'use client';
/** OPS-03 — KYC / approval detail. Extracted values and verification are visually distinct. */
import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, XCircle, CircleDashed, ShieldCheck, FileText } from 'lucide-react';
import { apiFetch, useApi, fmtDate } from '@/lib/client';
import { Card, PageHeader, Status, DL, Button, Notice, Badge, Timeline, Modal, Textarea, Loading, useToast, cx } from '@/components/ui';
import { useSession, can } from '@/components/shell/AppShell';

function Tick({ r }: { r: any }) {
  if (!r) return <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted"><CircleDashed className="h-5 w-5" />Not run</span>;
  if (r.mockResult === 'VERIFIED') return <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ok-600" data-testid="kyc-verified"><CheckCircle2 className="h-5 w-5 fill-ok-600 text-white" />Verified</span>;
  if (r.mockResult === 'NOT_SUBMITTED') return <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted"><CircleDashed className="h-5 w-5" />Not submitted</span>;
  return <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-bad-600"><XCircle className="h-5 w-5" />Failed</span>;
}
export default function AppDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const s = useSession(); const toast = useToast();
  const { data: a, reload } = useApi<any>(`/ops/applications/${id}`, [id]);
  const [busy, setBusy] = useState<string | null>(null); const [dec, setDec] = useState<null | 'REJECT' | 'MORE_INFO'>(null); const [note, setNote] = useState(''); const scn = 'kyc_ok';
  if (!a) return <Loading />;
  const open = ['SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED'].includes(a.status);
  async function kyc(checkType: string) { setBusy(checkType); try { const r = await apiFetch<any>(`/applications/${id}/verify-demo`, { body: { checkType, scenario: scn } }); toast({ tone: r.data.result === 'VERIFIED' ? 'success' : 'error', title: `${checkType} check: ${r.data.result.toLowerCase()}`, body: r.data.reason }); reload(); } catch (e: any) { toast({ tone: 'error', title: 'Check not run', body: e.message }); } finally { setBusy(null); } }
  async function decide(decision: string) { setBusy(decision); try { const r = await apiFetch<any>(`/applications/${id}/decision`, { body: { decision, note: note || undefined } }); toast({ tone: 'success', title: decision === 'APPROVE' ? `Approved · ${r.data.agencyId} active` : decision === 'MORE_INFO' ? `Information request emailed to ${r.data.emailSentTo ?? 'the applicant'}` : 'Application rejected', body: decision === 'APPROVE' ? `Initial Agency Admin: ${r.data.adminEmail}` : decision === 'MORE_INFO' ? 'You can still approve, reject or request more information at any time.' : r.data.emailSentTo ? `Decision emailed to ${r.data.emailSentTo}` : undefined }); setNote(''); setDec(null); reload(); } catch (e: any) { toast({ tone: 'error', title: 'Decision not recorded', body: e.message }); } finally { setBusy(null); } }
  const d = a.draft;
  return (
    <div>
      <Link href="/operations/applications" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" />Applications</Link>
      <PageHeader title={d.organization?.agencyName ?? a.reference} subtitle={`${a.reference} · submitted ${fmtDate(a.submitTime)}`} badges={<Status value={a.status} />}
        actions={open && can(s, 'APPLICATION_REVIEW') && <><Button variant="secondary" onClick={() => setDec('MORE_INFO')}>Request info</Button><Button variant="danger" onClick={() => setDec('REJECT')}>Reject</Button><Button icon={<ShieldCheck className="h-4 w-4" />} loading={busy === 'APPROVE'} onClick={() => decide('APPROVE')} disabled={a.kyc.PAN?.mockResult !== 'VERIFIED'} data-testid="approve">Approve & activate</Button></>} />
      {a.status === 'MORE_INFO_REQUIRED' && (() => { const h = [...(a.history ?? [])].reverse().find((x: any) => x.status === 'MORE_INFO_REQUIRED'); return <Notice tone="warn" className="mb-4" title="More information requested" data-testid="more-info-notice">{h?.note}{h?.emailSentTo && <> — emailed to <b>{h.emailSentTo}</b> on {fmtDate(h.at)}</>}. You can still verify, approve, reject or request more information.</Notice>; })()}
      {a.agencyId && <Notice tone="success" className="mb-4" title="Agency active">Created <Link href="/operations/agencies" className="font-semibold underline">{a.agencyId}</Link> with an initial Agency Admin and default prepaid / supplier-settlement policies.</Notice>}
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Card title="Application form (applicant-confirmed values)">
            <DL cols={3} items={[['Entity type', d.organization?.entityType], ['PAN (masked)', d.organization?.pan], ['GSTIN', d.organization?.gstin || '—'], ['Turnover (INR)', d.organization?.turnoverInr?.toLocaleString('en-IN')], ['Registration', d.organization?.registrationNumber || '—'], ['Website', d.organization?.website || d.communication?.website || '—'], ['Director', `${d.director?.salutation} ${d.director?.firstName} ${d.director?.lastName}`], ['Director email', d.director?.email], ['Finance', `${d.finance?.firstName} ${d.finance?.lastName}`], ['Comms', `${d.communication?.email} · ${d.communication?.mobile}`], ['Address', `${d.address?.line1}, ${d.address?.city}, ${d.address?.state} ${d.address?.postalCode}`], ['Country', d.address?.country]]} />
          </Card>
          <Card title="Documents & extraction" subtitle="Extraction = suggested values from the document. It never implies verification.">
            <div className="space-y-3">{a.documents.map((doc: any) => (
              <div key={doc.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm"><FileText className="h-4 w-4 text-brand-500" /><b>{doc.originalName}</b><Badge tone="gray">{doc.docType.replace(/_/g, ' ').toLowerCase()}</Badge><Status value={doc.extractionStatus} /><Badge tone="blue">Extracted ≠ verified</Badge></div>
                {doc.extraction?.fields?.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{doc.extraction.fields.slice(0, 8).map((f: any) => <span key={f.name} className={cx('rounded-md px-2 py-0.5 text-[11.5px]', f.reviewRequired ? 'bg-warn-50 text-warn-600' : 'bg-slate-100 text-slate-700')}>{f.name}: {f.name === 'pan' ? `${String(f.value).slice(0, 4)}••` : f.value} ({Math.round(f.confidence * 100)}%)</span>)}</div>}
              </div>
            ))}{!a.documents.length && <p className="text-sm text-muted">No documents uploaded.</p>}</div>
          </Card>
          <Card title="Timeline"><Timeline items={a.history} /></Card>
        </div>
        <aside className="space-y-5">
          <Card title="Verification" subtitle="Green tick only after a completed check.">
            <div className="space-y-3">
              {[['PAN', 'PAN check'], ['IDENTITY', 'Masked identity document'], ['BUSINESS', 'Business registration']].map(([k, l]) => (
                <div key={k} className="flex items-center justify-between gap-2 rounded-lg border border-line p-3">
                  <div><div className="text-sm font-semibold">{l}</div><Tick r={a.kyc[k]} />{a.kyc[k]?.reason && <div className="mt-0.5 text-[11px] text-muted">{a.kyc[k].reason}</div>}</div>
                  {open && can(s, 'KYC_VERIFY') && <Button size="sm" variant="secondary" loading={busy === k} onClick={() => kyc(k)} data-testid={`kyc-${k}`}>Run</Button>}
                </div>
              ))}
              <p className="text-[11px] text-muted">Approval requires a verified PAN check.</p>
            </div>
          </Card>
        </aside>
      </div>
      <Modal open={!!dec} onClose={() => setDec(null)} title={dec === 'REJECT' ? 'Reject application' : 'Request more information'} footer={<><Button variant="secondary" onClick={() => setDec(null)}>Cancel</Button><Button variant={dec === 'REJECT' ? 'danger' : 'primary'} loading={!!busy} disabled={note.trim().length < 3} onClick={() => decide(dec!)} data-testid="decision-confirm">{dec === 'MORE_INFO' ? 'Send request by email' : 'Confirm'}</Button></>}>
        {dec === 'MORE_INFO' && <Notice tone="info" className="mb-3">The request is emailed to {a.draft?.director?.email ?? 'the applicant'}. The application stays open — you can approve, reject or ask again later.</Notice>}<Textarea rows={3} placeholder={dec === 'MORE_INFO' ? 'What information do you need? e.g. Please share the GST certificate' : 'Reason shown to the applicant'} value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>
    </div>
  );
}
