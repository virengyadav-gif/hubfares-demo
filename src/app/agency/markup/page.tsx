'use client';
/** OTA-19 — Agency downstream markup: UI configuration only. Never applied to fares, bookings, wallet or analytics. */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { apiFetch, useApi, inr } from '@/lib/client';
import { Card, PageHeader, Table, Td, Badge, Button, Modal, Field, Input, Select, Toggle, Notice, useToast } from '@/components/ui';
import { useSession, can } from '@/components/shell/AppShell';

const blank = { name: '', journey: 'DOMESTIC', tripTypes: ['ONE_WAY', 'RETURN'], airlineFilter: 'ALL', cabinFilter: 'ALL', markupKind: 'FIXED', value: 5000, targetUserIds: [] as string[], enabled: true };
export default function Markup() {
  const s = useSession(); const toast = useToast(); const admin = can(s, 'AGENCY_MARKUP_MANAGE');
  const { data, reload } = useApi<any[]>('/agency-markup-rules');
  const [edit, setEdit] = useState<any>(null); const [err, setErr] = useState<string | null>(null);
  async function save() {
    setErr(null);
    try { const { id, ...body } = edit; await apiFetch(id ? `/agency-markup-rules/${id}` : '/agency-markup-rules', { method: id ? 'PATCH' : 'POST', body: { name: body.name, journey: body.journey, tripTypes: body.tripTypes, airlineFilter: body.airlineFilter, cabinFilter: body.cabinFilter, markupKind: body.markupKind, value: Number(body.value), enabled: body.enabled } }); toast({ tone: 'success', title: 'Markup rule saved', body: 'Applies to all users of your agency.' }); setEdit(null); reload(); }
    catch (e: any) { setErr(e.message); }
  }
  const fmt = (m: any) => m.markupKind === 'FIXED' ? inr(m.value, { decimals: false }) : `${(m.value / 100).toFixed(2)}%`;
  return (
    <div>
      <PageHeader eyebrow="Agency settings" title="Manage markup" subtitle="Your agency's resale markup. One set of rules applies to every user of your agency." actions={admin && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ ...blank })} data-testid="add-markup">Add rule</Button>} />
      <Notice tone="info" className="mb-5">Markup is applied at agency level and is the same for all your users. It is your margin when reselling to your customers — Hubfares net fares and your wallet are not affected.</Notice>
      <Card pad={false}>
        <Table head={['Rule', 'Journey', 'Trip type', 'Airline', 'Cabin', 'Markup', 'Applies to', 'Status', '']}>
          {(data ?? []).map((m) => <tr key={m.id}><Td className="font-semibold">{m.name}</Td><Td>{m.journey.toLowerCase()}</Td><Td>{m.tripTypes.map((t: string) => t.replace('_', '-').toLowerCase()).join(', ')}</Td><Td>{m.airlineFilter}</Td><Td>{m.cabinFilter.toLowerCase()}</Td><Td className="font-semibold">{fmt(m)}</Td><Td className="text-xs text-muted">All agency users</Td><Td><Badge tone={m.enabled ? 'green' : 'gray'}>{m.enabled ? 'Active' : 'Inactive'}</Badge></Td><Td>{admin && <Button size="sm" variant="ghost" onClick={() => setEdit({ ...m })}>Edit</Button>}</Td></tr>)}
        </Table>
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit markup rule' : 'New markup rule'} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save} data-testid="save-markup">Save (UI only)</Button></>}>
        {edit && <div className="space-y-3">
          {err && <Notice tone="error">{err}</Notice>}
          <Field label="Rule name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} name="markupName" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Journey"><Select value={edit.journey} onChange={(e) => setEdit({ ...edit, journey: e.target.value })}><option value="DOMESTIC">Domestic</option><option value="INTERNATIONAL">International</option><option value="BOTH">Both</option></Select></Field>
            <Field label="Cabin"><Select value={edit.cabinFilter} onChange={(e) => setEdit({ ...edit, cabinFilter: e.target.value })}>{['ALL', 'ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'].map((c) => <option key={c} value={c}>{c.replace('_', ' ').toLowerCase()}</option>)}</Select></Field>
            <Field label="Airline"><Select value={edit.airlineFilter} onChange={(e) => setEdit({ ...edit, airlineFilter: e.target.value })}>{['ALL', 'AI', '6E', 'BA', 'QR', 'EK', 'SQ', 'LH'].map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Markup type"><Select value={edit.markupKind} onChange={(e) => setEdit({ ...edit, markupKind: e.target.value })}><option value="FIXED">Fixed amount (INR)</option><option value="PERCENT">Percentage</option></Select></Field>
          </div>
          <div className="flex flex-wrap gap-4">{['ONE_WAY', 'RETURN', 'MULTI_CITY'].map((t) => <label key={t} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-500" checked={edit.tripTypes.includes(t)} onChange={(e) => setEdit({ ...edit, tripTypes: e.target.checked ? [...edit.tripTypes, t] : edit.tripTypes.filter((x: string) => x !== t) })} />{t.replace('_', '-').toLowerCase()}</label>)}</div>
          <Field label={edit.markupKind === 'FIXED' ? 'Value (INR)' : 'Value (%)'}><Input type="number" min={0} step={edit.markupKind === 'FIXED' ? 1 : 0.01} value={edit.markupKind === 'FIXED' ? edit.value / 100 : edit.value / 100} onChange={(e) => setEdit({ ...edit, value: Math.round(Number(e.target.value) * 100) })} name="markupValue" /></Field>
          <Toggle checked={edit.enabled} onChange={(v) => setEdit({ ...edit, enabled: v })} label="Active" />
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-muted">Example: a ₹30,632.50 fare with this rule would be shown to your customer as {edit.markupKind === 'FIXED' ? inr(3063250 + Number(edit.value)) : inr(3063250 + Math.round(3063250 * edit.value / 10000))}. Not executed.</p>
        </div>}
      </Modal>
    </div>
  );
}
