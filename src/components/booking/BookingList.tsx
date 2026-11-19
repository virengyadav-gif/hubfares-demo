'use client';
/** OTA-08 / OPS-05 — one booking list component; the server scopes rows by session agency. */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, RotateCcw, Download } from 'lucide-react';
import { useApi, inr, fmtDate } from '@/lib/client';
import { Card, Input, Select, Table, Td, Status, Badge, Empty, Loading, ErrorBox, Button } from '@/components/ui';

export function BookingList({ base, hub }: { base: string; hub?: boolean }) {
  const [f, setF] = useState({ q: '', status: '', source: '', agencyId: '', from: '', to: '', route: '', airline: '' });
  const qs = useMemo(() => new URLSearchParams(Object.entries(f).filter(([, v]) => v).map(([k, v]) => [k, k === 'to' && v ? `${v}T23:59:59Z` : k === 'from' && v ? `${v}T00:00:00Z` : v])).toString(), [f]);
  const { data, loading, error, reload } = useApi<any[]>(`/bookings?${qs}`, [qs]);
  const agencies = useApi<any[]>(hub ? '/agencies' : null).data;
  const chips = Object.entries(f).filter(([, v]) => v);
  return (
    <Card pad={false}>
      <div className="grid gap-2 border-b border-line p-4 md:grid-cols-[1.4fr_repeat(3,1fr)_auto]">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" /><Input className="pl-9" placeholder="Booking ID, PNR, passenger or ticket" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} aria-label="Search bookings" /></div>
        <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Status"><option value="">All statuses</option>{['PNR_CREATED', 'TICKETED', 'CANCELLED', 'VOIDED', 'BOOKING_FAILED', 'TICKETING_FAILED', 'MANUAL_RECORDED'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>)}</Select>
        <Select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} aria-label="Source"><option value="">All sources</option><option value="PORTAL">Portal</option><option value="IMPORTED">Imported</option><option value="MANUAL_DEMO">Manual (guided)</option></Select>
        {hub ? <Select value={f.agencyId} onChange={(e) => setF({ ...f, agencyId: e.target.value })} aria-label="Agency"><option value="">All agencies</option>{agencies?.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}</Select> : <Input placeholder="Route e.g. BOM-DEL" value={f.route} onChange={(e) => setF({ ...f, route: e.target.value })} aria-label="Route" />}
        <Button variant="ghost" onClick={() => setF({ q: '', status: '', source: '', agencyId: '', from: '', to: '', route: '', airline: '' })} icon={<RotateCcw className="h-4 w-4" />}>Reset</Button>
        <div className="grid grid-cols-2 gap-2 md:col-span-2"><Input type="date" aria-label="Booked from" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /><Input type="date" aria-label="Booked to" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
        <Input placeholder="Airline e.g. BA" value={f.airline} onChange={(e) => setF({ ...f, airline: e.target.value })} aria-label="Airline" />
        {hub && <Input placeholder="Route e.g. BOM-LHR" value={f.route} onChange={(e) => setF({ ...f, route: e.target.value })} aria-label="Route" />}
      </div>
      {chips.length > 0 && <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2">{chips.map(([k, v]) => <Badge key={k} tone="orange">{k}: {v}</Badge>)}</div>}
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : !data?.length ? <Empty title="No bookings match">Adjust filters or create a booking from Book a Flight.</Empty> : (
        <Table head={['Booking', ...(hub ? ['Agency'] : []), 'Booked', 'Passenger', 'Route', 'Airline', 'GDS / PNR', 'Ticket', 'Status', 'Amount', '']}>
          {data.map((b) => (
            <tr key={b.id} className="hover:bg-slate-50/70" data-testid={`row-${b.id}`}>
              <Td><Link className="font-semibold text-brand-700 hover:underline" href={`${base}/${b.id}`}>{b.id}</Link>{b.source !== 'PORTAL' && <Badge tone={b.source === 'IMPORTED' ? 'blue' : 'violet'} className="ml-1.5">{b.source === 'IMPORTED' ? 'Imported' : 'Manual'}</Badge>}{b.tripType === 'ROUND_TRIP' && <Badge tone="gray" className="ml-1.5">Return</Badge>}</Td>
              {hub && <Td className="whitespace-nowrap">{b.agencyName}</Td>}
              <Td className="whitespace-nowrap text-muted">{fmtDate(b.bookedAt)}</Td>
              <Td className="max-w-[160px] truncate">{b.leadPassenger}</Td>
              <Td className="font-medium">{b.routeSummary}</Td>
              <Td>{b.airlineSummary}</Td>
              <Td className="whitespace-nowrap"><span className="text-xs text-muted">{b.provider === 'SABRE' ? 'Sabre (mock)' : b.provider}</span> <span className="font-mono text-[13px] font-semibold">{b.gdsPnr ?? '—'}</span></Td>
              <Td className="whitespace-nowrap font-mono text-[12px]">{['TICKETED', 'CANCELLED', 'VOIDED'].includes(b.bookingStatus) ? b.ticketNumbers.join(', ') || '—' : '—'}</Td>
              <Td><Status value={b.bookingStatus} /></Td>
              <Td className="whitespace-nowrap text-right font-semibold tabular">{inr(b.sellAmountMinor)}</Td>
              <Td><Link href={`${base}/${b.id}`} className="text-xs font-semibold text-brand-700">Open</Link></Td>
            </tr>
          ))}
        </Table>
      )}
      <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-muted"><span>{data?.length ?? 0} bookings · live demo records</span><span className="flex items-center gap-1"><Download className="h-3 w-3" />Excel exports are static samples under Reports</span></div>
    </Card>
  );
}
