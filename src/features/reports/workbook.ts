/** XLSX writer (ExcelJS). Hubfares-scope workbooks include internal supplier columns; agency-scope ones do not. */
import ExcelJS from 'exceljs';
import { REPORTS, COMMON_COLUMNS, HUB_ONLY_COLUMNS, REPORT_SNAPSHOT_AT, ReportType, ReportRow } from './catalog';

export type WorkbookOpts = { scope: string; hub: boolean; period?: string; statusFilter?: string; generatedAt?: string };
export function columnsFor(type: ReportType, hub: boolean): string[] {
  const def = REPORTS.find((r) => r.type === type)!;
  return [...COMMON_COLUMNS, ...def.columns].filter((c) => hub || !HUB_ONLY_COLUMNS.includes(c));
}
export async function buildWorkbook(type: ReportType, rows: ReportRow[], o: WorkbookOpts): Promise<Buffer> {
  const def = REPORTS.find((r) => r.type === type)!;
  const wb = new ExcelJS.Workbook();
  const stamp = new Date(o.generatedAt ?? REPORT_SNAPSHOT_AT);
  wb.creator = 'Hubfares'; wb.created = stamp; wb.modified = stamp;
  const ws = wb.addWorksheet('Transactions', { views: [{ state: 'frozen', ySplit: 2 }] });
  const cols = columnsFor(type, o.hub);
  ws.mergeCells(1, 1, 1, cols.length);
  ws.getCell(1, 1).value = [`${def.title}`, o.scope, o.period ? `Period ${o.period}` : null, `Status: ${o.statusFilter || 'All'}`, `${rows.length} rows`].filter(Boolean).join(' · ');
  ws.getCell(1, 1).font = { bold: true, color: { argb: 'FF25272B' } };
  ws.getRow(2).values = cols;
  ws.getRow(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(2).eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF25272B' } }; });
  rows.forEach((r) => ws.addRow(cols.map((c) => r[c] ?? '')));
  cols.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = Math.max(12, Math.min(34, c.length + 4));
    if (c.endsWith('INR')) col.numFmt = '#,##0.00';
  });
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: cols.length } };
  const about = wb.addWorksheet('About');
  [['Report', def.title], ['Category', def.category], ['Scope', o.scope], ['Period', o.period ?? 'All dates'], ['Status filter', o.statusFilter || 'All'], ['Rows', String(rows.length)], ['Generated', stamp.toISOString()]].forEach((r) => about.addRow(r));
  about.getColumn(1).width = 22; about.getColumn(2).width = 70;
  return Buffer.from(await wb.xlsx.writeBuffer());
}
