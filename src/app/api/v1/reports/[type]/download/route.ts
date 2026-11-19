import { api, fileResponse } from '@/server/http';
import { download } from '@/features/reports/service';
import { audit } from '@/server/db/util';
export const GET = api({ perm: ['AGENCY_REPORTS', 'REPORTS_ALL'] }, async ({ db, ctx, params }) => {
  const r = await download(ctx, params.type);
  audit(db, { userId: ctx.userId, role: ctx.role }, 'REPORT_DOWNLOADED', 'report', params.type, ctx.agencyId, { rows: r.rows, scope: ctx.agencyId ?? 'ALL' });
  return fileResponse(r.buf, r.filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});
