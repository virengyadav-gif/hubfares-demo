'use client';
/** OPS-04 — Agency directory with policy and funding summary. */
import { useApi, inr, fmtDate } from '@/lib/client';
import { Card, PageHeader, Table, Td, Status, Badge, Loading } from '@/components/ui';
export default function Agencies() {
  const { data } = useApi<any[]>('/agencies');
  if (!data) return <Loading />;
  return (
    <div>
      <PageHeader eyebrow="Operations" title="Agency directory" subtitle="All authorised OTA tenants with live funding position and current policies." />
      <Card pad={false}>
        <Table head={['Agency', 'Status', 'City', 'Users', 'Bookings', 'Wallet cash', 'Credit used / limit', 'Credit', 'Refund policy', 'Activated']}>
          {data.map((a) => { const refund = a.policies.find((p: any) => p.type === 'REFUND'); const credit = a.policies.find((p: any) => p.type === 'CREDIT'); return (
            <tr key={a.id}><Td><div className="font-semibold">{a.displayName}</div><div className="text-xs text-muted">{a.id} · PAN {a.panMasked}</div></Td><Td><Status value={a.status} /></Td><Td>{a.city}</Td><Td>{a.users}</Td><Td>{a.bookings}</Td><Td className="tabular">{inr(a.position.walletCashMinor)}</Td><Td className="tabular">{inr(a.position.creditOutstandingMinor)} / {inr(a.position.creditLimitMinor)}</Td><Td>{a.position.creditBlocked ? <Badge tone="red">Blocked (overdue)</Badge> : <Badge tone="gray">{credit?.config.cycle?.toLowerCase()} {credit ? `v${credit.version}` : ''}</Badge>}</Td><Td><Badge tone={refund?.config.payoutMode === 'IMMEDIATE_IF_ELIGIBLE' ? 'green' : 'violet'}>{refund?.config.payoutMode?.replace(/_/g, ' ').toLowerCase()} v{refund?.version}</Badge></Td><Td className="text-muted">{fmtDate(a.activatedAt, undefined, false)}</Td></tr>
          ); })}
        </Table>
      </Card>
    </div>
  );
}
