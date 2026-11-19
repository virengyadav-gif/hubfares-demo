'use client';
/** EXE-03 — Cancellation & refund trends; VOIDED excluded from the cancellation numerator. */
import Link from 'next/link';
import { useApi, inr, pct, fmtDate } from '@/lib/client';
import { PageHeader, Loading, Card, Table, Td, Kpi, Status, Badge, Notice } from '@/components/ui';
import { FilterBar, useFilters, ChartCard, CountBars, MoneyBars, C } from '@/components/analytics';
export default function Cancellations() {
  const { f, setF, q } = useFilters();
  const { data } = useApi<any>(`/executive/cancellations?${q}`, [q]);
  if (!data) return <Loading />;
  const t = data.totals;
  return (
    <div>
      <PageHeader eyebrow="Executive" title="Cancellations & refunds" subtitle={data.definition} />
      <FilterBar f={f} setF={setF} />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Cancellation rate" value={pct(t.cancellationRatePct)} sub={`${t.cancelled} cancelled / ${t.ticketed} ticketed`} tone="warn" />
        <Kpi label="Void rate (separate)" value={pct(t.voidRatePct)} sub={`${t.voided} voided / ${t.ticketed} ticketed`} />
        <Kpi label="OTA refunds pending" value={inr(t.agencyRefundPendingMinor, { decimals: false })} sub={`of ${inr(t.agencyRefundObligationMinor, { decimals: false })} obligation`} tone="warn" />
        <Kpi label="Supplier receivable" value={inr(t.supplierReceivableMinor, { decimals: false })} sub="Expected but not yet matched" />
      </div>
      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <ChartCard title="Ticketed cohort outcome by OTA"><CountBars data={data.byAgency.map((a: any) => ({ name: a.agencyName.split(' ')[0], active: a.ticketed - a.cancelled - a.voided, cancelled: a.cancelled, voided: a.voided }))} x="name" keys={[{ key: 'active', name: 'Still ticketed', color: C.teal }, { key: 'cancelled', name: 'Cancelled', color: C.red }, { key: 'voided', name: 'Voided', color: C.slate }]} /></ChartCard>
        <ChartCard title="Refund aging" sub="Days since the refund claim was raised · pending OTA payout vs supplier receivable"><MoneyBars data={data.aging} x="bucket" bars={[{ key: 'pendingAgencyMinor', name: 'OTA payout pending' }, { key: 'supplierReceivableMinor', name: 'Supplier receivable' }]} colors={[C.amber, C.ink]} /></ChartCard>
      </div>
      <Card title="Refund claims" pad={false}>
        <Table head={['Claim', 'OTA', 'Route', 'Policy', 'OTA refund', 'Payout', 'Supplier exp. / rec.', 'Supplier', 'Raised', 'Age']}>
          {data.claims.map((c: any) => <tr key={c.id}><Td className="font-semibold">{c.id}</Td><Td>{c.agencyName}</Td><Td>{c.route}</Td><Td><Badge tone={c.payoutMode === 'IMMEDIATE_IF_ELIGIBLE' ? 'green' : 'violet'}>{c.payoutMode === 'IMMEDIATE_IF_ELIGIBLE' ? 'Immediate' : 'Supplier'}</Badge></Td><Td className="tabular">{inr(c.agencyRefundMinor)}</Td><Td><Status value={c.agencyPayoutStatus} /></Td><Td className="tabular text-xs">{inr(c.supplierExpectedMinor)} / {inr(c.supplierReceivedMinor)}</Td><Td><Status value={c.supplierStatus} /></Td><Td className="whitespace-nowrap text-muted">{fmtDate(c.createdAt, 'Asia/Kolkata', false)}</Td><Td>{c.ageDays}d</Td></tr>)}
        </Table>
      </Card>
      <Notice tone="info" className="mt-4">Agency refunds are recognised when cancellation is confirmed (obligation), regardless of payout timing; supplier refunds reduce cost only when a receipt is matched. This avoids profit swinging on payment timing. <Link className="font-semibold underline" href="/operations/refunds">Refund queue</Link></Notice>
    </div>
  );
}
