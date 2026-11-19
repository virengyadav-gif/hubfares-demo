/** Report catalogue + server-scoped XLSX downloads with date range and status filters. Never filtered in the browser. */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { SessionCtx } from '@/server/auth/session';
import { isHub } from '@/server/auth/authorize';
import { AppError } from '@/shared/errors';
import { nowIso } from '@/shared/time';
import type { Tx } from '@/server/db/util';
import { getMeta } from '@/server/db/util';
import { REPORTS, REPORT_SNAPSHOT_AT, ReportType, ReportRow, AGENCY_NAMES } from './catalog';
import { buildWorkbook, columnsFor } from './workbook';

let cache: Record<string, ReportRow[]> | null = null;
function baseRows(): Record<string, ReportRow[]> {
  if (!cache) cache = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'fixtures/reports/report-rows.json'), 'utf8')).reports;
  return cache!;
}
/** Report rows are a fixed dataset positioned relative to the environment's anchor date, so ranges like "last 30 days" stay meaningful. */
function rowsAsOf(db: Tx, type: ReportType): ReportRow[] {
  const anchor = getMeta(db, 'anchorUtc') ?? REPORT_SNAPSHOT_AT;
  const shiftDays = Math.round((Date.parse(anchor.slice(0, 10)) - Date.parse(REPORT_SNAPSHOT_AT.slice(0, 10))) / 86400000) - 1;
  const shift = (v: string | number) => { const t = Date.parse(String(v).replace(' ', 'T') + 'Z'); return Number.isNaN(t) ? v : new Date(t + shiftDays * 86400000).toISOString().slice(0, 16).replace('T', ' '); };
  return baseRows()[type].map((r) => ({ ...r, TransactionDate: shift(r.TransactionDate), ...(r.CancellationDate ? { CancellationDate: shift(r.CancellationDate) } : {}) }));
}
export function scopeFor(ctx: SessionCtx): { agencyId: string | null; label: string } {
  if (isHub(ctx)) return { agencyId: null, label: 'All agencies' };
  if (!ctx.agencyId) throw new AppError('FORBIDDEN', 'No agency scope');
  return { agencyId: ctx.agencyId, label: AGENCY_NAMES[ctx.agencyId] ?? ctx.agencyName ?? ctx.agencyId };
}
export const reportFilterSchema = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')), status: z.string().max(40).optional() });
export function filteredRows(db: Tx, ctx: SessionCtx, type: ReportType, f: z.infer<typeof reportFilterSchema> = {}) {
  const sc = scopeFor(ctx);
  return rowsAsOf(db, type).filter((r) => (!sc.agencyId || r.AgencyId === sc.agencyId)
    && (!f.from || String(r.TransactionDate).slice(0, 10) >= f.from) && (!f.to || String(r.TransactionDate).slice(0, 10) <= f.to)
    && (!f.status || r.Status === f.status));
}
export function catalog(db: Tx, ctx: SessionCtx) {
  const sc = scopeFor(ctx);
  return { scope: sc.label, generatedAt: nowIso(), reports: REPORTS.map((r) => {
    const rows = filteredRows(db, ctx, r.type);
    const dates = rows.map((x) => String(x.TransactionDate).slice(0, 10)).sort();
    return { type: r.type, title: r.title, category: r.category, filename: `${r.type}${sc.agencyId ? `-${sc.agencyId.replace('agency_', '')}` : ''}.xlsx`, rowCount: rows.length, columns: columnsFor(r.type, !sc.agencyId), statuses: [...new Set(rows.map((x) => String(x.Status)))].sort(), firstDate: dates[0] ?? null, lastDate: dates[dates.length - 1] ?? null };
  }) };
}
export async function download(db: Tx, ctx: SessionCtx, type: string, f: z.infer<typeof reportFilterSchema> = {}) {
  const def = REPORTS.find((r) => r.type === type);
  if (!def) throw new AppError('NOT_FOUND', 'Unknown report type');
  const sc = scopeFor(ctx);
  const rows = filteredRows(db, ctx, def.type, f);
  const period = f.from || f.to ? `${f.from || '…'} to ${f.to || '…'}` : undefined;
  const buf = await buildWorkbook(def.type, rows, { scope: sc.label, hub: !sc.agencyId, period, statusFilter: f.status, generatedAt: nowIso() });
  const suffix = [sc.agencyId ? sc.agencyId.replace('agency_', '') : null, f.from || null, f.to || null].filter(Boolean).join('_');
  return { buf, filename: `${def.type}${suffix ? `-${suffix}` : ''}.xlsx`, rows: rows.length };
}
