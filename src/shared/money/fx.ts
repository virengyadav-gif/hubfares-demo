/** Display-only FX (Technical Design §4.9). Rounds ONLY at the display boundary. */
export type DisplayCurrency = 'INR' | 'USD' | 'EUR';
export type FxRate = { quoteCurrency: DisplayCurrency; inrPerUnit: string; effectiveDate: string; source: 'DEMO' };

/** Returns converted amount in hundredths of the display currency (integer), rounded half-up, or null if no rate. */
export function convertForDisplay(amountInrMinor: number, rate: FxRate | null | undefined): number | null {
  if (!rate) return null;
  const [intPart, frac = ''] = rate.inrPerUnit.split('.');
  const scale = 10n ** BigInt(frac.length);
  const rateScaled = BigInt(intPart + frac); // inrPerUnit * scale
  if (rateScaled <= 0n) return null;
  // converted (hundredths) = amountInrMinor / inrPerUnit = amountInrMinor * scale / rateScaled
  const num = BigInt(amountInrMinor) * scale;
  const q = num / rateScaled;
  const r = num % rateScaled;
  return Number(r * 2n >= rateScaled ? q + 1n : q);
}
export function formatDisplay(hundredths: number, currency: DisplayCurrency): string {
  const locale = currency === 'INR' ? 'en-IN' : currency === 'EUR' ? 'en-IE' : 'en-US';
  return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(hundredths / 100);
}
