import { api } from '@/server/http';
import * as s from '@/server/db/schema';
export const GET = api({}, ({ db }) => db.select().from(s.fareRuleProfiles).all().map((p) => JSON.parse(p.dataJson)));
