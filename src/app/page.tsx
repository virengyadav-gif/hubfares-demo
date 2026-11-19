import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, ShieldCheck, Plane, Wallet, BarChart3, FileScan, Headset, Import, Layers } from 'lucide-react';
const FEATURES = [
  [FileScan, 'Document-assisted onboarding', 'Upload business documents, review extracted fields, and get approved after (simulated) verification.'],
  [Plane, 'Branded fares & fare rules', 'Sabre-first search with fare brands, two transparent time-slab rule profiles and display currency.'],
  [Wallet, 'Wallet, credit & passbook', 'Automated payment matching, agency-specific credit terms and an immutable ledger.'],
  [Layers, 'Agency-specific refunds', 'Supplier-settlement or immediate payout policies, snapshotted at booking time.'],
  [Import, 'Offline PNR import', 'Bring GDS bookings made elsewhere into one operational view — once.'],
  [Headset, 'Guided OTA support', 'Multilingual scripted help that routes requests straight to Hubfares Operations.'],
  [BarChart3, 'Management intelligence', 'OTA revenue, contribution, cancellations and credit risk from live demo records.'],
  [ShieldCheck, 'Tenant isolation', 'Every agency sees only its own bookings, money, cases and reports — enforced on the server.'],
] as const;
export default function Home() {
  return (
    <div className="min-h-screen bg-ink-800 text-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3"><Image src="/hubfares-logo.jpeg" alt="Hubfares" width={40} height={40} className="rounded-lg" /><div className="text-xl font-bold">hub<span className="text-brand-500">fares</span></div></div>
        <div className="flex items-center gap-3"><span className="hidden rounded-full border border-brand-500/40 bg-brand-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-400 sm:inline">Demo Environment</span><Link href="/login" className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10">Demo Login</Link></div>
      </header>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-500/20 blur-3xl" />
        <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-12 lg:grid-cols-[1.15fr_1fr] lg:pt-20">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-white/70 ring-1 ring-white/10">Exclusively B2B · for OTAs and travel agencies</div>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">The distribution & operations platform built for <span className="text-brand-500">travel agencies</span>.</h1>
            <p className="mt-5 max-w-xl text-lg text-white/65">Onboard, fund, search, book, ticket, refund and reconcile — with every agency&apos;s money and data kept separate, and every number traceable to a record.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/partner/register" className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-3 font-semibold shadow-lg shadow-brand-500/30 hover:bg-brand-600">Partner Registration <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-6 py-3 font-semibold hover:bg-white/15">Demo Login</Link>
              <Link href="/partner/status" className="inline-flex items-center gap-2 px-3 py-3 text-sm font-semibold text-white/70 hover:text-white">Track an application</Link>
            </div>
            <p className="mt-6 text-xs text-white/40">No retail ticketing. This capability POC uses a Sabre-first mock GDS and simulated bank, KYC, supplier and FX services. Not production.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.slice(0, 4).map(([I, t, d]) => <div key={t} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><I className="h-6 w-6 text-brand-400" /><div className="mt-3 font-semibold">{t}</div><div className="mt-1 text-sm text-white/55">{d}</div></div>)}
          </div>
        </div>
      </section>
      <section className="bg-canvas py-16 text-navy">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.slice(4).map(([I, t, d]) => <div key={t} className="rounded-2xl border border-line bg-white p-6 shadow-[var(--shadow-card)]"><I className="h-6 w-6 text-brand-500" /><div className="mt-3 font-semibold">{t}</div><div className="mt-1 text-sm text-muted">{d}</div></div>)}
        </div>
        <p className="mt-10 text-center text-xs text-muted">© Hubfares · Built by VARP Techlabs · Synthetic demo data only</p>
      </section>
    </div>
  );
}
