import { eq } from 'drizzle-orm';
import { api } from '@/server/http';
import * as s from '@/server/db/schema';
import { AppError } from '@/shared/errors';
export const GET = api({}, ({ db, params }) => { const p = db.select().from(s.fareRuleProfiles).where(eq(s.fareRuleProfiles.id, params.id)).get(); if (!p) throw new AppError('NOT_FOUND', 'Only A_FLEXIBLE and B_RESTRICTED exist'); return JSON.parse(p.dataJson); });
