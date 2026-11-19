'use client';
/** OPS-09 — Guided amendment / rebooking cases. */
import Link from 'next/link';
import { apiFetch, useApi, inr, fmtDate } from '@/lib/client';
import { Card, PageHeader, Table, Td, Status, Button, SimTag, Empty, useToast } from '@/components/ui';
import { useSession, can } from '@/components/shell/AppShell';
export default function Page() {
  const s = useSession(); const toast = useToast();
  const { data, reload } = useApi<any[]>('/amendments');
  const step = async (id: string, reject = false) => { try { const r = await apiFetch<any>(`/amendments/${id}`, { method: 'PATCH', body: { reject } }); toast({ tone: 'success', title: `${id}: ${r.data.status.replace(/_/g, ' ').toLowerCase()}`, body: 'Guided — no live ticket change' }); reload(); } catch (e: any) { toast({ tone: 'error', title: 'Not updated', body: e.message }); } };
  const NEXT: Record<string, string> = { REQUESTED: 'Quote', QUOTED: 'Approve', APPROVED: 'Record reissue' };
  return (
    <div>
      <PageHeader eyebrow="Operations" title="Amendment & rebooking cases" subtitle="Requested → Quoted → Approved → Reissued/Closed" badges={<SimTag kind="Guided demo" />} />
      <Card pad={false}>{!data?.length ? <Empty title="No amendment cases" /> : (
        <Table head={['Case', 'Agency', 'Booking', 'Type', 'Fee + fare diff.', 'Status', 'Updated', '']}>
          {data.map((a) => <tr key={a.id}><Td className="font-semibold">{a.id}</Td><Td>{a.agencyName}</Td><Td><Link className="text-brand-700" href={`/operations/bookings/${a.bookingId}`}>{a.bookingId}</Link></Td><Td>{a.type.replace(/_/g, ' ').toLowerCase()}</Td><Td className="tabular">{inr(a.quote.amendmentChargeMinor)} + {inr(a.quote.fareDifferenceMinor)}</Td><Td><Status value={a.status} /></Td><Td className="text-muted">{fmtDate(a.updatedAt)}</Td><Td className="whitespace-nowrap">{can(s, 'AMENDMENT_MANAGE') && NEXT[a.status] && <><Button size="sm" onClick={() => step(a.id)}>{NEXT[a.status]}</Button> <Button size="sm" variant="ghost" onClick={() => step(a.id, true)}>Reject</Button></>}</Td></tr>)}
        </Table>)}</Card>
    </div>
  );
}
