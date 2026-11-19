/** Deterministic Sabre simulator — pure functions of input + fixture version + scenario switch. No network. */
import type { GdsAdapter, ImportedPnr } from './types';
import { loadFixture } from '@/server/db/seed';
import { AppError } from '@/shared/errors';

export const REVAL_CHANGE_DELTA_MINOR = 35000; // Data & Mocks §4.3: CHANGED +INR 350 sample
export const sabreMock: GdsAdapter = {
  provider: 'SABRE', mode: 'MOCK',
  revalidateFare(scenario) {
    if (scenario === 'reval_change') return { status: 'CHANGED', priceDeltaMinor: REVAL_CHANGE_DELTA_MINOR };
    if (scenario === 'reval_unavailable') return { status: 'UNAVAILABLE', priceDeltaMinor: 0 };
    return { status: 'SAME', priceDeltaMinor: 0 };
  },
  createBooking(scenario, seq) {
    if (scenario === 'booking_fail') return { ok: false, code: 'BOOKING_PROVIDER_SIM_FAILURE', message: 'The airline did not confirm this booking — no PNR was created and no funds were charged' };
    return { ok: true, pnr: `SBN${String(seq).padStart(3, '0')}` };
  },
  issueTicket(scenario, seqStart, paxCount) {
    if (scenario === 'ticket_fail') return { ok: false, code: 'TICKETING_SIM_FAILURE', message: 'Ticketing could not be completed by the airline — the hold was released and nothing was charged' };
    return { ok: true, ticketNumbers: Array.from({ length: paxCount }, (_, i) => `098-2400${String(seqStart + i).padStart(6, '0')}`) };
  },
  listPnrs() {
    return loadFixture<{ records: ImportedPnr[] }>('import-pnrs.json').records;
  },
  retrievePnr(pnr, pcc) {
    const recs = loadFixture<{ records: ImportedPnr[] }>('import-pnrs.json').records;
    return recs.find((r) => r.pnr === pnr.trim().toUpperCase() && r.pcc === pcc) ?? null;
  },
};
export function gdsAdapter(provider: string): GdsAdapter {
  if (process.env.DEMO_MODE && process.env.DEMO_MODE !== 'mock') throw new AppError('INTEGRATION_NOT_CONNECTED', 'Live GDS integrations are not configured in this POC');
  if (provider === 'SABRE') return sabreMock;
  throw new AppError('INTEGRATION_NOT_CONNECTED', `${provider} is a planned integration — adapter not connected in this POC`);
}
