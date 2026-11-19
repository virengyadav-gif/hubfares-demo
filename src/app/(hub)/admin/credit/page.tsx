'use client';
/** ADM-02 — Credit & payment policies (maker-checker: changes go to the CXO for approval) + credit repayment. */
import { useEffect, useState } from 'react';
import { apiFetch, useApi, inr, fmtDate, newKey } from '@/lib/client';
import { Card, PageHeader, Field, Select, Input, Toggle, Button, Notice, Table, Td, Badge, Kpi, useToast } from '@/components/ui';
import { useSession, can } from '@/components/shell/AppShell';
const TERMS: Record<string, number> = { UPFRONT: 0, DAILY: 1, WEEKLY: 7, CUSTOM: 15 };
export default function Credit() {
  const s = useSession(); const toast = useToast();
  const agencies = useApi<any[]>('/agencies');
  const [ag, setAg] = useState('agency_orbit');
  const pol = useApi<any[]>(`/agency-policies?agencyId=${ag}`, [ag]);
  const cur = agencies.data?.find((a) => a.id === ag);
  const [cfg, setCfg] = useState<any>(null); const [repay, setRepay] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { const c = pol.data?.find((p) => p.type === 'CREDIT' && !p.effectiveUntil); if (c) setCfg({ ...c.config }); }, [pol.data]);
  async function publish() { if (busy) return; setBusy(true); try { const r = await apiFetch<any>('/agency-policies', { method: 'PATCH', body: { agencyId: ag, type: 'CREDIT', config: { ...cfg, creditLimitMinor: Math.round(Number(cfg.creditLimitMinor)) } } }); if (r.data.status === 'PENDING_APPROVAL') toast({ tone: 'info', title: `Sent for approval · ${r.data.approvalId}`, body: r.data.message }); else toast({ tone: 'success', title: `Published ${r.data.id}` }); pol.reload(); agencies.reload(); approvals.reload(); } catch (e: any) { toast({ tone: 'error', title: 'Not submitted', body: e.message }); } finally { setBusy(false); } }
  async function block(status: 'SUSPENDED' | 'ACTIVE') { if (busy) return; const reason = status === 'SUSPENDED' ? 'Booking block requested by Hubfares admin' : 'Restore bookings requested by Hubfares admin'; setBusy(true); try { const r = await apiFetch<any>(`/agencies/${ag}`, { method: 'PATCH', body: { status, reason } }); toast({ tone: 'info', title: `Sent for approval · ${r.data.approvalId}`, body: r.data.message }); approvals.reload(); } catch (e: any) { toast({ tone: 'error', title: 'Not submitted', body: e.message }); } finally { setBusy(false); } }
  async function doRepay() { setBusy(true); try { await apiFetch('/credit-repayments', { idem: newKey(), body: { agencyId: ag, amountMinor: Math.round(Number(repay) * 100), note: 'Repayment received' } }); toast({ tone: 'success', title: 'Repayment recorded' }); setRepay(''); agencies.reload(); } catch (e: any) { toast({ tone: 'error', title: 'Not recorded', body: e.message }); } finally { setBusy(false); } }
  const edit = can(s, 'POLICY_EDIT');
  const approvals = useApi<any[]>(edit ? '/approvals' : null);
  const mine = (approvals.data ?? []).filter((a) => a.agencyId === ag);
  const pendingCredit = mine.find((a) => a.status === 'PENDING' && a.kind === 'CREDIT_POLICY_CHANGE');
  const pendingBlock = mine.find((a) => a.status === 'PENDING' && a.kind === 'AGENCY_STATUS_CHANGE');
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Credit & payment policies" subtitle="Credit changes are critical: they are sent to the approving authority (CXO) and take effect only after approval. Historical draws and bookings are untouched." actions={<Select value={ag} onChange={(e) => setAg(e.target.value)} className="w-64" aria-label="Agency">{agencies.data?.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}</Select>} />
      {cur && <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Kpi label="Wallet cash" value={inr(cur.position.walletCashMinor)} /><Kpi label="Credit limit" value={inr(cur.position.creditLimitMinor)} /><Kpi label="Utilised" value={inr(cur.position.creditOutstandingMinor)} sub={`Hold ${inr(cur.position.creditHoldMinor)}`} /><Kpi label="Overdue" value={inr(cur.position.overdueMinor)} tone={cur.position.overdueMinor ? 'bad' : 'ok'} /><Kpi label="Available credit (effective)" value={inr(cur.position.availableCreditMinor)} sub={cur.position.creditBlocked ? 'Blocked by overdue policy' : `Before block ${inr(cur.position.availableCreditBeforeBlockMinor)}`} tone={cur.position.creditBlocked ? 'bad' : 'brand'} /></div>}
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card title="Change credit terms">
          {cfg && <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Cycle"><Select value={cfg.cycle} disabled={!edit} onChange={(e) => setCfg({ ...cfg, cycle: e.target.value, termDays: TERMS[e.target.value], creditEnabled: e.target.value !== 'UPFRONT' && cfg.creditEnabled })} name="cycle"><option value="UPFRONT">Prepaid / upfront</option><option value="DAILY">Daily (1 day)</option><option value="WEEKLY">Weekly (7 days)</option><option value="CUSTOM">Custom (15 days)</option></Select></Field>
              <Field label="Term days"><Input type="number" value={cfg.termDays} disabled={!edit || cfg.cycle !== 'CUSTOM'} onChange={(e) => setCfg({ ...cfg, termDays: Number(e.target.value) })} /></Field>
              <Field label="Credit limit (INR)"><Input type="number" min={0} disabled={!edit || cfg.cycle === 'UPFRONT'} value={cfg.creditLimitMinor / 100} onChange={(e) => setCfg({ ...cfg, creditLimitMinor: Math.round(Number(e.target.value) * 100) })} name="creditLimit" /></Field>
            </div>
            <div className="flex flex-wrap gap-5"><Toggle disabled={!edit || cfg.cycle === 'UPFRONT'} checked={cfg.creditEnabled} onChange={(v) => setCfg({ ...cfg, creditEnabled: v })} label="Credit enabled" /><Toggle disabled={!edit} checked={cfg.blockOnOverdue} onChange={(v) => setCfg({ ...cfg, blockOnOverdue: v })} label="Block new credit when overdue" /><Toggle disabled={!edit} checked={cfg.allowWalletWhenCreditBlocked} onChange={(v) => setCfg({ ...cfg, allowWalletWhenCreditBlocked: v })} label="Allow wallet bookings when blocked" /></div>
            {edit ? <div className="flex flex-wrap items-center gap-2"><Button loading={busy} disabled={!!pendingCredit} onClick={publish} data-testid="publish-credit">Submit for approval</Button>{pendingCredit && <span className="text-xs font-semibold text-warn-600">Awaiting approval: {pendingCredit.id}</span>}</div> : <Notice tone="info">Read-only for your role.</Notice>}
          </div>}
        </Card>
        <Card title="Version history">
          <Table dense head={['Policy', 'Effective', 'Until', 'Terms']}>{(pol.data ?? []).filter((p) => p.type === 'CREDIT').map((p) => <tr key={p.id}><Td className="font-semibold">{p.id}{!p.effectiveUntil && <Badge tone="green" className="ml-1">current</Badge>}</Td><Td className="text-xs">{fmtDate(p.effectiveFrom)}</Td><Td className="text-xs">{p.effectiveUntil ? fmtDate(p.effectiveUntil) : '—'}</Td><Td className="text-xs">{p.config.cycle.toLowerCase()} · {inr(p.config.creditLimitMinor, { decimals: false })} · block {String(p.config.blockOnOverdue)}</Td></tr>)}</Table>
          {can(s, 'CREDIT_REPAY') && cur?.position.creditOutstandingMinor > 0 && <div className="mt-5 border-t border-line pt-4"><div className="mb-2 text-sm font-semibold">Record credit repayment</div><div className="flex gap-2"><Input type="number" placeholder="Amount INR" value={repay} onChange={(e) => setRepay(e.target.value)} /><Button variant="secondary" loading={busy} disabled={!(Number(repay) > 0)} onClick={doRepay}>Record</Button></div><p className="mt-1 text-xs text-muted">Separate credit-ledger entry (FIFO against oldest dues). Refund credits are never auto-offset.</p></div>}
        </Card>
      </div>
      {edit && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <Card title="Booking access" subtitle="Blocking or restoring bookings for an agency also needs approval.">
            <div className="flex flex-wrap items-center gap-3 text-sm"><span>Status: <b>{cur?.status?.toLowerCase()}</b></span>
              {cur?.status === 'ACTIVE' ? <Button variant="danger" size="sm" loading={busy} disabled={!!pendingBlock} onClick={() => block('SUSPENDED')} data-testid="request-block">Block bookings</Button> : <Button size="sm" loading={busy} disabled={!!pendingBlock} onClick={() => block('ACTIVE')}>Restore bookings</Button>}
              {pendingBlock && <span className="text-xs font-semibold text-warn-600">Awaiting approval: {pendingBlock.id}</span>}</div>
          </Card>
          <Card title="Approval requests" subtitle="Maker-checker log for this agency">
            {!mine.length ? <p className="text-sm text-muted">No approval requests for this agency.</p> : <Table dense head={['Request', 'Change', 'Requested by', 'Status', 'Decided by']}>{mine.map((a) => <tr key={a.id}><Td className="font-semibold">{a.id}</Td><Td className="text-xs">{a.summary}</Td><Td className="text-xs">{a.requestedByName}<div className="text-muted">{fmtDate(a.requestedAt)}</div></Td><Td><Badge tone={a.status === 'APPROVED' ? 'green' : a.status === 'REJECTED' ? 'red' : 'amber'}>{a.status === 'PENDING' ? 'Awaiting CXO' : a.status.toLowerCase()}</Badge></Td><Td className="text-xs">{a.decidedByName ?? '—'}{a.decisionNote && <div className="text-muted">{a.decisionNote}</div>}</Td></tr>)}</Table>}
          </Card>
        </div>
      )}
    </div>
  );
}
