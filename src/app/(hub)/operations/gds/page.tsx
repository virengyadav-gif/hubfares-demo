'use client';
/** OPS-11 — GDS/PCC queue preview. No live queue polling. */
import { useApi } from '@/lib/client';
import { Card, PageHeader, Table, Td, Badge, SimTag } from '@/components/ui';
export default function Page() {
  const d = useApi<any>('/guided/samples').data;
  return (
    <div>
      <PageHeader eyebrow="Operations" title="GDS / PCC queues" subtitle="Preview of queue monitoring per provider and PCC." badges={<><SimTag kind="Guided demo" /><SimTag kind="Planned integration" /></>} />
      <Card pad={false}><Table head={['Provider', 'PCC', 'Queue', 'Items', 'Status']}>{(d?.gdsQueues ?? []).map((q: any, i: number) => <tr key={i}><Td className="font-semibold">{q.provider}{q.provider === 'SABRE' && <Badge tone="amber" className="ml-1.5">mock</Badge>}</Td><Td className="font-mono">{q.pcc}</Td><Td>{q.queue}</Td><Td>{q.count}</Td><Td><Badge tone={q.status === 'Planned integration' ? 'violet' : 'blue'}>{q.status}</Badge></Td></tr>)}</Table></Card>
      <p className="mt-3 text-xs text-muted">Live queue polling and actioning require provider credentials, certification and PCC entitlements (Phase 1+). No queue is contacted in this POC.</p>
    </div>
  );
}
