'use client';
/** Manage Exchange — display exchange rates (INR base). Conversion is for display; bookings, wallet and settlement stay in INR. */
import { useState } from 'react';
import { apiFetch, useApi } from '@/lib/client';
import { Card, PageHeader, Table, Td, Notice, Input, Button, Badge, useToast } from '@/components/ui';
import { useSession, can } from '@/components/shell/AppShell';
export default function Page() {
  const s = useSession(); const toast = useToast();
  const { data, reload } = useApi<any[]>('/fx-demo-rates');
  const [edit, setEdit] = useState<Record<string, string>>({}); const [busy, setBusy] = useState<string | null>(null);
  const save = async (c: string) => { setBusy(c); try { await apiFetch('/fx-demo-rates', { method: 'PATCH', body: { quoteCurrency: c, inrPerUnit: edit[c] } }); toast({ tone: 'success', title: `${c} rate updated`, body: `1 ${c} = ₹${edit[c]}` }); setEdit((e) => { const n = { ...e }; delete n[c]; return n; }); reload(); } catch (e: any) { toast({ tone: 'error', title: 'Rate not saved', body: e.message }); } finally { setBusy(null); } };
  const editable = can(s, 'POLICY_EDIT');
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Admin" title="Manage Exchange" subtitle="Exchange rates used to show fares in USD and EUR. INR is the base currency." />
      <Card title="Exchange rates" pad={false}><Table head={['Currency', 'INR per unit', 'Rate date', 'Source', '']}>{(data ?? []).map((r) => (
        <tr key={r.quoteCurrency}><Td className="font-semibold">{r.quoteCurrency}{r.quoteCurrency === 'INR' && <Badge tone="gray" className="ml-1.5">base</Badge>}</Td>
          <Td className="tabular">{editable && r.quoteCurrency !== 'INR' && edit[r.quoteCurrency] !== undefined ? <Input className="h-8 w-28" value={edit[r.quoteCurrency]} onChange={(e) => setEdit({ ...edit, [r.quoteCurrency]: e.target.value })} name={`rate-${r.quoteCurrency}`} /> : r.inrPerUnit}</Td>
          <Td>{r.effectiveDate}</Td><Td>{r.source === 'MANUAL' ? 'Updated by admin' : 'Treasury rate'}</Td>
          <Td className="whitespace-nowrap">{editable && r.quoteCurrency !== 'INR' && (edit[r.quoteCurrency] === undefined ? <Button size="sm" variant="secondary" onClick={() => setEdit({ ...edit, [r.quoteCurrency]: r.inrPerUnit })}>Edit</Button> : <div className="flex gap-1.5"><Button size="sm" loading={busy === r.quoteCurrency} onClick={() => save(r.quoteCurrency)}>Save</Button><Button size="sm" variant="ghost" onClick={() => setEdit((e) => { const n = { ...e }; delete n[r.quoteCurrency]; return n; })}>Cancel</Button></div>)}</Td></tr>
      ))}</Table></Card>
      <Notice tone="info" className="mt-4">Converted prices are for display. Quotes, bookings, wallet, credit and settlement always remain in INR.</Notice>
    </div>
  );
}
