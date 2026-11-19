'use client';
/** OPS-09 — Amendments (date changes with ticket reissue) across agencies. */
import Link from 'next/link';
import { useApi, inr, fmtDate } from '@/lib/client';
import { Card, PageHeader, Table, Td, Status, Empty, Loading } from '@/components/ui';
export default function Page() {
  const { data, loading } = useApi<any[]>('/amendments');
  return (
    <div>
      <PageHeader eyebrow="Operations" title="Amendments" subtitle="Date changes completed by agencies or Operations, with the charges collected and the reissued tickets." />
      <Card pad={false}>{loading && !data ? <Loading /> : !data?.length ? <Empty title="No amendments yet" /> : (
        <Table head={['Amendment', 'Agency', 'Booking', 'Change', 'Airline fee', 'Fare difference', 'Service fee', 'Total', 'Exchanged → new ticket(s)', 'Status', 'Date']}>
          {data.map((a) => <tr key={a.id}><Td className="font-semibold">{a.id}</Td><Td>{a.agencyName}</Td><Td><Link className="text-brand-700 hover:underline" href={`/operations/bookings/${a.bookingId}`}>{a.bookingId}</Link></Td><Td className="whitespace-nowrap">{a.quote.route} · {a.quote.fromDate} → {a.quote.toDate}</Td><Td className="tabular">{inr(a.quote.breakdown?.airlineChangeFeeMinor)}</Td><Td className="tabular">{inr(a.quote.breakdown?.fareDifferenceMinor)}</Td><Td className="tabular">{inr(a.quote.breakdown?.serviceFeeMinor)}</Td><Td className="font-semibold tabular">{inr(a.quote.totalMinor)}</Td><Td className="font-mono text-xs">{(a.quote.exchangedTickets ?? []).join(', ')} → {(a.quote.newTickets ?? []).join(', ')}</Td><Td><Status value={a.status} /></Td><Td className="whitespace-nowrap text-muted">{fmtDate(a.updatedAt)}</Td></tr>)}
        </Table>)}</Card>
    </div>
  );
}
