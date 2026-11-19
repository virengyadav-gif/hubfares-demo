'use client';
import { useState } from 'react';
import { MessageCircleQuestion } from 'lucide-react';
import { useApi, fmtDate } from '@/lib/client';
import { Card, PageHeader, Table, Td, Status, Empty, Button, Drawer, Timeline } from '@/components/ui';
import { openHelp } from '@/components/support/HelpChat';
export default function Page() {
  const { data } = useApi<any[]>('/support-cases');
  const [sel, setSel] = useState<any>(null);
  return (
    <div>
      <PageHeader eyebrow="Help" title="Support cases" subtitle="Requests raised through the Need Help assistant and their Operations status." actions={<Button icon={<MessageCircleQuestion className="h-4 w-4" />} onClick={() => openHelp()}>Open Need Help</Button>} />
      <Card pad={false}>{!data?.length ? <Empty title="No cases yet" /> : (
        <Table head={['Case', 'Category', 'Summary', 'PNR', 'Source', 'Status', 'Created']}>
          {data.map((c) => <tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSel(c)}><Td className="font-semibold text-brand-700">{c.id}</Td><Td>{c.category.replace(/_/g, ' ').toLowerCase()}</Td><Td className="max-w-[320px] truncate">{c.summary}</Td><Td className="font-mono">{c.pnr ?? '—'}</Td><Td>{c.source.toLowerCase()}</Td><Td><Status value={c.status} /></Td><Td className="text-muted">{fmtDate(c.createdAt)}</Td></tr>)}
        </Table>)}</Card>
      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.id}>{sel && <div className="space-y-4"><div className="text-sm">{sel.summary}</div>{sel.details && <div className="rounded-lg bg-slate-50 p-3 text-sm">{sel.details}</div>}<Timeline items={sel.events.map((e: any) => ({ at: e.createdAt, status: e.toStatus, note: e.note, by: e.actorName }))} /><p className="text-xs text-muted">Case handling never cancels bookings or moves money by itself.</p></div>}</Drawer>
    </div>
  );
}
