'use client';
/** ADM-07 — Audit trail of recorded events. */
import { useState } from 'react';
import { useApi, fmtDate } from '@/lib/client';
import { Card, PageHeader, Table, Td, Badge, Select } from '@/components/ui';
export default function Audit() {
  const [t, setT] = useState('');
  const { data } = useApi<any[]>(`/audit${t ? `?entityType=${t}` : ''}`, [t]);
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Audit trail" subtitle="Append-only actor/action/entity log. No raw identity numbers, documents or secrets are recorded." actions={<Select className="w-56" value={t} onChange={(e) => setT(e.target.value)} aria-label="Entity type"><option value="">All entities</option>{['booking', 'refund_claim', 'payment_event', 'application', 'user', 'agency_policy', 'core_rule', 'support_case', 'approval', 'amendment', 'demo'].map((x) => <option key={x} value={x}>{x === 'demo' ? 'environment reset' : x.replace(/_/g, ' ')}</option>)}</Select>} />
      <Card pad={false}><Table head={['Time', 'Actor', 'Role', 'Action', 'Entity', 'Agency', 'Details']}>{(data ?? []).map((a) => <tr key={a.id}><Td className="whitespace-nowrap text-muted">{fmtDate(a.occurredAt)}</Td><Td>{a.actorName}</Td><Td className="text-xs">{a.actorRole}</Td><Td><Badge tone="gray">{a.action}</Badge></Td><Td className="font-mono text-xs">{a.entityType}:{a.entityId}</Td><Td className="text-xs">{a.agencyId?.replace('agency_', '') ?? '—'}</Td><Td className="max-w-[320px] truncate font-mono text-[11px] text-muted">{JSON.stringify(a.metadata)}</Td></tr>)}</Table></Card>
    </div>
  );
}
