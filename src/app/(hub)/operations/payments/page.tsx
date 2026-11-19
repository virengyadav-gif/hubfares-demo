'use client';
/** OPS-07 — Payment reconciliation: received → awaiting match → matched / unmatched (with reason). */
import { useState } from 'react';
import { apiFetch, useApi, inr, fmtDate, newKey } from '@/lib/client';
import { Card, PageHeader, Table, Td, Button, Modal, Field, Select, Input, Badge, useToast, cx } from '@/components/ui';
import { useSession, can } from '@/components/shell/AppShell';
export default function Payments() {
  const s = useSession(); const toast = useToast();
  const { data, reload } = useApi<any[]>('/payment-events'); const agencies = useApi<any[]>('/agencies').data;
  const [res, setRes] = useState<any>(null); const [f, setF] = useState({ agencyId: '', note: '' }); const [busy, setBusy] = useState<string | null>(null);
  const act = async (id: string, fn: () => Promise<any>) => { setBusy(id); try { const r = await fn(); toast({ tone: ['CREDITED'].includes(r.data.status) ? 'success' : r.data.duplicate ? 'info' : 'error', title: `${r.data.status.replace(/_/g, ' ').toLowerCase()}`, body: r.data.reason ?? r.data.message ?? (r.data.walletCredited ? 'Wallet credited exactly once' : undefined) }); reload(); } catch (e: any) { toast({ tone: 'error', title: 'Action failed', body: e.message }); } finally { setBusy(null); } };
  const write = can(s, 'PAYMENT_MATCH');
  return (
    <div>
      <PageHeader eyebrow="Finance & Operations" title="Payment matching" subtitle="Every bank transfer is Received, then Awaiting Match until the matcher runs; it ends Matched (wallet credited once) or Unmatched with the exception reason." />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">{(['Received', 'Awaiting Match', 'Matched', 'Unmatched'] as const).map((k) => <Card key={k}><div className="text-xs font-semibold text-muted">{k}</div><div className="mt-1 text-2xl font-bold" data-testid={`recon-${k}`}>{k === 'Received' ? (data ?? []).length : (data ?? []).filter((p) => p.reconStatus === k || (k === 'Unmatched' && p.reconStatus === 'Rejected')).length}</div></Card>)}</div>
      <Card pad={false}>
        <Table head={['Received', 'UTR', 'Agency ref', 'Amount', 'Bank status', 'Reconciliation', 'Agency', 'Exception reason / evidence', '']}>
          {(data ?? []).map((p) => (
            <tr key={p.id} data-testid={`pay-${p.externalPaymentRef}`}><Td className="whitespace-nowrap text-muted">{fmtDate(p.receivedAt)}</Td><Td className="font-mono text-[12.5px] font-semibold">{p.externalPaymentRef}</Td><Td className="font-mono text-[12px]">{p.agencyHint}</Td><Td className="tabular">{p.currency === 'INR' ? inr(p.grossAmountMinor) : <Badge tone="red">{p.currency} {(p.grossAmountMinor / 100).toFixed(2)}</Badge>}</Td><Td><Badge tone="blue">{p.bankStatus}</Badge></Td><Td><Badge tone={p.reconStatus === 'Matched' ? 'green' : p.reconStatus === 'Awaiting Match' ? 'amber' : 'red'} data-testid={`recon-status-${p.externalPaymentRef}`}>{p.reconStatus}</Badge></Td><Td>{p.agencyName ?? '—'}</Td><Td className={cx('max-w-[280px] text-xs', p.exceptionReason ? 'font-medium text-bad-600' : 'text-muted')}>{p.exceptionReason ?? (p.reconStatus === 'Matched' ? p.matching?.reason ?? 'Matched to agency virtual account' : 'Waiting for the matcher')}{p.replayCount > 0 && <Badge tone="gray" className="ml-1">{p.replayCount} replay(s) ignored</Badge>}</Td>
              <Td className="whitespace-nowrap">{write && <div className="flex gap-1.5">
                {p.status === 'RECEIVED' && <Button size="sm" loading={busy === p.id} onClick={() => act(p.id, () => apiFetch(`/payment-events/${p.id}/match`, { method: 'POST', idem: newKey() }))}>Run matcher</Button>}
                {p.status === 'CREDITED' && <Button size="sm" variant="secondary" loading={busy === p.id} onClick={() => act(p.id, () => apiFetch('/payment-events/replay', { body: { externalRef: p.externalPaymentRef } }))}>Replay webhook</Button>}
                {p.status === 'UNMATCHED' && <Button size="sm" variant="secondary" onClick={() => { setRes(p); setF({ agencyId: '', note: '' }); }}>Resolve</Button>}
                {['UNMATCHED', 'EXCEPTION', 'RECEIVED'].includes(p.status) && <Button size="sm" variant="ghost" onClick={() => act(p.id, () => apiFetch(`/payment-events/${p.id}/reject`, { method: 'POST' }))}>Reject</Button>}
              </div>}</Td></tr>
          ))}
        </Table>
      </Card>
      <Modal open={!!res} onClose={() => setRes(null)} title={`Resolve ${res?.externalPaymentRef}`} subtitle="Assign the verified agency (audited); the matcher then runs once." footer={<><Button variant="secondary" onClick={() => setRes(null)}>Cancel</Button><Button disabled={!f.agencyId || f.note.length < 3} loading={busy === 'res'} onClick={async () => { setBusy('res'); try { const r = await apiFetch<any>(`/payment-events/${res.id}/resolve`, { idem: newKey(), body: f }); toast({ tone: 'success', title: `Payment ${r.data.status.toLowerCase()}` }); setRes(null); reload(); } catch (e: any) { toast({ tone: 'error', title: 'Not resolved', body: e.message }); } finally { setBusy(null); } }}>Assign & match</Button></>}>
        <div className="space-y-3"><Field label="Verified agency"><Select value={f.agencyId} onChange={(e) => setF({ ...f, agencyId: e.target.value })}><option value="">Select…</option>{agencies?.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}</Select></Field><Field label="Verification note (audited)"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Confirmed with agency finance by phone" /></Field></div>
      </Modal>
    </div>
  );
}
