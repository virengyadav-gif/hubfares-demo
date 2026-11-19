'use client';
/** OTA-11 — Refund tracking: agency payout vs supplier settlement shown separately. */
import Link from 'next/link';
import { useApi, inr, fmtDate } from '@/lib/client';
import { Card, PageHeader, Table, Td, Status, Badge, Loading, Empty } from '@/components/ui';
export default function Refunds() {
  const { data, loading } = useApi<any[]>('/refund-claims');
  return (
    <div>
      <PageHeader eyebrow="Refund tracking" title="Refunds" subtitle="Payout timing follows the refund policy snapshotted when each booking was created." />
      <Card pad={false}>{loading ? <Loading /> : !data?.length ? <Empty title="No refund claims" /> : (
        <Table head={['Claim', 'Booking', 'Route', 'Policy (booked)', 'Agency refund', 'Agency payout', 'Supplier', 'Status', 'Created']}>
          {data.map((c) => <tr key={c.id}><Td className="font-semibold">{c.id}</Td><Td><Link className="text-brand-700" href={`/agency/bookings/${c.bookingId}`}>{c.bookingId}</Link></Td><Td>{c.route}</Td><Td><Badge tone={c.payoutMode === 'IMMEDIATE_IF_ELIGIBLE' ? 'green' : 'violet'}>{c.refundPolicyId} v{c.refundPolicyVersion}</Badge></Td><Td className="tabular font-semibold">{inr(c.agencyRefundMinor)}</Td><Td><Status value={c.agencyPayoutStatus} /></Td><Td><Status value={c.supplierStatus} /></Td><Td><Status value={c.status} /></Td><Td className="text-muted">{fmtDate(c.createdAt)}</Td></tr>)}
        </Table>
      )}</Card>
    </div>
  );
}
