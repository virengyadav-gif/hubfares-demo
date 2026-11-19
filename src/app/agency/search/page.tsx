'use client';
/** OTA-03 / OTA-04 / OTA-05 / OTA-22 — Search, branded fares, fare rules, display currency (WF-07/08/23). */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, Search, Plane, Zap, IndianRupee, SlidersHorizontal, Info, ChevronDown, ChevronUp, RotateCcw, CheckCircle2 } from 'lucide-react';
import { apiFetch, useApi, fmtTime, fmtDay, dur, ApiError } from '@/lib/client';
import { Button, Card, Field, Input, Select, Notice, Badge, Drawer, Modal, Empty, Loading, SimTag, PageHeader, cx, useToast } from '@/components/ui';
import { Price, CurrencySwitcher, FxNotice } from '@/components/flight/currency';
import { FareDetailsTabs, ProfileBadge, Profile } from '@/components/flight/FareRules';

const CITIES = [['BOM', 'Mumbai (BOM)'], ['DEL', 'Delhi (DEL)'], ['BLR', 'Bengaluru (BLR)'], ['GOA', 'Goa (GOI)'], ['LON', 'London (LHR)'], ['SIN', 'Singapore (SIN)'], ['DXB', 'Dubai (DXB)'], ['FRA', 'Frankfurt (FRA)']];
type Crit = { tripType: 'ONE_WAY' | 'ROUND_TRIP'; origin: string; destination: string; departureDate: string; returnDate: string; adults: number; children: number; infants: number; cabin: string; preferredAirline: string };
type Sel = { offer: any; brand: any } | null;
const BUCKETS = [['00-06', 0, 6], ['06-12', 6, 12], ['12-18', 12, 18], ['18-24', 18, 24]] as const;
const localHour = (iso: string, tz: string) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date(iso)));

export default function SearchPage() {
  const router = useRouter(); const toast = useToast();
  const seeded = useApi<Record<string, string[]>>('/search/seeded-dates').data;
  const [c, setC] = useState<Crit>({ tripType: 'ONE_WAY', origin: 'BOM', destination: 'LON', departureDate: '', returnDate: '', adults: 1, children: 0, infants: 0, cabin: 'ANY', preferredAirline: '' });
  const [res, setRes] = useState<any>(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState<ApiError | null>(null);
  const [out, setOut] = useState<Sel>(null); const [inb, setInb] = useState<Sel>(null); const [quoting, setQuoting] = useState(false);
  useEffect(() => { if (seeded && !c.departureDate) { const d = seeded['BOM-LON']?.[0]; const r = seeded['LON-BOM']?.[0]; setC((x) => ({ ...x, departureDate: d ?? '', returnDate: r ?? '' })); } }, [seeded, c.departureDate]);
  const hint = (o: string, d: string) => seeded?.[`${o}-${d}`]?.slice(0, 4) ?? [];
  async function run(crit = c) {
    setLoading(true); setErr(null); setOut(null); setInb(null);
    const q = new URLSearchParams(Object.entries(crit).filter(([k, v]) => v !== '' && !(k === 'returnDate' && crit.tripType === 'ONE_WAY')).map(([k, v]) => [k, String(v)]));
    try { setRes((await apiFetch(`/flight-offers?${q}`)).data); } catch (e: any) { setErr(e); setRes(null); } finally { setLoading(false); }
  }
  async function book() {
    if (!out || (c.tripType === 'ROUND_TRIP' && !inb)) return;
    setQuoting(true);
    try {
      const legs = [{ offerId: out.offer.id, brandId: out.brand.id }, ...(c.tripType === 'ROUND_TRIP' && inb ? [{ offerId: inb.offer.id, brandId: inb.brand.id }] : [])];
      const r = await apiFetch<any>('/quotes', { body: { tripType: c.tripType, legs, adults: c.adults } });
      router.push(`/agency/book/${r.data.quoteId}`);
    } catch (e: any) { toast({ tone: 'error', title: 'Could not create quote', body: e.message }); setQuoting(false); }
  }
  const fe = (err?.details as any)?.fieldErrors ?? {};
  const total = (out?.brand.sellMinor ?? 0) + (inb?.brand.sellMinor ?? 0);
  return (
    <div className={cx(out && 'pb-28')}>
      <PageHeader eyebrow="Book a flight" title="Search flights" subtitle="Sabre-first mock inventory with branded fares and transparent time-slab rules." badges={<SimTag kind="Simulated Sabre response" />} actions={<CurrencySwitcher />} />
      <Card className="mb-5">
        <form onSubmit={(e) => { e.preventDefault(); run(); }} className="space-y-4" data-testid="search-form">
          <div className="flex flex-wrap items-center gap-2">
            {(['ONE_WAY', 'ROUND_TRIP'] as const).map((t) => <button type="button" key={t} onClick={() => setC({ ...c, tripType: t })} className={cx('rounded-full px-4 py-1.5 text-sm font-semibold', c.tripType === t ? 'bg-ink-800 text-white' : 'bg-slate-100 text-muted hover:text-navy')}>{t === 'ONE_WAY' ? 'One-way' : 'Round-trip'}</button>)}
            <span className="rounded-full bg-slate-50 px-3 py-1.5 text-xs text-muted" title="Multi-city exists only as an agency-markup criterion and roadmap item.">Multi-city · roadmap</span>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_1fr_1fr]">
            <Field label="From" error={fe.origin}><Select value={c.origin} onChange={(e) => setC({ ...c, origin: e.target.value })} name="origin">{CITIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
            <button type="button" aria-label="Swap" onClick={() => setC({ ...c, origin: c.destination, destination: c.origin })} className="mt-6 h-10 rounded-lg border border-line px-2 text-muted hover:text-brand-600"><ArrowLeftRight className="h-4 w-4" /></button>
            <Field label="To" error={fe.destination}><Select value={c.destination} onChange={(e) => setC({ ...c, destination: e.target.value })} name="destination">{CITIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
            <Field label="Departure" hint={hint(c.origin, c.destination).length ? `Seeded: ${hint(c.origin, c.destination).map((d) => d.slice(5)).join(', ')}` : 'No seeded inventory on this route'}><Input type="date" required value={c.departureDate} onChange={(e) => setC({ ...c, departureDate: e.target.value })} name="departureDate" /></Field>
            <Field label="Return" error={fe.returnDate} hint={c.tripType === 'ROUND_TRIP' && hint(c.destination, c.origin).length ? `Seeded: ${hint(c.destination, c.origin).map((d) => d.slice(5)).join(', ')}` : undefined}><Input type="date" disabled={c.tripType === 'ONE_WAY'} value={c.tripType === 'ONE_WAY' ? '' : c.returnDate} onChange={(e) => setC({ ...c, returnDate: e.target.value })} name="returnDate" /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-[repeat(3,110px)_1fr_1fr_auto] md:items-end">
            <Field label="Adults" error={fe.adults}><Input type="number" min={0} max={4} value={c.adults} onChange={(e) => setC({ ...c, adults: Number(e.target.value) })} name="adults" /></Field>
            <Field label="Children" hint="Fares: N/A in demo"><Input type="number" min={0} max={4} value={c.children} onChange={(e) => setC({ ...c, children: Number(e.target.value) })} /></Field>
            <Field label="Infants" error={fe.infants}><Input type="number" min={0} max={4} value={c.infants} onChange={(e) => setC({ ...c, infants: Number(e.target.value) })} /></Field>
            <Field label="Cabin"><Select value={c.cabin} onChange={(e) => setC({ ...c, cabin: e.target.value })}><option value="ANY">Any cabin</option><option value="ECONOMY">Economy</option><option value="PREMIUM_ECONOMY">Premium economy</option><option value="BUSINESS">Business</option><option value="FIRST">First</option></Select></Field>
            <Field label="Preferred airline"><Select value={c.preferredAirline} onChange={(e) => setC({ ...c, preferredAirline: e.target.value })}><option value="">Any</option>{['AI', '6E', 'BA', 'QR', 'EK', 'SQ', 'LH'].map((a) => <option key={a}>{a}</option>)}</Select></Field>
            <Button size="lg" loading={loading} icon={<Search className="h-4 w-4" />} data-testid="search-submit">Search</Button>
          </div>
          {(c.children > 0 || c.infants > 0) && <Notice tone="warn">Child and infant fares are not defined in the demo fare data — searches show adult pricing; booking supports adults only.</Notice>}
        </form>
      </Card>
      {err && <Notice tone="error" title={err.message} className="mb-4">{Object.values(fe).join(' · ')}</Notice>}
      {loading && <Loading label="Querying simulated Sabre inventory…" />}
      {res && !loading && (
        <>
          <div className="mb-3"><FxNotice /></div>
          <div className={cx('grid gap-5', c.tripType === 'ROUND_TRIP' && 'xl:grid-cols-2')}>
            <ResultsColumn title={`${res.criteria.origin} → ${res.criteria.destination}`} leg={res.outbound} profiles={res.profiles} selected={out} onSelect={setOut} onDate={(d) => { const n = { ...c, departureDate: d }; setC(n); run(n); }} label={c.tripType === 'ROUND_TRIP' ? 'Outbound' : undefined} />
            {c.tripType === 'ROUND_TRIP' && res.inbound && <ResultsColumn title={`${res.criteria.destination} → ${res.criteria.origin}`} leg={res.inbound} profiles={res.profiles} selected={inb} onSelect={setInb} onDate={(d) => { const n = { ...c, returnDate: d }; setC(n); run(n); }} label="Inbound" />}
          </div>
        </>
      )}
      {!res && !loading && !err && <Card><Empty title="Search the Sabre mock inventory" icon={<Plane className="h-6 w-6" />}>Try <b>Mumbai → London</b> on a seeded date for branded fares with both rule profiles, or switch to round-trip for a two-leg itinerary.</Empty></Card>}
      {out && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.2)] backdrop-blur lg:left-[264px]">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-4 px-6 py-3">
            <div className="flex flex-1 flex-wrap gap-4 text-sm">
              <div><div className="text-[11px] font-bold uppercase text-muted">{c.tripType === 'ROUND_TRIP' ? 'Outbound' : 'Selected'}</div><div className="font-semibold">{out.offer.flightNumber} · {out.brand.brandName} <ProfileBadge id={out.brand.ruleProfileId} /></div></div>
              {c.tripType === 'ROUND_TRIP' && <div><div className="text-[11px] font-bold uppercase text-muted">Inbound</div><div className="font-semibold">{inb ? <>{inb.offer.flightNumber} · {inb.brand.brandName} <ProfileBadge id={inb.brand.ruleProfileId} /></> : <span className="text-warn-600">Select a return flight</span>}</div></div>}
            </div>
            <div className="text-right"><div className="text-[11px] text-muted">Itinerary total · {c.adults} adult{c.adults > 1 ? 's' : ''}</div><Price minor={total * c.adults} size="lg" /></div>
            <Button size="lg" onClick={book} loading={quoting} disabled={c.tripType === 'ROUND_TRIP' && !inb} data-testid="continue-booking">Continue to review</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultsColumn({ title, leg, profiles, selected, onSelect, onDate, label }: { title: string; leg: any; profiles: Profile[]; selected: Sel; onSelect: (s: Sel) => void; onDate: (d: string) => void; label?: string }) {
  const [sort, setSort] = useState<'cheapest' | 'fastest' | 'departure'>('cheapest');
  const [f, setF] = useState({ airlines: [] as string[], stops: [] as number[], buckets: [] as string[], profile: '' as string, maxPrice: 0 });
  const [showFilters, setShowFilters] = useState(false);
  const all = leg.results as any[];
  const airlines = [...new Set(all.map((o) => o.airlineCode))];
  const maxP = Math.max(0, ...all.map((o) => o.fromSellMinor ?? 0));
  const rows = useMemo(() => {
    let r = all.filter((o) => (!f.airlines.length || f.airlines.includes(o.airlineCode)) && (!f.stops.length || f.stops.includes(Math.min(o.stops, 2))) && (!f.buckets.length || f.buckets.some((b) => { const [, lo, hi] = BUCKETS.find((x) => x[0] === b)!; const h = localHour(o.departureAt, o.originTz); return h >= lo && h < hi; })) && (!f.profile || o.brands.some((b: any) => b.ruleProfileId === f.profile)) && (!f.maxPrice || (o.fromSellMinor ?? 0) <= f.maxPrice));
    r = [...r].sort((a, b) => sort === 'cheapest' ? (a.fromSellMinor ?? 9e15) - (b.fromSellMinor ?? 9e15) : sort === 'fastest' ? a.durationMin - b.durationMin : a.departureAt.localeCompare(b.departureAt));
    return r;
  }, [all, f, sort]);
  const cheapest = [...all].filter((o) => !o.soldOut).sort((a, b) => a.fromSellMinor - b.fromSellMinor)[0];
  const fastest = [...all].filter((o) => !o.soldOut).sort((a, b) => a.durationMin - b.durationMin)[0];
  const toggle = <K extends 'airlines' | 'stops' | 'buckets'>(k: K, v: any) => setF((x) => ({ ...x, [k]: (x[k] as any[]).includes(v) ? (x[k] as any[]).filter((y) => y !== v) : [...(x[k] as any[]), v] }));
  const active = f.airlines.length + f.stops.length + f.buckets.length + (f.profile ? 1 : 0) + (f.maxPrice ? 1 : 0);
  return (
    <div className="min-w-0 space-y-3" data-testid={`results-${label ?? 'oneway'}`}>
      <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{label && <span className="mr-2 text-brand-600">{label}</span>}{title}</h2><span className="text-sm text-muted">{rows.length} of {all.length} flights</span></div>
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1 scroll-thin">
        {leg.dateStrip.map((d: any, i: number) => <button key={d.date} onClick={() => onDate(d.date)} className={cx('min-w-[86px] flex-1 rounded-lg px-2 py-1.5 text-center', i === 3 ? 'bg-brand-50 ring-1 ring-brand-300' : 'hover:bg-slate-50')}><div className={cx('text-[11.5px] font-semibold', i === 3 ? 'text-brand-700' : 'text-muted')}>{new Date(d.date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' })}</div><div className="text-[12.5px] font-bold">{d.cheapestSellMinor ? <Price minor={d.cheapestSellMinor} size="sm" showOriginal={false} /> : <span className="text-muted">—</span>}</div></button>)}
      </div>
      <div className="text-[11px] text-muted">Date fares are indicative from seeded demo inventory.</div>
      <div className="grid grid-cols-2 gap-2">
        {cheapest && <button onClick={() => setSort('cheapest')} className={cx('flex items-center gap-2 rounded-xl border bg-white p-3 text-left', sort === 'cheapest' ? 'border-brand-400 ring-1 ring-brand-200' : 'border-line')}><IndianRupee className="h-4 w-4 text-brand-500" /><div><div className="text-sm font-bold">Cheapest</div><div className="text-[11.5px] text-muted"><Price minor={cheapest.fromSellMinor} size="sm" showOriginal={false} /> · {dur(cheapest.durationMin)}</div></div></button>}
        {fastest && <button onClick={() => setSort('fastest')} className={cx('flex items-center gap-2 rounded-xl border bg-white p-3 text-left', sort === 'fastest' ? 'border-brand-400 ring-1 ring-brand-200' : 'border-line')}><Zap className="h-4 w-4 text-brand-500" /><div><div className="text-sm font-bold">Fastest</div><div className="text-[11.5px] text-muted"><Price minor={fastest.fromSellMinor} size="sm" showOriginal={false} /> · {dur(fastest.durationMin)}</div></div></button>}
      </div>
      <div className="rounded-xl border border-line bg-white">
        <button onClick={() => setShowFilters((s) => !s)} className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-semibold"><span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" />Filters {active > 0 && <Badge tone="orange">{active}</Badge>}</span><span className="flex items-center gap-3">{active > 0 && <span role="button" onClick={(e) => { e.stopPropagation(); setF({ airlines: [], stops: [], buckets: [], profile: '', maxPrice: 0 }); }} className="flex items-center gap-1 text-xs text-brand-700"><RotateCcw className="h-3 w-3" />Reset all</span>}<select aria-label="Sort" value={sort} onClick={(e) => e.stopPropagation()} onChange={(e) => setSort(e.target.value as any)} className="rounded-md border border-line px-2 py-1 text-xs"><option value="cheapest">Sort: price</option><option value="fastest">Sort: duration</option><option value="departure">Sort: departure</option></select>{showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span></button>
        {showFilters && (
          <div className="grid gap-4 border-t border-line px-4 py-3 text-sm sm:grid-cols-2">
            <div><div className="mb-1.5 text-xs font-bold uppercase text-muted">Airline</div><div className="flex flex-wrap gap-1.5">{airlines.map((a) => <Chip key={a} on={f.airlines.includes(a)} onClick={() => toggle('airlines', a)}>{a}</Chip>)}</div></div>
            <div><div className="mb-1.5 text-xs font-bold uppercase text-muted">Stops</div><div className="flex gap-1.5">{[0, 1, 2].map((s) => <Chip key={s} on={f.stops.includes(s)} onClick={() => toggle('stops', s)}>{s === 2 ? '2+' : s}</Chip>)}</div></div>
            <div><div className="mb-1.5 text-xs font-bold uppercase text-muted">Departure (local)</div><div className="flex flex-wrap gap-1.5">{BUCKETS.map(([b]) => <Chip key={b} on={f.buckets.includes(b)} onClick={() => toggle('buckets', b)}>{b}</Chip>)}</div></div>
            <div><div className="mb-1.5 text-xs font-bold uppercase text-muted">Fare rules / refundability</div><div className="flex flex-wrap gap-1.5"><Chip on={f.profile === 'A_FLEXIBLE'} onClick={() => setF({ ...f, profile: f.profile === 'A_FLEXIBLE' ? '' : 'A_FLEXIBLE' })}>Flexible</Chip><Chip on={f.profile === 'B_RESTRICTED'} onClick={() => setF({ ...f, profile: f.profile === 'B_RESTRICTED' ? '' : 'B_RESTRICTED' })}>Restricted</Chip></div></div>
            {maxP > 0 && <div className="sm:col-span-2"><div className="mb-1.5 flex justify-between text-xs font-bold uppercase text-muted"><span>Max price (from)</span><span><Price minor={f.maxPrice || maxP} size="sm" showOriginal={false} /></span></div><input type="range" aria-label="Max price" className="w-full accent-brand-500" min={0} max={maxP} step={10000} value={f.maxPrice || maxP} onChange={(e) => setF({ ...f, maxPrice: Number(e.target.value) >= maxP ? 0 : Number(e.target.value) })} /></div>}
          </div>
        )}
      </div>
      {!all.length && <Card><Empty title="No flights for this date and route" icon={<Plane className="h-6 w-6" />}>The simulated Sabre inventory has no offers here. Pick a highlighted date above or a seeded route. No live fares are invented.</Empty></Card>}
      {all.length > 0 && !rows.length && <Card><Empty title="No flights match these filters">Reset filters to see all {all.length} results.</Empty></Card>}
      {rows.map((o) => <FlightCard key={o.id} o={o} profiles={profiles} selected={selected} onSelect={onSelect} />)}
    </div>
  );
}
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={on} className={cx('rounded-full border px-3 py-1 text-xs font-semibold', on ? 'border-brand-500 bg-brand-500 text-white' : 'border-line bg-white text-navy hover:border-brand-300')}>{children}</button>;
}
function FlightCard({ o, profiles, selected, onSelect }: { o: any; profiles: Profile[]; selected: Sel; onSelect: (s: Sel) => void }) {
  const [expanded, setExpanded] = useState(false); const [rules, setRules] = useState<any>(null); const [compare, setCompare] = useState(false);
  const shown = expanded ? o.brands : o.brands.slice(0, 2);
  const isSel = selected?.offer.id === o.id;
  return (
    <div className={cx('rounded-xl border bg-white shadow-[var(--shadow-card)] transition', isSel ? 'border-brand-400 ring-2 ring-brand-100' : 'border-line', o.soldOut && 'opacity-60')} data-testid={`offer-${o.id}`}>
      <div className="grid gap-4 p-4 md:grid-cols-[1.1fr_1.6fr]">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-xs font-bold text-white">{o.airlineCode}</div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{o.airlineName}</div><div className="text-xs text-muted">{o.flightNumber} · {o.aircraft}</div>
            <div className="mt-2 flex items-center gap-3">
              <div><div className="text-lg font-bold tabular">{fmtTime(o.departureAt, o.originTz)}</div><div className="text-[11px] text-muted">{o.origin} · {fmtDay(o.departureAt, o.originTz)}</div></div>
              <div className="flex-1 text-center"><div className="text-[11px] text-muted">{dur(o.durationMin)}</div><div className="relative my-1 h-px bg-line"><Plane className="absolute -top-1.5 right-0 h-3 w-3 text-brand-500" /></div><div className="text-[11px] text-muted">{o.stops === 0 ? 'Non-stop' : `${o.stops} stop · ${o.via}`}</div></div>
              <div className="text-right"><div className="text-lg font-bold tabular">{fmtTime(o.arrivalAt, o.destinationTz)}</div><div className="text-[11px] text-muted">{o.destination} · {fmtDay(o.arrivalAt, o.destinationTz)}</div></div>
            </div>
            <div className="mt-2 text-[11.5px] font-semibold text-brand-700">{o.soldOut ? 'Sold out (demo inventory)' : `Seats left: ${o.seatsLeft}`}</div>
          </div>
        </div>
        <div className="space-y-2">
          {shown.map((b: any) => {
            const on = isSel && selected?.brand.id === b.id;
            return (
              <div key={b.id} className={cx('flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2', on ? 'border-brand-400 bg-brand-50/60' : 'border-line')}>
                <input type="radio" aria-label={`Select ${b.brandName}`} disabled={o.soldOut} checked={on} onChange={() => onSelect({ offer: o, brand: b })} className="h-4 w-4 accent-brand-500" data-testid={`brand-${b.id}`} />
                <div className="min-w-[110px]"><Price minor={b.sellMinor} showOriginal={false} /></div>
                <div className="min-w-0 flex-1 text-xs"><div className="flex flex-wrap items-center gap-1.5"><Badge tone="orange">{b.brandName}</Badge><ProfileBadge id={b.ruleProfileId} /></div><div className="mt-0.5 text-muted">{o.cabin.charAt(0) + o.cabin.slice(1).toLowerCase()} · {b.refundableLabel} · {b.baggage.checkIn} · {b.meal}</div></div>
                <button onClick={() => setRules(b)} className="text-xs font-semibold text-brand-700 hover:underline" data-testid={`rules-${b.id}`}>Fare Rules</button>
              </div>
            );
          })}
          <div className="flex items-center justify-between">
            {o.brands.length > 2 ? <button onClick={() => setExpanded((e) => !e)} className="rounded-full bg-slate-100 px-3 py-1 text-[11.5px] font-semibold">{expanded ? 'Show less' : `+${o.brands.length - 2} more fares`}</button> : <span />}
            {o.brands.length > 1 && <button onClick={() => setCompare(true)} className="text-xs font-semibold text-navy underline-offset-2 hover:underline">Compare brands</button>}
          </div>
        </div>
      </div>
      <Drawer open={!!rules} onClose={() => setRules(null)} title={rules ? `${o.flightNumber} · ${rules.brandName}` : ''} footer={rules && <div className="flex items-center justify-between"><Price minor={rules.sellMinor} size="lg" /><Button disabled={o.soldOut} onClick={() => { onSelect({ offer: o, brand: rules }); setRules(null); }}>Select this fare</Button></div>}>
        {rules && <FareDetailsTabs offer={o} brand={rules} profile={profiles.find((p) => p.id === rules.ruleProfileId)!} />}
      </Drawer>
      <Modal open={compare} onClose={() => setCompare(false)} title={`Compare fare brands · ${o.flightNumber}`} wide>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-line text-left text-xs uppercase text-muted"><th className="py-2">Feature</th>{o.brands.map((b: any) => <th key={b.id} className="py-2">{b.brandName}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            <tr><td className="py-2 text-muted">Price</td>{o.brands.map((b: any) => <td key={b.id} className="py-2"><Price minor={b.sellMinor} size="sm" /></td>)}</tr>
            <tr><td className="py-2 text-muted">Rules profile</td>{o.brands.map((b: any) => <td key={b.id} className="py-2"><ProfileBadge id={b.ruleProfileId} /></td>)}</tr>
            {(['S2', 'S1'] as const).map((sl) => <tr key={sl}><td className="py-2 text-muted">Cancel {sl === 'S2' ? '≥24h' : '2–24h'}</td>{o.brands.map((b: any) => { const s = profiles.find((p) => p.id === b.ruleProfileId)!.cancellationSlabs.find((x: any) => x.id === sl); return <td key={b.id} className="py-2 tabular">₹{(s.supplierPenaltyMinor / 100).toLocaleString('en-IN')} + ₹50</td>; })}</tr>)}
            <tr><td className="py-2 text-muted">Within 2h</td>{o.brands.map((b: any) => <td key={b.id} className="py-2">Non-refundable</td>)}</tr>
            <tr><td className="py-2 text-muted">Check-in bag</td>{o.brands.map((b: any) => <td key={b.id} className="py-2">{b.baggage.checkIn}</td>)}</tr>
            <tr><td className="py-2 text-muted">Meal</td>{o.brands.map((b: any) => <td key={b.id} className="py-2">{b.meal}</td>)}</tr>
            <tr><td /> {o.brands.map((b: any) => <td key={b.id} className="py-2"><Button size="sm" variant={selected?.brand.id === b.id ? 'primary' : 'secondary'} disabled={o.soldOut} onClick={() => { onSelect({ offer: o, brand: b }); setCompare(false); }} icon={selected?.brand.id === b.id ? <CheckCircle2 className="h-3.5 w-3.5" /> : undefined}>Select</Button></td>)}</tr>
          </tbody></table></div>
        <p className="mt-3 flex items-center gap-1 text-xs text-muted"><Info className="h-3 w-3" />Sample fare rules — synthetic, not actual airline terms.</p>
      </Modal>
    </div>
  );
}
