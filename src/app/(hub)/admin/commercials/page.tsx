'use client';
/** ADM-03 — Simplified Hubfares→OTA core commercial rules (functional; new quotes only). */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { apiFetch, useApi, inr, fmtDate } from '@/lib/client';
import { Card, PageHeader, Table, Td, Badge, Button, Modal, Field, Input, Select, Toggle, Notice, useToast } from '@/components/ui';
const PREVIEW = { supplierBaseMinor: 2550000, supplierTaxMinor: 450000 };
const roundHalfUp = (b: number, bps: number) => Math.floor((b * bps * 2 + 10000) / 20000);
export default function Commercials() {
  const toast = useToast();
  const { data, reload } = useApi<any[]>('/core-commercial-rules'); const agencies = useApi<any[]>('/agencies').data;
  const [e, setE] = useState<any>(null);
  const save = async () => { try { const { id, ...r } = e; const body = { label: r.label, agencyId: r.agencyId || null, airlineCode: r.airlineCode || null, origin: r.origin || null, destination: r.destination || null, fixedFeeMinor: Number(r.fixedFeeMinor), percentBps: Number(r.percentBps), disclosedServiceFeeMinor: Number(r.disclosedServiceFeeMinor), priority: Number(r.priority), enabled: r.enabled }; const res = await apiFetch<any>(id ? `/core-commercial-rules/${id}` : '/core-commercial-rules', { method: id ? 'PATCH' : 'POST', body }); toast({ tone: 'success', title: `Saved ${res.data.id} v${res.data.ruleVersion}`, body: 'Applies to new quotes only — booked prices are immutable.' }); setE(null); reload(); } catch (err: any) { toast({ tone: 'error', title: 'Not saved', body: err.message }); } };
  const prev = e ? PREVIEW.supplierBaseMinor + PREVIEW.supplierTaxMinor + Number(e.fixedFeeMinor || 0) + roundHalfUp(PREVIEW.supplierBaseMinor, Number(e.percentBps || 0)) + Number(e.disclosedServiceFeeMinor || 0) : 0;
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Hubfares core commercial rules" subtitle="Deterministic precedence: agency+airline+route → agency+airline → agency+route → agency default → global airline/route → global default." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setE({ label: '', agencyId: '', airlineCode: '', origin: '', destination: '', fixedFeeMinor: 20000, percentBps: 0, disclosedServiceFeeMinor: 0, priority: 5, enabled: true })}>New rule</Button>} />
      <Notice tone="info" className="mb-5">This is the only executable pricing layer in the POC. sell = supplier base + supplier tax + fixed fee + round-half-up(base × bps / 10 000) + disclosed service fee. OTA downstream markup and advanced BF/TF expressions never enter this calculation.</Notice>
      <Card pad={false}>
        <Table head={['Rule', 'Scope', 'Fixed fee', '% of base', 'Service fee', 'Priority', 'Version', 'Effective from', 'Status', '']}>
          {(data ?? []).map((r) => <tr key={r.id} data-testid={`rule-${r.id}`}><Td><div className="font-semibold">{r.label}</div><div className="font-mono text-[11px] text-muted">{r.id}</div></Td><Td className="text-xs">{r.agencyName}{r.airlineCode && ` · ${r.airlineCode}`}{r.origin && ` · ${r.origin}-${r.destination}`}</Td><Td className="tabular">{inr(r.fixedFeeMinor)}</Td><Td>{(r.percentBps / 100).toFixed(2)}%</Td><Td className="tabular">{inr(r.disclosedServiceFeeMinor)}</Td><Td>{r.priority}</Td><Td><Badge tone="gray">v{r.ruleVersion}</Badge></Td><Td className="text-xs text-muted">{fmtDate(r.effectiveFrom)}</Td><Td><Badge tone={r.enabled ? 'green' : 'gray'}>{r.enabled ? 'Enabled' : 'Disabled'}</Badge></Td><Td><Button size="sm" variant="ghost" onClick={() => setE({ ...r, agencyId: r.agencyId ?? '', airlineCode: r.airlineCode ?? '', origin: r.origin ?? '', destination: r.destination ?? '' })} data-testid={`edit-${r.id}`}>Edit</Button></Td></tr>)}
        </Table>
      </Card>
      <Modal open={!!e} onClose={() => setE(null)} title={e?.id ? `Edit ${e.id}` : 'New core rule'} wide footer={<><Button variant="secondary" onClick={() => setE(null)}>Cancel</Button><Button onClick={save} data-testid="save-rule">Save — new quotes only</Button></>}>
        {e && <div className="grid gap-5 md:grid-cols-[1fr_280px]">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Label" className="sm:col-span-2"><Input value={e.label} onChange={(x) => setE({ ...e, label: x.target.value })} /></Field>
            <Field label="Agency"><Select value={e.agencyId} onChange={(x) => setE({ ...e, agencyId: x.target.value })} disabled={e.id === 'core_global_default'}><option value="">All agencies (global)</option>{agencies?.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}</Select></Field>
            <Field label="Airline"><Input value={e.airlineCode} maxLength={3} onChange={(x) => setE({ ...e, airlineCode: x.target.value.toUpperCase() })} placeholder="Any" disabled={e.id === 'core_global_default'} /></Field>
            <Field label="Origin airport"><Input value={e.origin} maxLength={3} onChange={(x) => setE({ ...e, origin: x.target.value.toUpperCase() })} placeholder="Any" disabled={e.id === 'core_global_default'} /></Field>
            <Field label="Destination airport"><Input value={e.destination} maxLength={3} onChange={(x) => setE({ ...e, destination: x.target.value.toUpperCase() })} placeholder="Any (LHR for London)" disabled={e.id === 'core_global_default'} /></Field>
            <Field label="Fixed fee (INR)"><Input type="number" value={e.fixedFeeMinor / 100} onChange={(x) => setE({ ...e, fixedFeeMinor: Math.round(Number(x.target.value) * 100) })} name="fixedFee" /></Field>
            <Field label="% of supplier base (bps)" hint="100 bps = 1%"><Input type="number" value={e.percentBps} onChange={(x) => setE({ ...e, percentBps: Number(x.target.value) })} /></Field>
            <Field label="Disclosed service fee (INR)"><Input type="number" value={e.disclosedServiceFeeMinor / 100} onChange={(x) => setE({ ...e, disclosedServiceFeeMinor: Math.round(Number(x.target.value) * 100) })} /></Field>
            <Field label="Priority"><Input type="number" value={e.priority} onChange={(x) => setE({ ...e, priority: Number(x.target.value) })} /></Field>
            <Toggle checked={e.enabled} onChange={(v) => setE({ ...e, enabled: v })} label="Enabled" disabled={e.id === 'core_global_default'} />
          </div>
          <div className="rounded-xl bg-slate-50 p-4 text-sm"><div className="mb-2 font-semibold">Preview</div><div className="text-xs text-muted">Sample: supplier base ₹25,500 + tax ₹4,500 (BA Saver BOM-LHR)</div><div className="mt-3 text-2xl font-bold">{inr(prev)}</div><div className="mt-1 text-xs text-muted">per adult, if this rule is selected</div><p className="mt-3 text-[11.5px] text-muted">Saving bumps the rule version and sets effective-from = now. Accepted quotes and booked snapshots keep their original rule ID/version.</p></div>
        </div>}
      </Modal>
    </div>
  );
}
