'use client';
/** Display-only currency (WF-23). One seeded DEMO rate table; never changes stored INR amounts. */
import { createContext, ReactNode, useContext, useState } from 'react';
import { useApi } from '@/lib/client';
import { convertForDisplay, formatDisplay, DisplayCurrency, FxRate } from '@/shared/money/fx';
import { cx, SimTag } from '@/components/ui';

type Ctx = { currency: DisplayCurrency; setCurrency: (c: DisplayCurrency) => void; rates: FxRate[] };
const C = createContext<Ctx>({ currency: 'INR', setCurrency: () => {}, rates: [] });
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<DisplayCurrency>('INR');
  const { data } = useApi<FxRate[]>('/fx-demo-rates');
  return <C.Provider value={{ currency, setCurrency, rates: data ?? [] }}>{children}</C.Provider>;
}
export const useCurrency = () => useContext(C);
export function CurrencySwitcher({ compact }: { compact?: boolean }) {
  const { currency, setCurrency, rates } = useCurrency();
  const r = rates.find((x) => x.quoteCurrency === currency);
  return (
    <div className="flex items-center gap-2" data-testid="currency-switcher">
      <div className="inline-flex rounded-lg border border-line bg-white p-0.5" role="radiogroup" aria-label="Display currency">
        {(['INR', 'USD', 'EUR'] as DisplayCurrency[]).map((c) => (
          <button key={c} role="radio" aria-checked={currency === c} onClick={() => setCurrency(c)} className={cx('rounded-md px-2.5 py-1 text-xs font-bold transition', currency === c ? 'bg-ink-800 text-white' : 'text-muted hover:text-navy')}>{c}</button>
        ))}
      </div>
      {!compact && currency !== 'INR' && r && <span className="hidden text-[11px] text-muted xl:inline">1 {currency} = ₹{r.inrPerUnit} · {r.effectiveDate}</span>}
    </div>
  );
}
/** Renders the display equivalent of an INR amount (rounded at display only) with the INR original alongside. */
export function Price({ minor, className, showOriginal = true, size = 'md' }: { minor: number; className?: string; showOriginal?: boolean; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const { currency, rates } = useCurrency();
  const inrText = formatDisplay(minor, 'INR');
  const sz = { sm: 'text-sm', md: 'text-base', lg: 'text-xl', xl: 'text-[28px]' }[size];
  if (currency === 'INR') return <span className={cx('font-bold tabular', sz, className)} data-testid="price">{inrText}</span>;
  const rate = rates.find((r) => r.quoteCurrency === currency) ?? null;
  const conv = convertForDisplay(minor, rate);
  if (conv === null) return <span className={cx('font-bold tabular', sz, className)} data-testid="price">{inrText}<span className="ml-1 text-[11px] font-medium text-warn-600">Conversion unavailable</span></span>;
  return (
    <span className={cx('inline-flex flex-col leading-tight', className)}>
      <span className={cx('font-bold tabular', sz)} data-testid="price">{formatDisplay(conv, currency)}</span>
      {showOriginal && <span className="text-[11px] font-medium text-muted tabular" data-testid="price-inr">{inrText} charged in INR</span>}
    </span>
  );
}
export function FxNotice() {
  const { currency, rates } = useCurrency();
  const r = rates.find((x) => x.quoteCurrency === currency);
  if (currency === 'INR') return null;
  return <div className="flex flex-wrap items-center gap-2 text-xs text-muted">Display only — 1 {currency} = ₹{r?.inrPerUnit} (rate date {r?.effectiveDate}). Booking, wallet and settlement stay in INR; no point-of-sale change.</div>;
}
