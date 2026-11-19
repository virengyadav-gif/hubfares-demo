'use client';
/** OPS-07 — Payment matching queue: automated matcher, exceptions, guided manual resolution, replay control. */
import { useState } from 'react';
import { apiFetch, useApi, inr, fmtDate, newKey } from '@/lib/client';
import { Card, PageHeader, Table, Td, Status, Button, Modal, Field, Select, Input, Notice, SimTag, Badge, useToast } from '@/components/ui';
import { useSession, can } from '@/components/shell/AppShell';
export default function Payments() {
  const s = useSession(); const toast = useToast();
  const { data, reload } = useApi<any[]>('/payment-events'); const agencies = useApi<any[]>('/agencies').data;
  const [res, setRes] = useState<any>(null); const [f, setF] = useState({ agencyId: '', note: '' }); const [busy, setBusy] = useState<string | null>(null);
  const act = async (id: string, fn: () => Promise<any>) => { setBusy(id); try { const r = await fn(); toast({ tone: ['CREDITED'].includes(r.data.status) ? 'success' : r.data.duplicate ? 'info' : 'error', title: `${r.data.status.replace(/_/g, ' ').toLowerCase()}`, body: r.data.reason ?? r.data.message ?? (r.data.walletCredited ? 'Wallet credited exactly once' : undefined) }); reload(); } catch (e: any) { toast({ tone: 'error', title: 'Action failed', body: e.message }); } finally { setBusy(null); } };
  const write = can(s, 'PAYMENT_MATCH');
  return (
    <div>
      <PageHeader eyebrow="Finance & Operations" title="Payment matching" subtitle="Received → matched → credited. Unmatched, wrong-amount and unsupported-currency events never credit a wallet." badges={<SimTag kind="Demo" />} />
      <Notice tone="info" className="mb-4">Simulated bank events (provider DEMO_BANK). Matching checks currency, a recognised agency virtual reference and any declared intimation amount. Each UTR can credit at most once.</Notice>
      <Card pad={false}>
        <Table head={['Received', 'UTR', 'Agency ref', 'Amount', 'Status', 'Agency', 'Reason / evidence', '']}>
          {(data ?? []).map((p) => (
            <tr key={p.id} data-testid={`pay-${p.externalPaymentRef}`}><Td className="whitespace-nowrap text-muted">{fmtDate(p.receivedAt)}</Td><Td className="font-mono text-[12.5px] font-semibold">{p.externalPaymentRef}</Td><Td className="font-mono text-[12px]">{p.agencyHint}</Td><Td className="tabular">{p.currency === 'INR' ? inr(p.grossAmountMinor) : <Badge tone="red">{p.currency} {(p.grossAmountMinor / 100).toFixed(2)}</Badge>}</Td><Td><Status value={p.status} /></Td><Td>{p.agencyId?.replace('agency_', '') ?? '—'}</Td><Td className="max-w-[260px] text-xs text-muted">{p.matching?.reason ?? (p.matching?.ledgerEntryId ? `Ledger ${p.matching.ledgerEntryId}` : '')}{p.replayCount > 0 && <Badge tone="gray" className="ml-1">{p.replayCount} replay(s) ignored</Badge>}</Td>
              <Td className="whitespace-nowrap">{write && <div className="flex gap-1.5">
                {p.status === 'RECEIVED' && <Button size="sm" loading={busy === p.id} onClick={() => act(p.id, () => apiFetch(`/payment-events/${p.id}/match`, { method: 'POST', idem: newKey() }))}>Run matcher</Button>}
                {p.status === 'CREDITED' && <Button size="sm" variant="secondary" loading={busy === p.id} onClick={() => act(p.id, () => apiFetch('/payment-events/replay', { body: { externalRef: p.externalPaymentRef } }))}>Replay webhook</Button>}
                {p.status === 'UNMATCHED' && <Button size="sm" variant="secondary" onClick={() => { setRes(p); setF({ agencyId: '', note: '' }); }}>Resolve</Button>}
                {['UNMATCHED', 'EXCEPTION', 'RECEIVED'].includes(p.status) && <Button size="sm" variant="ghost" onClick={() => act(p.id, () => apiFetch(`/payment-events/${p.id}/reject`, { method: 'POST' }))}>Reject</Button>}
              </div>}</Td></tr>
          ))}
        </Table>
      </Card>
      <Modal open={!!res} onClose={() => setRes(null)} title={`Resolve ${res?.externalPaymentRef}`} subtitle="Guided manual resolution — auditable assignment, then the matcher runs once." footer={<><Button variant="secondary" onClick={() => setRes(null)}>Cancel</Button><Button disabled={!f.agencyId || f.note.length < 3} loading={busy === 'res'} onClick={async () => { setBusy('res'); try { const r = await apiFetch<any>(`/payment-events/${res.id}/resolve`, { idem: newKey(), body: f }); toast({ tone: 'success', title: `Payment ${r.data.status.toLowerCase()}` }); setRes(null); reload(); } catch (e: any) { toast({ tone: 'error', title: 'Not resolved', body: e.message }); } finally { setBusy(null); } }}>Assign & match</Button></>}>
        <div className="space-y-3"><Field label="Verified agency"><Select value={f.agencyId} onChange={(e) => setF({ ...f, agencyId: e.target.value })}><option value="">Select…</option>{agencies?.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}</Select></Field><Field label="Verification note (audited)"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Confirmed with agency finance by phone (demo)" /></Field></div>
      </Modal>
    </div>
  );
}
