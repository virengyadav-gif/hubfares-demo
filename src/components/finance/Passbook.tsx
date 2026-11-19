'use client';
/** OTA-13 — live passbook from the append-only wallet ledger (not a static report). */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useApi, inr, fmtDate } from '@/lib/client';
import { Card, Input, Table, Td, Badge, Loading, ErrorBox, Empty, SimTag, cx } from '@/components/ui';

export function Passbook({ agencyId, bookingBase = '/agency/bookings' }: { agencyId?: string; bookingBase?: string }) {
  const [f, setF] = useState({ from: '', to: '', q: '' });
  const qs = useMemo(() => new URLSearchParams(Object.entries({ ...f, agencyId: agencyId ?? '' }).filter(([, v]) => v).map(([k, v]) => [k, k === 'from' ? `${v}T00:00:00Z` : k === 'to' ? `${v}T23:59:59Z` : v])).toString(), [f, agencyId]);
  const { data, loading, error } = useApi<any>(`/wallet/passbook?${qs}`, [qs]);
  return (
    <Card pad={false} title="Wallet passbook" subtitle="Opening balance + credits − debits = closing balance. Derived live from the ledger." actions={<SimTag kind="Live demo data" />}>
      <div className="grid gap-2 border-b border-line p-4 sm:grid-cols-3"><Input type="date" aria-label="From" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /><Input type="date" aria-label="To" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /><Input placeholder="Booking / payment / refund reference" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} aria-label="Reference filter" /></div>
      {error && <div className="p-4"><ErrorBox error={error} /></div>}
      {loading && !data ? <Loading /> : data && (
        <>
          <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-4">
            {[['Opening balance', data.openingBalanceMinor], ['Credits', data.totalCreditsMinor], ['Debits', data.totalDebitsMinor], ['Closing balance', data.closingBalanceMinor]].map(([l, v]) => <div key={l as string}><div className="text-xs text-muted">{l}</div><div className="text-lg font-bold tabular" data-testid={`pb-${(l as string).split(' ')[0].toLowerCase()}`}>{inr(v as number)}</div></div>)}
          </div>
          {!data.entries.length ? <Empty title="No ledger entries in this window" /> : (
            <Table head={['Date', 'Type', 'Description', 'Reference', 'Debit', 'Credit', 'Balance']}>
              {data.entries.map((e: any) => (
                <tr key={e.id}><Td className="whitespace-nowrap text-muted">{fmtDate(e.createdAt)}</Td><Td><Badge tone={e.type === 'REFUND_CREDIT' ? 'green' : e.type === 'PAYMENT_CREDIT' ? 'blue' : e.type === 'OPENING' ? 'gray' : 'orange'}>{e.type.replace(/_/g, ' ').toLowerCase()}</Badge></Td><Td className="max-w-[300px] truncate">{e.description}</Td>
                  <Td className="whitespace-nowrap font-mono text-[12px]">{e.bookingId ? <Link className="text-brand-700 hover:underline" href={`${bookingBase}/${e.bookingId}`}>{e.bookingId}</Link> : e.externalRef ?? e.refundId ?? '—'}</Td>
                  <Td className="text-right tabular text-bad-600">{e.direction === 'DEBIT' ? inr(e.amountMinor) : ''}</Td><Td className="text-right tabular text-ok-600">{e.direction === 'CREDIT' ? inr(e.amountMinor) : ''}</Td><Td className={cx('text-right font-semibold tabular')}>{inr(e.balanceAfterMinor)}</Td></tr>
              ))}
            </Table>
          )}
        </>
      )}
    </Card>
  );
}
