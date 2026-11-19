'use client';
/** OPS-10 — Guided manual/offline order: an identifiable record only; no GDS ticket, no ledger posting. */
import { useState } from 'react';
import Link from 'next/link';
import { apiFetch, useApi } from '@/lib/client';
import { Card, PageHeader, Field, Input, Select, Button, Notice, SimTag, DL } from '@/components/ui';
export default function Page() {
  const agencies = useApi<any[]>('/agencies').data;
  const [f, setF] = useState({ agencyId: '', origin: 'BOM', destination: 'DEL', travelDate: '', airline: 'AI', passengerName: '', supplierReference: '', amount: '' });
  const [step, setStep] = useState<'form' | 'review' | 'done'>('form'); const [res, setRes] = useState<any>(null); const [err, setErr] = useState<string | null>(null);
  const submit = async () => { setErr(null); try { const r = await apiFetch<any>('/manual-orders', { body: { ...f, amountMinor: Math.round(Number(f.amount) * 100) } }); setRes(r.data); setStep('done'); } catch (e: any) { setErr(e.message); setStep('form'); } };
  const valid = f.agencyId && f.travelDate && f.passengerName.length > 2 && f.supplierReference.length > 3 && Number(f.amount) > 0;
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Operations" title="Manual / offline order" subtitle="Record an offline booking made directly with a supplier." badges={<SimTag kind="Guided demo" />} />
      {err && <Notice tone="error" className="mb-4">{err}</Notice>}
      {step === 'done' && res ? <Notice tone="success" title={`Recorded ${res.bookingId}`}>{res.label}. <Link className="font-semibold underline" href={`/operations/bookings/${res.bookingId}`}>Open record</Link> — no ticket, no wallet/credit posting, excluded from ticketed KPIs.</Notice> : (
        <Card>
          {step === 'form' ? <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Agency" required><Select value={f.agencyId} onChange={(e) => setF({ ...f, agencyId: e.target.value })}><option value="">Select…</option>{agencies?.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}</Select></Field>
            <Field label="Supplier reference" required><Input value={f.supplierReference} onChange={(e) => setF({ ...f, supplierReference: e.target.value })} placeholder="SUP-REF-1234" /></Field>
            <Field label="Origin"><Input value={f.origin} maxLength={3} onChange={(e) => setF({ ...f, origin: e.target.value.toUpperCase() })} /></Field>
            <Field label="Destination"><Input value={f.destination} maxLength={3} onChange={(e) => setF({ ...f, destination: e.target.value.toUpperCase() })} /></Field>
            <Field label="Travel date" required><Input type="date" value={f.travelDate} onChange={(e) => setF({ ...f, travelDate: e.target.value })} /></Field>
            <Field label="Airline"><Input value={f.airline} maxLength={3} onChange={(e) => setF({ ...f, airline: e.target.value.toUpperCase() })} /></Field>
            <Field label="Passenger (synthetic)" required><Input value={f.passengerName} onChange={(e) => setF({ ...f, passengerName: e.target.value })} /></Field>
            <Field label="Amount (INR)" required><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
            <div className="sm:col-span-2 flex justify-end"><Button disabled={!valid} onClick={() => setStep('review')}>Review</Button></div>
          </div> : <div className="space-y-4"><DL items={Object.entries(f).map(([k, v]) => [k, v || '—'])} /><Notice tone="warn">This creates a demo offline record only. No supplier order, ticket or payment is executed.</Notice><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setStep('form')}>Back</Button><Button onClick={submit}>Confirm demo manual order</Button></div></div>}
        </Card>
      )}
    </div>
  );
}
