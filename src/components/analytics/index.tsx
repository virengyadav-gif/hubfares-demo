'use client';
import { useMemo, useState, ReactNode } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Cell, Legend } from 'recharts';
import { useApi, inr, inrCompact } from '@/lib/client';
import { Input, Select, Button, Badge, SimTag } from '@/components/ui';

export const C = { brand: '#f47b31', ink: '#25272b', teal: '#0f9488', blue: '#3b6fd8', amber: '#d99a1e', red: '#d14b36', slate: '#94a3b8', violet: '#7c5cc4' };
export type Filters = { from: string; to: string; agencyId: string; airline: string; route: string; journey: string };
export const emptyFilters: Filters = { from: '', to: '', agencyId: '', airline: '', route: '', journey: '' };
export const toQuery = (f: Filters) => new URLSearchParams(Object.entries(f).filter(([, v]) => v).map(([k, v]) => [k, k === 'from' ? `${v}T00:00:00Z` : k === 'to' ? `${v}T23:59:59Z` : v])).toString();
export function FilterBar({ f, setF, show = ['date', 'agency', 'airline', 'route', 'journey'] }: { f: Filters; setF: (f: Filters) => void; show?: string[] }) {
  const ag = useApi<any[]>('/agencies').data;
  return (
    <div className="mb-5 flex flex-wrap items-end gap-2 rounded-xl border border-line bg-white p-3 shadow-[var(--shadow-card)]">
      {show.includes('date') && <><label className="text-xs font-semibold text-muted">Booked from<Input type="date" className="mt-1 h-9 w-40" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label><label className="text-xs font-semibold text-muted">to<Input type="date" className="mt-1 h-9 w-40" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label></>}
      {show.includes('agency') && <label className="text-xs font-semibold text-muted">OTA<Select className="mt-1 h-9 w-48" value={f.agencyId} onChange={(e) => setF({ ...f, agencyId: e.target.value })}><option value="">All OTAs</option>{ag?.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}</Select></label>}
      {show.includes('airline') && <label className="text-xs font-semibold text-muted">Airline<Select className="mt-1 h-9 w-28" value={f.airline} onChange={(e) => setF({ ...f, airline: e.target.value })}><option value="">All</option>{['AI', '6E', 'BA', 'QR', 'EK', 'SQ', 'LH'].map((a) => <option key={a}>{a}</option>)}</Select></label>}
      {show.includes('route') && <label className="text-xs font-semibold text-muted">Route<Input className="mt-1 h-9 w-32" placeholder="BOM-DEL" value={f.route} onChange={(e) => setF({ ...f, route: e.target.value.toUpperCase() })} /></label>}
      {show.includes('journey') && <label className="text-xs font-semibold text-muted">Journey<Select className="mt-1 h-9 w-36" value={f.journey} onChange={(e) => setF({ ...f, journey: e.target.value })}><option value="">Both</option><option value="DOMESTIC">Domestic</option><option value="INTERNATIONAL">International</option></Select></label>}
      <Button size="sm" variant="ghost" onClick={() => setF(emptyFilters)}>Reset</Button>
      <div className="ml-auto flex items-center gap-2"><Badge tone="gray">Date basis: booking date</Badge><SimTag kind="Illustrative" /></div>
    </div>
  );
}
export function useFilters() { const [f, setF] = useState<Filters>(emptyFilters); const q = useMemo(() => toQuery(f), [f]); return { f, setF, q }; }
export function ChartCard({ title, children, sub, h = 260 }: { title: string; children: ReactNode; sub?: string; h?: number }) {
  return <div className="rounded-xl border border-line bg-white p-4 shadow-[var(--shadow-card)]"><div className="mb-3"><div className="text-[15px] font-semibold">{title}</div>{sub && <div className="text-xs text-muted">{sub}</div>}</div><div style={{ height: h }}><ResponsiveContainer width="100%" height="100%">{children as any}</ResponsiveContainer></div></div>;
}
const tip = { contentStyle: { borderRadius: 10, border: '1px solid #e6e8ec', fontSize: 12 }, formatter: (v: any) => (typeof v === 'number' && Math.abs(v) > 1000 ? inr(v) : v) };
export function MoneyBars({ data, x, bars, colors }: { data: any[]; x: string; bars: { key: string; name: string }[]; colors?: string[] }) {
  return <BarChart data={data} margin={{ left: 8, right: 8, top: 4 }}><CartesianGrid vertical={false} stroke="#eef0f3" /><XAxis dataKey={x} tick={{ fontSize: 11, fill: '#687483' }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(v) => inrCompact(v)} tick={{ fontSize: 11, fill: '#687483' }} axisLine={false} tickLine={false} width={72} /><Tooltip {...tip} cursor={{ fill: '#f6f7f9' }} />{bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}{bars.map((b, i) => <Bar key={b.key} dataKey={b.key} name={b.name} fill={(colors ?? [C.brand, C.ink, C.teal, C.slate])[i]} radius={[4, 4, 0, 0]} maxBarSize={44} />)}</BarChart>;
}
export function CountBars({ data, x, keys }: { data: any[]; x: string; keys: { key: string; name: string; color: string }[] }) {
  return <BarChart data={data} margin={{ left: 0, right: 8, top: 4 }}><CartesianGrid vertical={false} stroke="#eef0f3" /><XAxis dataKey={x} tick={{ fontSize: 11, fill: '#687483' }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#687483' }} axisLine={false} tickLine={false} width={30} /><Tooltip contentStyle={tip.contentStyle} cursor={{ fill: '#f6f7f9' }} /><Legend wrapperStyle={{ fontSize: 12 }} />{keys.map((k) => <Bar key={k.key} dataKey={k.key} name={k.name} fill={k.color} stackId="a" maxBarSize={44} />)}</BarChart>;
}
export function TrendLine({ data, x, lines }: { data: any[]; x: string; lines: { key: string; name: string; color: string }[] }) {
  return <LineChart data={data} margin={{ left: 8, right: 8, top: 4 }}><CartesianGrid vertical={false} stroke="#eef0f3" /><XAxis dataKey={x} tick={{ fontSize: 11, fill: '#687483' }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(v) => inrCompact(v)} tick={{ fontSize: 11, fill: '#687483' }} axisLine={false} tickLine={false} width={72} /><Tooltip {...tip} />{lines.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}{lines.map((l) => <Line key={l.key} dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2.5} dot={{ r: 3 }} type="monotone" />)}</LineChart>;
}
export { Cell };
