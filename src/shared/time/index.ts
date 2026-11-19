/** Server clock: system or fixed (DEMO_CLOCK_MODE). Tests may override via setClockOverride. */
let override: number | null = null;
export function setClockOverride(iso: string | null) { override = iso ? Date.parse(iso) : null; }
export function nowMs(): number {
  if (override !== null) return override;
  if (process.env.DEMO_CLOCK_MODE === 'fixed' && process.env.DEMO_FIXED_NOW) return Date.parse(process.env.DEMO_FIXED_NOW);
  return Date.now();
}
export const nowIso = () => new Date(nowMs()).toISOString();
export const HOUR = 3_600_000;
export const DAY = 86_400_000;
export const isoPlus = (baseIso: string, ms: number) => new Date(Date.parse(baseIso) + ms).toISOString();
/** Parse fixture offsets like D-10, D+12, H+10, H-47 relative to anchor. */
export function offsetToIso(anchorIso: string, offset: string): string {
  const m = /^([DH])([+-])(\d+)$/.exec(offset.trim());
  if (!m) throw new Error(`Bad offset ${offset}`);
  const unit = m[1] === 'D' ? DAY : HOUR;
  const n = Number(m[3]) * (m[2] === '-' ? -1 : 1);
  return isoPlus(anchorIso, n * unit);
}
