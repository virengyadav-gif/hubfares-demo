import { api, fileResponse } from '@/server/http';
import { download, reportFilterSchema } from '@/features/reports/service';
import { audit } from '@/server/db/util';
export const GET = api({ perm: ['AGENCY_REPORTS', 'REPORTS_ALL'], query: reportFilterSchema }, async ({ db, ctx, params, query }) => {
  const r = await download(db, ctx, params.type, query);
  audit(db, { userId: ctx.userId, role: ctx.role }, 'REPORT_DOWNLOADED', 'report', params.type, ctx.agencyId, { rows: r.rows, scope: ctx.agencyId ?? 'ALL', ...query });
  return fileResponse(r.buf, r.filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});
