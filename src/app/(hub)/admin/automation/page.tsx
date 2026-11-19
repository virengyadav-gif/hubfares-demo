'use client';
/** Workflow & notification settings — saved per environment and audited. */
import { apiFetch, useApi } from '@/lib/client';
import { Card, PageHeader, Toggle, Loading, useToast } from '@/components/ui';
export default function Page() {
  const toast = useToast();
  const { data, setData } = useApi<any>('/settings/automation');
  const flip = async (id: number, enabled: boolean) => { try { const r = await apiFetch<any>('/settings/automation', { method: 'PUT', body: { id, enabled }, quiet: true }); setData(r.data); toast({ tone: 'success', title: enabled ? 'Automation enabled' : 'Automation disabled' }); } catch (e: any) { toast({ tone: 'error', title: 'Not saved', body: e.message }); } };
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Admin" title="Workflow & notification settings" subtitle="Turn workflow automations on or off. Changes are saved immediately and recorded in the audit trail." />
      {!data ? <Loading /> : <Card>{data.rules.map((r: any) => <div key={r.id} className="flex items-center justify-between border-b border-line py-3 last:border-0"><span className="text-sm">{r.label}</span><Toggle checked={r.enabled} onChange={(v) => flip(r.id, v)} /></div>)}</Card>}
    </div>
  );
}
