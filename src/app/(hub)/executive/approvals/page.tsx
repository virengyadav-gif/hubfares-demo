'use client';
/** CXO — approving authority for critical OTA changes (maker-checker). */
import { useState } from 'react';
import { ShieldCheck, XCircle } from 'lucide-react';
import { apiFetch, useApi, fmtDate } from '@/lib/client';
import { Card, PageHeader, Table, Td, Badge, Button, Tabs, Modal, Field, Input, Empty, Loading, Kpi, useToast } from '@/components/ui';
import { useSession, can } from '@/components/shell/AppShell';
export default function Approvals() {
  const s = useSession(); const toast = useToast();
  const { data, reload, loading } = useApi<any[]>('/approvals');
  const [t, setT] = useState<'PENDING' | 'ALL'>('PENDING'); const [rej, setRej] = useState<any>(null); const [note, setNote] = useState(''); const [busy, setBusy] = useState<string | null>(null);
  const decide = async (a: any, decision: 'APPROVE' | 'REJECT', n?: string) => {
    if (busy) return; setBusy(a.id);
    try { const r = await apiFetch<any>(`/approvals/${a.id}/decision`, { body: { decision, note: n || undefined } }); toast({ tone: decision === 'APPROVE' ? 'success' : 'info', title: decision === 'APPROVE' ? `${a.id} approved and applied` : `${a.id} rejected`, body: a.summary }); setRej(null); setNote(''); reload(); void r; }
    catch (e: any) { toast({ tone: 'error', title: 'Decision not recorded', body: e.message }); } finally { setBusy(null); }
  };
  const rows = (data ?? []).filter((a) => t === 'ALL' || a.status === 'PENDING');
  const canDecide = can(s, 'APPROVALS_DECIDE');
  return (
    <div>
      <PageHeader eyebrow="Executive" title="Approvals" subtitle="Critical changes to OTAs — credit limits, credit policies and booking blocks — wait here. They take effect only after approval." />
      <div className="mb-5 grid gap-4 sm:grid-cols-3"><Kpi label="Awaiting your approval" value={(data ?? []).filter((a) => a.status === 'PENDING').length} tone="warn" /><Kpi label="Approved" value={(data ?? []).filter((a) => a.status === 'APPROVED').length} tone="ok" /><Kpi label="Rejected" value={(data ?? []).filter((a) => a.status === 'REJECTED').length} tone="bad" /></div>
      <Card pad={false}>
        <Tabs className="px-4" value={t} onChange={setT} tabs={[{ id: 'PENDING', label: 'Pending', count: (data ?? []).filter((a) => a.status === 'PENDING').length }, { id: 'ALL', label: 'All', count: data?.length ?? 0 }]} />
        {loading && !data ? <Loading /> : !rows.length ? <Empty title={t === 'PENDING' ? 'Nothing awaiting approval' : 'No approval requests yet'} icon={<ShieldCheck className="h-6 w-6" />}>Requests from Hubfares admins appear here.</Empty> : (
          <Table head={['Request', 'Type', 'Agency', 'Change requested', 'Requested by', 'Status', '']}>
            {rows.map((a) => (
              <tr key={a.id} data-testid={`approval-${a.id}`}>
                <Td className="font-semibold">{a.id}</Td>
                <Td><Badge tone={a.kind === 'CREDIT_POLICY_CHANGE' ? 'violet' : 'red'}>{a.kind === 'CREDIT_POLICY_CHANGE' ? 'Credit policy' : 'Booking block'}</Badge></Td>
                <Td>{a.agencyName}</Td>
                <Td className="max-w-[360px] text-sm">{a.summary}</Td>
                <Td className="whitespace-nowrap text-sm">{a.requestedByName}<div className="text-xs text-muted">{fmtDate(a.requestedAt)}</div></Td>
                <Td><Badge tone={a.status === 'APPROVED' ? 'green' : a.status === 'REJECTED' ? 'red' : 'amber'}>{a.status === 'PENDING' ? 'Pending' : a.status.toLowerCase()}</Badge>{a.decidedByName && <div className="mt-0.5 text-xs text-muted">{a.decidedByName} · {fmtDate(a.decidedAt)}</div>}</Td>
                <Td className="whitespace-nowrap">{a.status === 'PENDING' && canDecide && <div className="flex gap-1.5"><Button size="sm" icon={<ShieldCheck className="h-3.5 w-3.5" />} loading={busy === a.id} onClick={() => decide(a, 'APPROVE')} data-testid={`approve-${a.id}`}>Approve</Button><Button size="sm" variant="secondary" icon={<XCircle className="h-3.5 w-3.5" />} onClick={() => { setRej(a); setNote(''); }}>Reject</Button></div>}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Modal open={!!rej} onClose={() => setRej(null)} title={`Reject ${rej?.id ?? ''}`} subtitle={rej?.summary} footer={<><Button variant="secondary" onClick={() => setRej(null)}>Cancel</Button><Button variant="danger" disabled={note.trim().length < 3} loading={busy === rej?.id} onClick={() => decide(rej, 'REJECT', note)}>Reject request</Button></>}>
        <Field label="Reason (shared with the requester)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Clear the overdue amount first" /></Field>
      </Modal>
    </div>
  );
}
