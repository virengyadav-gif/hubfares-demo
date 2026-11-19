'use client';
/** OPS-12 / OPS-13 — Support case board; chatbot-originated cases show the same ID the OTA received. */
import { useState } from 'react';
import Link from 'next/link';
import { apiFetch, useApi, fmtDate } from '@/lib/client';
import { Card, PageHeader, Table, Td, Status, Badge, Tabs, Drawer, Select, Button, Timeline, Textarea, SimTag, useToast, cx } from '@/components/ui';
import { useSession, can } from '@/components/shell/AppShell';
const NEXT: Record<string, string[]> = { OPEN: ['ASSIGNED', 'IN_PROGRESS', 'CLOSED'], ASSIGNED: ['IN_PROGRESS', 'AWAITING_EXTERNAL', 'RESOLVED'], IN_PROGRESS: ['AWAITING_EXTERNAL', 'RESOLVED', 'ESCALATED'], AWAITING_EXTERNAL: ['IN_PROGRESS', 'RESOLVED'], ESCALATED: ['IN_PROGRESS', 'RESOLVED'], RESOLVED: ['CLOSED', 'REOPENED'], REOPENED: ['ASSIGNED', 'IN_PROGRESS'], CLOSED: ['REOPENED'] };
export default function Cases() {
  const s = useSession(); const toast = useToast();
  const [src, setSrc] = useState<'CHATBOT' | 'ALL'>('CHATBOT');
  const { data, reload } = useApi<any[]>(`/support-cases${src === 'CHATBOT' ? '?source=CHATBOT' : ''}`, [src]);
  const ops = useApi<any[]>('/agency-users?hubOnly=1').data;
  const [sel, setSel] = useState<any>(null); const [note, setNote] = useState('');
  async function upd(body: any) { try { const r = await apiFetch<any>(`/support-cases/${sel.id}`, { method: 'PATCH', body: { ...body, note: note || undefined } }); setSel(r.data); setNote(''); reload(); toast({ tone: 'success', title: `Case ${r.data.id}: ${r.data.status.toLowerCase().replace(/_/g, ' ')}` }); } catch (e: any) { toast({ tone: 'error', title: 'Not updated', body: e.message }); } }
  const now = Date.now();
  return (
    <div>
      <PageHeader eyebrow="Operations" title="Support cases" subtitle="Cases from the OTA Help assistant appear here with the same reference. Handling a case never cancels bookings or moves money." />
      <Card pad={false}>
        <Tabs className="px-4" value={src} onChange={setSrc} tabs={[{ id: 'CHATBOT', label: 'Chatbot-originated' }, { id: 'ALL', label: 'All cases (incl. guided samples)' }]} />
        <Table head={['Case', 'Agency', 'Category', 'PNR / booking', 'Summary', 'Priority', 'Owner', 'SLA', 'Status', 'Created']}>
          {(data ?? []).map((c) => { const breach = c.slaDueAt && Date.parse(c.slaDueAt) < now && !['RESOLVED', 'CLOSED'].includes(c.status); return (
            <tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSel(c)} data-testid={`case-${c.id}`}><Td className="font-semibold text-brand-700">{c.id}</Td><Td>{c.agencyName}</Td><Td>{c.category.replace(/_/g, ' ').toLowerCase()}</Td><Td className="font-mono text-xs">{c.pnr ?? '—'}{c.bookingId && <div className="text-muted">{c.bookingId}</div>}</Td><Td className="max-w-[260px] truncate">{c.summary}</Td><Td><Badge tone={c.priority === 'HIGH' ? 'red' : c.priority === 'MEDIUM' ? 'amber' : 'gray'}>{c.priority.toLowerCase()}</Badge></Td><Td>{c.assignedToName ?? <span className="text-muted">Unassigned</span>}</Td><Td className={cx('text-xs', breach ? 'font-semibold text-bad-600' : 'text-muted')}>{c.slaDueAt ? (breach ? 'Breached' : fmtDate(c.slaDueAt)) : '—'}</Td><Td><Status value={c.status} /></Td><Td className="text-muted">{fmtDate(c.createdAt)}</Td></tr>
          ); })}
        </Table>
      </Card>
      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.id}>
        {sel && <div className="space-y-4">
          <div className="flex flex-wrap gap-2"><Status value={sel.status} /><Badge tone="gray">{sel.source.toLowerCase()}</Badge><Badge tone="blue">{sel.category.replace(/_/g, ' ').toLowerCase()}</Badge>{sel.source !== 'CHATBOT' && <SimTag kind="Guided demo" />}</div>
          <div className="text-sm"><b>{sel.agencyName}</b> · {sel.summary}</div>
          {sel.bookingId && <Link href={`/operations/bookings/${sel.bookingId}`} className="text-sm font-semibold text-brand-700">Open booking {sel.bookingId}</Link>}
          {sel.details && <div className="rounded-lg bg-slate-50 p-3 text-sm">{sel.details}</div>}
          {can(s, 'CASES_MANAGE') && <div className="space-y-2 rounded-xl border border-line p-3">
            <div className="grid grid-cols-2 gap-2"><Select aria-label="Assign" value={sel.assignedTo ?? ''} onChange={(e) => e.target.value && upd({ assignedTo: e.target.value })}><option value="">Assign to…</option>{ops?.filter((u) => ['HUB_OPS', 'HUB_ADMIN_FINANCE', 'SUPER_ADMIN'].includes(u.role)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select><Select aria-label="Priority" value={sel.priority} onChange={(e) => upd({ priority: e.target.value })}><option>LOW</option><option>MEDIUM</option><option>HIGH</option></Select></div>
            <Textarea rows={2} placeholder="Internal note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex flex-wrap gap-1.5">{(NEXT[sel.status] ?? []).map((st) => <Button key={st} size="sm" variant="secondary" onClick={() => upd({ status: st })} data-testid={`case-to-${st}`}>{st.replace(/_/g, ' ').toLowerCase()}</Button>)}</div>
          </div>}
          <Timeline items={sel.events.map((e: any) => ({ at: e.createdAt, status: e.toStatus ?? e.action, note: e.note, by: e.actorName }))} />
          <p className="text-xs text-muted">Email/SMS/WhatsApp notifications and SLA automation are planned integrations.</p>
        </div>}
      </Drawer>
    </div>
  );
}
