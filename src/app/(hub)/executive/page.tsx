'use client';
/** EXE-01 — Executive overview: every figure derived live from canonical booking/claim/ledger records. */
import Link from 'next/link';
import { TrendingUp, Wallet, Landmark, Percent, Building2, Undo2, CreditCard, Receipt } from 'lucide-react';
import { useApi, inr, inrCompact, pct } from '@/lib/client';
import { PageHeader, Kpi, Card, Table, Td, Loading, Badge, Notice } from '@/components/ui';
import { FilterBar, useFilters, ChartCard, MoneyBars, TrendLine, C } from '@/components/analytics';
export default function ExecOverview() {
  const { f, setF, q, label } = useFilters();
  const o = useApi<any>(`/executive/overview?${q}`, [q]); const t = useApi<any>(`/executive/sales-trends?${q}`, [q]);
  if (!o.data) return <Loading />;
  const k = o.data.total;
  return (
    <div>
      <PageHeader eyebrow="Executive" title="Management intelligence" subtitle="Revenue, contribution, cancellations and credit exposure from live booking, refund and ledger records." />
      <FilterBar f={f} setF={setF} show={['date', 'granularity', 'agency', 'airline', 'route', 'journey']} />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={`Gross booking value · ${label}`} value={inr(k.grossBookingValueMinor, { decimals: false })} sub={`${k.ticketedCount} ticketed bookings · ABV ${inr(k.averageBookingValueMinor, { decimals: false })}`} icon={<TrendingUp className="h-4 w-4" />} hint="Sum of originally ticketed agency sell amounts in the booking-date cohort (incl. later cancelled)" />
        <Kpi label="Net platform revenue" value={inr(k.netPlatformRevenueMinor, { decimals: false })} sub={`Retained sales ${inrCompact(k.retainedAgencySalesMinor)} − retained supplier cost ${inrCompact(k.retainedSupplierCostMinor)}`} icon={<Landmark className="h-4 w-4" />} tone="ok" />
        <Kpi label="Estimated contribution" value={inr(k.estimatedContributionMinor, { decimals: false })} sub={`After modeled variable cost ${inr(k.variableOperatingExpenseMinor, { decimals: false })}`} icon={<Wallet className="h-4 w-4" />} tone="ok" />
        <Kpi label="Contribution margin" value={pct(k.contributionMarginPct)} sub={`${k.activeOtas} active OTAs`} icon={<Percent className="h-4 w-4" />} />
        <Kpi label="Cancellation rate" value={pct(k.cancellationRatePct)} sub={`${k.cancelledCount}/${k.ticketedCount} cancelled · void ${pct(k.voidRatePct)} (${k.voidedCount}) shown separately`} icon={<Undo2 className="h-4 w-4" />} tone="warn" />
        <Kpi label="OTA refunds pending" value={inr(k.agencyRefundPendingMinor, { decimals: false })} sub={`Obligation ${inr(k.agencyRefundObligationMinor, { decimals: false })} · paid ${inr(k.agencyWalletRefundPaidMinor, { decimals: false })}`} icon={<Receipt className="h-4 w-4" />} tone="warn" />
        <Kpi label="Supplier refund receivable" value={inr(k.supplierReceivableMinor, { decimals: false })} sub={`Expected ${inr(k.supplierExpectedRefundMinor, { decimals: false })} · received ${inr(k.supplierReceivedRefundMinor, { decimals: false })}`} icon={<Building2 className="h-4 w-4" />} />
        <Kpi label="Credit utilised / overdue" value={inr(o.data.credit.outstanding, { decimals: false })} sub={<span className={o.data.credit.overdue ? 'font-semibold text-bad-600' : ''}>Overdue {inr(o.data.credit.overdue, { decimals: false })} · limits {inrCompact(o.data.credit.limit)}</span>} icon={<CreditCard className="h-4 w-4" />} tone={o.data.credit.overdue ? 'bad' : 'brand'} />
      </div>
      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <ChartCard title="Contribution by OTA" sub="Net platform revenue vs estimated contribution (INR)"><MoneyBars data={o.data.byAgency.map((a: any) => ({ name: a.agencyName.split(' ')[0], rev: a.netPlatformRevenueMinor, contrib: a.estimatedContributionMinor }))} x="name" bars={[{ key: 'rev', name: 'Net revenue' }, { key: 'contrib', name: 'Contribution' }]} colors={[C.ink, C.brand]} /></ChartCard>
        <ChartCard title={`${f.granularity === 'monthly' ? 'Monthly' : f.granularity === 'weekly' ? 'Weekly' : 'Daily'} ticketed GBV`} sub={`By booking date · ${label}`}>{t.data ? <TrendLine data={t.data.daily.map((d: any) => ({ ...d, date: f.granularity === 'monthly' ? d.date : f.granularity === 'weekly' ? `wk ${d.date.slice(5)}` : d.date.slice(5) }))} x="date" lines={[{ key: 'gbvMinor', name: 'GBV', color: C.brand }]} /> : <div />}</ChartCard>
      </div>
      <Card title="OTA performance" pad={false} actions={<Link href="/executive/ota" className="text-sm font-semibold text-brand-700">Ranking & drill-down</Link>}>
        <Table head={['OTA', 'Ticketed', 'GBV', 'Net revenue', 'Contribution', 'Margin', 'Cancel %', 'Credit outstanding']}>
          {o.data.byAgency.map((a: any) => <tr key={a.agencyId}><Td className="font-semibold">{a.agencyName}</Td><Td>{a.ticketedCount}</Td><Td className="tabular">{inr(a.grossBookingValueMinor, { decimals: false })}</Td><Td className="tabular">{inr(a.netPlatformRevenueMinor, { decimals: false })}</Td><Td className="tabular font-semibold">{inr(a.estimatedContributionMinor, { decimals: false })}</Td><Td>{pct(a.contributionMarginPct)}</Td><Td>{a.cancellationRatePct !== null && a.cancellationRatePct > 30 ? <Badge tone="red">{pct(a.cancellationRatePct)}</Badge> : pct(a.cancellationRatePct)}</Td><Td className="tabular">{inr(a.creditOutstandingMinor, { decimals: false })}{a.overdueMinor > 0 && <Badge tone="red" className="ml-1.5">overdue</Badge>}</Td></tr>)}
          <tr className="bg-slate-50 font-semibold"><Td>Total</Td><Td>{k.ticketedCount}</Td><Td className="tabular">{inr(k.grossBookingValueMinor, { decimals: false })}</Td><Td className="tabular">{inr(k.netPlatformRevenueMinor, { decimals: false })}</Td><Td className="tabular">{inr(k.estimatedContributionMinor, { decimals: false })}</Td><Td>{pct(k.contributionMarginPct)}</Td><Td>{pct(k.cancellationRatePct)}</Td><Td className="tabular">{inr(o.data.credit.outstanding, { decimals: false })}</Td></tr>
        </Table>
      </Card>
      <Notice tone="info" className="mt-5" title="Definitions">Net platform revenue = retained agency sales (GBV − agency refunds recognised at cancellation) − retained supplier cost (supplier cost − matched supplier refunds) − rebates/pass-through (zero in fixtures). Contribution subtracts modeled variable cost (₹35 per ticketed booking).</Notice>
    </div>
  );
}
