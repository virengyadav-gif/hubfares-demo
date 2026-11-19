'use client';
import { useEffect } from 'react';
import { Bell } from 'lucide-react';
import { apiFetch, useApi, fmtDate } from '@/lib/client';
import { Card, PageHeader, SimTag, Empty, Badge } from '@/components/ui';
import { useSession } from '@/components/shell/AppShell';
export default function Page() {
  const s = useSession();
  const { data, reload } = useApi<any[]>('/notifications');
  useEffect(() => { const t = setTimeout(() => apiFetch('/notifications', { method: 'POST' }).then(() => reload()).catch(() => {}), 1500); return () => clearTimeout(t); }, [reload]);
  return (
    <div>
      <PageHeader eyebrow="Profile" title="Notifications" subtitle="Updates about your bookings, payments, refunds and account." />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card pad={false}>{!data?.length ? <Empty title="No notifications yet" icon={<Bell className="h-6 w-6" />} /> : data.map((n) => <div key={n.id} className="flex items-start gap-3 border-b border-line px-5 py-3 last:border-0"><Bell className="mt-0.5 h-4 w-4 text-brand-500" /><div className="flex-1"><div className="text-sm font-medium">{n.title}</div><div className="text-xs text-muted">{fmtDate(n.createdAt)} · {n.kind.replace(/_/g, ' ').toLowerCase()}</div></div>{!n.seenAt && <Badge tone="orange">New</Badge>}</div>)}</Card>
        <Card title="Profile"><div className="space-y-1 text-sm"><div className="font-semibold">{s.name}</div><div className="text-muted">{s.email}</div><div className="text-muted">{s.agencyName}</div><div className="pt-2"><Badge tone="gray">{s.role.replace(/_/g, ' ').toLowerCase()}</Badge></div></div></Card>
      </div>
    </div>
  );
}
