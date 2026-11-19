'use client';
/** ADM-04 — OTA refund payout policies, versioned. New bookings snapshot the new version; existing bookings keep theirs. */
import { useEffect, useState } from 'react';
import { apiFetch, useApi, inr, fmtDate } from '@/lib/client';
import { Card, PageHeader, Field, Select, Input, Button, Notice, Table, Td, Badge, useToast } from '@/components/ui';
import { useSession, can } from '@/components/shell/AppShell';
export default function RefundPolicies() {
  const s = useSession(); const toast = useToast();
  const agencies = useApi<any[]>('/agencies').data;
  const [ag, setAg] = useState('agency_skyline');
  const pol = useApi<any[]>(`/agency-policies?agencyId=${ag}`, [ag]);
  const [cfg, setCfg] = useState<any>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { const c = pol.data?.find((p) => p.type === 'REFUND' && !p.effectiveUntil); if (c) setCfg({ ...c.config }); }, [pol.data]);
  const publish = async () => { setBusy(true); try { const r = await apiFetch<any>('/agency-policies', { method: 'PATCH', body: { agencyId: ag, type: 'REFUND', config: cfg } }); toast({ tone: 'success', title: `Published ${r.data.id}`, body: r.data.note }); pol.reload(); } catch (e: any) { toast({ tone: 'error', title: 'Not published', body: e.message }); } finally { setBusy(false); } };
  return (
    <div>
      <PageHeader eyebrow="Admin" title="OTA refund policies" subtitle="Supplier-settlement vs immediate-if-eligible payout, per agency." actions={<Select value={ag} onChange={(e) => setAg(e.target.value)} className="w-64" aria-label="Agency">{agencies?.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}</Select>} />
      <Notice tone="brand" className="mb-5" title="Booking-time snapshot">The policy effective when a booking is created is frozen on that booking and its claim. Publishing a new version affects bookings created afterwards only — cancellation of an older booking still follows its booked version.</Notice>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Publish new version">{cfg && <div className="space-y-3">
          <Field label="Agency payout mode"><Select value={cfg.payoutMode} disabled={!can(s, 'POLICY_EDIT')} onChange={(e) => setCfg({ ...cfg, payoutMode: e.target.value })} name="payoutMode"><option value="SUPPLIER_SETTLEMENT">Supplier settlement — credit after supplier refund received</option><option value="IMMEDIATE_IF_ELIGIBLE">Immediate if eligible — credit on cancellation</option></Select></Field>
          <Field label="Auto-approve limit (INR)" hint="Immediate claims above this wait for Finance approval"><Input type="number" value={cfg.autoApproveLimitMinor / 100} onChange={(e) => setCfg({ ...cfg, autoApproveLimitMinor: Math.round(Number(e.target.value) * 100) })} /></Field>
          {can(s, 'POLICY_EDIT') && <Button loading={busy} onClick={publish} data-testid="publish-refund">Publish version</Button>}
        </div>}</Card>
        <Card title="Versions">
          <Table dense head={['Policy', 'Mode', 'Auto-approve', 'Effective', 'Until']}>{(pol.data ?? []).filter((p) => p.type === 'REFUND').map((p) => <tr key={p.id}><Td className="font-semibold">{p.id}{!p.effectiveUntil && <Badge tone="green" className="ml-1">current</Badge>}</Td><Td><Badge tone={p.config.payoutMode === 'IMMEDIATE_IF_ELIGIBLE' ? 'green' : 'violet'}>{p.config.payoutMode.replace(/_/g, ' ').toLowerCase()}</Badge></Td><Td>{inr(p.config.autoApproveLimitMinor, { decimals: false })}</Td><Td className="text-xs">{fmtDate(p.effectiveFrom)}</Td><Td className="text-xs">{p.effectiveUntil ? fmtDate(p.effectiveUntil) : '—'}</Td></tr>)}</Table>
        </Card>
      </div>
    </div>
  );
}
