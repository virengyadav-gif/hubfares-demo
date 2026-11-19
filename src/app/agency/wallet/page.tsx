'use client';
/** OTA-12 — Wallet & credit: separate cash wallet and credit facility; simulated bank transfer with automated matching (WF-05/06). */
import { useRef, useState } from 'react';
import { Banknote, CreditCard, Wallet, Landmark } from 'lucide-react';
import { apiFetch, useApi, inr, fmtDate, newKey } from '@/lib/client';
import { Card, Kpi, PageHeader, Field, Input, Button, Notice, Table, Td, Status, DL, SimTag, Loading, useToast } from '@/components/ui';
import { useSession, can } from '@/components/shell/AppShell';

export default function WalletPage() {
  const s = useSession(); const toast = useToast();
  const w = useApi<any>('/wallet'); const ev = useApi<any[]>('/payment-events');
  const [amt, setAmt] = useState('25000'); const [busy, setBusy] = useState(false); const key = useRef(newKey());
  if (w.loading && !w.data) return <Loading />;
  const d = w.data;
  async function pay(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { const r = await apiFetch<any>('/payment-events/demo', { idem: key.current, body: { amountMinor: Math.round(Number(amt) * 100) } }); key.current = newKey(); toast({ tone: r.data.match.status === 'CREDITED' ? 'success' : 'error', title: r.data.match.status === 'CREDITED' ? `Demo payment ${r.data.externalRef} matched` : `Payment ${r.data.match.status.toLowerCase()}`, body: r.data.match.status === 'CREDITED' ? `Wallet credited ${inr(Math.round(Number(amt) * 100))} exactly once` : r.data.match.reason }); w.reload(); ev.reload(); }
    catch (e: any) { toast({ tone: 'error', title: 'Payment not created', body: e.message }); } finally { setBusy(false); }
  }
  return (
    <div>
      <PageHeader eyebrow="Finance" title="Wallet & credit" subtitle="Cash wallet and credit facility are separate. Spending power = available wallet + eligible available credit." badges={<SimTag kind="Demo" />} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Wallet cash balance" value={inr(d.walletCashMinor)} sub={`On hold ${inr(d.walletHoldMinor)}`} icon={<Wallet className="h-4 w-4" />} />
        <Kpi label="Available wallet" value={inr(d.availableWalletMinor)} sub="Cash minus active holds" icon={<Banknote className="h-4 w-4" />} tone="ok" />
        <Kpi label="Credit utilised" value={inr(d.creditOutstandingMinor)} sub={d.creditEnabled ? `Limit ${inr(d.creditLimitMinor)} · hold ${inr(d.creditHoldMinor)}` : 'Prepaid — no credit facility'} icon={<CreditCard className="h-4 w-4" />} tone={d.overdueMinor ? 'bad' : 'brand'} />
        <Kpi label="Spending power" value={inr(d.spendingPowerMinor)} sub={`Credit available ${inr(d.availableCreditMinor)}`} icon={<Landmark className="h-4 w-4" />} />
      </div>
      {d.creditBlocked && <Notice tone="error" className="mb-4" title="New credit draws blocked">{d.blockReason}. {d.allowWalletWhenCreditBlocked ? 'Wallet-funded bookings are still allowed.' : ''}</Notice>}
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card title="Credit terms (Hubfares-configured)">
          <DL items={[['Policy', d.creditPolicyId ? `${d.creditPolicyId} (v${d.creditPolicyVersion})` : '—'], ['Cycle', `${d.creditCycle.toLowerCase()} · ${d.creditTermDays} day term`], ['Credit limit', inr(d.creditLimitMinor)], ['Outstanding', inr(d.creditOutstandingMinor)], ['Overdue', <span key="o" className={d.overdueMinor ? 'font-bold text-bad-600' : ''}>{inr(d.overdueMinor)}</span>], ['Next due', fmtDate(d.nextDueAt)]]} />
          <p className="mt-4 text-xs text-muted">Refund payouts credit the cash wallet; they are not automatically offset against credit outstanding.</p>
        </Card>
        <Card title="Add funds (simulated bank transfer)" actions={<SimTag kind="Demo" />}>
          <DL items={[['Beneficiary', d.bankDetails.beneficiary], ['Bank', d.bankDetails.bank], ['Virtual account / reference', <b key="r" className="font-mono">{d.bankDetails.virtualAccount}</b>], ['IFSC', d.bankDetails.ifsc]]} />
          {can(s, 'AGENCY_PAYMENT_INIT') ? (
            <form onSubmit={pay} className="mt-4 flex items-end gap-2"><Field label="Amount (INR)" className="flex-1"><Input type="number" min={1000} step={1} value={amt} onChange={(e) => setAmt(e.target.value)} /></Field><Button loading={busy} data-testid="demo-pay">Send demo transfer</Button></form>
          ) : <p className="mt-4 text-sm text-muted">Only the Agency Admin can initiate a demo payment.</p>}
          <p className="mt-2 text-xs text-muted">{d.bankDetails.note}. The automated matcher credits the wallet once per unique UTR.</p>
        </Card>
      </div>
      <Card title="Payment events" className="mt-5" pad={false}>
        <Table head={['Received', 'UTR / reference', 'Amount', 'Status', 'Note']}>
          {(ev.data ?? []).map((p) => <tr key={p.id}><Td className="text-muted">{fmtDate(p.receivedAt)}</Td><Td className="font-mono text-[12.5px]">{p.externalPaymentRef}</Td><Td className="tabular">{p.currency === 'INR' ? inr(p.grossAmountMinor) : `${p.currency} ${(p.grossAmountMinor / 100).toFixed(2)}`}</Td><Td><Status value={p.status} /></Td><Td className="text-xs text-muted">{p.matching?.reason ?? (p.status === 'RECEIVED' ? 'Awaiting matcher' : '')}</Td></tr>)}
        </Table>
      </Card>
    </div>
  );
}
