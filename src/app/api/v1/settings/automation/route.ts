import { z } from 'zod';
import { api, ok } from '@/server/http';
import { getMeta, setMeta, audit } from '@/server/db/util';
const AUTOMATION_RULES = ['Auto-assign chatbot refund cases to the Operations queue', 'Alert Finance when a payment is unmatched for more than 2 hours', 'Notify the agency when wallet balance falls below ₹25,000', 'Escalate supplier refunds pending more than 7 days', 'Auto-route applications to review once all verification checks are green', 'Send booking confirmations to agencies by email'];
const DEFAULT = [true, true, false, true, false, true];
const read = (db: any): boolean[] => { const v = getMeta(db, 'automationSettings'); try { const a = v ? JSON.parse(v) : DEFAULT; return AUTOMATION_RULES.map((_, i) => a[i] ?? DEFAULT[i]); } catch { return DEFAULT; } };
export const GET = api({ perm: 'POLICY_EDIT' }, ({ db }) => ok({ rules: AUTOMATION_RULES.map((label, i) => ({ id: i, label, enabled: read(db)[i] })) }));
export const PUT = api({ perm: 'POLICY_EDIT', body: z.object({ id: z.number().int().min(0).max(AUTOMATION_RULES.length - 1), enabled: z.boolean() }) }, ({ db, ctx, body }) => {
  const cur = read(db); cur[body.id] = body.enabled;
  setMeta(db, 'automationSettings', JSON.stringify(cur));
  audit(db, { userId: ctx.userId, role: ctx.role }, 'AUTOMATION_SETTING_CHANGED', 'setting', `automation:${body.id}`, null, { label: AUTOMATION_RULES[body.id], enabled: body.enabled });
  return ok({ rules: AUTOMATION_RULES.map((label, i) => ({ id: i, label, enabled: cur[i] })) });
});
