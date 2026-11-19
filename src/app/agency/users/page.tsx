'use client';
/** OTA-02 — Agency sub-users (WF-04). Server enforces own-agency scope and agency-only roles. */
import { useState } from 'react';
import Link from 'next/link';
import { UserPlus, Percent } from 'lucide-react';
import { apiFetch, useApi, fmtDate } from '@/lib/client';
import { Card, PageHeader, Table, Td, Status, Badge, Button, Modal, Field, Input, Select, Toggle, Notice, useToast } from '@/components/ui';
import { useSession } from '@/components/shell/AppShell';

export default function Users() {
  const s = useSession(); const toast = useToast();
  const { data, reload } = useApi<any[]>('/agency-users');
  const [open, setOpen] = useState(false); const [f, setF] = useState({ name: '', email: '', mobile: '', role: 'AGENCY_AGENT', permissions: { BOOK: true, CANCEL: true, FINANCE_VIEW: false } }); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function create() { setBusy(true); setErr(null); try { await apiFetch('/agency-users', { body: f }); toast({ tone: 'success', title: 'User created', body: `${f.email} can sign in with the operator demo password.` }); setOpen(false); reload(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } }
  async function patch(id: string, body: any) { try { await apiFetch(`/agency-users/${id}`, { method: 'PATCH', body }); reload(); toast({ tone: 'success', title: 'User updated' }); } catch (e: any) { toast({ tone: 'error', title: 'Not allowed', body: e.message }); } }
  return (
    <div>
      <PageHeader eyebrow={s.agencyName ?? ''} title="Manage users" subtitle="Users inherit your agency and can only access its data." actions={<><Link href="/agency/markup"><Button variant="secondary" icon={<Percent className="h-4 w-4" />}>Manage Markup</Button></Link><Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setOpen(true)} data-testid="add-user">Add sub-user</Button></>} />
      <Card pad={false}>
        <Table head={['Name', 'Email (login)', 'Role', 'Book', 'Cancel', 'Finance view', 'Status', 'Created', '']}>
          {(data ?? []).map((u) => {
            const agent = u.role === 'AGENCY_AGENT'; const self = u.id === s.userId;
            return (
              <tr key={u.id} data-testid={`user-${u.email}`}><Td className="font-semibold">{u.name}{self && <Badge className="ml-1.5" tone="gray">You</Badge>}</Td><Td className="text-muted">{u.email}</Td>
                <Td><Select className="h-8 w-44 text-xs" value={u.role} disabled={self} onChange={(e) => patch(u.id, { role: e.target.value })}><option value="AGENCY_ADMIN">Agency Admin</option><option value="AGENCY_AGENT">Agency Agent</option><option value="AGENCY_FINANCE_VIEWER">Finance Viewer</option></Select></Td>
                {(['BOOK', 'CANCEL', 'FINANCE_VIEW'] as const).map((k) => <Td key={k}>{agent ? <Toggle checked={u.permissions[k]} onChange={(v) => patch(u.id, { permissions: { [k]: v } })} /> : <span className="text-xs text-muted">{u.role === 'AGENCY_ADMIN' ? 'All' : k === 'FINANCE_VIEW' ? 'Yes' : 'No'}</span>}</Td>)}
                <Td><Status value={u.status} /></Td><Td className="text-muted">{fmtDate(u.createdAt, undefined, false)}</Td>
                <Td>{!self && <Button size="sm" variant="ghost" onClick={() => patch(u.id, { status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })}>{u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</Button>}</Td></tr>
            );
          })}
        </Table>
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Add sub-user" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={busy} onClick={create} data-testid="create-user">Create user</Button></>}>
        <div className="space-y-3">
          {err && <Notice tone="error">{err}</Notice>}
          <Field label="Full name" required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} name="name" /></Field>
          <Field label="Email (login)" required><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} name="email" /></Field>
          <Field label="Mobile" required><Input value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} placeholder="+919000000000" name="mobile" /></Field>
          <Field label="Role"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="AGENCY_AGENT">Agency Agent</option><option value="AGENCY_FINANCE_VIEWER">Finance Viewer</option><option value="AGENCY_ADMIN">Agency Admin</option></Select></Field>
          {f.role === 'AGENCY_AGENT' && <div className="flex flex-wrap gap-4 rounded-lg bg-slate-50 p-3">{(['BOOK', 'CANCEL', 'FINANCE_VIEW'] as const).map((k) => <Toggle key={k} checked={f.permissions[k]} onChange={(v) => setF({ ...f, permissions: { ...f.permissions, [k]: v } })} label={{ BOOK: 'Can book', CANCEL: 'Can cancel', FINANCE_VIEW: 'Finance view' }[k]} />)}</div>}
          <p className="text-xs text-muted">Hubfares roles cannot be granted from the agency portal.</p>
        </div>
      </Modal>
    </div>
  );
}
