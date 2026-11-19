import { api, ok } from '@/server/http';
import * as s from '@/server/db/schema';
export const GET = api({}, ({ db }) => ok(db.select().from(s.fxDemoRates).all().map((r) => ({ quoteCurrency: r.quoteCurrency, inrPerUnit: r.inrPerUnit, effectiveDate: r.effectiveDate, source: r.source })), { label: 'Exchange rates' }));
