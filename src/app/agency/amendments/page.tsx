'use client';
/** OTA amendments — date changes with ticket reissue. Start from any ticketed booking. */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarClock } from 'lucide-react';
import { useApi, inr, fmtDate } from '@/lib/client';
import { Card, PageHeader, Table, Td, Status, Empty, Select, Button, Loading } from '@/components/ui';
import { useSession, can } from '@/components/shell/AppShell';
import { signalNavigate } from '@/lib/busy';
export default function Page() {
  const router = useRouter(); const session = useSession();
  const { data, loading } = useApi<any[]>('/amendments');
  const ticketed = useApi<any[]>('/bookings?status=TICKETED').data;
  const [pick, setPick] = useState('');
  return (
    <div>
      <PageHeader eyebrow="Servicing" title="Manage Amendments" subtitle="Change the travel date of a ticketed booking — charges are shown before you confirm and tickets are reissued automatically." />
      {can(session, 'AGENCY_AMEND') && (
        <Card className="mb-5" title={<span className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-brand-500" />Start a date change</span>}>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[280px] flex-1"><Select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Ticketed booking" data-testid="amend-booking"><option value="">Select a ticketed booking…</option>{(ticketed ?? []).map((b) => <option key={b.id} value={b.id}>{b.id} · {b.routeSummary} · {b.leadPassenger}{b.passengerCount > 1 ? ` +${b.passengerCount - 1}` : ''} · {fmtDate(b.firstDepartureAt, 'Asia/Kolkata', false)}</option>)}</Select></div>
            <Button disabled={!pick} onClick={() => { signalNavigate(); router.push(`/agency/bookings/${pick}?amend=1`); }} data-testid="amend-start">Choose new date</Button>
          </div>
        </Card>
      )}
      <Card pad={false} title="Amendment history">{loading && !data ? <Loading /> : !data?.length ? <Empty title="No amendments yet">Date changes you make will appear here.</Empty> : (
        <Table head={['Amendment', 'Booking', 'Change', 'Airline fee', 'Fare difference', 'Service fee', 'Total charged', 'New ticket(s)', 'Status', 'Date']}>
          {data.map((a) => <tr key={a.id} data-testid={`amd-${a.id}`}><Td className="font-semibold">{a.id}</Td><Td><Link href={`/agency/bookings/${a.bookingId}`} className="text-brand-700 hover:underline">{a.bookingId}</Link></Td><Td className="whitespace-nowrap">{a.quote.route} · {a.quote.fromDate} → {a.quote.toDate}</Td><Td className="tabular">{inr(a.quote.breakdown?.airlineChangeFeeMinor)}</Td><Td className="tabular">{inr(a.quote.breakdown?.fareDifferenceMinor)}</Td><Td className="tabular">{inr(a.quote.breakdown?.serviceFeeMinor)}</Td><Td className="font-semibold tabular">{inr(a.quote.totalMinor)}</Td><Td className="font-mono text-xs">{(a.quote.newTickets ?? []).join(', ')}</Td><Td><Status value={a.status} /></Td><Td className="whitespace-nowrap text-muted">{fmtDate(a.createdAt)}</Td></tr>)}
        </Table>)}</Card>
    </div>
  );
}
