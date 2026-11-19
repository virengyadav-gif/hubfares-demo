'use client';
/** EXE-02 — OTA ranking, sortable, with drill-down to the underlying booked cohort. */
import { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { useApi, inr, pct, fmtDate } from '@/lib/client';
import { PageHeader, Card, Table, Td, Drawer, Badge, Status, Loading } from '@/components/ui';
import { FilterBar, useFilters } from '@/components/analytics';
const COLS: [string, string][] = [['ticketedCount', 'Bookings'], ['grossBookingValueMinor', 'Gross sales'], ['netPlatformRevenueMinor', 'Net revenue'], ['estimatedContributionMinor', 'Contribution'], ['contributionMarginPct', 'Margin %'], ['cancellationRatePct', 'Cancel %'], ['creditOutstandingMinor', 'Credit outstanding']];
export default function Ota() {
  const { f, setF, q } = useFilters();
  const { data } = useApi<any[]>(`/executive/ota-profitability?${q}`, [q]);
  const [sort, setSort] = useState<[string, 1 | -1]>(['estimatedContributionMinor', -1]); const [drill, setDrill] = useState<any>(null);
  const dd = useApi<any[]>(drill ? `/executive/drilldown?${q ? q + '&' : ''}agencyId=${drill.agencyId}` : null, [drill?.agencyId, q]);
  if (!data) return <Loading />;
  const rows = [...data].sort((a, b) => ((a[sort[0]] ?? -1) - (b[sort[0]] ?? -1)) * sort[1]);
  const fmt = (k: string, v: any) => (k.endsWith('Pct') ? pct(v) : k.endsWith('Minor') ? inr(v, { decimals: false }) : v);
  return (
    <div>
      <PageHeader eyebrow="Executive" title="OTA revenue & profitability" subtitle="Rank agencies by sales, contribution, margin, cancellations and credit. Click a row for its booking cohort." />
      <FilterBar f={f} setF={setF} show={['date', 'airline', 'route', 'journey']} />
      <Card pad={false}>
        <Table head={['#', 'OTA', ...COLS.map(([k, l]) => <button key={k} className="inline-flex items-center gap-1 uppercase" onClick={() => setSort([k, sort[0] === k ? (sort[1] === 1 ? -1 : 1) : -1])}>{l}<ArrowUpDown className="h-3 w-3" /></button>)]}>
          {rows.map((a, i) => <tr key={a.agencyId} className="cursor-pointer hover:bg-slate-50" onClick={() => setDrill(a)} data-testid={`ota-${a.agencyId}`}><Td className="text-muted">{i + 1}</Td><Td className="font-semibold">{a.agencyName}{a.creditBlocked && <Badge tone="red" className="ml-1.5">credit blocked</Badge>}</Td>{COLS.map(([k]) => <Td key={k} className="tabular">{fmt(k, a[k])}</Td>)}</tr>)}
        </Table>
      </Card>
      <p className="mt-3 text-xs text-muted">Orbit: high volume with thinner margin per sale; Aster: elevated cancellations and overdue credit — both emerge from the underlying records, not a hardcoded ranking.</p>
      <Drawer open={!!drill} onClose={() => setDrill(null)} title={drill ? `${drill.agencyName} · booking cohort` : ''} width="max-w-4xl">
        {dd.data && <Table dense head={['Booking', 'Booked', 'Route', 'Status', 'Ticketed', 'Sell', 'Supplier', 'Claim']}>{dd.data.map((b) => <tr key={b.id}><Td className="font-semibold">{b.id}</Td><Td className="text-xs text-muted">{fmtDate(b.bookedAt, undefined, false)}</Td><Td>{b.route}</Td><Td><Status value={b.status} /></Td><Td>{b.ticketed ? 'Yes' : 'No'}</Td><Td className="tabular">{inr(b.sellMinor)}</Td><Td className="tabular">{inr(b.supplierCostMinor)}</Td><Td className="text-xs">{b.claim ? `${b.claim.id} · ${inr(b.claim.agencyRefundMinor)}` : '—'}</Td></tr>)}</Table>}
      </Drawer>
    </div>
  );
}
