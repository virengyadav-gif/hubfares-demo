'use client';
/** OTA-09/10/11 & OPS booking servicing — detail, (partial) cancellation with PNR split, date change with reissue, refund tracking, history. */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Ticket, XCircle, LifeBuoy, CalendarClock, ArrowLeft, Plane, GitFork, Users } from 'lucide-react';
import { apiFetch, useApi, inr, fmtDate, fmtTime, fmtDay, newKey } from '@/lib/client';
import { Button, Card, Badge, Status, Notice, Modal, Loading, ErrorBox, PageHeader, Table, Td, Tabs, Select, Input, Field, BusyOverlay, useToast, cx } from '@/components/ui';
import { RuleTables, ProfileBadge } from '@/components/flight/FareRules';
import { Price } from '@/components/flight/currency';
import { useSession, can } from '@/components/shell/AppShell';
import { openHelp } from '@/components/support/HelpChat';

const PAYOUT_LABEL: Record<string, string> = { SUPPLIER_SETTLEMENT: 'Refund after airline refund is received', IMMEDIATE_IF_ELIGIBLE: 'Immediate refund to wallet' };
const HISTORY_TONE: Record<string, string> = { BOOKED: 'blue', BOOKING_PNR_CREATED: 'blue', TICKET_ISSUED: 'green', TICKET_REISSUED: 'violet', PNR_SPLIT: 'amber', PNR_SPLIT_CREATED: 'amber', BOOKING_CANCELLED: 'red', TICKETING_FAILED: 'red', BOOKING_FAILED: 'red', PNR_IMPORTED: 'blue' };

export function BookingDetail({ id, back }: { id: string; back: string }) {
  const session = useSession(); const toast = useToast();
  const { data: b, loading, error, reload } = useApi<any>(`/bookings/${id}`, [id]);
  const [cancelOpen, setCancelOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'itin' | 'rules' | 'money' | 'refund' | 'history'>('itin');
  const [amend, setAmend] = useState(false);
  const tktKey = useRef(newKey());
  useEffect(() => { if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('amend') === '1') setAmend(true); }, []);
  if (loading && !b) return <Loading />;
  if (error) return <div className="space-y-3"><ErrorBox error={error} /><Link href={back} className="text-sm font-semibold text-brand-700">← Back to bookings</Link></div>;
  const canCancel = can(session, ['AGENCY_CANCEL', 'BOOKING_SERVICE_ALL']);
  const canAmend = can(session, ['AGENCY_AMEND', 'AMENDMENT_MANAGE']);
  async function issue() { if (busy) return; setBusy(true); try { await apiFetch(`/bookings/${id}/issue-ticket`, { idem: tktKey.current, body: {}, quiet: true }); toast({ tone: 'success', title: 'Ticket issued' }); reload(); } catch (e: any) { toast({ tone: 'error', title: 'Ticketing failed', body: e.message }); } finally { setBusy(false); } }
  const claim = b.refundClaim;
  const live = b.tickets.filter((t: any) => t.status !== 'EXCHANGED');
  const base = back.replace(/\/$/, '');
  return (
    <div>
      <BusyOverlay show={busy} title="Issuing ticket…" detail="Please wait — do not refresh this page." />
      <Link href={back} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-navy"><ArrowLeft className="h-4 w-4" />Bookings</Link>
      <PageHeader title={<span data-testid="detail-id">{b.bookingId}</span>} subtitle={`${b.routeSummary} · ${b.tripType === 'ROUND_TRIP' ? 'Return' : 'One-way'} · ${b.passengers.length} passenger${b.passengers.length === 1 ? '' : 's'} · ${b.agencyName} · booked ${fmtDate(b.bookedAt)}`}
        badges={<><Status value={b.bookingStatus} />{b.source !== 'PORTAL' && <Badge tone={b.source === 'IMPORTED' ? 'blue' : 'violet'}>{b.source === 'IMPORTED' ? 'Imported PNR' : 'Offline booking'}</Badge>}{b.parentBookingId && <Badge tone="amber" icon={<GitFork className="h-3 w-3" />}>Split PNR</Badge>}</>}
        actions={<>
          {b.bookingStatus === 'PNR_CREATED' && b.reservation?.status === 'ACTIVE' && can(session, ['AGENCY_BOOK', 'BOOKING_SERVICE_ALL']) && <Button icon={<Ticket className="h-4 w-4" />} loading={busy} disabled={busy} onClick={issue}>Issue ticket</Button>}
          {b.bookingStatus === 'TICKETED' && canAmend && b.source !== 'MANUAL_DEMO' && <Button variant="secondary" icon={<CalendarClock className="h-4 w-4" />} onClick={() => setAmend(true)} data-testid="change-date">Change date</Button>}
          {b.bookingStatus === 'TICKETED' && canCancel && <Button variant="danger" icon={<XCircle className="h-4 w-4" />} onClick={() => setCancelOpen(true)} data-testid="cancel-quote">Cancel</Button>}
          {!session.isHub && b.pnr && can(session, 'AGENCY_SUPPORT') && <Button variant="ghost" icon={<LifeBuoy className="h-4 w-4" />} onClick={() => openHelp(b.pnr.gdsPnr)}>Need help</Button>}
        </>} />
      {b.failureReason && <Notice tone="error" className="mb-4" title="Booking not completed">{b.failureReason}</Notice>}
      {b.parentBookingId && <Notice tone="info" className="mb-4" title="Split from another booking">These passengers were moved out of <Link href={`${base}/${b.parentBookingId}`} className="font-semibold underline">{b.parentBookingId}</Link> into their own PNR.</Notice>}
      {b.splitChildren.length > 0 && (
        <Card className="mb-5" title={<span className="flex items-center gap-2"><GitFork className="h-4 w-4 text-brand-500" />Split PNRs</span>} subtitle="Passengers moved to separate PNRs (for partial cancellation). The remaining passengers stay on this booking.">
          <Table dense head={['Booking', 'PNR', 'Passengers', 'Amount', 'Status']}>
            {b.splitChildren.map((c: any) => <tr key={c.bookingId}><Td><Link href={`${base}/${c.bookingId}`} className="font-semibold text-brand-700 hover:underline" data-testid={`split-${c.bookingId}`}>{c.bookingId}</Link></Td><Td className="font-mono">{c.gdsPnr}</Td><Td>{c.passengers.join(', ')}</Td><Td className="tabular">{inr(c.amountMinor)}</Td><Td><Status value={c.status} /></Td></tr>)}
          </Table>
        </Card>
      )}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Mini l="PNR" v={<span className="font-mono tracking-wider" data-testid="detail-pnr">{b.pnr?.gdsPnr ?? '—'}</span>} s={b.pnr ? (session.isHub && b.pnr.pcc ? `${b.pnr.provider} · PCC ${b.pnr.pcc}` : b.pnr.airlinePnr ? `Airline PNR ${b.pnr.airlinePnr}` : 'Confirmed') : 'No PNR'} />
        <Mini l={`Ticket${live.length === 1 ? '' : 's'}`} v={<span className="font-mono text-[14px]">{live.length ? `${live.length} ticket${live.length === 1 ? '' : 's'}` : '—'}</span>} s={live.length ? `${live[0].status.toLowerCase()}${live[0].imported ? ' · imported' : ''}` : 'Not issued'} />
        <Mini l="Amount (INR)" v={<Price minor={b.amount.amountMinor} size="lg" />} s={`Funding: ${b.fundingType.toLowerCase()}`} />
        <Mini l="Refund policy" v={<span className="text-[14px]">{PAYOUT_LABEL[b.refundPolicySnapshot.payoutMode] ?? b.refundPolicySnapshot.payoutMode}</span>} s={`Locked at booking · v${b.refundPolicySnapshot.version}`} />
        <Mini l="Payment" v={<Status value={b.paymentStatus} />} s={b.reservation ? `Hold ${b.reservation.status.toLowerCase()}` : '—'} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'itin', label: 'Itinerary & passengers' }, { id: 'rules', label: 'Fare rules' }, { id: 'money', label: 'Account impact', count: b.walletEntries.length + b.creditEntries.length }, { id: 'refund', label: 'Cancellation & refund' }, { id: 'history', label: 'History', count: b.history.length }]} className="mb-4" />
      {tab === 'itin' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <Card title="Flights">
            <div className="space-y-3">{b.segments.map((s: any) => (
              <div key={s.legIndex} className="rounded-lg border border-line p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2"><Badge tone="dark">{s.direction === 'OUTBOUND' ? 'Outbound' : 'Inbound'}</Badge><span className="font-semibold">{s.airlineName} · {s.flightNumber}</span>{s.brandName && <Badge tone="orange">{s.brandName}</Badge>}<ProfileBadge id={s.fareRuleProfileId} /></div>
                <div className="flex items-center gap-4 text-sm"><div><b className="text-base">{fmtTime(s.departureAt, s.originTz)}</b><div className="text-xs text-muted">{s.origin} · {fmtDay(s.departureAt, s.originTz)}</div></div><Plane className="h-4 w-4 text-brand-500" /><div><b className="text-base">{fmtTime(s.arrivalAt, s.destinationTz)}</b><div className="text-xs text-muted">{s.destination} · {fmtDay(s.arrivalAt, s.destinationTz)}</div></div><div className="ml-auto text-right"><div className="font-semibold tabular">{inr(s.segmentSellMinor)}</div><div className="text-[11px] text-muted">{b.passengers.length > 1 ? `${b.passengers.length} passengers` : 'fare'}</div></div></div>
              </div>
            ))}</div>
          </Card>
          <Card title={<span className="flex items-center gap-2"><Users className="h-4 w-4" />Passengers</span>}>
            <div className="divide-y divide-line">{b.passengers.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm" data-testid={`pax-${p.id}`}>
                <div><div className="font-medium">{p.displayName}</div><div className="font-mono text-[11.5px] text-muted">{p.ticketNumber ?? 'No ticket yet'}</div></div>
                {p.ticketStatus ? <Status value={p.ticketStatus} /> : <span className="text-xs text-muted">{p.travelerType.toLowerCase()}</span>}
              </div>
            ))}</div>
            {b.tickets.some((t: any) => t.status === 'EXCHANGED') && <p className="mt-3 text-[11.5px] text-muted">Exchanged tickets: {b.tickets.filter((t: any) => t.status === 'EXCHANGED').map((t: any) => t.ticketNumber).join(', ')}</p>}
          </Card>
        </div>
      )}
      {tab === 'rules' && <Card><div className="space-y-8">{b.segments.map((s: any) => <RuleTables key={s.legIndex} profile={s.fareRuleSnapshot} route={`${s.origin}-${s.destination}`} />)}</div><p className="mt-4 text-xs text-muted">Charges are per passenger per flight, taken from the fare rules locked at booking.</p></Card>}
      {tab === 'money' && (
        <Card title="Account entries for this booking" subtitle="Wallet and credit movements linked to this booking — the same entries appear in your passbook.">
          {!b.walletEntries.length && !b.creditEntries.length ? <p className="text-sm text-muted">No account movements for this booking{b.parentBookingId ? ` (charged on ${b.parentBookingId})` : ''}.</p> : (
            <Table head={['Account', 'Type', 'Description', 'Date', 'Amount']}>
              {b.walletEntries.map((e: any) => <tr key={e.id}><Td><Badge tone="blue">Wallet</Badge></Td><Td>{e.type.replace(/_/g, ' ').toLowerCase()}</Td><Td>{e.description}</Td><Td className="text-muted">{fmtDate(e.createdAt)}</Td><Td className={cx('text-right font-semibold tabular', e.direction === 'CREDIT' ? 'text-ok-600' : 'text-bad-600')}>{e.direction === 'CREDIT' ? '+' : '−'}{inr(e.amountMinor)}</Td></tr>)}
              {b.creditEntries.map((e: any) => <tr key={e.id}><Td><Badge tone="violet">Credit</Badge></Td><Td>{e.type.toLowerCase()}</Td><Td>{e.description}{e.dueAt && <span className="text-muted"> · due {fmtDate(e.dueAt)}</span>}</Td><Td className="text-muted">{fmtDate(e.createdAt)}</Td><Td className="text-right font-semibold tabular">{inr(e.amountMinor)}</Td></tr>)}
            </Table>
          )}
        </Card>
      )}
      {tab === 'refund' && <RefundPanel b={b} claim={claim} isHub={session.isHub} />}
      {tab === 'history' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <Card title="Booking history" subtitle="Every change to this booking, newest last.">
            <ol className="relative space-y-4 border-l border-line pl-5" data-testid="history">
              {b.history.map((h: any, i: number) => (
                <li key={i} className="relative">
                  <span className={cx('absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white', ({ green: 'bg-ok-600', red: 'bg-bad-600', amber: 'bg-warn-600', violet: 'bg-violet-600', blue: 'bg-info-600' } as any)[HISTORY_TONE[h.action] ?? 'blue'] ?? 'bg-slate-400')} />
                  <div className="text-sm font-semibold">{h.detail}</div>
                  <div className="text-xs text-muted">{fmtDate(h.occurredAt)}{h.actorName ? ` · ${h.actorName}` : ''}</div>
                </li>
              ))}
            </ol>
          </Card>
          <Card title="Related">
            {!b.amendments.length && !b.supportCases.length && <p className="text-sm text-muted">No amendments or support cases.</p>}
            {b.amendments.length > 0 && <div className="mb-3 space-y-1.5">{b.amendments.map((a: any) => <div key={a.id} className="flex items-center justify-between gap-2 text-sm"><span>{a.id} · Date change {a.quote?.fromDate} → {a.quote?.toDate}</span><Status value={a.status} /></div>)}</div>}
            {b.supportCases.length > 0 && <div className="space-y-1.5">{b.supportCases.map((c: any) => <div key={c.id} className="flex items-center justify-between text-sm"><span>{c.id} · {c.category.replace(/_/g, ' ').toLowerCase()}</span><Status value={c.status} /></div>)}</div>}
          </Card>
        </div>
      )}
      {cancelOpen && <CancelModal b={b} onClose={(done) => { setCancelOpen(false); if (done) { reload(); setTab('refund'); } }} />}
      {amend && <DateChangeModal booking={b} onClose={(done) => { setAmend(false); if (done) { reload(); setTab('history'); } }} />}
    </div>
  );
}
function Mini({ l, v, s }: { l: string; v: React.ReactNode; s?: React.ReactNode }) {
  return <div className="rounded-xl border border-line bg-white p-3.5 shadow-[var(--shadow-card)]"><div className="text-[11.5px] font-semibold text-muted">{l}</div><div className="mt-1 text-[17px] font-bold">{v}</div>{s && <div className="mt-0.5 text-[11.5px] text-muted">{s}</div>}</div>;
}
function Breakdown({ segs }: { segs: any[] }) {
  return (
    <Table dense head={['Flight', 'Departure', 'Time to departure', 'Fare type', 'Airline penalty', 'Service fee', 'Refund']}>
      {segs.map((s) => <tr key={s.legIndex}><Td className="font-semibold">{s.route}</Td><Td className="text-muted">{s.departureAt ? fmtDate(s.departureAt) : '—'}</Td><Td><Badge tone={s.slab === 'S2' ? 'green' : s.slab === 'S1' ? 'amber' : 'red'}>{s.slabLabel ?? s.slab}</Badge></Td><Td><ProfileBadge id={s.profileId} /></Td><Td className="tabular">{inr(s.supplierPenaltyMinor)}</Td><Td className="tabular">{inr(s.serviceFeeMinor)}</Td><Td className="font-semibold tabular">{inr(s.segmentRefundMinor)}</Td></tr>)}
    </Table>
  );
}
function RefundPanel({ b, claim, isHub }: { b: any; claim: any; isHub: boolean }) {
  if (!claim) return <Card><p className="text-sm text-muted">{b.splitChildren.length ? 'Cancelled passengers were split to separate PNRs — open them above for their refunds.' : 'No cancellation or refund on this booking.'}</p></Card>;
  const q = b.cancellation ? JSON.parse(b.cancellation.quoteSnapshotJson) : null;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Cancellation charges" subtitle={claim.id}>
        {q && <div className="space-y-1.5 text-sm" data-testid="penalty-breakup">
          <Row l="Amount paid" v={inr(q.agencyAmountPaidMinor)} />
          <Row l="Airline cancellation penalty" v={`− ${inr(q.supplierPenaltyMinor)}`} neg />
          <Row l="Hubfares service fee" v={`− ${inr(q.serviceFeeMinor)}`} neg />
          <div className="flex justify-between border-t border-line pt-2 font-bold"><span>Refund to agency</span><span className="tabular text-ok-600">{inr(claim.agencyRefundMinor)}</span></div>
        </div>}
        {b.cancellation && <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold">Per-flight breakdown</summary><div className="mt-2"><Breakdown segs={JSON.parse(b.cancellation.segmentSlabBreakdownJson)} /></div></details>}
      </Card>
      <Card title="Refund status">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 p-3" data-testid="agency-refund-status"><div className="text-xs text-muted">Agency refund</div><div className="font-bold tabular">{inr(claim.agencyRefundMinor)}</div><Status value={claim.agencyPayoutStatus} /><div className="mt-1 text-[11px] text-muted">{PAYOUT_LABEL[claim.payoutMode]}</div></div>
          <div className="rounded-lg bg-slate-50 p-3" data-testid="supplier-refund-status"><div className="text-xs text-muted">Airline refund to Hubfares</div><div className="font-bold tabular">{isHub ? `${inr(claim.supplierExpectedMinor)} / ${inr(claim.supplierReceivedMinor)}` : claim.supplierStatus === 'RECEIVED' ? 'Received' : claim.supplierStatus === 'NOT_APPLICABLE' ? '—' : 'Awaited'}</div><Status value={claim.supplierStatus} /></div>
        </div>
        <div className="mt-4"><RefundTimeline items={claim.timeline} /></div>
      </Card>
    </div>
  );
}
function Row({ l, v, neg }: { l: string; v: string; neg?: boolean }) { return <div className="flex justify-between"><span className="text-muted">{l}</span><span className={cx('tabular', neg && 'text-bad-600')}>{v}</span></div>; }
function RefundTimeline({ items }: { items: any[] }) {
  return <ol className="space-y-2 text-sm">{items.map((t, i) => <li key={i} className="flex justify-between gap-3"><span><Status value={t.status} />{t.amountMinor ? <span className="ml-2 tabular">{inr(t.amountMinor)}</span> : null}</span><span className="text-xs text-muted">{fmtDate(t.at)}</span></li>)}</ol>;
}

function CancelModal({ b, onClose }: { b: any; onClose: (done: boolean) => void }) {
  const toast = useToast();
  const multi = b.passengers.length > 1;
  const [sel, setSel] = useState<string[]>(b.passengers.map((p: any) => p.id));
  const [cq, setCq] = useState<any>(null); const [qErr, setQErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  const partial = multi && sel.length > 0 && sel.length < b.passengers.length;
  useEffect(() => {
    if (!sel.length) { setCq(null); return; }
    let live = true; setQErr(null);
    apiFetch(`/bookings/${b.bookingId}/cancel-quote`, { body: { mode: 'CANCEL', ...(partial ? { passengerIds: sel } : {}) } })
      .then((r) => { if (live) setCq(r.data); }).catch((e) => { if (live) { setCq(null); setQErr(e.message); } });
    key.current = newKey();
    return () => { live = false; };
  }, [sel.join(','), partial, b.bookingId]); // eslint-disable-line react-hooks/exhaustive-deps
  async function confirm() {
    if (busy || !cq?.eligible) return;
    setBusy(true);
    try {
      const r = await apiFetch<any>(`/bookings/${b.bookingId}/cancel-confirm`, { idem: key.current, body: { mode: 'CANCEL', ...(partial ? { passengerIds: sel } : {}) }, quiet: true });
      const d = r.data;
      toast({ tone: 'success', title: d.partial ? `${d.cancelledPassengers.length} passenger${d.cancelledPassengers.length > 1 ? 's' : ''} cancelled · new PNR ${d.childPnr}` : `Cancelled · refund ${d.claimId}`, body: d.agencyPayoutStatus === 'CREDITED' ? `${inr(d.walletCreditedMinor)} credited to your wallet` : d.refundMinor ? `Refund of ${inr(d.refundMinor)} will be credited after the airline refund is received` : 'Non-refundable — no refund due' });
      onClose(true);
    } catch (e: any) { toast({ tone: 'error', title: 'Cancellation not completed', body: e.message }); setBusy(false); }
  }
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const tix = Object.fromEntries(b.passengers.map((p: any) => [p.id, p.ticketNumber]));
  return (
    <Modal open onClose={() => !busy && onClose(false)} wide title={partial ? 'Partial cancellation' : 'Cancel booking'} subtitle={multi ? 'Choose the passengers to cancel. Charges are per passenger, from the fare rules locked at booking.' : 'Charges are taken from the fare rules locked at booking.'}
      footer={<><Button variant="secondary" onClick={() => onClose(false)} disabled={busy}>Keep booking</Button><Button variant="danger" loading={busy} disabled={!cq?.eligible || busy || !sel.length} onClick={confirm} data-testid="cancel-confirm">{partial ? `Cancel ${sel.length} of ${b.passengers.length} passengers` : 'Confirm cancellation'}</Button></>}>
      <BusyOverlay show={busy} title={partial ? 'Splitting PNR and cancelling…' : 'Cancelling booking…'} detail="Please wait." />
      <div className="space-y-4">
        {multi && (
          <div className="rounded-xl border border-line p-3" data-testid="pax-select">
            <div className="mb-2 flex items-center justify-between text-sm"><b>Passengers on PNR {b.pnr?.gdsPnr}</b><button type="button" className="text-xs font-semibold text-brand-700" onClick={() => setSel(sel.length === b.passengers.length ? [] : b.passengers.map((p: any) => p.id))}>{sel.length === b.passengers.length ? 'Clear all' : 'Select all'}</button></div>
            <div className="grid gap-2 sm:grid-cols-2">{b.passengers.map((p: any) => (
              <label key={p.id} className={cx('flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm', sel.includes(p.id) ? 'border-bad-600/40 bg-bad-50/60' : 'border-line')}>
                <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={sel.includes(p.id)} onChange={() => toggle(p.id)} data-testid={`cancel-pax-${p.id}`} />
                <span className="flex-1"><span className="font-medium">{p.displayName}</span><span className="block font-mono text-[11px] text-muted">{tix[p.id] ?? '—'}</span></span>
              </label>
            ))}</div>
            {partial && <Notice tone="info" className="mt-3" title="The PNR will be split">{sel.length} passenger{sel.length > 1 ? 's' : ''} will move to a new PNR and be cancelled. {cq?.partial?.remainingPassengers?.map((p: any) => p.name).join(', ')} stay confirmed on PNR {b.pnr?.gdsPnr}.</Notice>}
          </div>
        )}
        {!sel.length && <Notice tone="warn">Select at least one passenger.</Notice>}
        {qErr && <Notice tone="error">{qErr}</Notice>}
        {cq && !cq.eligible && <Notice tone="error" title="Not eligible">{cq.ineligibleReason}</Notice>}
        {cq && (
          <>
            <Breakdown segs={cq.segments} />
            {cq.partial && <Table dense head={['Passenger', 'Ticket', 'Paid', 'Airline penalty', 'Service fee', 'Refund']}>{cq.partial.selectedPassengers.map((p: any) => <tr key={p.id}><Td className="font-medium">{p.name}</Td><Td className="font-mono text-xs">{p.ticketNumber}</Td><Td className="tabular">{inr(cq.partial.perPassenger.paidMinor)}</Td><Td className="tabular text-bad-600">−{inr(cq.partial.perPassenger.penaltyMinor)}</Td><Td className="tabular text-bad-600">−{inr(cq.partial.perPassenger.serviceFeeMinor)}</Td><Td className="font-semibold tabular">{inr(cq.partial.perPassenger.refundMinor)}</Td></tr>)}</Table>}
            <div className="grid gap-3 sm:grid-cols-4">
              <Mini l="Amount paid" v={inr(cq.agencyAmountPaidMinor)} s={partial ? `${sel.length} passenger${sel.length > 1 ? 's' : ''}` : undefined} />
              <Mini l="Airline penalty" v={<span className="text-bad-600">−{inr(cq.supplierPenaltyMinor)}</span>} />
              <Mini l="Hubfares service fee" v={<span className="text-bad-600">−{inr(cq.serviceFeeMinor)}</span>} />
              <Mini l="Expected refund" v={<span className="text-ok-600" data-testid="refund-estimate">{inr(cq.estimatedAgencyRefundMinor)}</span>} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs font-semibold text-muted">Agency refund</div><div className="mt-0.5">{cq.estimatedAgencyRefundMinor === 0 ? 'No refund due' : cq.payoutPolicy === 'IMMEDIATE_IF_ELIGIBLE' ? 'Credited to your wallet immediately on confirmation' : 'Credited to your wallet after the airline refund is received'}</div></div>
              <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs font-semibold text-muted">Airline refund</div><div className="mt-0.5">{cq.supplierExpectedMinor > 0 ? 'Claimed from the airline — tracked separately' : 'Not applicable'}</div></div>
            </div>
          </>
        )}
        {!cq && sel.length > 0 && !qErr && <Loading label="Calculating refund…" />}
      </div>
    </Modal>
  );
}

function DateChangeModal({ booking, onClose }: { booking: any; onClose: (done: boolean) => void }) {
  const toast = useToast();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [leg, setLeg] = useState(0); const [date, setDate] = useState(''); const [q, setQ] = useState<any>(null); const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [quoting, setQuoting] = useState(false);
  const key = useRef(newKey());
  const seg = booking.segments.find((s: any) => s.legIndex === leg);
  useEffect(() => {
    if (!date) { setQ(null); return; }
    let live = true; setQuoting(true); setErr(null);
    apiFetch('/amendments/quote', { body: { bookingId: booking.bookingId, legIndex: leg, newDate: date } })
      .then((r) => { if (live) setQ(r.data); }).catch((e) => { if (live) { setQ(null); setErr(e.message); } }).finally(() => live && setQuoting(false));
    key.current = newKey();
    return () => { live = false; };
  }, [date, leg, booking.bookingId]);
  async function confirm() {
    if (busy || !q?.permitted) return;
    setBusy(true);
    try {
      const r = await apiFetch<any>('/amendments', { idem: key.current, body: { bookingId: booking.bookingId, legIndex: leg, newDate: date, expectedTotalMinor: q.totalMinor }, quiet: true });
      toast({ tone: 'success', title: `Date changed to ${fmtDay(r.data.toDepartureAt, seg.originTz)}`, body: `New ticket${r.data.newTickets.length > 1 ? 's' : ''} ${r.data.newTickets.join(', ')} · charged ${inr(r.data.totalMinor)}` });
      onClose(true);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }
  return (
    <Modal open onClose={() => !busy && onClose(false)} wide title="Change travel date" subtitle={`${booking.bookingId} · ${booking.passengers.length} passenger${booking.passengers.length > 1 ? 's' : ''} · charges per passenger from the fare rules locked at booking`}
      footer={<><Button variant="secondary" onClick={() => onClose(false)} disabled={busy}>Close</Button><Button disabled={!q?.permitted || !q?.funding?.sufficient || busy} loading={busy} onClick={confirm} data-testid="confirm-date-change">Confirm & reissue ticket</Button></>}>
      <BusyOverlay show={busy} title="Changing date and reissuing ticket…" detail="Please wait — do not close this window." steps={['Confirming new flight date', 'Charging your account', 'Reissuing ticket']} step={1} />
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
          {booking.segments.length > 1 ? <Field label="Flight to change"><Select value={leg} onChange={(e) => { setLeg(Number(e.target.value)); setDate(''); }}>{booking.segments.map((s: any) => <option key={s.legIndex} value={s.legIndex}>{s.direction === 'OUTBOUND' ? 'Outbound' : 'Return'} · {s.origin}–{s.destination} · {fmtDay(s.departureAt, s.originTz)}</option>)}</Select></Field>
            : <div className="rounded-lg border border-line p-3 text-sm"><div className="text-xs text-muted">Current flight</div><div className="font-semibold">{seg.airlineName} {seg.flightNumber} · {seg.origin}–{seg.destination}</div><div className="text-muted">{fmtDay(seg.departureAt, seg.originTz)} · {fmtTime(seg.departureAt, seg.originTz)}</div></div>}
          <Field label="New travel date"><Input type="date" min={tomorrow} value={date} onChange={(e) => setDate(e.target.value)} name="newDate" data-testid="new-date" /></Field>
        </div>
        {!date && <p className="text-sm text-muted">Pick a new date to see the charges. The same flight is rebooked on the chosen date.</p>}
        {quoting && <Loading label="Checking availability and charges…" />}
        {err && <Notice tone="error">{err}</Notice>}
        {q && !q.permitted && <Notice tone="error" title="Date change not available">{q.reason}</Notice>}
        {q && q.permitted && (
          <div className="space-y-3" data-testid="date-change-quote">
            <div className="rounded-lg border border-line p-3 text-sm"><div className="text-xs text-muted">New flight</div><div className="font-semibold">{q.flightNumber} · {q.route.replace('-', ' → ')}</div><div>{fmtDay(q.toDepartureAt, q.originTz)} · departs {fmtTime(q.toDepartureAt, q.originTz)} · arrives {fmtTime(q.toArrivalAt, q.destinationTz)}</div></div>
            <Table dense head={['Charge', 'Per passenger', `Total (${q.adults})`]}>
              <tr><Td>Airline change fee</Td><Td className="tabular">{inr(q.perPassenger.airlineChangeFeeMinor)}</Td><Td className="tabular">{inr(q.breakdown.airlineChangeFeeMinor)}</Td></tr>
              <tr><Td>Fare difference</Td><Td className="tabular">{inr(q.perPassenger.fareDifferenceMinor)}</Td><Td className="tabular">{inr(q.breakdown.fareDifferenceMinor)}</Td></tr>
              <tr><Td>Hubfares service fee</Td><Td className="tabular">{inr(q.perPassenger.serviceFeeMinor)}</Td><Td className="tabular">{inr(q.breakdown.serviceFeeMinor)}</Td></tr>
              <tr><Td className="font-bold">Total to pay</Td><Td /><Td className="font-bold tabular" data-testid="date-change-total">{inr(q.totalMinor)}</Td></tr>
            </Table>
            {q.funding.sufficient ? <p className="text-xs text-muted">Charged to {q.funding.creditMinor > 0 && q.funding.walletMinor > 0 ? `wallet (${inr(q.funding.walletMinor)}) and credit (${inr(q.funding.creditMinor)})` : q.funding.creditMinor > 0 ? 'credit' : 'wallet'}. Existing tickets are exchanged and new tickets issued.</p> : <Notice tone="error">Insufficient balance — available {inr(q.funding.availableMinor)}.</Notice>}
          </div>
        )}
      </div>
    </Modal>
  );
}
