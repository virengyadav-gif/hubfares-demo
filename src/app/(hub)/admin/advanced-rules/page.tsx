'use client';
/** ADM-08 — Advanced commercial rule builder (guided). Expressions are stored text; never evaluated. */
import { useState } from 'react';
import { Plus, Minus, History } from 'lucide-react';
import { apiFetch, useApi, fmtDate } from '@/lib/client';
import { Card, PageHeader, Button, Field, Input, Select, Toggle, Notice, Badge, SimTag, Drawer, Timeline, useToast, cx } from '@/components/ui';
const CRITERIA: [string, string][] = [['travelPeriod', 'Travel period'], ['bookingPeriod', 'Booking period'], ['flightNumbers', 'Flight numbers'], ['supplierIds', 'Supplier IDs'], ['sector', 'Sector'], ['destination', 'Destinations'], ['marketingCarrier', 'Marketing carrier'], ['operatingCarrier', 'Operating carrier'], ['fareBasis', 'Fare basis'], ['bookingClass', 'Booking class'], ['privateAccountCodes', 'Private account codes'], ['userIds', 'User ID'], ['paxTypes', 'Pax types'], ['priceRange', 'Price range'], ['cabin', 'Cabin classes'], ['weekdays', 'Allowed weekdays']];
export default function Advanced() {
  const toast = useToast();
  const { data, reload } = useApi<any[]>('/advanced-commercial-drafts');
  const [selId, setSelId] = useState<string | null>(null); const [d, setD] = useState<any>(null); const [hist, setHist] = useState(false);
  const pick = (x: any) => { setSelId(x.id); setD(structuredClone(x)); };
  if (data && !d && data[0]) pick(data[0]);
  const save = async () => { try { await apiFetch(selId ? `/advanced-commercial-drafts/${selId}` : '/advanced-commercial-drafts', { method: selId ? 'PATCH' : 'POST', body: { ruleName: d.ruleName, header: d.header, criteria: d.criteria, lines: d.lines, priority: Number(d.priority), enabled: d.enabled, note: 'Edited in rule builder' } }); toast({ tone: 'success', title: 'Draft saved — not executed', body: 'Expressions are preview text only.' }); reload(); } catch (e: any) { toast({ tone: 'error', title: 'Not saved', body: e.message }); } };
  const crit = (k: string, side: 'include' | 'exclude', v: string) => setD({ ...d, criteria: { ...d.criteria, [k]: { ...(d.criteria[k] ?? { include: '', exclude: '' }), [side]: v } } });
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Advanced commercial rule builder" subtitle="Inclusion/exclusion criteria, priorities and commission/markup expression lines." actions={<><Select className="w-72" value={selId ?? ''} onChange={(e) => { const x = data?.find((y) => y.id === e.target.value); if (x) pick(x); }} aria-label="Draft">{data?.map((x) => <option key={x.id} value={x.id}>{x.ruleName} (rev {x.draftRevision})</option>)}</Select><Button variant="secondary" onClick={() => { setSelId(null); setD({ ruleName: 'New draft', header: { description: '', searchType: 'ALL', airType: 'ALL', airline: 'ALL' }, criteria: {}, lines: [{ type: 'MARKUP', expression: '', applicableOnBooking: false, applicableOnInfant: false, applicableOnAllSegments: false }], priority: 100000, enabled: false, history: [] }); }}>New draft</Button></>} />
      <Notice tone="info" className="mb-5" title="Draft rules">Advanced rules are saved as drafts with full revision history for commercial review. Live pricing uses the Core Commercials rules.</Notice>
      {d && <div className="space-y-5">
        <Card title="Rule header" actions={<><Badge tone={d.enabled ? 'green' : 'gray'}>{d.enabled ? 'Enabled (draft)' : 'Disabled'}</Badge><Button size="sm" variant="ghost" icon={<History className="h-4 w-4" />} onClick={() => setHist(true)}>History</Button></>}>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Rule name" className="md:col-span-2"><Input value={d.ruleName} onChange={(e) => setD({ ...d, ruleName: e.target.value })} /></Field>
            <Field label="Description"><Input value={d.header.description ?? ''} onChange={(e) => setD({ ...d, header: { ...d.header, description: e.target.value } })} /></Field>
            <Field label="Priority"><Input type="number" value={d.priority} onChange={(e) => setD({ ...d, priority: e.target.value })} /></Field>
            <Field label="Search type"><Select value={d.header.searchType} onChange={(e) => setD({ ...d, header: { ...d.header, searchType: e.target.value } })}><option>ALL</option><option>ONE_WAY</option><option>RETURN</option></Select></Field>
            <Field label="Air type"><Select value={d.header.airType} onChange={(e) => setD({ ...d, header: { ...d.header, airType: e.target.value } })}><option>ALL</option><option>DOMESTIC</option><option>INTERNATIONAL</option></Select></Field>
            <Field label="Airline"><Input value={d.header.airline} onChange={(e) => setD({ ...d, header: { ...d.header, airline: e.target.value.toUpperCase() } })} /></Field>
            <div className="flex items-end pb-2"><Toggle checked={d.enabled} onChange={(v) => setD({ ...d, enabled: v })} label="Enabled" /></div>
          </div>
        </Card>
        <Card title="Criteria" pad={false}>
          <div className="grid grid-cols-[200px_1fr_1fr] border-b border-line bg-ink-800 text-xs font-bold uppercase tracking-wide text-white"><div className="px-4 py-2.5">Criteria</div><div className="px-4 py-2.5">Inclusion</div><div className="px-4 py-2.5">Exclusion</div></div>
          {CRITERIA.map(([k, l], i) => <div key={k} className={cx('grid grid-cols-[200px_1fr_1fr] items-center', i % 2 && 'bg-slate-50/60')}><div className="px-4 py-2 text-sm font-medium">{l}</div><div className="px-3 py-1.5"><Input className="h-8 text-xs" value={d.criteria[k]?.include ?? ''} onChange={(e) => crit(k, 'include', e.target.value)} placeholder="e.g. BOM-LHR,LHR-BOM" /></div><div className="px-3 py-1.5"><Input className="h-8 text-xs" value={d.criteria[k]?.exclude ?? ''} onChange={(e) => crit(k, 'exclude', e.target.value)} /></div></div>)}
        </Card>
        <Card title="Commercial info" subtitle="Expression lines (text only)">
          <div className="space-y-3">{d.lines.map((ln: any, i: number) => (
            <div key={i} className="grid items-end gap-3 rounded-lg border-l-4 border-brand-500 bg-slate-50 p-3 md:grid-cols-[180px_1fr_auto_auto_auto_auto]">
              <Field label="Type of commission"><Select value={ln.type} onChange={(e) => { const L = [...d.lines]; L[i] = { ...ln, type: e.target.value }; setD({ ...d, lines: L }); }}><option value="IATA_COMMISSION">IATA</option><option value="MARKUP">Markup</option><option value="SERVICE_FEE">Service fee</option></Select></Field>
              <Field label="Expression"><Input className="font-mono" value={ln.expression} onChange={(e) => { const L = [...d.lines]; L[i] = { ...ln, expression: e.target.value }; setD({ ...d, lines: L }); }} placeholder="5*BF · 1*TF · 270" /></Field>
              {(['applicableOnBooking', 'applicableOnInfant', 'applicableOnAllSegments'] as const).map((f) => <label key={f} className="flex items-center gap-1.5 pb-2 text-xs"><input type="checkbox" className="accent-brand-500" checked={ln[f]} onChange={(e) => { const L = [...d.lines]; L[i] = { ...ln, [f]: e.target.checked }; setD({ ...d, lines: L }); }} />{{ applicableOnBooking: 'On booking', applicableOnInfant: 'On infant', applicableOnAllSegments: 'All segments' }[f]}</label>)}
              <button aria-label="Remove line" className="mb-2 rounded-full bg-bad-600 p-1 text-white" onClick={() => setD({ ...d, lines: d.lines.filter((_: any, j: number) => j !== i) })}><Minus className="h-3.5 w-3.5" /></button>
            </div>
          ))}</div>
          <div className="mt-4 flex items-center justify-between"><Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setD({ ...d, lines: [...d.lines, { type: 'MARKUP', expression: '', applicableOnBooking: false, applicableOnInfant: false, applicableOnAllSegments: false }] })}>Add line</Button><Button onClick={save} data-testid="save-draft">Save draft</Button></div>
          <div className="mt-4 rounded-lg bg-ink-800 p-3 font-mono text-xs text-white/80">Preview: {d.lines.map((l: any) => `${l.type}(${l.expression || '∅'})`).join(' + ')} → <span className="text-brand-400">not evaluated</span></div>
        </Card>
      </div>}
      <Drawer open={hist} onClose={() => setHist(false)} title="Revision history" width="max-w-md">{d && <Timeline items={(d.history ?? []).map((h: any) => ({ at: h.at, status: `REVISION ${h.revision}`, note: h.note, by: h.by }))} />}</Drawer>
    </div>
  );
}
