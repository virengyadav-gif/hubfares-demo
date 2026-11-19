'use client';
import Link from 'next/link';
import { useApi, inr, fmtDate } from '@/lib/client';
import { Card, PageHeader, Table, Td, Status, SimTag, Empty, Notice } from '@/components/ui';
export default function Page() {
  const { data } = useApi<any[]>('/amendments');
  return (
    <div>
      <PageHeader eyebrow="Servicing" title="Amendments & rebooking" subtitle="Request date changes, corrections, rebooking or ancillaries from a ticketed booking (Amend button)." badges={<SimTag kind="Guided demo" />} />
      <Notice tone="info" className="mb-4">Guided workflow: quotes use the booked fare profile&apos;s date-change fee plus a sample fare difference. No ticket is reissued and no airline is contacted.</Notice>
      <Card pad={false}>{!data?.length ? <Empty title="No amendment requests">Open a ticketed booking and choose “Amend (guided)”.</Empty> : (
        <Table head={['Request', 'Booking', 'Type', 'Change fee', 'Fare diff.', 'Status', 'Requested']}>
          {data.map((a) => <tr key={a.id}><Td className="font-semibold">{a.id}</Td><Td><Link href={`/agency/bookings/${a.bookingId}`} className="text-brand-700">{a.bookingId}</Link></Td><Td>{a.type.replace(/_/g, ' ').toLowerCase()}</Td><Td className="tabular">{inr(a.quote.amendmentChargeMinor)}</Td><Td className="tabular">{inr(a.quote.fareDifferenceMinor)}</Td><Td><Status value={a.status} /></Td><Td className="text-muted">{fmtDate(a.createdAt)}</Td></tr>)}
        </Table>)}</Card>
    </div>
  );
}
