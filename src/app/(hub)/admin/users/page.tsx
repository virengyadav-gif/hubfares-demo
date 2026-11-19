'use client';
/** ADM-01 — Roles, users and permissions (Hubfares + agencies). */
import { useState } from 'react';
import { apiFetch, useApi, fmtDate } from '@/lib/client';
import { Card, PageHeader, Table, Td, Status, Badge, Button, Tabs, Select, useToast } from '@/components/ui';
import { useSession } from '@/components/shell/AppShell';
const CATALOG = [['SUPER_ADMIN', 'All configuration, demo reset, all agencies'], ['HUB_ADMIN_FINANCE', 'Credit, refund & commercial policy, payouts, payment matching'], ['HUB_OPS', 'Approvals, bookings, supplier receipts, cases, imports'], ['HUB_CXO', 'Read-only executive analytics & reports'], ['AGENCY_ADMIN', 'Own agency: users, markup UI, wallet, bookings'], ['AGENCY_AGENT', 'Own agency: search/book/service (restrictable)'], ['AGENCY_FINANCE_VIEWER', 'Own agency: wallet, passbook, reports only']];
export default function Users() {
  const s = useSession(); const toast = useToast();
  const [t, setT] = useState<'hub' | 'agency' | 'roles'>('hub');
  const { data, reload } = useApi<any[]>('/agency-users');
  const rows = (data ?? []).filter((u) => (t === 'hub' ? !u.agencyId : !!u.agencyId));
  const patch = async (id: string, body: any) => { try { await apiFetch(`/agency-users/${id}`, { method: 'PATCH', body }); toast({ tone: 'success', title: 'Updated (audited)' }); reload(); } catch (e: any) { toast({ tone: 'error', title: 'Not allowed', body: e.message }); } };
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Roles, users & permissions" subtitle="Roles are enforced on the server. Agency users can never receive Hubfares roles." />
      <Card pad={false}>
        <Tabs className="px-4" value={t} onChange={setT} tabs={[{ id: 'hub', label: 'Hubfares users' }, { id: 'agency', label: 'Agency users' }, { id: 'roles', label: 'Role catalogue' }]} />
        {t === 'roles' ? <Table head={['Role', 'Scope & permissions']}>{CATALOG.map(([r, d]) => <tr key={r}><Td><Badge tone={r.startsWith('AGENCY') ? 'blue' : 'dark'}>{r}</Badge></Td><Td>{d}</Td></tr>)}</Table> : (
          <Table head={['Name', 'Email', 'Agency', 'Role', 'Status', 'Created', '']}>
            {rows.map((u) => <tr key={u.id}><Td className="font-semibold">{u.name}</Td><Td className="text-muted">{u.email}</Td><Td>{u.agencyName}</Td><Td>{u.agencyId ? <Badge tone="blue">{u.role}</Badge> : <Select className="h-8 w-48 text-xs" value={u.role} disabled={u.id === s.userId} onChange={(e) => patch(u.id, { role: e.target.value })}>{['SUPER_ADMIN', 'HUB_ADMIN_FINANCE', 'HUB_OPS', 'HUB_CXO'].map((r) => <option key={r}>{r}</option>)}</Select>}</Td><Td><Status value={u.status} /></Td><Td className="text-muted">{fmtDate(u.createdAt, undefined, false)}</Td><Td>{u.id !== s.userId && <Button size="sm" variant="ghost" onClick={() => patch(u.id, { status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })}>{u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</Button>}</Td></tr>)}
          </Table>
        )}
      </Card>
    </div>
  );
}
