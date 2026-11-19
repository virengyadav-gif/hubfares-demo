'use client';
/** OPS-06/OPS-08 shared claims board — refund applications; supplier receipt matching and authorised payout (idempotent). */
import { useState } from 'react';
import Link from 'next/link';
import { apiFetch, useApi, inr, fmtDate, newKey } from '@/lib/client';
import { Card, Table, Td, Status, Badge, Button, Tabs, Modal, Notice, Timeline, Select, Loading, useToast } from '@/components/ui';
import { useSession, can } from '@/components/shell/AppShell';

export function ClaimsBoard({ supplierFocus }: { supplierFocus?: boolean }) {
  const s = useSession(); const toast = useToast();
  const { data, reload } = useApi<any[]>('/refund-claims');
  const [t, setT] = useState<'open' | 'all'>('open'); const [sel, setSel] = useState<any>(null); const [scn, setScn] = useState(''); const [busy, setBusy] = useState<string | null>(null);
  if (!data) return <Loading />;
  const open = (c: any) => !['RECONCILED_CLOSED', 'CLOSED_SETTLED_VOID', 'CLOSED_NONREFUNDABLE', 'CLOSED_NONREFUNDABLE_S0'].includes(c.status);
  const rows = data.filter((c) => (t === 'all' || open(c)) && (!supplierFocus || c.supplierStatus !== 'NOT_APPLICABLE'));
  async function settle(c: any) { setBusy('settle'); try { const r = await apiFetch<any>(`/refund-claims/${c.id}/supplier-settlement-demo`, { idem: newKey(), body: { scenarioId: scn } }); toast({ tone: r.data.status === 'MATCHED' ? 'success' : 'error', title: r.data.replay ? 'Replay ignored — already recorded' : `Supplier receipt ${r.data.status.toLowerCase()}`, body: 'No wallet credit is posted by a supplier receipt.' }); const fresh = (await apiFetch<any[]>('/refund-claims')).data; setSel(fresh.find((x) => x.id === c.id)); reload(); } catch (e: any) { toast({ tone: 'error', title: 'Not recorded', body: e.message }); } finally { setBusy(null); } }
  async function payout(c: any) { setBusy('pay'); try { const r = await apiFetch<any>(`/refund-claims/${c.id}/payout-demo`, { idem: newKey() }); toast({ tone: 'success', title: r.data.alreadyCredited ? 'Already credited — no second payout' : `Wallet credited ${inr(r.data.amountMinor)} once`, body: c.agencyName }); const fresh = (await apiFetch<any[]>('/refund-claims')).data; setSel(fresh.find((x) => x.id === c.id)); reload(); } catch (e: any) { toast({ tone: 'error', title: 'Payout blocked', body: e.message }); } finally { setBusy(null); } }
  const payoutEligible = (c: any) => c.agencyPayoutStatus !== 'CREDITED' && ((c.payoutMode === 'SUPPLIER_SETTLEMENT' && c.supplierStatus === 'RECEIVED') || c.agencyPayoutStatus === 'APPROVAL_PENDING');
  return (
    <>
      <Card pad={false}>
        <Tabs className="px-4" value={t} onChange={setT} tabs={[{ id: 'open', label: 'Open', count: data.filter(open).length }, { id: 'all', label: 'All', count: data.length }]} />
        <Table head={['Claim', 'Agency', 'Booking', 'Booked policy', 'Agency refund', 'Payout', 'Supplier expected / received', 'Supplier', 'Status', 'Raised', 'Age', '']}>
          {rows.map((c) => <tr key={c.id} className="hover:bg-slate-50" data-testid={`claim-${c.id}`}><Td className="font-semibold">{c.id}</Td><Td>{c.agencyName}</Td><Td><Link href={`/operations/bookings/${c.bookingId}`} className="text-brand-700">{c.bookingId}</Link><div className="text-xs text-muted">{c.route}</div></Td><Td><Badge tone={c.payoutMode === 'IMMEDIATE_IF_ELIGIBLE' ? 'green' : 'violet'}>{c.payoutMode === 'IMMEDIATE_IF_ELIGIBLE' ? 'Immediate' : 'Supplier settlement'} · v{c.refundPolicyVersion}</Badge></Td><Td className="tabular font-semibold">{inr(c.agencyRefundMinor)}</Td><Td><Status value={c.agencyPayoutStatus} /></Td><Td className="tabular text-xs">{inr(c.supplierExpectedMinor)} / {inr(c.supplierReceivedMinor)}</Td><Td><Status value={c.supplierStatus} /></Td><Td><Status value={c.status} /></Td><Td className="whitespace-nowrap text-muted">{fmtDate(c.createdAt, 'Asia/Kolkata', false)}</Td><Td className="whitespace-nowrap" data-testid={`age-${c.id}`}>{Math.max(0, Math.floor((Date.now() - Date.parse(c.createdAt)) / 86400000))}d</Td><Td><Button size="sm" variant="secondary" onClick={() => { setSel(c); setScn(c.supplierScenarios?.[0]?.id ?? ''); }}>Process</Button></Td></tr>)}
        </Table>
      </Card>
      <Modal open={!!sel} onClose={() => setSel(null)} wide title={sel ? `${sel.id} · ${sel.agencyName}` : ''} subtitle={sel ? `Booking ${sel.bookingId} · policy ${sel.refundPolicyId} v${sel.refundPolicyVersion} (snapshotted at booking)` : ''}>
        {sel && (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-muted">Agency refund</div><div className="text-lg font-bold">{inr(sel.agencyRefundMinor)}</div><Status value={sel.agencyPayoutStatus} /></div><div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-muted">Supplier expected / received</div><div className="text-lg font-bold">{inr(sel.supplierExpectedMinor)}</div><div className="text-xs">received {inr(sel.supplierReceivedMinor)} · <Status value={sel.supplierStatus} /></div></div></div>
              <Timeline items={sel.timeline} />
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border border-line p-4"><div className="mb-2 flex items-center justify-between"><b className="text-sm">1 · Supplier refund receipt</b></div>
                {sel.supplierStatus === 'PENDING' || sel.supplierStatus === 'EXCEPTION' ? (can(s, 'SUPPLIER_SETTLE') ? <>
                  <Select value={scn} onChange={(e) => setScn(e.target.value)} className="mb-2 text-sm" aria-label="Supplier statement event">{sel.supplierScenarios?.map((x: any) => <option key={x.id} value={x.id}>{x.externalRef} · {inr(x.amountMinor)}{x.amountMinor !== sel.supplierExpectedMinor ? ' (mismatch)' : ''}</option>)}</Select>
                  <Button size="sm" loading={busy === 'settle'} onClick={() => settle(sel)} disabled={!scn} data-testid="post-receipt">Match supplier statement entry</Button>
                  <p className="mt-2 text-[11.5px] text-muted">Persists receipt evidence and match/exception only. Never credits the agency wallet.</p></> : <p className="text-sm text-muted">Requires Operations/Finance permission.</p>)
                  : <div className="space-y-1 text-sm">{sel.receipts?.map((r: any) => <div key={r.id} className="flex justify-between"><span className="font-mono text-xs">{r.externalRef}</span><span>{inr(r.amountMinor)} <Status value={r.status} /></span></div>)}{!sel.receipts?.length && <span className="text-muted">Not applicable</span>}</div>}
              </div>
              <div className="rounded-xl border border-line p-4"><b className="text-sm">2 · Authorised agency payout</b>
                {sel.agencyPayoutStatus === 'CREDITED' ? <Notice tone="success" className="mt-2">Credited {inr(sel.walletCreditedMinor)} — exactly once ({sel.walletLedgerEntryId}).</Notice>
                  : can(s, 'REFUND_PAYOUT') ? <><Button className="mt-2" size="sm" loading={busy === 'pay'} disabled={!payoutEligible(sel)} onClick={() => payout(sel)} data-testid="payout">Post wallet refund credit</Button><p className="mt-2 text-[11.5px] text-muted">{payoutEligible(sel) ? 'Idempotent — a replay never creates a second credit.' : sel.payoutMode === 'SUPPLIER_SETTLEMENT' ? 'Booked policy requires a fully matched supplier receipt first.' : 'Not awaiting payout.'}</p></> : <p className="mt-2 text-sm text-muted">Finance role required.</p>}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
