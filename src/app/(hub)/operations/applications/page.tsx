'use client';
/** OPS-02 — Agency applications queue. */
import Link from 'next/link';
import { useState } from 'react';
import { useApi, fmtDate } from '@/lib/client';
import { Card, PageHeader, Table, Td, Status, Tabs, Empty } from '@/components/ui';
export default function Apps() {
  const { data } = useApi<any[]>('/ops/applications');
  const [t, setT] = useState<'pending' | 'all'>('pending');
  const rows = (data ?? []).filter((a) => t === 'all' || ['SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED'].includes(a.status));
  return (
    <div>
      <PageHeader eyebrow="Operations" title="Agency onboarding" subtitle="Review submitted applications, run simulated verification and decide." />
      <Card pad={false}>
        <Tabs className="px-4" value={t} onChange={setT} tabs={[{ id: 'pending', label: 'Pending review', count: (data ?? []).filter((a) => ['SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED'].includes(a.status)).length }, { id: 'all', label: 'All', count: data?.length }]} />
        {!rows.length ? <Empty title="Queue is clear" /> : (
          <Table head={['Reference', 'Agency', 'City', 'Submitted', 'Status', 'Decision', '']}>
            {rows.map((a) => <tr key={a.id} data-testid={`app-${a.reference}`}><Td className="font-semibold">{a.reference}</Td><Td className="font-medium">{a.agencyName}</Td><Td>{a.city}</Td><Td className="text-muted">{fmtDate(a.submitTime)}</Td><Td><Status value={a.status} /></Td><Td className="text-muted">{a.decisionTime ? fmtDate(a.decisionTime) : '—'}</Td><Td><Link href={`/operations/applications/${a.id}`} className="font-semibold text-brand-700">Review</Link></Td></tr>)}
          </Table>
        )}
      </Card>
    </div>
  );
}
