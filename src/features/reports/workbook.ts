/** Genuine XLSX writer (ExcelJS). Deterministic metadata so frozen files keep stable content. */
import ExcelJS from 'exceljs';
import { REPORTS, COMMON_COLUMNS, REPORT_SNAPSHOT_AT, ReportType, ReportRow } from './catalog';

export async function buildWorkbook(type: ReportType, rows: ReportRow[], scope: string): Promise<Buffer> {
  const def = REPORTS.find((r) => r.type === type)!;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Hubfares POC'; wb.created = new Date(REPORT_SNAPSHOT_AT); wb.modified = new Date(REPORT_SNAPSHOT_AT);
  const ws = wb.addWorksheet('Transactions', { views: [{ state: 'frozen', ySplit: 2 }] });
  const cols = [...COMMON_COLUMNS, ...def.columns];
  ws.mergeCells(1, 1, 1, cols.length);
  ws.getCell(1, 1).value = `SAMPLE EXTRACT - NOT LIVE · ${def.title} · Fixture hubfares-v1.1-seed-002 · Frozen snapshot ${REPORT_SNAPSHOT_AT} · Scope: ${scope} · ${rows.length} rows`;
  ws.getCell(1, 1).font = { bold: true, color: { argb: 'FFB45309' } };
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
  [['Report', def.title], ['Category', def.category], ['Label', 'SAMPLE EXTRACT - NOT LIVE'], ['Fixture version', 'hubfares-v1.1-seed-002'], ['Snapshot timestamp', REPORT_SNAPSHOT_AT], ['Row scope', scope], ['Rows', String(rows.length)], ['Note', 'Preloaded sample report - static illustration; dashboard totals update during the demonstration. Synthetic data only.']].forEach((r) => about.addRow(r));
  about.getColumn(1).width = 22; about.getColumn(2).width = 90;
  return Buffer.from(await wb.xlsx.writeBuffer());
}
