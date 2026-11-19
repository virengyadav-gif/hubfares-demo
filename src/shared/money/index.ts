/** Integer minor-unit money helpers (Technical Design §4.1). Never use floats for cash. */
export type MoneyINR = { amountMinor: number; currency: 'INR' };
export const inr = (amountMinor: number): MoneyINR => {
  if (!Number.isInteger(amountMinor)) throw new Error(`Non-integer minor amount: ${amountMinor}`);
  return { amountMinor, currency: 'INR' };
};
/** roundHalfUp(base * bps / 10_000) using integer arithmetic only. */
export function percentOfMinor(baseMinor: number, bps: number): number {
  if (!Number.isInteger(baseMinor) || !Number.isInteger(bps)) throw new Error('integer inputs required');
  const num = BigInt(baseMinor) * BigInt(bps);
  const q = num / 10000n;
  const r = num % 10000n;
  return Number(r * 2n >= 10000n ? q + 1n : q);
}
export function sumMinor(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
export function formatINR(amountMinor: number, opts: { decimals?: boolean } = {}): string {
  const major = amountMinor / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: opts.decimals === false ? 0 : 2,
    maximumFractionDigits: opts.decimals === false ? 0 : 2,
  }).format(major);
}
