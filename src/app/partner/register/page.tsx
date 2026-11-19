'use client';
/** ONB-01 / ONB-02 — Partner registration with document-assisted autofill (WF-01/02). */
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { UploadCloud, FileText, Sparkles, Check, AlertTriangle, Save, Send, Loader2, FileWarning } from 'lucide-react';
import { apiFetch } from '@/lib/client';
import { Button, Card, Field, Input, Select, Notice, Badge, cx, ToastProvider, useToast } from '@/components/ui';

type Draft = any;
const EMPTY: Draft = {
  organization: { agencyName: '', turnoverInr: '', entityType: '', pan: '', gstin: '', registrationNumber: '', website: '' },
  director: { salutation: 'Ms', firstName: '', lastName: '', email: '', mobile: '' },
  finance: { salutation: 'Mr', firstName: '', lastName: '', email: '', mobile: '' },
  communication: { email: '', mobile: '', website: '' },
  address: { line1: '', line2: '', country: 'India', state: '', city: '', postalCode: '' },
  acknowledged: false,
};
const MAP: Record<string, string[]> = {
  agencyName: ['organization.agencyName'], entityType: ['organization.entityType'], registrationNumber: ['organization.registrationNumber'], gstin: ['organization.gstin'], pan: ['organization.pan'],
  website: ['organization.website', 'communication.website'], addressLine1: ['address.line1'], city: ['address.city'], state: ['address.state'], postalCode: ['address.postalCode'], country: ['address.country'],
  contactEmail: ['communication.email'], contactMobile: ['communication.mobile'], directorName: ['director.firstName', 'director.lastName'], directorSalutation: ['director.salutation'],
};
const LABELS: Record<string, string> = { directorSalutation: 'Director salutation', maskedId: 'Aadhaar (masked)', agencyName: 'Agency / legal name', entityType: 'Entity type', registrationNumber: 'Registration no.', gstin: 'GSTIN', pan: 'PAN', website: 'Website', addressLine1: 'Address line 1', city: 'City', state: 'State', postalCode: 'PIN / postal code', country: 'Country', contactEmail: 'Communication email', contactMobile: 'Communication mobile', directorName: 'Director / proprietor' };
const get = (o: any, p: string) => p.split('.').reduce((a, k) => a?.[k], o);
const set = (o: any, p: string, v: any) => { const c = structuredClone(o); const ks = p.split('.'); let x = c; ks.slice(0, -1).forEach((k) => (x = x[k])); x[ks[ks.length - 1]] = v; return c; };
function splitName(v: string): [string, string] { const parts = v.trim().split(/\s+/); return [parts[0] ?? '', parts.slice(1).join(' ')]; }

function validate(d: Draft): Record<string, string> {
  const e: Record<string, string> = {}; const req = (p: string, m = 'Required') => { if (!String(get(d, p) ?? '').trim()) e[p] = m; };
  ['organization.agencyName', 'organization.entityType', 'director.firstName', 'director.lastName', 'finance.firstName', 'finance.lastName', 'address.line1', 'address.state', 'address.city', 'address.country'].forEach((p) => req(p));
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(d.organization.pan).toUpperCase())) e['organization.pan'] = 'Format: 5 letters, 4 digits, 1 letter';
  if (!(Number(d.organization.turnoverInr) >= 0) || d.organization.turnoverInr === '') e['organization.turnoverInr'] = 'Enter estimated annual turnover in INR';
  for (const p of ['director.email', 'finance.email', 'communication.email']) if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(get(d, p))) e[p] = 'Enter a valid email';
  for (const p of ['director.mobile', 'finance.mobile', 'communication.mobile']) if (!/^\+?[0-9]{10,13}$/.test(get(d, p))) e[p] = 'Enter a valid mobile (e.g. +919000000000)';
  if (!/^[0-9A-Z -]{4,10}$/i.test(d.address.postalCode)) e['address.postalCode'] = 'Enter a valid PIN/postal code';
  if (!d.acknowledged) e.acknowledged = 'Please acknowledge before submitting';
  return e;
}

function RegisterInner() {
  const router = useRouter(); const toast = useToast();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [app, setApp] = useState<{ id: string; token: string; reference: string } | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [accepted, setAccepted] = useState<Record<string, 'accepted' | 'edited' | 'kept'>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'save' | 'submit' | null>(null);
  const [serverErr, setServerErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const prov = useRef<Record<string, string>>({});

  async function ensureApp() {
    if (app) return app;
    const r = await apiFetch<any>('/applications', { body: { draft } });
    const a = { id: r.data.id, token: r.data.token, reference: r.data.reference };
    setApp(a); return a;
  }
  const upd = (p: string, v: any) => { setDraft((d: Draft) => set(d, p, v)); setErrors((e) => { const n = { ...e }; delete n[p]; return n; }); };
  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true); setServerErr(null);
    try {
      const a = await ensureApp();
      for (const f of Array.from(files)) {
        const fd = new FormData(); fd.append('file', f);
        const res = await fetch(`/api/v1/applications/${a.id}/documents`, { method: 'POST', body: fd, headers: { 'x-application-token': a.token } });
        const j = await res.json();
        if (!res.ok) { toast({ tone: 'error', title: `${f.name}: upload rejected`, body: j.error?.message }); continue; }
        setDocs((d) => [...d, j.data]);
        if (j.data.status === 'EXTRACTED') autoApply(j.data);
        toast({ tone: j.data.status === 'EXTRACTED' ? 'success' : 'info', title: j.data.status === 'EXTRACTED' ? `Details filled from ${f.name}` : `${f.name}: please fill the details manually`, body: j.data.status === 'EXTRACTED' ? 'Review the prefilled values before submitting.' : j.data.warnings?.[0] });
      }
    } catch (e: any) { setServerErr(e.message); } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }
  /** Fill every empty form field from a freshly extracted document; typed values are never overwritten. */
  function autoApply(doc: any) {
    const fields = (doc.fields ?? []).filter((f: any) => MAP[f.name] && !f.reviewRequired);
    if (!fields.length) return;
    setDraft((d0: Draft) => {
      let d = d0; const done: Record<string, 'accepted'> = {};
      for (const f of fields) {
        const targets = MAP[f.name];
        const empty = f.name === 'directorName' ? !`${d.director.firstName}${d.director.lastName}`.trim() : f.name === 'directorSalutation' ? true : f.name === 'country' ? true : !String(get(d, targets[0]) ?? '').trim();
        if (!empty) continue;
        if (f.name === 'directorName') { const [a, b] = splitName(f.value); d = set(set(d, 'director.firstName', a), 'director.lastName', b); }
        else for (const p of targets) d = set(d, p, f.value);
        targets.forEach((p) => (prov.current[p] = `${doc.originalName} · ${f.sourceLabel}`));
        done[`${doc.documentId}:${f.name}`] = 'accepted';
      }
      setAccepted((x) => ({ ...x, ...done }));
      return d;
    });
  }
  const candidates = useMemo(() => docs.flatMap((d) => (d.fields ?? []).map((f: any) => ({ ...f, docId: d.documentId, docName: d.originalName, docType: d.documentType }))).filter((f: any) => MAP[f.name]), [docs]);
  function apply(f: any) {
    let d = draft;
    if (f.name === 'directorName') { const [a, b] = splitName(f.value); d = set(set(d, 'director.firstName', a), 'director.lastName', b); }
    else for (const p of MAP[f.name]) d = set(d, p, f.value);
    MAP[f.name].forEach((p) => (prov.current[p] = `${f.docName} · ${f.sourceLabel} (${Math.round(f.confidence * 100)}%)`));
    setDraft(d); setAccepted((x) => ({ ...x, [`${f.docId}:${f.name}`]: 'accepted' }));
  }
  const currentFor = (f: any) => f.name === 'directorName' ? `${draft.director.firstName} ${draft.director.lastName}`.trim() : get(draft, MAP[f.name][0]) ?? '';
  async function saveDraft() {
    setBusy('save');
    try { const a = await ensureApp(); await apiFetch(`/applications/${a.id}`, { method: 'PATCH', body: { draft }, headers: { 'x-application-token': a.token } }); toast({ tone: 'success', title: 'Draft saved', body: `Reference ${a.reference}` }); }
    catch (e: any) { toast({ tone: 'error', title: 'Could not save', body: e.message }); } finally { setBusy(null); }
  }
  async function submit() {
    const e = validate(draft); setErrors(e);
    if (Object.keys(e).length) { setServerErr('Please fix the highlighted fields.'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setBusy('submit'); setServerErr(null);
    try {
      const a = await ensureApp();
      const payload = { ...draft, organization: { ...draft.organization, pan: draft.organization.pan.toUpperCase(), turnoverInr: Number(draft.organization.turnoverInr) } };
      for (const d of docs) await apiFetch(`/applications/${a.id}/documents/${d.documentId}/confirm`, { body: { reviewed: Object.fromEntries((d.fields ?? []).filter((f: any) => accepted[`${d.documentId}:${f.name}`]).map((f: any) => [f.name, f.value])) }, headers: { 'x-application-token': a.token } });
      await apiFetch(`/applications/${a.id}/submit`, { body: { draft: payload }, headers: { 'x-application-token': a.token } });
      router.push(`/partner/status?id=${a.id}&t=${a.token}`);
    } catch (e: any) { setServerErr(e.message); setBusy(null); }
  }
  const F = ({ p, label, type = 'text', placeholder, req = true, upper }: { p: string; label: string; type?: string; placeholder?: string; req?: boolean; upper?: boolean }) => (
    <Field label={label} required={req} error={errors[p]} hint={prov.current[p] ? `Prefilled from ${prov.current[p]}` : undefined}>
      <Input type={type} value={get(draft, p) ?? ''} placeholder={placeholder} invalid={!!errors[p]} onChange={(e) => upd(p, upper ? e.target.value.toUpperCase() : e.target.value)} className={prov.current[p] ? 'bg-brand-50/40' : ''} name={p} />
    </Field>
  );
  const Person = ({ k, title }: { k: 'director' | 'finance'; title: string }) => (
    <Card title={title}>
      <div className="grid gap-4 sm:grid-cols-[110px_1fr_1fr]">
        <Field label="Salutation" required><Select value={draft[k].salutation} onChange={(e) => upd(`${k}.salutation`, e.target.value)} name={`${k}.salutation`}><option>Mr</option><option>Ms</option><option>Mx</option></Select></Field>
        {F({ p: `${k}.firstName`, label: 'First name' })}{F({ p: `${k}.lastName`, label: 'Last name' })}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{F({ p: `${k}.email`, label: 'Email', type: 'email' })}{F({ p: `${k}.mobile`, label: 'Mobile', placeholder: '+919000000000' })}</div>
    </Card>
  );
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"><Link href="/" className="flex items-center gap-2"><Image src="/hubfares-logo.jpeg" alt="Hubfares" width={32} height={32} className="rounded-md" /><span className="font-bold">hub<span className="text-brand-500">fares</span></span></Link><div className="flex items-center gap-3">{app && <Badge tone="gray">Draft {app.reference}</Badge>}</div></div></header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6"><div className="text-xs font-bold uppercase tracking-wider text-brand-600">Partner registration</div><h1 className="text-2xl font-bold">Register your travel agency</h1><p className="mt-1 text-sm text-muted">B2B only. Your application goes to Hubfares Operations for verification and approval before any booking is possible.</p></div>
        {serverErr && <Notice tone="error" className="mb-4">{serverErr}</Notice>}
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <Card title="Document upload & autofill" subtitle="Upload a PAN card, Aadhaar card or business registration (PDF, PNG or JPG, max 5 MB). Details are filled in automatically.">
              <Notice tone="brand" title="Upload your business documents to automatically prefill available details. Review extracted information before submitting." className="mb-4">Prefilled values are marked as extracted — PAN and identity are verified separately by Hubfares.</Notice>
              <div onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }} className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/40 px-6 py-8 text-center transition hover:bg-brand-50" data-testid="upload-zone">
                {uploading ? <Loader2 className="h-8 w-8 animate-spin text-brand-500" /> : <UploadCloud className="h-8 w-8 text-brand-500" />}
                <div className="mt-2 font-semibold">{uploading ? 'Uploading & extracting…' : 'Drop files here or click to browse'}</div>
                <div className="text-xs text-muted">PAN card · Aadhaar card · business registration</div>
                <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} data-testid="file-input" />
              </div>
              {docs.length > 0 && <ul className="mt-4 space-y-2">{docs.map((d) => <li key={d.documentId} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">{d.status === 'EXTRACTED' ? <FileText className="h-4 w-4 text-ok-600" /> : <FileWarning className="h-4 w-4 text-warn-600" />}<span className="flex-1 truncate font-medium">{d.originalName}</span><span className="text-xs text-muted">{d.documentType.replace(/_/g, ' ').toLowerCase()}</span>{d.status === 'EXTRACTED' ? <Badge tone="blue">Extracted · {d.fields.length}</Badge> : <Badge tone="amber">Needs manual review</Badge>}<Badge tone="gray">Not verified</Badge></li>)}</ul>}
            </Card>
            <Card title="Organization">
              <div className="grid gap-4 sm:grid-cols-2">
                {F({ p: 'organization.agencyName', label: 'Agency / legal name' })}
                <Field label="Entity type" required error={errors['organization.entityType']} hint={prov.current['organization.entityType'] ? `Prefilled from ${prov.current['organization.entityType']}` : undefined}><Select value={draft.organization.entityType} onChange={(e) => upd('organization.entityType', e.target.value)} name="organization.entityType"><option value="">Select…</option><option value="PROPRIETORSHIP">Proprietorship</option><option value="PARTNERSHIP">Partnership</option><option value="LLP">LLP</option><option value="PRIVATE_LIMITED">Private Limited</option><option value="PUBLIC_LIMITED">Public Limited</option></Select></Field>
                {F({ p: 'organization.turnoverInr', label: 'Estimated annual turnover (INR)', type: 'number' })}
                {F({ p: 'organization.pan', label: 'PAN', placeholder: 'ABCDE1234F', upper: true })}
                {F({ p: 'organization.gstin', label: 'GSTIN', req: false, upper: true })}
                {F({ p: 'organization.registrationNumber', label: 'Business / agency registration', req: false })}
              </div>
            </Card>
            {Person({ k: 'director', title: 'Director / proprietor' })}
            {Person({ k: 'finance', title: 'Finance controller' })}
            <Card title="Communication & registered address">
              <div className="grid gap-4 sm:grid-cols-3">{F({ p: 'communication.email', label: 'Email', type: 'email' })}{F({ p: 'communication.mobile', label: 'Mobile' })}{F({ p: 'communication.website', label: 'Website', req: false })}</div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">{F({ p: 'address.line1', label: 'Address line 1' })}{F({ p: 'address.line2', label: 'Address line 2', req: false })}</div>
              <div className="mt-4 grid gap-4 sm:grid-cols-4">{F({ p: 'address.country', label: 'Country' })}{F({ p: 'address.state', label: 'State' })}{F({ p: 'address.city', label: 'City' })}{F({ p: 'address.postalCode', label: 'PIN / postal code' })}</div>
            </Card>
            <Card>
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-brand-500" checked={draft.acknowledged} onChange={(e) => upd('acknowledged', e.target.checked)} name="acknowledged" /><span>I confirm the information is correct and understand uploaded documents are used only to prefill this application. </span></label>
              {errors.acknowledged && <div className="mt-1 text-xs font-medium text-bad-600">{errors.acknowledged}</div>}
              <div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="secondary" icon={<Save className="h-4 w-4" />} loading={busy === 'save'} onClick={saveDraft}>Save draft</Button><Button icon={<Send className="h-4 w-4" />} loading={busy === 'submit'} onClick={submit} data-testid="submit-application">Submit application</Button></div>
            </Card>
          </div>
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <Card title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-500" />Review extracted values</span>} subtitle="Values filled from your documents (marked Extracted — verified later by Hubfares). Typed values are never overwritten silently.">
              {!candidates.length ? <p className="text-sm text-muted">Upload a supported document to see extracted candidates with source and confidence.</p> : (
                <ul className="space-y-2.5" data-testid="extraction-review">
                  {candidates.map((f: any) => {
                    const key = `${f.docId}:${f.name}`; const cur = String(currentFor(f) ?? ''); const conflict = cur && cur !== f.value && !accepted[key]; const done = accepted[key];
                    return (
                      <li key={key} className={cx('rounded-lg border p-3', done ? 'border-ok-600/30 bg-ok-50/40' : f.reviewRequired ? 'border-warn-600/30 bg-warn-50/50' : 'border-line')}>
                        <div className="flex items-center justify-between gap-2"><span className="text-[12px] font-semibold text-muted">{LABELS[f.name] ?? f.name}</span><span className={cx('text-[11px] font-bold', f.confidence >= 0.9 ? 'text-ok-600' : f.confidence >= 0.75 ? 'text-info-600' : 'text-warn-600')}>{Math.round(f.confidence * 100)}%</span></div>
                        <div className="mt-0.5 break-words text-sm font-semibold">{f.value}</div>
                        <div className="mt-0.5 text-[11px] text-muted">{f.docName} · “{f.sourceLabel}” · p.{f.sourcePage}</div>
                        {f.reviewRequired && <div className="mt-1 flex items-center gap-1 text-[11.5px] font-semibold text-warn-600"><AlertTriangle className="h-3 w-3" />Review required</div>}
                        {conflict && <div className="mt-1 text-[11.5px] text-warn-600">You typed “{cur}”. Choose which to keep.</div>}
                        <div className="mt-2 flex gap-2">{done ? <Badge tone="green" icon={<Check className="h-3 w-3" />}>{done === 'accepted' ? 'Applied — still editable' : 'Kept yours'}</Badge> : <><Button size="sm" onClick={() => apply(f)}>{conflict ? 'Use extracted' : 'Accept'}</Button>{conflict && <Button size="sm" variant="secondary" onClick={() => setAccepted((x) => ({ ...x, [key]: 'kept' }))}>Keep mine</Button>}</>}</div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
export default function RegisterPage() { return <ToastProvider><RegisterInner /></ToastProvider>; }
