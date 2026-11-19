'use client';
/** OTA-14 / Ops Import PNR — provider + PCC + PNR retrieve, preview, single import (WF-14). */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { Search, Import } from 'lucide-react';
import { apiFetch, useApi, inr, fmtDate, newKey, ApiError } from '@/lib/client';
import { Button, Card, Field, Input, Select, Notice, DL, Badge, Status, SimTag, useToast } from '@/components/ui';

export function PnrImport({ hub, base }: { hub?: boolean; base: string }) {
  const toast = useToast();
  const agencies = useApi<any[]>(hub ? '/agencies' : null).data;
  const [f, setF] = useState({ provider: 'SABRE', pcc: hub ? 'HFDEMO1' : '', pnr: '', targetAgencyId: '' });
  const [prev, setPrev] = useState<any>(null); const [err, setErr] = useState<ApiError | null>(null); const [busy, setBusy] = useState<string | null>(null); const [done, setDone] = useState<any>(null);
  const key = useRef(newKey());
  const body = () => ({ ...f, targetAgencyId: hub ? f.targetAgencyId || undefined : undefined });
  async function lookup(e: React.FormEvent) { e.preventDefault(); setBusy('l'); setErr(null); setPrev(null); setDone(null); try { setPrev((await apiFetch('/pnr-imports/lookup', { body: body() })).data); key.current = newKey(); } catch (e: any) { setErr(e); } finally { setBusy(null); } }
  async function commit() { setBusy('i'); setErr(null); try { const r = await apiFetch<any>('/pnr-imports', { idem: key.current, body: body() }); setDone(r.data); toast({ tone: 'success', title: `Imported as ${r.data.bookingId}` }); } catch (e: any) { setErr(e); } finally { setBusy(null); } }
  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Card title="Retrieve PNR" actions={<SimTag kind="Simulated" />}>
        <form onSubmit={lookup} className="space-y-3">
          <Field label="GDS"><Select value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} name="provider"><option value="SABRE">Sabre (mock, default)</option><option value="TRAVELPORT">Travelport (planned)</option><option value="AMADEUS">Amadeus (planned)</option></Select></Field>
          <Field label="PCC" hint={hub ? 'HFDEMO1 · SKYDEMO · ORBDEMO (invented demo PCCs)' : 'Your permitted PCC, e.g. SKYDEMO'}><Input value={f.pcc} onChange={(e) => setF({ ...f, pcc: e.target.value.toUpperCase() })} required name="pcc" /></Field>
          <Field label="PNR"><Input value={f.pnr} onChange={(e) => setF({ ...f, pnr: e.target.value.toUpperCase() })} required placeholder="e.g. SBD101" name="pnr" /></Field>
          {hub && <Field label="Target agency"><Select value={f.targetAgencyId} onChange={(e) => setF({ ...f, targetAgencyId: e.target.value })} required><option value="">Select agency…</option>{agencies?.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}</Select></Field>}
          <Button className="w-full" loading={busy === 'l'} icon={<Search className="h-4 w-4" />} data-testid="pnr-lookup">Retrieve</Button>
        </form>
      </Card>
      <div className="space-y-4">
        {err && <Notice tone="error" title={err.code === 'PNR_ALREADY_IMPORTED' ? 'Already imported' : err.code === 'INTEGRATION_NOT_CONNECTED' ? 'Planned integration' : 'Not found'}>{err.message}</Notice>}
        {done && <Notice tone="success" title={`PNR ${done.gdsPnr} imported once`}>Booking <Link className="font-semibold underline" href={`${base}/${done.bookingId}`}>{done.bookingId}</Link> created with source IMPORTED. No new ticket was issued and no wallet/credit posting was made. Static Excel reports are unchanged.</Notice>}
        {prev ? (
          <Card title={<span className="flex items-center gap-2">PNR {prev.gdsPnr} <Badge tone="blue">{prev.provider} · {prev.pcc}</Badge></span>} subtitle="Simulated retrieve — confirm agency mapping before importing." actions={<SimTag kind="Simulated Sabre response" />}>
            <DL cols={3} items={[['Route', `${prev.itinerary.origin} → ${prev.itinerary.destination}`], ['Flight', `${prev.itinerary.airlineName} ${prev.itinerary.flightNumber}`], ['Departure', fmtDate(prev.itinerary.departureAt)], ['Passengers', prev.passengers.join(', ')], ['Ticket status', <Status key="t" value={prev.ticketStatus === 'TICKETED' ? 'ISSUED' : 'NOT_ISSUED'} />], ['Ticket numbers', prev.ticketNumbers.join(', ') || '—'], ['Fare rules', prev.fareRuleProfileId], ['Agency price', inr(prev.agencySellMinor)], ['Airline PNR', prev.airlinePnr ?? '—']]} />
            <div className="mt-5 flex items-center justify-between border-t border-line pt-4">{prev.alreadyImported ? <Notice tone="warn" title="Already imported">This provider/PCC/PNR already exists as {prev.alreadyImportedBookingId}. A second import will be rejected.</Notice> : <span className="text-sm text-muted">Import creates one booking record — it does not re-ticket.</span>}<Button icon={<Import className="h-4 w-4" />} loading={busy === 'i'} onClick={commit} disabled={!!done} data-testid="pnr-import">Import once</Button></div>
          </Card>
        ) : !err && <Card><p className="text-sm text-muted">Enter a seeded sample, e.g. <b>Sabre · SKYDEMO · SBD101</b> (Skyline) or <b>ORBDEMO · SBD202</b> (Orbit). <b>SBD404</b> is already imported; <b>NOPE99</b> is unknown.</p></Card>}
      </div>
    </div>
  );
}
