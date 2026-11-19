'use client';
/** OTA-14 / Ops Import PNR — every field optional: list PNRs available to the user, then import one or many at once. */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, Import, CheckCircle2, RotateCcw } from 'lucide-react';
import { apiFetch, useApi, inr, fmtDate, newKey, ApiError } from '@/lib/client';
import { Button, Card, Field, Input, Select, Notice, Badge, Status, Table, Td, Empty, Loading, BusyOverlay, useToast, cx } from '@/components/ui';

type Filters = { pcc: string; pnr: string; passenger: string; from: string; to: string; targetAgencyId: string };
const EMPTY: Filters = { pcc: '', pnr: '', passenger: '', from: '', to: '', targetAgencyId: '' };

export function PnrImport({ hub, base }: { hub?: boolean; base: string }) {
  const toast = useToast();
  const agencies = useApi<any[]>(hub ? '/agencies' : null).data;
  const [f, setF] = useState<Filters>(EMPTY);
  const [rows, setRows] = useState<any[] | null>(null); const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<'search' | 'import' | null>(null);
  const [sel, setSel] = useState<string[]>([]); const [result, setResult] = useState<any[] | null>(null);
  const key = useRef(newKey());
  const rowKey = (r: any) => `${r.pcc}:${r.gdsPnr}`;
  async function search(filters = f) {
    setBusy('search'); setErr(null); setSel([]);
    const body = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    try { setRows((await apiFetch<any[]>('/pnr-imports/search', { body, quiet: true })).data); } catch (e: any) { setErr(e); setRows(null); } finally { setBusy(null); }
  }
  useEffect(() => { search(EMPTY); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const importable = useMemo(() => (rows ?? []).filter((r) => !r.alreadyImported), [rows]);
  async function doImport(keys: string[]) {
    if (!keys.length || busy) return;
    setBusy('import'); setErr(null);
    try {
      const items = keys.map((k) => { const [pcc, pnr] = k.split(':'); return { pcc, pnr }; });
      const r = await apiFetch<any[]>('/pnr-imports/bulk', { idem: key.current, body: { items, ...(hub && f.targetAgencyId ? { targetAgencyId: f.targetAgencyId } : {}) }, quiet: true });
      setResult(r.data); key.current = newKey();
      const ok = r.data.filter((x) => x.status === 'IMPORTED').length;
      toast({ tone: ok ? 'success' : 'info', title: ok ? `${ok} PNR${ok > 1 ? 's' : ''} imported` : 'Nothing new imported', body: r.data.filter((x) => x.status !== 'IMPORTED').map((x) => `${x.gdsPnr}: ${x.status === 'ALREADY_IMPORTED' ? 'already imported' : x.message}`).join(' · ') || undefined });
      await search();
    } catch (e: any) { setErr(e); } finally { setBusy(null); }
  }
  const toggle = (k: string) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  return (
    <div className="space-y-5">
      <BusyOverlay show={busy === 'import'} title="Importing PNRs…" detail="Retrieving each PNR and creating bookings." />
      <Card title="Find PNRs" subtitle="All fields are optional — leave them empty to list every PNR available to you, or fill any field to narrow the list.">
        <form onSubmit={(e) => { e.preventDefault(); search(); }} className={cx('grid items-end gap-3 sm:grid-cols-2', hub ? 'lg:grid-cols-[1fr_1fr_1.2fr_150px_150px_1fr_auto]' : 'lg:grid-cols-[1fr_1fr_1.2fr_150px_150px_auto]')}>
          <Field label="PCC"><Input value={f.pcc} onChange={(e) => setF({ ...f, pcc: e.target.value.toUpperCase() })} placeholder={hub ? 'e.g. S9KY' : 'Your PCC, e.g. S9KY'} name="pcc" /></Field>
          <Field label="PNR"><Input value={f.pnr} onChange={(e) => setF({ ...f, pnr: e.target.value.toUpperCase() })} placeholder="e.g. SBD101" name="pnr" /></Field>
          <Field label="Passenger name"><Input value={f.passenger} onChange={(e) => setF({ ...f, passenger: e.target.value })} placeholder="e.g. Menon" name="passenger" /></Field>
          <Field label="Departure from"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} name="from" /></Field><Field label="Departure to"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} name="to" /></Field>
          {hub && <Field label="Agency"><Select value={f.targetAgencyId} onChange={(e) => setF({ ...f, targetAgencyId: e.target.value })} name="targetAgencyId"><option value="">All agencies</option>{agencies?.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}</Select></Field>}
          <div className="flex gap-2"><Button loading={busy === 'search'} icon={<Search className="h-4 w-4" />} data-testid="pnr-lookup">Search</Button><Button type="button" variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={() => { setF(EMPTY); search(EMPTY); }}>Reset</Button></div>
        </form>
      </Card>
      <div className="min-w-0 space-y-4">
        {err && <Notice tone="error" title={err.code === 'PNR_ALREADY_IMPORTED' ? 'Already imported' : 'Could not retrieve'}>{err.message}</Notice>}
        {result && (
          <Card title={<span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-ok-600" />Import result</span>} actions={<Button size="sm" variant="ghost" onClick={() => setResult(null)}>Dismiss</Button>}>
            <Table dense head={['PNR', 'Result', 'Booking', 'Next steps']}>
              {result.map((r) => <tr key={`${r.pcc}:${r.gdsPnr}`} data-testid={`import-result-${r.gdsPnr}`}><Td className="font-mono font-semibold">{r.gdsPnr}</Td><Td>{r.status === 'IMPORTED' ? <Badge tone="green">Imported</Badge> : r.status === 'ALREADY_IMPORTED' ? <Badge tone="amber">Already imported</Badge> : <Badge tone="red">{r.message}</Badge>}</Td>
                <Td>{r.bookingId ? <Link className="font-semibold text-brand-700 hover:underline" href={`${base}/${r.bookingId}`}>{r.bookingId}</Link> : '—'}</Td>
                <Td className="whitespace-nowrap">{r.bookingId && <span className="flex gap-3 text-xs font-semibold text-brand-700"><Link href={`${base}/${r.bookingId}`}>View booking</Link><Link href={`${base}/${r.bookingId}?amend=1`}>Change date</Link><Link href={`${base}/${r.bookingId}`}>Cancel</Link></span>}</Td></tr>)}
            </Table>
            <p className="mt-3 text-xs text-muted">Imported bookings appear in Booking Carts. No new ticket is issued and nothing is charged to your account.</p>
          </Card>
        )}
        <Card pad={false} title={rows ? `${rows.length} PNR${rows.length === 1 ? '' : 's'} found` : 'PNRs'} actions={rows && importable.length > 0 && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSel(sel.length === importable.length ? [] : importable.map(rowKey))}>{sel.length === importable.length ? 'Clear selection' : 'Select all new'}</Button>
            <Button size="sm" icon={<Import className="h-4 w-4" />} disabled={!sel.length || !!busy} loading={busy === 'import'} onClick={() => doImport(sel)} data-testid="pnr-import">Import selected ({sel.length})</Button>
          </div>)}>
          {busy === 'search' && !rows ? <Loading /> : !rows?.length ? <Empty title="No PNRs found">Try fewer filters, or check the PCC and PNR.</Empty> : (
            <Table head={['', 'PNR', 'PCC', ...(hub ? ['Agency'] : []), 'Route & flight', 'Departure', 'Passengers', 'Tickets', 'Amount', 'Status']}>
              {rows.map((r) => {
                const k = rowKey(r);
                return (
                  <tr key={k} className={cx(r.alreadyImported && 'bg-slate-50/60')} data-testid={`pnr-row-${r.gdsPnr}`}>
                    <Td><input type="checkbox" className="h-4 w-4 accent-brand-500" aria-label={`Select ${r.gdsPnr}`} disabled={r.alreadyImported} checked={sel.includes(k)} onChange={() => toggle(k)} data-testid={`pnr-select-${r.gdsPnr}`} /></Td>
                    <Td className="font-mono font-semibold">{r.gdsPnr}</Td>
                    <Td className="font-mono text-xs">{r.pcc}</Td>
                    {hub && <Td>{r.ownerAgencyName ?? '—'}</Td>}
                    <Td className="whitespace-nowrap">{r.itinerary.origin} → {r.itinerary.destination}<div className="text-xs text-muted">{r.itinerary.airlineName} {r.itinerary.flightNumber}</div></Td>
                    <Td className="whitespace-nowrap text-muted">{fmtDate(r.itinerary.departureAt)}</Td>
                    <Td className="max-w-[220px]" title={r.passengers.join(', ')}>{r.passengers[0]}{r.passengers.length > 1 && <span className="ml-1 text-xs text-muted">+{r.passengers.length - 1}</span>}</Td>
                    <Td className="whitespace-nowrap">{r.ticketNumbers.length ? `${r.ticketNumbers.length} issued` : <Status value="NOT_ISSUED" />}</Td>
                    <Td className="whitespace-nowrap tabular">{inr(r.agencySellMinor)}</Td>
                    <Td className="whitespace-nowrap">{r.alreadyImported ? <span className="text-xs"><Badge tone="amber">Already imported</Badge> <Link className="font-semibold text-brand-700" href={`${base}/${r.alreadyImportedBookingId}`}>{r.alreadyImportedBookingId}</Link></span> : <Button size="sm" variant="secondary" onClick={() => doImport([k])} disabled={!!busy}>Import</Button>}</Td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
