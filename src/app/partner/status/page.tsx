'use client';
/** ONB-03 — Registration status & timeline (reflects Operations decisions). */
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { apiFetch } from '@/lib/client';
import { Card, Field, Input, Button, Notice, Status, Timeline, DL } from '@/components/ui';

function StatusInner() {
  const sp = useSearchParams();
  const [data, setData] = useState<any>(null); const [err, setErr] = useState<string | null>(null);
  const [ref, setRef] = useState(''); const [email, setEmail] = useState('');
  const id = sp.get('id'); const t = sp.get('t');
  useEffect(() => { if (id && t) apiFetch(`/applications/${id}`, { headers: { 'x-application-token': t } }).then((r) => setData(r.data)).catch((e) => setErr(e.message)); }, [id, t]);
  const lookup = async (e: React.FormEvent) => { e.preventDefault(); setErr(null); try { setData((await apiFetch('/applications/status', { body: { reference: ref, email } })).data); } catch (e: any) { setErr(e.message); } };
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white"><div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4"><Link href="/" className="flex items-center gap-2"><Image src="/hubfares-logo.jpeg" alt="Hubfares" width={32} height={32} className="rounded-md" /><span className="font-bold">hub<span className="text-brand-500">fares</span></span></Link><Link href="/login" className="text-sm font-semibold text-brand-700">Sign in</Link></div></header>
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <h1 className="text-2xl font-bold">Registration status</h1>
        {err && <Notice tone="error">{err}</Notice>}
        {!data && <Card title="Track your application"><form onSubmit={lookup} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><Field label="Reference"><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="HF-APP-0101" required /></Field><Field label="Communication email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field><Button>Check status</Button></form></Card>}
        {data && (
          <>
            {data.status === 'SUBMITTED' && sp.get('t') && <Notice tone="success" title="Application submitted">Hubfares Operations has been notified. Your agency is not active until approval — no bookings are possible yet.</Notice>}
            <Card title={<span className="flex items-center gap-2">Application {data.reference} <Status value={data.status} /></span>} subtitle="Draft → Submitted → Under Review → Active">
              <DL items={[['Reference', <b key="r" data-testid="app-reference">{data.reference}</b>], ['Current status', <Status key="s" value={data.status} />], ...(data.draft ? [['Agency', data.draft.organization?.agencyName], ['Documents', `${data.documents?.length ?? 0} uploaded · extraction is not verification`]] as any : []), ...(data.decisionNote ? [['Hubfares note', data.decisionNote]] as any : [])]} />
              <div className="mt-6"><Timeline items={data.history} /></div>
              {data.status === 'APPROVED' && <Notice tone="success" className="mt-6" title="Agency activated"><span className="inline-flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />Your Agency Admin can now sign in with the director email and the initial password shared by Hubfares.</span></Notice>}
              {data.status === 'MORE_INFO_REQUIRED' && <Notice tone="warn" className="mt-6" title="More information requested">{data.decisionNote} — details have been sent to your registered email.</Notice>}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
export default function StatusPage() { return <Suspense><StatusInner /></Suspense>; }
