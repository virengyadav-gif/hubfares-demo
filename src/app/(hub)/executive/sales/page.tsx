'use client';
/** Sales & growth — daily/route/airline/journey/source splits from live bookings. */
import { useApi, inr } from '@/lib/client';
import { PageHeader, Loading, Card, Table, Td } from '@/components/ui';
import { FilterBar, useFilters, ChartCard, MoneyBars, TrendLine, C } from '@/components/analytics';
export default function Sales() {
  const { f, setF, q } = useFilters();
  const { data } = useApi<any>(`/executive/sales-trends?${q}`, [q]);
  if (!data) return <Loading />;
  return (
    <div>
      <PageHeader eyebrow="Executive" title="Sales trends" subtitle="Ticketed GBV by booking date, route, airline, journey type and source." />
      <FilterBar f={f} setF={setF} />
      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Daily GBV"><TrendLine data={data.daily.map((d: any) => ({ ...d, date: d.date.slice(5) }))} x="date" lines={[{ key: 'gbvMinor', name: 'GBV', color: C.brand }]} /></ChartCard>
        <ChartCard title="GBV by route"><MoneyBars data={data.byRoute.slice(0, 8)} x="key" bars={[{ key: 'gbvMinor', name: 'GBV' }]} /></ChartCard>
        <ChartCard title="GBV by airline"><MoneyBars data={data.byAirline} x="key" bars={[{ key: 'gbvMinor', name: 'GBV' }]} colors={[C.ink]} /></ChartCard>
        <Card title="Domestic vs international · source" pad={false}><Table head={['Segment', 'Bookings', 'GBV', 'Cancelled', 'Voided']}>{[...data.byJourney, ...data.bySource].map((r: any) => <tr key={r.key}><Td className="font-semibold">{r.key.toLowerCase()}</Td><Td>{r.bookings}</Td><Td className="tabular">{inr(r.gbvMinor, { decimals: false })}</Td><Td>{r.cancelled}</Td><Td>{r.voided}</Td></tr>)}</Table></Card>
      </div>
      <p className="mt-4 text-xs text-muted">Booking funnel (search → ticket) is omitted: search events are not recorded in this POC, so the metric is not shown rather than invented.</p>
    </div>
  );
}
