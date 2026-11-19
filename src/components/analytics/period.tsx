'use client';
/** Shared date-range picker with presets (prefilled) and optional Daily / Weekly / Monthly granularity. */
import { Calendar } from 'lucide-react';
import { Input, Select, cx } from '@/components/ui';

export type Period = { preset: string; from: string; to: string };
export type Granularity = 'daily' | 'weekly' | 'monthly';
const ymd = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export function presetRange(preset: string, today = new Date()): { from: string; to: string } {
  const t = ymd(today);
  const back = (n: number) => ymd(new Date(today.getTime() - n * 86400000));
  switch (preset) {
    case 'today': return { from: t, to: t };
    case '7d': return { from: back(6), to: t };
    case '30d': return { from: back(29), to: t };
    case '90d': return { from: back(89), to: t };
    case 'month': return { from: `${t.slice(0, 8)}01`, to: t };
    case 'all': return { from: '', to: '' };
    default: return { from: t, to: t };
  }
}
export const PRESETS: [string, string][] = [['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['month', 'This month'], ['90d', 'Last 90 days'], ['all', 'All dates'], ['custom', 'Custom range']];
export function defaultPeriod(preset = '30d'): Period { return { preset, ...presetRange(preset) }; }
export function periodLabel(p: Period): string {
  if (p.preset !== 'custom') return PRESETS.find(([k]) => k === p.preset)?.[1] ?? '';
  const f = (s: string) => (s ? new Date(`${s}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '…');
  return `${f(p.from)} – ${f(p.to)}`;
}
export function PeriodPicker({ value, onChange, granularity, onGranularity, className }: { value: Period; onChange: (p: Period) => void; granularity?: Granularity; onGranularity?: (g: Granularity) => void; className?: string }) {
  return (
    <div className={cx('flex flex-wrap items-center gap-2', className)} data-testid="period-picker">
      <Calendar className="h-4 w-4 text-muted" />
      <Select aria-label="Period" value={value.preset} onChange={(e) => { const preset = e.target.value; onChange(preset === 'custom' ? { ...value, preset } : { preset, ...presetRange(preset) }); }} className="w-[150px]">{PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
      <Input type="date" aria-label="From" value={value.from} onChange={(e) => onChange({ preset: 'custom', from: e.target.value, to: value.to })} className="w-[150px]" />
      <span className="text-muted">–</span>
      <Input type="date" aria-label="To" value={value.to} onChange={(e) => onChange({ preset: 'custom', from: value.from, to: e.target.value })} className="w-[150px]" />
      {onGranularity && (
        <div className="ml-1 inline-flex rounded-lg border border-line bg-white p-0.5" role="radiogroup" aria-label="Granularity">
          {(['daily', 'weekly', 'monthly'] as Granularity[]).map((g) => <button key={g} type="button" role="radio" aria-checked={granularity === g} onClick={() => onGranularity(g)} className={cx('rounded-md px-3 py-1 text-xs font-semibold capitalize', granularity === g ? 'bg-ink-800 text-white' : 'text-muted hover:text-navy')}>{g}</button>)}
        </div>
      )}
    </div>
  );
}
