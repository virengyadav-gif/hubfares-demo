/** Static sample report catalogue + server-scoped XLSX downloads (WF-18). Never filtered in the browser. */
import fs from 'node:fs';
import path from 'node:path';
import type { SessionCtx } from '@/server/auth/session';
import { isHub } from '@/server/auth/authorize';
import { AppError } from '@/shared/errors';
import { REPORTS, REPORT_SNAPSHOT_AT, ReportType, ReportRow, AGENCY_NAMES } from './catalog';
import { buildWorkbook } from './workbook';

let cache: Record<string, ReportRow[]> | null = null;
function frozenRows(): Record<string, ReportRow[]> {
  if (!cache) cache = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'fixtures/reports/report-rows.json'), 'utf8')).reports;
  return cache!;
}
export function scopeFor(ctx: SessionCtx): { agencyId: string | null; label: string } {
  if (isHub(ctx)) return { agencyId: null, label: 'All agencies (authorised Hubfares role)' };
  if (!ctx.agencyId) throw new AppError('FORBIDDEN', 'No agency scope');
  return { agencyId: ctx.agencyId, label: `${AGENCY_NAMES[ctx.agencyId] ?? ctx.agencyName} only (server-scoped)` };
}
export function catalog(ctx: SessionCtx) {
  const sc = scopeFor(ctx);
  const rows = frozenRows();
  return { snapshotAt: REPORT_SNAPSHOT_AT, scope: sc.label, static: true, notice: 'Preloaded sample report - static illustration; dashboard totals update during the demonstration.', reports: REPORTS.map((r) => ({ type: r.type, title: r.title, category: r.category, filename: `${r.type}${sc.agencyId ? `-${sc.agencyId.replace('agency_', '')}` : ''}.xlsx`, rowCount: rows[r.type].filter((x) => !sc.agencyId || x.AgencyId === sc.agencyId).length, columns: r.columns })) };
}
export async function download(ctx: SessionCtx, type: string) {
  const def = REPORTS.find((r) => r.type === type);
  if (!def) throw new AppError('NOT_FOUND', 'Unknown report type');
  const sc = scopeFor(ctx);
  if (!sc.agencyId) {
    const file = path.resolve(process.cwd(), `fixtures/reports/${def.type}.xlsx`);
    return { buf: fs.readFileSync(file), filename: `${def.type}.xlsx`, rows: 100 };
  }
  const rows = frozenRows()[def.type].filter((r) => r.AgencyId === sc.agencyId).map((r) => ({ ...r, ReportScope: `AGENCY_SCOPED:${sc.agencyId}` }));
  const buf = await buildWorkbook(def.type as ReportType, rows, sc.label);
  return { buf, filename: `${def.type}-${sc.agencyId.replace('agency_', '')}.xlsx`, rows: rows.length };
}
