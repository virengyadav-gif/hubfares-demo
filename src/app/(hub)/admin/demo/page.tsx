'use client';
/** Demo launcher / reset — Super Admin only, mock mode, allow-listed DB, typed confirmation. */
import { useState } from 'react';
import { RotateCcw, ShieldAlert } from 'lucide-react';
import { apiFetch, useApi, fmtDate } from '@/lib/client';
import { Card, PageHeader, Button, Input, Notice, DL, Badge, useToast } from '@/components/ui';
export default function Demo() {
  const toast = useToast();
  const st = useApi<any>('/demo/status');
  const [c, setC] = useState(''); const [busy, setBusy] = useState(false); const [res, setRes] = useState<any>(null);
  const reset = async () => { setBusy(true); try { const r = await apiFetch<any>('/demo/reset', { body: { confirm: c } }); setRes(r.data); setC(''); st.reload(); toast({ tone: 'success', title: 'Demo reset complete', body: `${r.data.checksPassed} oracle checks passed` }); } catch (e: any) { toast({ tone: 'error', title: 'Reset refused', body: e.message }); } finally { setBusy(false); } };
  const m = st.data?.manifest;
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Admin" title="Demo control" subtitle="Restore the deterministic seed (24 bookings, opening ledgers, policies, cases). Frozen XLSX samples are untouched." />
      <Card title="Current demo state" className="mb-5">{st.data && <DL items={[['Fixture version', m?.fixtureVersion], ['Seed anchor (UTC)', st.data.anchorUtc], ['Anchor (IST)', fmtDate(st.data.anchorUtc)], ['Resets this session', st.data.resetCount], ['Mode', <Badge key="m" tone="amber">{st.data.demoMode}</Badge>], ['Clock', st.data.clockMode], ['Reset enabled', String(st.data.resetEnabled)], ['Fare profiles', m?.fareProfileIds?.join(', ')]]} />}</Card>
      <Card title="Reset demo data">
        <Notice tone="warn" title="Destructive for demo records only" className="mb-4"><span className="inline-flex items-center gap-1"><ShieldAlert className="h-4 w-4" />Removes demo bookings, payments, refunds, cases and agencies created since the last reset, then re-seeds atomically and re-validates the KPI/ledger oracle. Allowed only in mock mode on the allow-listed demo database.</span></Notice>
        <div className="flex gap-2"><Input placeholder="Type RESET DEMO" value={c} onChange={(e) => setC(e.target.value)} aria-label="Confirmation" /><Button variant="danger" icon={<RotateCcw className="h-4 w-4" />} loading={busy} disabled={c !== 'RESET DEMO'} onClick={reset} data-testid="reset">Reset</Button></div>
        {res && <Notice tone="success" className="mt-4" title={`Reset #${res.resetCount} · anchor ${res.anchorUtc}`}>{res.checksPassed} checks passed, including 24 bookings, opening wallet/credit oracle and GBV ₹2,56,200 / net revenue ₹5,941 / contribution ₹5,276. Sessions remain valid; other users should refresh.</Notice>}
      </Card>
    </div>
  );
}
