'use client';
/** OTA-only scripted, finite-state Help assistant (WF-20). Not an LLM. Creates support cases; never moves money or changes bookings. */
import { useEffect, useRef, useState } from 'react';
import { MessageCircleQuestion, X, ArrowLeft, Home, RotateCcw, Languages, PhoneCall, Send, Bot, CheckCircle2 } from 'lucide-react';
import { apiFetch, useApi, inr, fmtDate, newKey } from '@/lib/client';
import { Button, Status, Badge, Textarea, Select, cx } from '@/components/ui';

type L = { en: string; hi: string; hinglish: string };
type Opt = { id: string; label: L; informational?: boolean; needsPnr?: boolean; needsCase?: boolean; needsFlight?: boolean };
type Intent = { id: string; label: L; category?: string; needsPnr?: boolean; pnrOptional?: boolean; options: Opt[] };
type Cfg = { languages: { id: keyof L; label: string }[]; messages: Record<string, L>; menu: Intent[]; controls: Record<string, L> };
type Step = { kind: 'language' } | { kind: 'menu' } | { kind: 'submenu'; intent: Intent } | { kind: 'ask'; intent: Intent; opt: Opt; what: 'pnr' | 'case' | 'flight' } | { kind: 'result'; intent: Intent; opt: Opt; data: any } | { kind: 'compose'; intent: Intent; opt: Opt; booking: any | null } | { kind: 'confirm'; intent: Intent; opt: Opt; booking: any | null; details: string; contact: string } | { kind: 'created'; data: any } | { kind: 'callcenter' };
type Msg = { from: 'bot' | 'user'; text: string };

export function openHelp(pnr?: string) { window.dispatchEvent(new CustomEvent('hubfares:help', { detail: { pnr } })); }

export function HelpChat() {
  const cfg = useApi<Cfg>('/help/config').data;
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<keyof L>('en');
  const [stack, setStack] = useState<Step[]>([{ kind: 'language' }]);
  const [log, setLog] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<string | null>(null);
  const idem = useRef<string>(newKey());
  const endRef = useRef<HTMLDivElement>(null);
  const step = stack[stack.length - 1];
  const t = (l?: L) => (l ? l[lang] : '');
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [stack, log]);
  useEffect(() => {
    const h = (e: Event) => { const pnr = (e as CustomEvent).detail?.pnr ?? null; setPrefill(pnr); setOpen(true); };
    window.addEventListener('hubfares:help', h); return () => window.removeEventListener('hubfares:help', h);
  }, []);
  const say = (m: Msg) => setLog((x) => [...x.slice(-30), m]);
  const push = (s: Step) => { setErr(null); setStack((x) => [...x, s]); };
  const back = () => { setErr(null); setStack((x) => (x.length > 1 ? x.slice(0, -1) : x)); };
  const home = () => { setErr(null); setStack([{ kind: 'language' }, { kind: 'menu' }]); };
  const restart = () => { setErr(null); setLog([]); setStack([{ kind: 'language' }]); setPrefill(null); idem.current = newKey(); };
  if (!cfg) return null;
  const M = cfg.messages; const C = cfg.controls;

  async function lookup(intent: Intent, opt: Opt, what: 'pnr' | 'case' | 'flight', value: string) {
    setBusy(true); setErr(null); say({ from: 'user', text: value });
    try {
      const body: any = what === 'pnr' ? { action: 'lookup_pnr', pnr: value } : what === 'case' ? { action: 'lookup_case', reference: value } : { action: 'flight_status', flightNumber: value };
      const r = await apiFetch('/help/intent', { body: { ...body, intent: intent.id, option: opt.id, locale: lang } });
      if (opt.informational || what !== 'pnr') push({ kind: 'result', intent, opt, data: r.data });
      else push({ kind: 'compose', intent, opt, booking: r.data });
      setInput('');
    } catch (e: any) { setErr(e.code === 'TENANT_RESOURCE_NOT_FOUND' ? t(M.notFound) : e.message); }
    finally { setBusy(false); }
  }
  async function pickOption(intent: Intent, opt: Opt) {
    say({ from: 'user', text: t(opt.label) });
    if (opt.id === 'WALLET_HELP' || opt.id === 'CONTACT_SUPPORT') return push({ kind: 'result', intent, opt, data: { static: opt.id } });
    if (opt.id === 'MY_CASES') { setBusy(true); try { const r = await apiFetch('/help/intent', { body: { action: 'my_cases', locale: lang } }); push({ kind: 'result', intent, opt, data: { cases: r.data } }); } finally { setBusy(false); } return; }
    const needPnr = opt.needsPnr ?? intent.needsPnr;
    if (opt.needsCase) return push({ kind: 'ask', intent, opt, what: 'case' });
    if (opt.needsFlight) return push({ kind: 'ask', intent, opt, what: 'flight' });
    if (needPnr) { if (prefill) return lookup(intent, opt, 'pnr', prefill); return push({ kind: 'ask', intent, opt, what: 'pnr' }); }
    if (intent.pnrOptional) return push({ kind: 'compose', intent, opt, booking: null });
    return push({ kind: 'result', intent, opt, data: { static: opt.id } });
  }
  async function submit(s: Extract<Step, { kind: 'confirm' }>) {
    setBusy(true); setErr(null);
    try {
      const r = await apiFetch('/help/cases', { idem: idem.current, body: { category: s.intent.category ?? 'COMPLAINT', subcategory: s.opt.id, pnr: s.booking?.pnr, details: s.details || undefined, contactPreference: s.contact, locale: lang } });
      idem.current = newKey();
      push({ kind: 'created', data: r.data });
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  const Opts = ({ items }: { items: { key: string; label: string; onClick: () => void }[] }) => (
    <div className="mt-2 flex flex-wrap gap-1.5">{items.map((i) => <button key={i.key} onClick={i.onClick} disabled={busy} className="rounded-full border border-brand-300 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50">{i.label}</button>)}</div>
  );
  const Bubble = ({ children }: { children: React.ReactNode }) => <div className="flex gap-2"><div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-800 text-white"><Bot className="h-4 w-4" /></div><div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-slate-100 px-3.5 py-2.5 text-[13.5px] text-navy">{children}</div></div>;

  function body() {
    switch (step.kind) {
      case 'language': return <Bubble>{t(M.welcome)}<Opts items={cfg!.languages.map((l) => ({ key: l.id, label: l.label, onClick: () => { setLang(l.id); say({ from: 'user', text: l.label }); push({ kind: 'menu' }); } }))} /></Bubble>;
      case 'menu': return <Bubble>{t(M.mainMenu)}{prefill && <div className="mt-1 text-xs text-muted">Booking context: PNR {prefill}</div>}<Opts items={cfg!.menu.map((m) => ({ key: m.id, label: t(m.label), onClick: () => { say({ from: 'user', text: t(m.label) }); push({ kind: 'submenu', intent: m }); } }))} /></Bubble>;
      case 'submenu': return <Bubble><b>{t(step.intent.label)}</b><Opts items={step.intent.options.map((o) => ({ key: o.id, label: t(o.label), onClick: () => pickOption(step.intent, o) }))} /></Bubble>;
      case 'ask': return (
        <Bubble>{step.what === 'pnr' ? t(M.askPnr) : step.what === 'case' ? t(M.askCase) : 'Enter airline + flight number, e.g. BA-DEMO-105'}
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (input.trim()) lookup(step.intent, step.opt, step.what, input.trim().toUpperCase()); }}>
            <input aria-label="Reference" autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder={step.what === 'pnr' ? 'e.g. SBX001' : step.what === 'case' ? 'CASE-1001 or refund_orb_012' : 'BA-DEMO-105'} className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm uppercase focus:border-brand-400 focus:outline-none" />
            <Button size="sm" loading={busy} icon={<Send className="h-3.5 w-3.5" />}>Check</Button>
          </form>
        </Bubble>
      );
      case 'result': return <Bubble><Result data={step.data} opt={step.opt} intent={step.intent} lang={lang} onAct={(booking) => { const actOpt = step.intent.options.find((o) => !o.informational); if (actOpt) push({ kind: 'compose', intent: step.intent, opt: actOpt, booking }); }} /></Bubble>;
      case 'compose': return (
        <Bubble>
          {step.booking && <BookingSummary b={step.booking} />}
          {!step.booking && step.intent.pnrOptional && <input aria-label="Optional PNR" id="optPnr" placeholder="PNR (optional, your agency only)" className="mt-1 h-9 w-full rounded-lg border border-line bg-white px-3 text-sm uppercase" />}
          <div className="mt-2 text-[13px]">{t(M.details)}</div>
          <Textarea aria-label="Details" rows={3} className="mt-1.5 bg-white" value={input} onChange={(e) => setInput(e.target.value)} maxLength={600} />
          {step.intent.id === 'COMPLAINTS' && <Select aria-label="Contact preference" className="mt-2 h-9 bg-white" defaultValue="PORTAL" id="contactPref"><option value="PORTAL">Reply in portal</option><option value="EMAIL">Email</option><option value="PHONE">Phone</option></Select>}
          <div className="mt-2"><Button size="sm" onClick={() => { const c = (document.getElementById('contactPref') as HTMLSelectElement | null)?.value ?? 'PORTAL'; const op = (document.getElementById('optPnr') as HTMLInputElement | null)?.value?.trim().toUpperCase(); push({ kind: 'confirm', intent: step.intent, opt: step.opt, booking: step.booking ?? (op ? { pnr: op, route: 'ownership checked on submit', leadPassenger: '' } : null), details: input, contact: c }); setInput(''); }}>Review request</Button></div>
        </Bubble>
      );
      case 'confirm': return (
        <Bubble>
          <div className="font-semibold">Confirm support request</div>
          <dl className="mt-2 space-y-1 text-[12.5px]">
            <div><dt className="inline text-muted">Category: </dt><dd className="inline font-semibold">{t(step.intent.label)} · {t(step.opt.label)}</dd></div>
            {step.booking && <div><dt className="inline text-muted">Booking: </dt><dd className="inline font-semibold">{step.booking.pnr} · {step.booking.route} · {step.booking.leadPassenger}</dd></div>}
            {step.details && <div><dt className="inline text-muted">Details: </dt><dd className="inline">{step.details}</dd></div>}
          </dl>
          <div className="mt-2 rounded-lg bg-warn-50 px-2.5 py-2 text-[12px] text-warn-600">{t(M.confirmNotice)}</div>
          <div className="mt-2 flex gap-2"><Button size="sm" loading={busy} onClick={() => submit(step)} data-testid="chat-submit">{t(C.submit)}</Button><Button size="sm" variant="secondary" onClick={back}>{t(C.back)}</Button></div>
        </Bubble>
      );
      case 'created': return <Bubble><div className="flex items-center gap-2 font-semibold text-ok-600"><CheckCircle2 className="h-4 w-4" />{t(M.caseCreated)}</div><div className="mt-1 text-lg font-bold tracking-wide" data-testid="chat-case-id">{step.data.caseId}</div><div className="text-xs text-muted">Status: Open · visible to Hubfares Operations. No booking, refund or wallet change was made.</div><Opts items={[{ key: 'm', label: t(C.mainMenu), onClick: home }]} /></Bubble>;
      case 'callcenter': return <Bubble>{t(M.callCenter)}</Bubble>;
    }
  }
  return (
    <>
      {!open && <button onClick={() => setOpen(true)} data-testid="help-bubble" className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-ink-800 py-3 pl-3.5 pr-4 text-sm font-semibold text-white shadow-[var(--shadow-pop)] transition hover:bg-ink-700"><MessageCircleQuestion className="h-5 w-5 text-brand-400" />Need Help</button>}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end sm:inset-auto sm:bottom-5 sm:right-5" role="dialog" aria-label="Hubfares Help">
          <div className="animate-in flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-[var(--shadow-pop)] sm:h-[620px] sm:w-[400px] sm:rounded-2xl sm:border sm:border-line">
            <header className="flex items-center gap-3 bg-ink-800 px-4 py-3 text-white">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500"><Bot className="h-5 w-5" /></div>
              <div className="flex-1"><div className="text-sm font-bold">Hubfares Help</div><div className="text-[11px] text-white/60">Scripted assistant · not a live agent</div></div>
              <Badge tone="orange">Demo</Badge>
              <button aria-label="Close help" onClick={() => setOpen(false)} className="rounded p-1 text-white/70 hover:text-white"><X className="h-5 w-5" /></button>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto px-3.5 py-4 scroll-thin">
              {log.map((m, i) => m.from === 'user' ? <div key={i} className="flex justify-end"><div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-500 px-3.5 py-2 text-[13px] text-white">{m.text}</div></div> : null)}
              {body()}
              {err && <div className="rounded-lg border border-bad-600/20 bg-bad-50 px-3 py-2 text-[12.5px] text-bad-600" data-testid="chat-error">{err}</div>}
              <div ref={endRef} />
            </div>
            <footer className="grid grid-cols-5 gap-1 border-t border-line bg-slate-50 px-2 py-2 text-[10.5px] font-semibold text-muted">
              {[[ArrowLeft, C.back, back], [Home, C.mainMenu, home], [RotateCcw, C.restart, restart], [Languages, C.language, () => setStack([{ kind: 'language' }])], [PhoneCall, C.callCenter, () => push({ kind: 'callcenter' })]].map(([I, l, f]: any, i) => (
                <button key={i} onClick={f} className="flex flex-col items-center gap-0.5 rounded-md py-1 hover:bg-white hover:text-navy"><I className="h-4 w-4" />{t(l)}</button>
              ))}
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
function BookingSummary({ b }: { b: any }) {
  return <div className="rounded-lg border border-line bg-white px-3 py-2 text-[12.5px]"><div className="flex items-center justify-between"><b>{b.pnr}</b><Status value={b.bookingStatus} /></div><div className="text-muted">{b.route} · {b.leadPassenger} · {fmtDate(b.firstDepartureAt)}</div></div>;
}
function Result({ data, opt, intent, onAct }: { data: any; opt: Opt; intent: Intent; lang: string; onAct: (b: any) => void }) {
  if (data.static === 'WALLET_HELP') return <div>Your wallet balance, holds and credit are on <b>Wallet &amp; Credit</b>; every movement appears in the <b>Passbook</b>. Add funds using the demo bank details — matching is automatic and credits once.</div>;
  if (data.static === 'CONTACT_SUPPORT') return <div>Raise a request under <b>Complaints / Support</b> or call the demo call centre. Live chat transfer is a planned integration.</div>;
  if (data.cases) return <div><div className="mb-1 font-semibold">Your recent cases</div>{data.cases.length ? data.cases.map((c: any) => <div key={c.id} className="flex items-center justify-between border-t border-line py-1 text-[12.5px]"><span><b>{c.id}</b> · {c.category.replace(/_/g, ' ').toLowerCase()}</span><Status value={c.status} /></div>) : 'No cases yet.'}</div>;
  if (data.kind === 'REFUND') return <RefundStatus r={data} />;
  if (data.kind === 'CASE') return <div><div className="font-semibold">{data.id}</div><div className="text-[12.5px] text-muted">{data.summary}</div><div className="mt-1"><Status value={data.status} /></div></div>;
  if (data.flightNumber && data.status && !data.segments) return <div><b>{data.flightNumber}</b> · {data.route}<div className="mt-1 flex items-center gap-2"><Badge tone={data.status.code === 'SCHEDULED' ? 'green' : data.status.code === 'DELAYED' ? 'amber' : 'red'}>{data.status.label}</Badge><Badge tone="amber">{data.label}</Badge></div></div>;
  // booking lookup results
  const b = data;
  return (
    <div className="space-y-2">
      <BookingSummary b={b} />
      {opt.id === 'ESTIMATE_REFUND' || opt.id === 'CANCEL_BOOKING_REFUND' ? (
        b.cancellationEstimate ? (b.cancellationEstimate.eligible ? <div className="text-[12.5px]">Indicative refund (booked fare rules {b.cancellationEstimate.slabs.join(', ')}): <b>{inr(b.cancellationEstimate.estimatedAgencyRefundMinor)}</b> after supplier penalty {inr(b.cancellationEstimate.supplierPenaltyMinor)} and Hubfares fee {inr(b.cancellationEstimate.serviceFeeMinor)}. Payout per booked policy: {b.refundPolicy.payoutMode.replace(/_/g, ' ').toLowerCase()}.</div> : <div className="text-[12.5px]">Not eligible: {b.cancellationEstimate.reason}</div>) : <div className="text-[12.5px]">No refund estimate available for this booking state.</div>
      ) : null}
      {(opt.id === 'BY_PNR' || opt.id === 'PENDING_SUPPLIER') && (b.refund ? <RefundStatus r={b.refund} /> : <div className="text-[12.5px]">No refund claim exists for this booking.</div>)}
      {opt.id === 'STATUS_BY_PNR' && b.segments.map((s: any) => <div key={s.flightNumber} className="flex items-center justify-between text-[12.5px]"><span>{s.flightNumber} {s.route}</span><Badge tone={s.status.code === 'SCHEDULED' ? 'green' : s.status.code === 'DELAYED' ? 'amber' : 'red'}>{s.status.label} · simulated</Badge></div>)}
      {opt.id === 'E_TICKET' && <div className="text-[12.5px]">{b.ticketNumbers.length ? <>E-ticket(s): <b>{b.ticketNumbers.join(', ')}</b> (simulated). Open the booking in Manage Booking to view the itinerary.</> : 'No ticket has been issued for this booking yet.'}</div>}
      {opt.id === 'FARE_RULES' && <div className="text-[12.5px]">Fare-rule profile(s): <b>{[...new Set(b.segments.map((s: any) => s.profileId))].join(', ')}</b>. Detailed slabs are shown on the booking detail page.</div>}
      {opt.id === 'INVOICE' && <div className="text-[12.5px]">Amount charged: <b>{inr(b.amountMinor)}</b>. Tax invoices are a planned integration; the passbook shows the ledger entry.</div>}
      {opt.id === 'ESTIMATED_CHARGES' && <div className="text-[12.5px]">Date-change charges follow the booked profile ({[...new Set(b.segments.map((s: any) => s.profileId))].join(', ')}) plus fare difference. Submit an amendment for a guided quote.</div>}
      {(opt.id === 'ESTIMATE_REFUND' || opt.id === 'ESTIMATED_CHARGES') && <button onClick={() => onAct(b)} className="text-[12.5px] font-semibold text-brand-700 underline">Continue to submit a request</button>}
      <div className="text-[11px] text-muted">{intent.label.en} · data from your agency only</div>
    </div>
  );
}
function RefundStatus({ r }: { r: any }) {
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-[12.5px]">
      <div className="flex items-center justify-between"><b>{r.claimId}</b><Status value={r.status} /></div>
      <div className="mt-1 grid grid-cols-2 gap-1"><span className="text-muted">Agency payout</span><span className={cx('font-semibold')}>{r.agencyPayoutStatus.replace(/_/g, ' ').toLowerCase()} {r.walletCreditedMinor ? `· ${inr(r.walletCreditedMinor)}` : ''}</span><span className="text-muted">Supplier settlement</span><span className="font-semibold">{(r.supplierSettlementStatus ?? '').replace(/_/g, ' ').toLowerCase()}</span><span className="text-muted">Refund amount</span><span className="font-semibold">{inr(r.agencyRefundMinor)}</span></div>
      <div className="mt-1 text-[11px] text-muted">No settlement date is promised in the demo.</div>
    </div>
  );
}
