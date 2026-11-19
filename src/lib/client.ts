'use client';
/** Browser API helpers: same-origin /api/v1, envelopes, idempotency keys. No money truth is kept client-side. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { signalBusy } from '@/lib/busy';

export class ApiError extends Error { constructor(public code: string, message: string, public status: number, public details?: any) { super(message); } }
export const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.round(performance.now() * 1000)}`);

export async function apiFetch<T = any>(path: string, opts: { method?: string; body?: unknown; idem?: string | boolean; headers?: Record<string, string>; quiet?: boolean } = {}): Promise<{ data: T; meta: any }> {
  const write = (opts.method ?? (opts.body !== undefined ? 'POST' : 'GET')) !== 'GET' && !opts.quiet;
  if (write) signalBusy(1);
  try { return await doFetch<T>(path, opts); } finally { if (write) signalBusy(-1); }
}
async function doFetch<T>(path: string, opts: { method?: string; body?: unknown; idem?: string | boolean; headers?: Record<string, string> }): Promise<{ data: T; meta: any }> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.body !== undefined && !(opts.body instanceof FormData)) headers['content-type'] = 'application/json';
  if (opts.idem) headers['idempotency-key'] = typeof opts.idem === 'string' ? opts.idem : newKey();
  const res = await fetch(`/api/v1${path}`, { method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'), headers, body: opts.body instanceof FormData ? opts.body : opts.body !== undefined ? JSON.stringify(opts.body) : undefined, credentials: 'same-origin', cache: 'no-store' });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/login') && !path.startsWith('/applications')) window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    throw new ApiError(json?.error?.code ?? 'ERROR', json?.error?.message ?? `Request failed (${res.status})`, res.status, json?.error?.details);
  }
  return { data: json?.data as T, meta: json?.meta };
}
export function useApi<T = any>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path);
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!path) { setLoading(false); return; }
    const n = ++seq.current;
    setLoading(true);
    try { const r = await apiFetch<T>(path); if (n === seq.current) { setData(r.data); setMeta(r.meta); setError(null); } }
    catch (e: any) { if (n === seq.current) setError(e); }
    finally { if (n === seq.current) setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => { load(); }, [load]);
  return { data, meta, error, loading, reload: load, setData };
}
export const inr = (minor: number | null | undefined, opts: { decimals?: boolean } = {}) =>
  minor === null || minor === undefined ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: opts.decimals === false ? 0 : 2, maximumFractionDigits: opts.decimals === false ? 0 : 2 }).format(minor / 100);
export const inrCompact = (minor: number) => { const v = minor / 100; if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`; if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`; return inr(minor, { decimals: false }); };
export const pct = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? 'N/A' : `${v.toFixed(d)}%`);
export function fmtDate(iso: string | null | undefined, tz = 'Asia/Kolkata', withTime = true) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', { timeZone: tz, day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : {}) }).format(new Date(iso));
}
export function fmtTime(iso: string, tz: string) { return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)); }
export function fmtDay(iso: string, tz: string) { return new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: '2-digit', month: 'short' }).format(new Date(iso)); }
export const dur = (min: number) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
export const titleCase = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
