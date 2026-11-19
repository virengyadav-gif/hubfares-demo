'use client';
/** OTA-01 — Agency dashboard from live agency-scoped records. */
import Link from 'next/link';
import { Wallet, CreditCard, Ticket, Undo2, Plane, Import, CalendarClock, ArrowRight } from 'lucide-react';
import { useApi, inr, fmtDate } from '@/lib/client';
import { Card, Kpi, PageHeader, Status, Table, Td, Button, Notice, Loading } from '@/components/ui';
import { useSession, can } from '@/components/shell/AppShell';

export default function AgencyDashboard() {
  const s = useSession();
  const fin = can(s, 'AGENCY_FINANCE_VIEW');
  const w = useApi<any>(fin ? '/wallet' : null);
  const b = useApi<any[]>('/bookings?limit=200');
  const c = useApi<any[]>('/refund-claims');
  const pb = useApi<any>(fin ? '/wallet/passbook' : null);
  if (b.loading && !b.data) return <Loading />;
  const rows = b.data ?? [];
  const ticketed = rows.filter((x) => x.bookingStatus === 'TICKETED').length;
  const pendingRefunds = (c.data ?? []).filter((x) => x.agencyPayoutStatus !== 'CREDITED' && x.agencyRefundMinor > 0);
  return (
    <div>
      <PageHeader eyebrow={s.agencyName ?? ''} title={`Welcome back, ${s.name.split(' ')[0]}`} subtitle="Live view of your agency's bookings, funds and refunds." actions={<>{can(s, 'AGENCY_BOOK') && <Link href="/agency/search"><Button icon={<Plane className="h-4 w-4" />}>Book a flight</Button></Link>}{can(s, 'AGENCY_PNR_IMPORT') && <Link href="/agency/import-pnr"><Button variant="secondary" icon={<Import className="h-4 w-4" />}>Import PNR</Button></Link>}</>} />
      {s.agencyStatus !== 'ACTIVE' && <Notice tone="error" className="mb-4" title="Agency not active">New bookings are blocked. Prior records remain viewable.</Notice>}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {fin && w.data ? <>
          <Kpi label="Wallet balance" value={inr(w.data.walletCashMinor)} sub={`Available ${inr(w.data.availableWalletMinor)} · on hold ${inr(w.data.walletHoldMinor)}`} icon={<Wallet className="h-4 w-4" />} />
          <Kpi label="Available credit" value={inr(w.data.availableCreditMinor)} sub={w.data.creditEnabled ? `Limit ${inr(w.data.creditLimitMinor)} · used ${inr(w.data.creditOutstandingMinor)}` : 'Prepaid — no credit facility'} icon={<CreditCard className="h-4 w-4" />} tone={w.data.creditBlocked ? 'bad' : 'brand'} />
        </> : <Kpi label="Finance" value="Restricted" sub="Your role cannot view wallet or credit" />}
        <Kpi label="Ticketed bookings" value={ticketed} sub={`${rows.length} total records`} icon={<Ticket className="h-4 w-4" />} tone="ok" />
        <Kpi label="Refunds pending" value={pendingRefunds.length} sub={inr(pendingRefunds.reduce((a, x) => a + x.agencyRefundMinor, 0))} icon={<Undo2 className="h-4 w-4" />} tone="warn" />
      </div>
      {fin && w.data?.creditBlocked && <Notice tone="error" className="mb-4" title="Credit blocked">{w.data.blockReason}. Wallet-only bookings remain allowed per policy.</Notice>}
      {fin && w.data?.nextDueAt && <Notice tone="info" className="mb-4"><span className="inline-flex items-center gap-1"><CalendarClock className="h-4 w-4" />Next credit payment due {fmtDate(w.data.nextDueAt)} · {w.data.creditCycle.toLowerCase()} cycle</span></Notice>}
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Recent bookings" actions={<Link href="/agency/bookings" className="text-sm font-semibold text-brand-700">View all</Link>} pad={false}>
          <Table head={['Booking', 'Route', 'Passenger', 'Status', 'Amount']}>
            {rows.slice(0, 7).map((r) => <tr key={r.id}><Td><Link href={`/agency/bookings/${r.id}`} className="font-semibold text-brand-700">{r.id}</Link></Td><Td>{r.routeSummary}</Td><Td className="max-w-[140px] truncate">{r.leadPassenger}</Td><Td><Status value={r.bookingStatus} /></Td><Td className="text-right tabular">{inr(r.sellAmountMinor)}</Td></tr>)}
          </Table>
        </Card>
        <Card title="Recent transactions" actions={fin && <Link href="/agency/passbook" className="text-sm font-semibold text-brand-700">Passbook <ArrowRight className="inline h-3 w-3" /></Link>}>
          {!fin ? <p className="text-sm text-muted">Finance view is restricted for your user.</p> : (pb.data?.entries ?? []).slice(0, 6).map((e: any) => <div key={e.id} className="flex items-center justify-between border-b border-line py-2 text-sm last:border-0"><div><div className="font-medium">{e.description}</div><div className="text-xs text-muted">{fmtDate(e.createdAt)}</div></div><div className={e.direction === 'CREDIT' ? 'font-semibold text-ok-600' : 'font-semibold text-bad-600'}>{e.direction === 'CREDIT' ? '+' : '−'}{inr(e.amountMinor)}</div></div>)}
        </Card>
      </div>
    </div>
  );
}
