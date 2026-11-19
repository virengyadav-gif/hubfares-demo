'use client';
import { Suspense, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock } from 'lucide-react';
import { apiFetch } from '@/lib/client';
import { Button, Input, Field, Notice, cx } from '@/components/ui';

const ACCOUNTS = [
  { group: 'Hubfares', email: 'superadmin@hubfares.example.com', name: 'Meera Kapoor', role: 'Super Admin', note: 'All config · demo reset' },
  { group: 'Hubfares', email: 'finance@hubfares.example.com', name: 'Vikram Shah', role: 'Admin · Finance', note: 'Credit, refunds, commercials, payouts' },
  { group: 'Hubfares', email: 'ops@hubfares.example.com', name: 'Neha Joshi', role: 'Operations', note: 'Approvals, bookings, cases' },
  { group: 'Hubfares', email: 'cxo@hubfares.example.com', name: 'Arjun Malhotra', role: 'CXO (read-only)', note: 'Executive analytics' },
  { group: 'Skyline Travels · prepaid', email: 'admin@skyline.example.com', name: 'Priya Nair', role: 'Agency Admin', note: 'Users, markup, wallet' },
  { group: 'Skyline Travels · prepaid', email: 'agent@skyline.example.com', name: 'Rahul Verma', role: 'Agency Agent', note: 'Search & book' },
  { group: 'Orbit Corporate · weekly credit', email: 'admin@orbit.example.com', name: 'Sanjay Rao', role: 'Agency Admin', note: 'Credit & immediate refunds' },
  { group: 'Orbit Corporate · weekly credit', email: 'agent@orbit.example.com', name: 'Divya Menon', role: 'Agency Agent', note: 'Finance view restricted' },
  { group: 'Aster Holidays · daily credit', email: 'admin@aster.example.com', name: 'Karan Bedi', role: 'Agency Admin', note: 'Overdue credit blocked' },
  { group: 'Aster Holidays · daily credit', email: 'finance@aster.example.com', name: 'Isha Gupta', role: 'Finance Viewer', note: 'Wallet, passbook, reports' },
];
function LoginForm() {
  const router = useRouter(); const sp = useSearchParams();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const r = await apiFetch<any>('/auth/login', { body: { email, password } });
      const next = sp.get('next');
      const home = r.data.agencyId ? '/agency' : r.data.role === 'HUB_CXO' ? '/executive' : '/operations';
      router.push(next && ((r.data.agencyId && next.startsWith('/agency')) || (!r.data.agencyId && !next.startsWith('/agency'))) ? next : home);
      router.refresh();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };
  const groups = [...new Set(ACCOUNTS.map((a) => a.group))];
  return (
    <div className="grid min-h-screen lg:grid-cols-[440px_1fr]">
      <aside className="flex flex-col justify-between bg-ink-800 p-8 text-white">
        <Link href="/" className="flex items-center gap-3"><Image src="/hubfares-logo.jpeg" alt="Hubfares" width={40} height={40} className="rounded-lg" /><span className="text-xl font-bold">hub<span className="text-brand-500">fares</span></span></Link>
        <form onSubmit={submit} className="my-10 space-y-4" aria-label="Demo sign in">
          <div><h1 className="text-2xl font-bold">Demo sign in</h1><p className="mt-1 text-sm text-white/55">Choose a seeded role, then enter the operator demo password. Roles are validated on the server.</p></div>
          <Field label={<span className="text-white/70">Email</span>}><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@agency.example.com" autoComplete="username" /></Field>
          <Field label={<span className="text-white/70">Password</span>}><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Operator demo password" autoComplete="current-password" /></Field>
          {err && <Notice tone="error">{err}</Notice>}
          <Button type="submit" size="lg" className="w-full" loading={busy} icon={<Lock className="h-4 w-4" />}>Sign in</Button>
          <p className="text-xs text-white/40">Synthetic accounts only · HTTP-only session cookie · password from the restricted operator guide.</p>
        </form>
        <div className="text-[11px] uppercase tracking-wider text-brand-400">Demo Environment</div>
      </aside>
      <main className="overflow-y-auto bg-canvas p-6 lg:p-10">
        <h2 className="text-lg font-bold">Seeded demo accounts</h2>
        <p className="mb-5 text-sm text-muted">Clicking a card fills the email. Use separate browser profiles to keep OTA and Hubfares sessions apart.</p>
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g}><div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{g}</div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {ACCOUNTS.filter((a) => a.group === g).map((a) => (
                  <button key={a.email} type="button" onClick={() => setEmail(a.email)} className={cx('rounded-xl border bg-white p-4 text-left shadow-[var(--shadow-card)] transition hover:border-brand-300', email === a.email ? 'border-brand-500 ring-2 ring-brand-100' : 'border-line')}>
                    <div className="text-sm font-bold">{a.role}</div><div className="text-[13px] text-navy/80">{a.name}</div><div className="mt-1 truncate text-[11.5px] text-muted">{a.email}</div><div className="mt-2 text-[11.5px] text-brand-700">{a.note}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
export default function LoginPage() { return <Suspense><LoginForm /></Suspense>; }
