'use client';
/** OTA-09/10/11 & OPS booking servicing — detail, cancellation quote from booked snapshot, refund tracking. */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { Ticket, XCircle, LifeBuoy, RefreshCcw, ArrowLeft, Plane } from 'lucide-react';
import { apiFetch, useApi, inr, fmtDate, fmtTime, fmtDay, newKey } from '@/lib/client';
import { Button, Card, Badge, Status, DL, Notice, Modal, Loading, ErrorBox, Timeline, SimTag, PageHeader, Table, Td, Tabs, Select, useToast, cx } from '@/components/ui';
import { RuleTables, ProfileBadge } from '@/components/flight/FareRules';
import { Price } from '@/components/flight/currency';
import { useSession, can } from '@/components/shell/AppShell';
import { openHelp } from '@/components/support/HelpChat';

export function BookingDetail({ id, back }: { id: string; back: string }) {
  const session = useSession(); const toast = useToast();
  const { data: b, loading, error, reload } = useApi<any>(`/bookings/${id}`, [id]);
  const [cq, setCq] = useState<any>(null); const [busy, setBusy] = useState(false); const [tab, setTab] = useState<'itin' | 'rules' | 'money' | 'history'>('itin');
  const [amend, setAmend] = useState(false);
  const cancelKey = useRef(newKey()); const tktKey = useRef(newKey());
  if (loading && !b) return <Loading />;
  if (error) return <div className="space-y-3"><ErrorBox error={error} /><Link href={back} className="text-sm font-semibold text-brand-700">← Back to bookings</Link></div>;
  const canCancel = can(session, ['AGENCY_CANCEL', 'BOOKING_SERVICE_ALL']);
  async function quote() { setBusy(true); try { setCq((await apiFetch(`/bookings/${id}/cancel-quote`, { body: { mode: 'CANCEL' } })).data); } catch (e: any) { toast({ tone: 'error', title: 'Cannot quote cancellation', body: e.message }); } finally { setBusy(false); } }
  async function confirm() {
    setBusy(true);
    try { const r = await apiFetch<any>(`/bookings/${id}/cancel-confirm`, { idem: cancelKey.current, body: { mode: 'CANCEL' } }); toast({ tone: 'success', title: `Cancelled · claim ${r.data.claimId}`, body: r.data.agencyPayoutStatus === 'CREDITED' ? `${inr(r.data.walletCreditedMinor)} credited to wallet (booked policy: immediate)` : r.data.refundMinor ? 'Refund pending supplier settlement (booked policy)' : 'Non-refundable — zero refund' }); setCq(null); reload(); }
    catch (e: any) { toast({ tone: 'error', title: 'Cancellation rejected', body: e.message }); } finally { setBusy(false); }
  }
  async function issue() { setBusy(true); try { await apiFetch(`/bookings/${id}/issue-ticket`, { idem: tktKey.current, body: {} }); toast({ tone: 'success', title: 'Ticket issued (simulated)' }); reload(); } catch (e: any) { toast({ tone: 'error', title: 'Ticketing failed', body: e.message }); } finally { setBusy(false); } }
  const claim = b.refundClaim;
  return (
    <div>
      <Link href={back} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-navy"><ArrowLeft className="h-4 w-4" />Bookings</Link>
      <PageHeader title={<span data-testid="detail-id">{b.bookingId}</span>} subtitle={`${b.routeSummary} · ${b.tripType === 'ROUND_TRIP' ? 'Return' : 'One-way'} · ${b.agencyName} · booked ${fmtDate(b.bookedAt)}`} badges={<><Status value={b.bookingStatus} />{b.source !== 'PORTAL' && <Badge tone={b.source === 'IMPORTED' ? 'blue' : 'violet'}>{b.source === 'IMPORTED' ? 'Imported PNR' : 'Manual (guided)'}</Badge>}</>}
        actions={<>
          {b.bookingStatus === 'PNR_CREATED' && b.reservation?.status === 'ACTIVE' && can(session, ['AGENCY_BOOK', 'BOOKING_SERVICE_ALL']) && <Button icon={<Ticket className="h-4 w-4" />} loading={busy} onClick={issue}>Issue ticket</Button>}
          {b.bookingStatus === 'TICKETED' && canCancel && <Button variant="danger" icon={<XCircle className="h-4 w-4" />} onClick={quote} loading={busy && !cq} data-testid="cancel-quote">Cancel full itinerary</Button>}
          {b.bookingStatus === 'TICKETED' && can(session, 'AGENCY_AMEND') && <Button variant="secondary" icon={<RefreshCcw className="h-4 w-4" />} onClick={() => setAmend(true)}>Amend (guided)</Button>}
          {!session.isHub && b.pnr && can(session, 'AGENCY_SUPPORT') && <Button variant="ghost" icon={<LifeBuoy className="h-4 w-4" />} onClick={() => openHelp(b.pnr.gdsPnr)}>Need help</Button>}
        </>} />
      {b.failureReason && <Notice tone="error" className="mb-4" title="Provider simulation outcome">{b.failureReason}</Notice>}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Mini l="Simulated GDS PNR" v={<span className="font-mono tracking-wider" data-testid="detail-pnr">{b.pnr?.gdsPnr ?? '—'}</span>} s={b.pnr ? `${b.pnr.provider === 'SABRE' ? 'Sabre (mock)' : b.pnr.provider} · PCC ${b.pnr.pcc}` : 'No PNR'} />
        <Mini l="Ticket(s)" v={<span className="font-mono text-[14px]">{b.tickets.map((t: any) => t.ticketNumber).join(', ') || '—'}</span>} s={b.tickets.length ? `${b.tickets[0].status.toLowerCase()}${b.tickets[0].imported ? ' · imported' : ''}` : 'Not issued'} />
        <Mini l="Amount (INR)" v={<Price minor={b.amount.amountMinor} size="lg" />} s={`Funding: ${b.fundingType.toLowerCase()}`} />
        <Mini l="Refund policy (booking-time)" v={b.refundPolicySnapshot.policyId} s={`v${b.refundPolicySnapshot.version} · ${b.refundPolicySnapshot.payoutMode.replace(/_/g, ' ').toLowerCase()}`} />
        <Mini l="Payment" v={<Status value={b.paymentStatus} />} s={b.reservation ? `Hold ${b.reservation.status.toLowerCase()}` : '—'} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'itin', label: 'Itinerary & passengers' }, { id: 'rules', label: 'Fare rules (booked snapshot)' }, { id: 'money', label: 'Wallet / credit impact', count: b.walletEntries.length + b.creditEntries.length }, { id: 'history', label: 'Cancellation, refund & history' }]} className="mb-4" />
      {tab === 'itin' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Card title="Segments" actions={<SimTag kind="Simulated" />}>
            <div className="space-y-3">{b.segments.map((s: any) => (
              <div key={s.legIndex} className="rounded-lg border border-line p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2"><Badge tone="dark">{s.direction === 'OUTBOUND' ? 'Outbound' : 'Inbound'}</Badge><span className="font-semibold">{s.airlineName} · {s.flightNumber}</span><Badge tone="orange">{s.brandName}</Badge><ProfileBadge id={s.fareRuleProfileId} /></div>
                <div className="flex items-center gap-4 text-sm"><div><b className="text-base">{fmtTime(s.departureAt, s.originTz)}</b><div className="text-xs text-muted">{s.origin} · {fmtDay(s.departureAt, s.originTz)}</div></div><Plane className="h-4 w-4 text-brand-500" /><div><b className="text-base">{fmtTime(s.arrivalAt, s.destinationTz)}</b><div className="text-xs text-muted">{s.destination} · {fmtDay(s.arrivalAt, s.destinationTz)}</div></div><div className="ml-auto text-right"><div className="font-semibold tabular">{inr(s.segmentSellMinor)}</div><div className="text-[11px] text-muted">segment snapshot</div></div></div>
              </div>
            ))}</div>
          </Card>
          <Card title="Passengers">{b.passengers.map((p: any) => <div key={p.id} className="flex justify-between border-b border-line py-2 text-sm last:border-0"><span className="font-medium">{p.displayName}</span><span className="text-muted">{p.travelerType.toLowerCase()}</span></div>)}<p className="mt-3 text-[11px] text-muted">Synthetic travellers · no identity documents stored.</p></Card>
        </div>
      )}
      {tab === 'rules' && <Card><div className="space-y-8">{b.segments.map((s: any) => <RuleTables key={s.legIndex} profile={s.fareRuleSnapshot} route={`${s.origin}-${s.destination}`} />)}</div><p className="mt-4 text-xs text-muted">Cancellation is always priced from this immutable booked snapshot, not current defaults.</p></Card>}
      {tab === 'money' && (
        <Card title="Ledger entries linked to this booking" subtitle="Append-only wallet and credit ledgers — the same records drive the passbook and executive views.">
          {!b.walletEntries.length && !b.creditEntries.length ? <p className="text-sm text-muted">No financial postings (PNR-only, failed, imported or manual records post nothing).</p> : (
            <Table head={['Ledger', 'Type', 'Description', 'Date', 'Amount']}>
              {b.walletEntries.map((e: any) => <tr key={e.id}><Td><Badge tone="blue">Wallet</Badge></Td><Td>{e.type.replace(/_/g, ' ').toLowerCase()}</Td><Td>{e.description}</Td><Td className="text-muted">{fmtDate(e.createdAt)}</Td><Td className={cx('text-right font-semibold tabular', e.direction === 'CREDIT' ? 'text-ok-600' : 'text-bad-600')}>{e.direction === 'CREDIT' ? '+' : '−'}{inr(e.amountMinor)}</Td></tr>)}
              {b.creditEntries.map((e: any) => <tr key={e.id}><Td><Badge tone="violet">Credit</Badge></Td><Td>{e.type.toLowerCase()}</Td><Td>{e.description}{e.dueAt && <span className="text-muted"> · due {fmtDate(e.dueAt)}</span>}</Td><Td className="text-muted">{fmtDate(e.createdAt)}</Td><Td className="text-right font-semibold tabular">{inr(e.amountMinor)}</Td></tr>)}
            </Table>
          )}
        </Card>
      )}
      {tab === 'history' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Refund tracking" subtitle={claim ? `${claim.id} · policy ${claim.refundPolicyId} v${claim.refundPolicyVersion}` : undefined}>
            {!claim ? <p className="text-sm text-muted">No cancellation or refund claim.</p> : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-muted">Agency refund</div><div className="font-bold tabular">{inr(claim.agencyRefundMinor)}</div><Status value={claim.agencyPayoutStatus} /></div>
                  <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-muted">Supplier refund {session.isHub ? 'expected / received' : 'status'}</div><div className="font-bold tabular">{session.isHub ? `${inr(claim.supplierExpectedMinor)} / ${inr(claim.supplierReceivedMinor)}` : '—'}</div><Status value={claim.supplierStatus} /></div>
                </div>
                <Timeline items={claim.timeline} />
                {b.cancellation && <details className="text-sm"><summary className="cursor-pointer font-semibold">Slab breakdown at cancellation</summary><Breakdown segs={JSON.parse(b.cancellation.segmentSlabBreakdownJson)} /></details>}
              </div>
            )}
          </Card>
          <Card title="Activity">
            {b.amendments.length > 0 && <div className="mb-3 space-y-1">{b.amendments.map((a: any) => <div key={a.id} className="flex items-center justify-between text-sm"><span>{a.id} · {a.type.replace(/_/g, ' ').toLowerCase()} <Badge tone="blue">Guided</Badge></span><Status value={a.status} /></div>)}</div>}
            {b.supportCases.length > 0 && <div className="mb-3 space-y-1">{b.supportCases.map((c: any) => <div key={c.id} className="flex items-center justify-between text-sm"><span>{c.id} · {c.category.replace(/_/g, ' ').toLowerCase()}</span><Status value={c.status} /></div>)}</div>}
            <ul className="space-y-1.5 text-sm">{b.audit.map((a: any, i: number) => <li key={i} className="flex justify-between gap-2"><span>{a.action.replace(/_/g, ' ').toLowerCase()}</span><span className="text-xs text-muted">{a.actorRole} · {fmtDate(a.occurredAt)}</span></li>)}{!b.audit.length && <li className="text-muted">Historical seed record.</li>}</ul>
          </Card>
        </div>
      )}
      <Modal open={!!cq} onClose={() => !busy && setCq(null)} wide title="Cancel full itinerary — refund estimate" subtitle="Computed from each booked segment's own fare-rule snapshot and scheduled departure. Partial-leg cancellation is not available."
        footer={cq && <><Button variant="secondary" onClick={() => setCq(null)} disabled={busy}>Keep booking</Button><Button variant="danger" loading={busy} disabled={!cq.eligible} onClick={confirm} data-testid="cancel-confirm">Confirm cancellation</Button></>}>
        {cq && (
          <div className="space-y-4">
            {!cq.eligible && <Notice tone="error" title="Not eligible">{cq.ineligibleReason}</Notice>}
            <Breakdown segs={cq.segments} />
            <div className="grid gap-3 sm:grid-cols-4">
              <Mini l="Paid by agency" v={inr(cq.agencyAmountPaidMinor)} />
              <Mini l="Supplier / airline penalty" v={<span className="text-bad-600">−{inr(cq.supplierPenaltyMinor)}</span>} />
              <Mini l="Hubfares disclosed fee" v={<span className="text-bad-600">−{inr(cq.serviceFeeMinor)}</span>} />
              <Mini l="Estimated agency refund" v={<span className="text-ok-600" data-testid="refund-estimate">{inr(cq.estimatedAgencyRefundMinor)}</span>} />
            </div>
            <Notice tone="info" title={`Payout per booking-time policy ${cq.bookedRefundPolicyId} v${cq.bookedRefundPolicyVersion}`}>{cq.payoutPolicy === 'IMMEDIATE_IF_ELIGIBLE' ? 'Immediate-eligible: the wallet is credited once on confirmation; supplier receivable is tracked separately.' : 'Supplier-settlement: the claim waits for the (simulated) supplier refund; the wallet is credited only after a matched receipt and a separate authorised payout.'} Void: {cq.voidEligibility.eligible ? 'eligible' : cq.voidEligibility.reason}</Notice>
            <p className="text-xs text-muted">Estimate only · simulated · no airline was contacted. Taxes/service charges as per sample rules.</p>
          </div>
        )}
      </Modal>
      {amend && <AmendModal booking={b} onClose={() => { setAmend(false); reload(); }} />}
    </div>
  );
}
function Mini({ l, v, s }: { l: string; v: React.ReactNode; s?: React.ReactNode }) {
  return <div className="rounded-xl border border-line bg-white p-3.5 shadow-[var(--shadow-card)]"><div className="text-[11.5px] font-semibold text-muted">{l}</div><div className="mt-1 text-[17px] font-bold">{v}</div>{s && <div className="mt-0.5 text-[11.5px] text-muted">{s}</div>}</div>;
}
function Breakdown({ segs }: { segs: any[] }) {
  return (
    <Table dense head={['Segment', 'Departure', 'Slab', 'Profile', 'Penalty', 'Fee', 'Segment refund']}>
      {segs.map((s) => <tr key={s.legIndex}><Td className="font-semibold">{s.route}</Td><Td className="text-muted">{s.departureAt ? fmtDate(s.departureAt) : '—'}</Td><Td><Badge tone={s.slab === 'S2' ? 'green' : s.slab === 'S1' ? 'amber' : 'red'}>{s.slab}{s.slabLabel ? ` · ${s.slabLabel}` : ''}</Badge></Td><Td>{s.profileId}</Td><Td className="tabular">{inr(s.supplierPenaltyMinor)}</Td><Td className="tabular">{inr(s.serviceFeeMinor)}</Td><Td className="font-semibold tabular">{inr(s.segmentRefundMinor)}</Td></tr>)}
    </Table>
  );
}
function AmendModal({ booking, onClose }: { booking: any; onClose: () => void }) {
  const toast = useToast();
  const samples = useApi<any>('/guided/samples').data;
  const [type, setType] = useState('DATE_CHANGE'); const [opt, setOpt] = useState(''); const [q, setQ] = useState<any>(null); const [busy, setBusy] = useState(false);
  const t = samples?.amendmentOptions.find((x: any) => x.type === type);
  async function getQuote(o: string) { setOpt(o); setQ(null); try { setQ((await apiFetch('/amendments/quote', { body: { bookingId: booking.bookingId, type, optionId: o } })).data); } catch (e: any) { toast({ tone: 'error', title: 'Quote unavailable', body: e.message }); } }
  async function submit() { setBusy(true); try { const r = await apiFetch<any>('/amendments', { body: { bookingId: booking.bookingId, type, optionId: opt } }); toast({ tone: 'success', title: `Amendment ${r.data.id} submitted (guided)`, body: 'Visible to Operations. No ticket was reissued.' }); onClose(); } catch (e: any) { toast({ tone: 'error', title: 'Not submitted', body: e.message }); } finally { setBusy(false); } }
  return (
    <Modal open onClose={onClose} title="Amendment / rebooking" subtitle="Guided demo — airline-dependent changes are previews; no live ticket change." footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button disabled={!q?.permitted} loading={busy} onClick={submit}>Submit demo request</Button></>}>
      <div className="space-y-3">
        <SimTag kind="Guided demo" />
        <Select value={type} onChange={(e) => { setType(e.target.value); setOpt(''); setQ(null); }} aria-label="Change type">{samples?.amendmentOptions.map((x: any) => <option key={x.type} value={x.type}>{x.label}</option>)}</Select>
        <div className="space-y-2">{t?.options.map((o: any) => <button key={o.id} onClick={() => getQuote(o.id)} className={cx('w-full rounded-lg border px-3 py-2 text-left text-sm', opt === o.id ? 'border-brand-400 bg-brand-50' : 'border-line')}>{o.label}</button>)}</div>
        {q && <DL items={[['Booked profile / slab', `${q.profileId} · ${q.slab}`], ['Permitted', q.permitted ? 'Yes' : 'No'], ['Airline change fee', inr(q.amendmentChargeMinor)], ['Fare difference', inr(q.fareDifferenceMinor)], ['Indicative total', <b key="t">{inr(q.totalIndicativeMinor)}</b>], ['Note', q.note]]} />}
      </div>
    </Modal>
  );
}
