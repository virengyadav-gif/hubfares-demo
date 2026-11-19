'use client';
/** OPS-01 — Operations overview from shared records. */
import Link from 'next/link';
import { ClipboardCheck, Ticket, Undo2, Banknote, Headset, AlertTriangle, Bell } from 'lucide-react';
import { useApi, inr, fmtDate } from '@/lib/client';
import { Card, Kpi, PageHeader, Table, Td, Status, Loading } from '@/components/ui';
export default function OpsOverview() {
  const { data: d } = useApi<any>('/ops/overview');
  const n = useApi<any[]>('/notifications').data;
  if (!d) return <Loading />;
  return (
    <div>
      <PageHeader eyebrow="Operations" title="Operations overview" subtitle={`Live queues across all agencies · as of ${fmtDate(new Date().toISOString())}`} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/operations/applications"><Kpi label="Pending agency applications · now" value={d.pendingApplications} icon={<ClipboardCheck className="h-4 w-4" />} /></Link>
        <Link href="/operations/bookings"><Kpi label="Bookings to date (ticketed / PNR pending)" value={`${d.ticketed} / ${d.pnrPending}`} sub={`${d.bookingsTotal} total · ${d.failures} failures`} icon={<Ticket className="h-4 w-4" />} tone="ok" /></Link>
        <Link href="/operations/refunds"><Kpi label="Refunds pending supplier · now" value={d.refundsPendingSupplier} sub={`${d.refundsAwaitingPayout} awaiting payout`} icon={<Undo2 className="h-4 w-4" />} tone="warn" /></Link>
        <Link href="/operations/payments"><Kpi label="Payments to match / exceptions · now" value={`${d.paymentsToMatch} / ${d.paymentExceptions}`} icon={<Banknote className="h-4 w-4" />} tone={d.paymentExceptions ? 'bad' : 'brand'} /></Link>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Card title="Latest bookings" pad={false} actions={<Link href="/operations/bookings" className="text-sm font-semibold text-brand-700">All bookings</Link>}>
          <Table head={['Booking', 'Agency', 'Route', 'Status', 'Booked', 'Amount']}>
            {d.recentBookings.map((b: any) => <tr key={b.id}><Td><Link className="font-semibold text-brand-700" href={`/operations/bookings/${b.id}`}>{b.id}</Link></Td><Td>{b.agencyId.replace('agency_', '')}</Td><Td>{b.route}</Td><Td><Status value={b.status} /></Td><Td className="text-muted">{fmtDate(b.bookedAt)}</Td><Td className="text-right tabular">{inr(b.amountMinor)}</Td></tr>)}
          </Table>
        </Card>
        <div className="space-y-5">
          <Card title="Support cases"><div className="flex items-center gap-6"><div><div className="text-3xl font-bold">{d.openCases}</div><div className="text-xs text-muted">open cases</div></div><div><div className="text-3xl font-bold text-brand-600">{d.chatbotCases}</div><div className="text-xs text-muted">from OTA chatbot</div></div><Link href="/operations/cases" className="ml-auto text-sm font-semibold text-brand-700"><Headset className="mr-1 inline h-4 w-4" />Case board</Link></div></Card>
          <Card title="Alerts" actions={<Bell className="h-4 w-4 text-muted" />}>
            <ul className="space-y-2">{(n ?? []).slice(0, 7).map((x) => <li key={x.id} className="flex gap-2 text-sm"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" /><div><div>{x.title}</div><div className="text-xs text-muted">{fmtDate(x.createdAt)}</div></div></li>)}{!n?.length && <li className="text-sm text-muted">No new alerts.</li>}</ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
