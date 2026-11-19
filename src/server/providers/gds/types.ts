/** Provider-neutral GDS adapter contract (Technical Design §6.1). Mock only in DEMO_MODE=mock. */
export type RevalidationScenario = 'reval_same' | 'reval_change' | 'reval_unavailable';
export type BookingScenario = 'normal' | 'booking_fail';
export type TicketScenario = 'normal' | 'ticket_fail';
export type ImportedPnr = {
  provider: string; pcc: string; pnr: string; ownerAgencyId: string | null; airlinePnr: string | null;
  itinerary: { origin: string; destination: string; airlineCode: string; flightNumber: string; departureOffset: string; durationMin: number; cabin: string };
  passengers: string[]; ticketStatus: 'TICKETED' | 'NOT_ISSUED'; ticketNumbers: string[]; fareRuleProfileId: 'A_FLEXIBLE' | 'B_RESTRICTED';
  agencySellMinor: number; supplierCostMinor: number; bookedOffset: string; alreadyImportedAsBooking?: string;
};
export interface GdsAdapter {
  readonly provider: 'SABRE' | 'TRAVELPORT' | 'AMADEUS';
  readonly mode: 'MOCK' | 'UNAVAILABLE';
  revalidateFare(scenario: RevalidationScenario): { status: 'SAME' | 'CHANGED' | 'UNAVAILABLE'; priceDeltaMinor: number };
  createBooking(scenario: BookingScenario, seq: number): { ok: true; pnr: string } | { ok: false; code: 'BOOKING_PROVIDER_SIM_FAILURE'; message: string };
  issueTicket(scenario: TicketScenario, seqStart: number, paxCount: number): { ok: true; ticketNumbers: string[] } | { ok: false; code: 'TICKETING_SIM_FAILURE'; message: string };
  retrievePnr(pnr: string, pcc: string): ImportedPnr | null;
}
