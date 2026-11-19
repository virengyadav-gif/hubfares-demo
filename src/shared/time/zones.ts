/** IANA timezone helpers using Intl only (no external tz library). */
export function tzOffsetMinutes(utcMs: number, tz: string): number {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}
/** Local wall-clock (YYYY-MM-DD, HH:MM) in tz → UTC ISO. */
export function zonedToUtcIso(ymd: string, hhmm: string, tz: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let guess = wall - tzOffsetMinutes(wall, tz) * 60000;
  guess = wall - tzOffsetMinutes(guess, tz) * 60000;
  return new Date(guess).toISOString();
}
export function localYmd(utcIso: string, tz: string): string {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  return f.format(new Date(utcIso));
}
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
export function formatLocal(utcIso: string, tz: string, opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...opts }).format(new Date(utcIso));
}
