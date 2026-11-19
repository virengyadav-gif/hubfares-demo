'use client';
/** EXE-04 — Credit & financial risk. */
import { useApi, inr, fmtDate } from '@/lib/client';
import { PageHeader, Loading, Card, Table, Td, Badge, Status, Kpi } from '@/components/ui';
import { ChartCard, MoneyBars, C } from '@/components/analytics';
export default function Risk() {
  const { data } = useApi<any>('/executive/credit-risk');
  if (!data) return <Loading />;
  const tot = data.agencies.reduce((a: any, x: any) => ({ lim: a.lim + x.creditLimitMinor, out: a.out + x.creditOutstandingMinor, od: a.od + x.overdueMinor }), { lim: 0, out: 0, od: 0 });
  return (
    <div>
      <PageHeader eyebrow="Executive" title="Credit & financial risk" subtitle="Approved vs utilised vs overdue credit, wallet funding, unmatched payments, refund obligations and supplier receivables." />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Credit approved" value={inr(tot.lim, { decimals: false })} /><Kpi label="Credit utilised" value={inr(tot.out, { decimals: false })} /><Kpi label="Overdue" value={inr(tot.od, { decimals: false })} tone={tot.od ? 'bad' : 'ok'} />
        <Kpi label="OTA refund obligations" value={inr(data.agencyRefundPendingMinor, { decimals: false })} tone="warn" /><Kpi label="Supplier receivable" value={inr(data.supplierReceivableMinor, { decimals: false })} />
      </div>
      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <ChartCard title="Credit by OTA"><MoneyBars data={data.agencies.map((a: any) => ({ name: a.agencyName.split(' ')[0], limit: a.creditLimitMinor, used: a.creditOutstandingMinor, overdue: a.overdueMinor }))} x="name" bars={[{ key: 'limit', name: 'Limit' }, { key: 'used', name: 'Utilised' }, { key: 'overdue', name: 'Overdue' }]} colors={[C.slate, C.ink, C.red]} /></ChartCard>
        <ChartCard title="Wallet funding activity" sub="Daily credits vs debits across agencies"><MoneyBars data={data.walletTrend.slice(-12).map((d: any) => ({ ...d, date: d.date.slice(5) }))} x="date" bars={[{ key: 'creditsMinor', name: 'Credits' }, { key: 'debitsMinor', name: 'Debits' }]} colors={[C.teal, C.brand]} /></ChartCard>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Agency credit flags" pad={false}><Table head={['OTA', 'Cycle', 'Limit', 'Utilised', 'Overdue', 'Available', 'Flag']}>{data.agencies.map((a: any) => <tr key={a.agencyId}><Td className="font-semibold">{a.agencyName}</Td><Td>{a.creditCycle.toLowerCase()}</Td><Td className="tabular">{inr(a.creditLimitMinor, { decimals: false })}</Td><Td className="tabular">{inr(a.creditOutstandingMinor, { decimals: false })}</Td><Td className="tabular">{inr(a.overdueMinor, { decimals: false })}</Td><Td className="tabular">{inr(a.availableCreditMinor, { decimals: false })}</Td><Td>{a.creditBlocked ? <Badge tone="red">Blocked</Badge> : a.creditEnabled ? <Badge tone="green">OK</Badge> : <Badge tone="gray">Prepaid</Badge>}</Td></tr>)}</Table></Card>
        <Card title="Unmatched / pending simulated payments" pad={false}><Table head={['UTR', 'Amount', 'Status', 'Reason']}>{data.unmatchedPayments.map((p: any) => <tr key={p.id}><Td className="font-mono text-xs">{p.ref}</Td><Td className="tabular">{p.currency === 'INR' ? inr(p.amountMinor) : `${p.currency} ${(p.amountMinor / 100).toFixed(2)}`}</Td><Td><Status value={p.status} /></Td><Td className="text-xs text-muted">{p.reason ?? 'Awaiting matcher'}</Td></tr>)}</Table></Card>
      </div>
    </div>
  );
}
