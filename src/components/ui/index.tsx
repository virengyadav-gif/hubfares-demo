'use client';
/** Hubfares UI kit — accessible primitives with the orange/charcoal/light design tokens. */
import { ReactNode, useEffect, useState, createContext, useContext, useCallback, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import clsx from 'clsx';
import { X, Loader2, Info, AlertTriangle, CheckCircle2, CircleAlert, Inbox, FlaskConical } from 'lucide-react';

export const cx = clsx;

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark'; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: ReactNode };
export function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...p }: BtnProps) {
  const v = { primary: 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm shadow-brand-500/20', secondary: 'bg-white text-navy border border-line hover:border-brand-300 hover:text-brand-700', ghost: 'text-navy hover:bg-black/5', danger: 'bg-bad-600 text-white hover:bg-red-700', dark: 'bg-ink-800 text-white hover:bg-ink-700' }[variant];
  const s = { sm: 'h-8 px-3 text-[13px] gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-[15px] gap-2' }[size];
  return (
    <button {...p} disabled={disabled || loading} className={cx('inline-flex items-center justify-center rounded-lg font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap', v, s, className)}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}{children}
    </button>
  );
}
export function Card({ className, children, title, actions, subtitle, pad = true }: { className?: string; children?: ReactNode; title?: ReactNode; actions?: ReactNode; subtitle?: ReactNode; pad?: boolean }) {
  return (
    <section className={cx('rounded-xl border border-line bg-white shadow-[var(--shadow-card)]', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div><h3 className="text-[15px] font-semibold text-navy">{title}</h3>{subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}</div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </section>
  );
}
export function PageHeader({ title, subtitle, actions, eyebrow, badges }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode; badges?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</div>}
        <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold tracking-tight text-navy">{title}</h1>{badges}</div>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
const TONES: Record<string, string> = {
  green: 'bg-ok-50 text-ok-600 ring-ok-600/20', amber: 'bg-warn-50 text-warn-600 ring-warn-600/20', red: 'bg-bad-50 text-bad-600 ring-bad-600/20',
  blue: 'bg-info-50 text-info-600 ring-info-600/20', gray: 'bg-slate-100 text-slate-600 ring-slate-500/20', orange: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20', dark: 'bg-ink-800 text-white ring-ink-800',
};
export function Badge({ tone = 'gray', children, className, icon }: { tone?: keyof typeof TONES | string; children: ReactNode; className?: string; icon?: ReactNode }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset whitespace-nowrap', TONES[tone] ?? TONES.gray, className)}>{icon}{children}</span>;
}
const STATUS_TONE: Record<string, string> = {
  TICKETED: 'green', ISSUED: 'green', CREDITED: 'green', MATCHED: 'green', VERIFIED: 'green', ACTIVE: 'green', APPROVED: 'green', RECEIVED: 'blue', RESOLVED: 'green', CLOSED: 'gray', RECONCILED_CLOSED: 'green', CLOSED_SETTLED_VOID: 'green', REISSUED_CLOSED: 'green', CHARGED: 'gray', REFUNDED: 'green',
  PNR_CREATED: 'blue', PENDING: 'amber', HELD: 'blue', OPEN: 'orange', ASSIGNED: 'blue', IN_PROGRESS: 'blue', AWAITING_EXTERNAL: 'violet', SUBMITTED: 'orange', UNDER_REVIEW: 'blue', DRAFT: 'gray', QUOTED: 'blue', REQUESTED: 'amber',
  PENDING_SUPPLIER: 'amber', PAID_SUPPLIER_PENDING: 'violet', SUPPLIER_RECEIVED_PAYOUT_ELIGIBLE: 'blue', APPROVAL_PENDING: 'amber', REFUND_PENDING: 'amber', MORE_INFO_REQUIRED: 'amber', NOT_RUN: 'gray', NOT_SUBMITTED: 'gray', NOT_APPLICABLE: 'gray', NOT_ISSUED: 'gray', MANUAL_RECORDED: 'violet', ESCALATED: 'red',
  CANCELLED: 'red', VOIDED: 'gray', BOOKING_FAILED: 'red', TICKETING_FAILED: 'red', FAILED: 'red', REJECTED: 'red', EXCEPTION: 'red', UNMATCHED: 'red', SUSPENDED: 'red', INACTIVE: 'gray', SUPPLIER_EXCEPTION: 'red', PAID_SUPPLIER_EXCEPTION: 'red', CLOSED_NONREFUNDABLE: 'gray', CLOSED_NONREFUNDABLE_S0: 'gray', RELEASED: 'gray', CONSUMED: 'gray', DECLINED: 'gray',
};
export const label = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()).replace(/\bpnr\b/i, 'PNR');
export function Status({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return <span className="text-muted">—</span>;
  return <Badge tone={STATUS_TONE[value] ?? 'gray'} className={className}>{label(value)}</Badge>;
}
/** Transparency label for simulated/guided/roadmap content. */
export function SimTag({ kind = 'Simulated', className }: { kind?: 'Simulated' | 'Demo' | 'Guided demo' | 'Planned integration' | 'Sample extract' | 'Illustrative' | 'Demo rates' | 'Demo verification' | 'Simulated Sabre response' | 'Live demo data' | 'Configuration preview'; className?: string }) {
  const tone = kind === 'Planned integration' ? 'violet' : kind === 'Guided demo' || kind === 'Configuration preview' ? 'blue' : kind === 'Live demo data' ? 'green' : 'amber';
  return <Badge tone={tone} className={className} icon={<FlaskConical className="h-3 w-3" />}>{kind}</Badge>;
}
export function Notice({ tone = 'info', title, children, className }: { tone?: 'info' | 'warn' | 'error' | 'success' | 'brand'; title?: ReactNode; children?: ReactNode; className?: string }) {
  const m = { info: ['bg-info-50 border-info-600/20 text-info-600', Info], warn: ['bg-warn-50 border-warn-600/25 text-warn-600', AlertTriangle], error: ['bg-bad-50 border-bad-600/25 text-bad-600', CircleAlert], success: ['bg-ok-50 border-ok-600/20 text-ok-600', CheckCircle2], brand: ['bg-brand-50 border-brand-500/30 text-brand-700', Info] } as const;
  const [cls, Icon] = m[tone];
  return (
    <div className={cx('flex gap-3 rounded-lg border px-4 py-3 text-sm', cls, className)} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 text-navy">{title && <div className="font-semibold">{title}</div>}{children && <div className="text-[13px] leading-relaxed text-navy/80">{children}</div>}</div>
    </div>
  );
}
export function Field({ label: l, hint, error, children, required, className }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; required?: boolean; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-[12.5px] font-semibold text-navy/80">{l}{required && <span className="text-brand-600"> *</span>}</span>
      {children}
      {error ? <span className="mt-1 block text-xs font-medium text-bad-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}
const inputCls = 'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-navy placeholder:text-slate-400 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50';
export function Input({ className, invalid, ...p }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...p} className={cx(inputCls, invalid && 'border-bad-600 focus:ring-bad-50', className)} />;
}
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(inputCls, 'pr-8', className)}>{children}</select>;
}
export function Textarea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx('w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100', p.className)} />;
}
export function Toggle({ checked, onChange, label: l, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm disabled:opacity-50">
      <span className={cx('relative h-5 w-9 rounded-full transition', checked ? 'bg-brand-500' : 'bg-slate-300')}><span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition', checked ? 'left-[18px]' : 'left-0.5')} /></span>
      {l}
    </button>
  );
}
export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cx('flex gap-1 overflow-x-auto border-b border-line scroll-thin', className)}>
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={cx('-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-semibold transition', value === t.id ? 'border-brand-500 text-brand-700' : 'border-transparent text-muted hover:text-navy')}>
          {t.label}{t.count !== undefined && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
export function Modal({ open, onClose, title, children, footer, wide, subtitle }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean; subtitle?: ReactNode }) {
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" className={cx('animate-in max-h-[92vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-[var(--shadow-pop)] sm:rounded-2xl', wide ? 'sm:max-w-4xl' : 'sm:max-w-lg')} onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4"><div><h2 className="text-lg font-bold text-navy">{title}</h2>{subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}</div><button aria-label="Close" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
        <div className="max-h-[66vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line bg-slate-50/60 px-6 py-3.5">{footer}</footer>}
      </div>
    </div>
  );
}
export function Drawer({ open, onClose, title, children, footer, width = 'max-w-2xl' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: string }) {
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink-900/40" onMouseDown={onClose}>
      <aside role="dialog" aria-modal="true" className={cx('slide-in flex h-full w-full flex-col bg-white shadow-[var(--shadow-pop)]', width)} onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-line px-6 py-4"><h2 className="text-lg font-bold">{title}</h2><button aria-label="Close" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="border-t border-line px-6 py-3.5">{footer}</footer>}
      </aside>
    </div>
  );
}
export function Empty({ title, children, icon }: { title: ReactNode; children?: ReactNode; icon?: ReactNode }) {
  return <div className="flex flex-col items-center justify-center px-6 py-12 text-center"><div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400">{icon ?? <Inbox className="h-6 w-6" />}</div><div className="font-semibold text-navy">{title}</div>{children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}</div>;
}
export function Loading({ label: l = 'Loading…' }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin text-brand-500" />{l}</div>;
}
export function ErrorBox({ error, onRetry }: { error: { message: string; code?: string } | null; onRetry?: () => void }) {
  if (!error) return null;
  return <Notice tone="error" title={error.code === 'TENANT_RESOURCE_NOT_FOUND' ? 'Not found' : error.code === 'FORBIDDEN' ? 'Permission denied' : 'Something went wrong'}>{error.message}{onRetry && <button className="ml-2 font-semibold underline" onClick={onRetry}>Retry</button>}</Notice>;
}
export function Table({ head, children, className, dense }: { head: ReactNode[]; children: ReactNode; className?: string; dense?: boolean }) {
  return (
    <div className={cx('overflow-x-auto scroll-thin', className)}>
      <table className="w-full text-left text-sm">
        <thead><tr className="border-b border-line bg-slate-50/70">{head.map((h, i) => <th key={i} className={cx('whitespace-nowrap px-4 font-semibold text-[12px] uppercase tracking-wide text-muted', dense ? 'py-2' : 'py-2.5')}>{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}
export function Td({ children, className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) { return <td {...p} className={cx('px-4 py-3 align-middle', className)}>{children}</td>; }
export function Kpi({ label: l, value, sub, tone, icon, onClick, hint }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: 'brand' | 'ok' | 'warn' | 'bad'; icon?: ReactNode; onClick?: () => void; hint?: string }) {
  const accent = { brand: 'text-brand-600 bg-brand-50', ok: 'text-ok-600 bg-ok-50', warn: 'text-warn-600 bg-warn-50', bad: 'text-bad-600 bg-bad-50' }[tone ?? 'brand'];
  return (
    <div onClick={onClick} title={hint} className={cx('rounded-xl border border-line bg-white p-4 shadow-[var(--shadow-card)]', onClick && 'cursor-pointer transition hover:border-brand-300')}>
      <div className="flex items-start justify-between gap-2"><div className="text-[12.5px] font-semibold text-muted">{l}</div>{icon && <div className={cx('rounded-lg p-1.5', accent)}>{icon}</div>}</div>
      <div className="mt-1.5 text-[22px] font-bold tracking-tight text-navy tabular">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}
export function DL({ items, cols = 2 }: { items: [ReactNode, ReactNode][]; cols?: 2 | 3 | 4 }) {
  return <dl className={cx('grid gap-x-6 gap-y-3', cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-4')}>{items.map(([k, v], i) => <div key={i}><dt className="text-[12px] font-medium text-muted">{k}</dt><dd className="mt-0.5 text-sm font-medium text-navy break-words">{v}</dd></div>)}</dl>;
}
export function Timeline({ items }: { items: { at: string; status: string; note?: string; amountMinor?: number; by?: string }[] }) {
  return (
    <ol className="relative ml-2 border-l border-line">
      {items.map((t, i) => (
        <li key={i} className="mb-4 ml-4 last:mb-0">
          <span className={cx('absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white', i === items.length - 1 ? 'bg-brand-500' : 'bg-slate-300')} />
          <div className="flex flex-wrap items-center gap-2"><Status value={t.status} /><span className="text-xs text-muted">{new Date(t.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>{t.by && <span className="text-xs text-muted">· {t.by}</span>}</div>
          {(t.note || t.amountMinor) && <p className="mt-1 text-[13px] text-navy/80">{t.note}{t.amountMinor ? ` ₹${(t.amountMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : ''}</p>}
        </li>
      ))}
    </ol>
  );
}

// ---- Toasts ----
type Toast = { id: number; tone: 'success' | 'error' | 'info'; title: string; body?: string };
const ToastCtx = createContext<{ push: (t: Omit<Toast, 'id'>) => void }>({ push: () => {} });
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, 'id'>) => { const id = Date.now() + Math.random(); setItems((x) => [...x, { ...t, id }]); setTimeout(() => setItems((x) => x.filter((y) => y.id !== id)), 5200); }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cx('animate-in pointer-events-auto rounded-xl border bg-white px-4 py-3 shadow-[var(--shadow-pop)]', t.tone === 'error' ? 'border-bad-600/30' : t.tone === 'success' ? 'border-ok-600/30' : 'border-line')}>
            <div className="flex items-start gap-2">{t.tone === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-ok-600" /> : t.tone === 'error' ? <CircleAlert className="mt-0.5 h-4 w-4 text-bad-600" /> : <Info className="mt-0.5 h-4 w-4 text-info-600" />}<div><div className="text-sm font-semibold">{t.title}</div>{t.body && <div className="text-[13px] text-muted">{t.body}</div>}</div></div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx).push;

export function ConfirmButton({ children, confirmTitle, confirmBody, onConfirm, variant = 'primary', size, confirmLabel = 'Confirm', disabled, icon }: { children: ReactNode; confirmTitle: string; confirmBody: ReactNode; onConfirm: () => Promise<unknown> | void; variant?: BtnProps['variant']; size?: BtnProps['size']; confirmLabel?: string; disabled?: boolean; icon?: ReactNode }) {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)} disabled={disabled} icon={icon}>{children}</Button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title={confirmTitle} footer={<><Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button variant={variant === 'danger' ? 'danger' : 'primary'} loading={busy} onClick={async () => { setBusy(true); try { await onConfirm(); setOpen(false); } finally { setBusy(false); } }}>{confirmLabel}</Button></>}>
        <div className="text-sm text-navy/85">{confirmBody}</div>
      </Modal>
    </>
  );
}
