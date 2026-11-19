'use client';
/** OTA-06 / OTA-07 — Review, revalidate, travellers, funding check, PNR, then separate simulated ticket issuance (WF-09). */
import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, RefreshCw, Ticket, Plane, CheckCircle2, AlertTriangle, Wrench, ArrowRight } from 'lucide-react';
import { apiFetch, useApi, inr, fmtTime, fmtDay, dur, newKey, ApiError } from '@/lib/client';
import { Button, Card, Field, Input, Select, Notice, Badge, Status, SimTag, PageHeader, Loading, ErrorBox, cx, useToast } from '@/components/ui';
import { Price, FxNotice, CurrencySwitcher } from '@/components/flight/currency';
import { ProfileBadge } from '@/components/flight/FareRules';
import { useSession, can } from '@/components/shell/AppShell';

type Pax = { title: 'Mr' | 'Ms' | 'Mx'; firstName: string; lastName: string };
export default function BookPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = use(params);
  const session = useSession(); const toast = useToast();
  const [qid, setQid] = useState(quoteId);
  const q = useApi<any>(`/quotes/${qid}`, [qid]);
  const wallet = useApi<any>(can(session, 'AGENCY_FINANCE_VIEW') ? '/wallet' : null);
  const [reval, setReval] = useState<any>(null); const [busy, setBusy] = useState<string | null>(null);
  const [pax, setPax] = useState<Pax[]>([]); const [email, setEmail] = useState('ops@agency.example.com');
  const [booking, setBooking] = useState<any>(null); const [ticket, setTicket] = useState<any>(null); const [err, setErr] = useState<ApiError | null>(null);
  const [scn, setScn] = useState({ reval: 'reval_same', book: 'normal', ticket: 'normal' }); const [showOps, setShowOps] = useState(false);
  const bookKey = useRef(newKey()); const ticketKey = useRef(newKey());
  useEffect(() => { if (q.data && !pax.length) setPax(Array.from({ length: q.data.passengers.adults }, () => ({ title: 'Ms', firstName: '', lastName: '' }))); }, [q.data, pax.length]);
  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const quote = q.data;
  const status = quote.status;
  const total = quote.sellAmount.amountMinor;
  const enough = wallet.data ? wallet.data.spendingPowerMinor >= total : true;

  async function revalidate() {
    setBusy('reval'); setErr(null);
    try { const r = await apiFetch<any>(`/quotes/${qid}/revalidate`, { body: { scenario: scn.reval } }); setReval(r.data); if (r.data.status === 'CHANGED') setQid(r.data.quote.quoteId); await q.reload(); }
    catch (e: any) { setErr(e); } finally { setBusy(null); }
  }
  async function decide(accept: boolean) { setBusy('accept'); try { await apiFetch(`/quotes/${qid}/accept`, { body: { accept } }); setReval({ ...reval, decided: accept }); await q.reload(); } catch (e: any) { setErr(e); } finally { setBusy(null); } }
  async function book() {
    if (pax.some((p) => !p.firstName.trim() || !p.lastName.trim())) { setErr(new ApiError('VALIDATION_ERROR', 'Enter first and last name for every traveller (letters only).', 422)); return; }
    setBusy('book'); setErr(null);
    try {
      const r = await apiFetch<any>('/bookings', { idem: bookKey.current, body: { quoteId: qid, passengers: pax, contactEmail: email, scenario: scn.book } });
      setBooking(r.data);
      if (r.data.bookingStatus === 'BOOKING_FAILED') toast({ tone: 'error', title: 'Simulated provider failure', body: 'No PNR was created and the funding hold was released.' });
      else toast({ tone: 'success', title: `PNR ${r.data.gdsPnr} created (simulated)`, body: 'Funds are on hold. Issue the ticket to charge.' });
      wallet.reload();
    } catch (e: any) { setErr(e); } finally { setBusy(null); }
  }
  async function issue() {
    setBusy('ticket'); setErr(null);
    try {
      const r = await apiFetch<any>(`/bookings/${booking.bookingId}/issue-ticket`, { idem: ticketKey.current, body: { scenario: scn.ticket } });
      setTicket(r.data);
      if (r.data.bookingStatus === 'TICKETING_FAILED') toast({ tone: 'error', title: 'Simulated ticketing failure', body: 'Hold released — no charge posted.' });
      else toast({ tone: 'success', title: 'Ticket issued (simulated)', body: r.data.ticketNumbers.join(', ') });
      wallet.reload();
    } catch (e: any) { setErr(e); } finally { setBusy(null); }
  }
  const step = ticket ? 4 : booking ? 3 : status === 'REVALIDATED' ? 2 : 1;
  return (
    <div>
      <PageHeader eyebrow="Book a flight" title={booking ? 'Booking confirmation' : 'Review & book'} subtitle={`${quote.tripType === 'ROUND_TRIP' ? 'Return itinerary — one quote, one PNR, one ticket per adult, one funding charge' : 'One-way itinerary'} · Quote ${quote.quoteId}`} badges={<Status value={status} />} actions={<CurrencySwitcher />} />
      <ol className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">{['Revalidate fare', 'Travellers & funding', 'PNR created', 'Ticket issued'].map((l, i) => <li key={l} className={cx('flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold', step > i + 1 ? 'border-ok-600/30 bg-ok-50 text-ok-600' : step === i + 1 ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line bg-white text-muted')}><span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs ring-1 ring-current">{step > i + 1 ? '✓' : i + 1}</span>{l}</li>)}</ol>
      {err && <Notice tone="error" className="mb-4" title={err.code === 'INSUFFICIENT_FUNDS' ? 'Insufficient spending power' : err.code === 'QUOTE_EXPIRED' ? 'Quote expired' : 'Action failed'}>{err.message}{err.code === 'QUOTE_EXPIRED' && <> — <Link className="font-semibold underline" href="/agency/search">search again</Link></>}{err.code === 'INSUFFICIENT_FUNDS' && can(session, 'AGENCY_PAYMENT_INIT') && <> — <Link className="font-semibold underline" href="/agency/wallet">add demo funds</Link></>}</Notice>}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card title="Itinerary" actions={<SimTag kind="Simulated Sabre response" />}>
            <div className="space-y-4">
              {quote.segments.map((s: any) => (
                <div key={s.legIndex} className="rounded-lg border border-line p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2"><Badge tone="dark">{s.direction === 'OUTBOUND' ? 'Outbound' : 'Inbound'}</Badge><span className="font-semibold">{s.airlineName} · {s.flightNumber}</span><Badge tone="orange">{s.brand.brandName}</Badge><ProfileBadge id={s.fareRuleProfileId} /></div>
                  <div className="flex items-center gap-4"><div><div className="text-lg font-bold">{fmtTime(s.departureAt, s.originTz)}</div><div className="text-xs text-muted">{s.origin} · {fmtDay(s.departureAt, s.originTz)}</div></div><div className="flex-1 text-center text-xs text-muted">{dur(s.durationMin)} · {s.stops === 0 ? 'Non-stop' : `via ${s.via}`}<div className="my-1 h-px bg-line" /></div><div className="text-right"><div className="text-lg font-bold">{fmtTime(s.arrivalAt, s.destinationTz)}</div><div className="text-xs text-muted">{s.destination} · {fmtDay(s.arrivalAt, s.destinationTz)}</div></div></div>
                  <div className="mt-3 grid gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-2">
                    {s.priceComponents.map((c: any) => <div key={c.key} className="flex justify-between"><span className="text-muted">{({ supplierBase: 'Supplier base', supplierTax: 'Supplier taxes', revalidationPriceChange: 'Revalidation change', hubfaresFixedFee: 'Hubfares fixed fee', hubfaresPercentFee: 'Hubfares % fee', disclosedServiceFee: 'Disclosed service fee' } as any)[c.key]}</span><span className={cx('tabular', c.key === 'revalidationPriceChange' && 'font-semibold text-warn-600')}>{inr(c.amountMinor)}</span></div>)}
                    <div className="flex justify-between font-semibold sm:col-span-2"><span>Leg price per adult</span><Price minor={s.legSellAmount.amountMinor} size="sm" /></div>
                    <div className="text-[11px] text-muted sm:col-span-2">Applied: {s.rationale}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          {step === 1 && (
            <Card title="1 · Revalidate with provider" subtitle="Every leg is re-checked before booking. If the price changes you must accept the full new itinerary total.">
              {reval?.status === 'UNAVAILABLE' ? <Notice tone="error" title="Fare unavailable">{reval.message} <Link href="/agency/search" className="font-semibold underline">Search again</Link></Notice>
                : status === 'PRICE_CHANGED' ? (
                  <div className="space-y-3"><Notice tone="warn" title="Price changed on revalidation">{reval?.message} New itinerary total <b>{inr(total)}</b>{reval?.previousQuote && <> (was {inr(reval.previousQuote.sellAmount.amountMinor)})</>}.</Notice><div className="flex gap-2"><Button onClick={() => decide(true)} loading={busy === 'accept'}>Accept new total</Button><Button variant="secondary" onClick={() => decide(false)}>Decline</Button></div></div>
                ) : status === 'DECLINED' ? <Notice tone="info" title="Revised price declined">No booking or charge was made. <Link href="/agency/search" className="font-semibold underline">Back to search</Link></Notice>
                : <Button icon={<RefreshCw className="h-4 w-4" />} loading={busy === 'reval'} onClick={revalidate} data-testid="revalidate">Revalidate {quote.segments.length > 1 ? 'both legs' : 'fare'}</Button>}
            </Card>
          )}
          {step === 2 && (
            <Card title="2 · Travellers" subtitle="Synthetic names only. Adult travellers (child/infant fares are not defined in the demo).">
              <Notice tone="success" className="mb-4">Fare revalidated with the simulated Sabre adapter — price confirmed.</Notice>
              <div className="space-y-3">{pax.map((p, i) => <div key={i} className="grid gap-3 sm:grid-cols-[100px_1fr_1fr]"><Field label={`Adult ${i + 1}`}><Select value={p.title} onChange={(e) => setPax(pax.map((x, j) => (j === i ? { ...x, title: e.target.value as any } : x)))}><option>Mr</option><option>Ms</option><option>Mx</option></Select></Field><Field label="First name"><Input value={p.firstName} onChange={(e) => setPax(pax.map((x, j) => (j === i ? { ...x, firstName: e.target.value } : x)))} name={`pax${i}-first`} /></Field><Field label="Last name"><Input value={p.lastName} onChange={(e) => setPax(pax.map((x, j) => (j === i ? { ...x, lastName: e.target.value } : x)))} name={`pax${i}-last`} /></Field></div>)}</div>
              <Field label="Agency contact email" className="mt-3"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><p className="max-w-md text-xs text-muted">Confirming creates one simulated PNR and places a funding hold for the itinerary total. No airline is contacted. The refund payout policy in force now is snapshotted to this booking.</p><Button size="lg" icon={<ShieldCheck className="h-4 w-4" />} loading={busy === 'book'} onClick={book} disabled={!enough} data-testid="confirm-booking">Confirm booking</Button></div>
            </Card>
          )}
          {booking && (
            <Card title={booking.bookingStatus === 'BOOKING_FAILED' ? 'Booking failed (simulated)' : ticket?.bookingStatus === 'TICKETED' ? 'Ticket issued' : '3 · PNR created — ticket pending'} actions={<SimTag kind="Simulated" />}>
              {booking.bookingStatus === 'BOOKING_FAILED' ? <Notice tone="error" title={booking.error.message}>Booking {booking.bookingId} recorded as failed; the funding hold was released and nothing was charged.</Notice> : (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-muted">Booking ID</div><div className="font-bold" data-testid="booking-id">{booking.bookingId}</div></div>
                    <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-muted">Simulated GDS PNR</div><div className="font-bold tracking-wider" data-testid="pnr">{booking.gdsPnr}</div></div>
                    <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-muted">Ticket</div><div className="font-bold" data-testid="ticket-number">{ticket?.ticketNumbers?.join(', ') ?? (ticket?.bookingStatus === 'TICKETING_FAILED' ? 'Failed' : 'Not yet issued')}</div></div>
                  </div>
                  {!ticket && <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted">PNR creation and ticket issuance are separate steps. Issuing will consume the hold and post one ledger charge.</p><Button size="lg" icon={<Ticket className="h-4 w-4" />} loading={busy === 'ticket'} onClick={issue} data-testid="issue-ticket">Issue ticket</Button></div>}
                  {ticket?.bookingStatus === 'TICKETED' && <Notice tone="success" title="Ticketed (simulated)">Wallet debit {inr(ticket.walletDebitMinor)}{ticket.creditDrawMinor ? ` · credit draw ${inr(ticket.creditDrawMinor)}` : ''}. Visible now in Manage Booking, Passbook, Operations and executive dashboards.</Notice>}
                  {ticket?.bookingStatus === 'TICKETING_FAILED' && <Notice tone="error" title="Ticketing failed (simulated)">{ticket.error.message}</Notice>}
                  <div className="flex flex-wrap gap-2"><Link href={`/agency/bookings/${booking.bookingId}`}><Button variant="secondary" icon={<ArrowRight className="h-4 w-4" />}>Open booking</Button></Link>{ticket && <Link href="/agency/passbook"><Button variant="ghost">View passbook</Button></Link>}<Link href="/agency/search"><Button variant="ghost" icon={<Plane className="h-4 w-4" />}>New search</Button></Link></div>
                </div>
              )}
            </Card>
          )}
        </div>
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card title="Price summary">
            <div className="space-y-2 text-sm">
              {quote.segments.map((s: any) => <div key={s.legIndex} className="flex justify-between"><span className="text-muted">{s.origin}–{s.destination} × {quote.passengers.adults}</span><span className="tabular">{inr(s.legSellAmount.amountMinor * quote.passengers.adults)}</span></div>)}
              <div className="flex items-end justify-between border-t border-line pt-3"><span className="font-semibold">Total (INR)</span><Price minor={total} size="xl" /></div>
              <FxNotice />
              <p className="text-[11px] text-muted">Your agency&apos;s downstream markup (if configured) is UI-only and not included.</p>
            </div>
          </Card>
          {wallet.data && (
            <Card title="Funding check">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted">Available wallet</span><span className="tabular">{inr(wallet.data.availableWalletMinor)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Available credit</span><span className="tabular">{inr(wallet.data.availableCreditMinor)}</span></div>
                {wallet.data.creditBlocked && <div className="text-xs text-bad-600">{wallet.data.blockReason}</div>}
                <div className="flex justify-between border-t border-line pt-1.5 font-semibold"><span>Spending power</span><span className="tabular">{inr(wallet.data.spendingPowerMinor)}</span></div>
                {!booking && <div className={cx('mt-2 flex items-center gap-1.5 text-xs font-semibold', enough ? 'text-ok-600' : 'text-bad-600')}>{enough ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}{enough ? 'Sufficient for this itinerary' : 'Insufficient — add funds or adjust'}</div>}
              </div>
            </Card>
          )}
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-3 text-xs">
            <button onClick={() => setShowOps((x) => !x)} className="flex w-full items-center gap-1.5 font-semibold text-muted"><Wrench className="h-3.5 w-3.5" />Operator mock scenarios {showOps ? '▴' : '▾'}</button>
            {showOps && <div className="mt-2 space-y-2"><p className="text-muted">Deterministic Sabre-mock outcomes for rehearsal. Hidden from client view by default.</p>
              <Field label="Revalidation"><Select value={scn.reval} onChange={(e) => setScn({ ...scn, reval: e.target.value })} data-testid="scn-reval"><option value="reval_same">Same price</option><option value="reval_change">Price changes (+₹350)</option><option value="reval_unavailable">Unavailable</option></Select></Field>
              <Field label="Booking"><Select value={scn.book} onChange={(e) => setScn({ ...scn, book: e.target.value })}><option value="normal">Normal</option><option value="booking_fail">Provider failure</option></Select></Field>
              <Field label="Ticketing"><Select value={scn.ticket} onChange={(e) => setScn({ ...scn, ticket: e.target.value })}><option value="normal">Normal</option><option value="ticket_fail">Ticketing failure</option></Select></Field>
            </div>}
          </div>
        </aside>
      </div>
    </div>
  );
}
