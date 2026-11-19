'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useState, createContext, useContext, useEffect } from 'react';
import { Menu, LogOut, Bell, ChevronsLeft, FlaskConical, Building2 } from 'lucide-react';
import { AGENCY_NAV, HUB_NAV, allowed, NavGroup } from './nav';
import { cx, ToastProvider, Badge } from '@/components/ui';
import { apiFetch, useApi } from '@/lib/client';
import type { ClientSession } from '@/server/auth/page';

const SessionCtx = createContext<ClientSession | null>(null);
export const useSession = () => useContext(SessionCtx)!;
export const can = (s: ClientSession, p: string | string[]) => allowed(s.perms, p);

export function Logo({ dark = true, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Image src="/hubfares-logo.jpeg" alt="Hubfares" width={34} height={34} className="rounded-lg" priority />
      {!compact && <div className="leading-tight"><div className={cx('text-[17px] font-bold tracking-tight', dark ? 'text-white' : 'text-navy')}>hub<span className="text-brand-500">fares</span></div><div className={cx('text-[10px] font-medium uppercase tracking-[0.14em]', dark ? 'text-white/45' : 'text-muted')}>B2B travel platform</div></div>}
    </div>
  );
}
export function DemoBadge({ className }: { className?: string }) {
  return <span title="All external providers (Sabre, bank, KYC, supplier, FX) are simulated in this environment." className={cx('inline-flex items-center gap-1 rounded-full border border-brand-500/40 bg-brand-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-600', className)}><FlaskConical className="h-3 w-3" />Demo Environment</span>;
}
const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: 'Super Admin', HUB_ADMIN_FINANCE: 'Hubfares Admin · Finance', HUB_OPS: 'Hubfares Operations', HUB_CXO: 'Hubfares CXO (read-only)', AGENCY_ADMIN: 'Agency Admin', AGENCY_AGENT: 'Agency Agent', AGENCY_FINANCE_VIEWER: 'Agency Finance Viewer' };

function Sidebar({ groups, session, collapsed, onNavigate }: { groups: NavGroup[]; session: ClientSession; collapsed: boolean; onNavigate?: () => void }) {
  const path = usePathname();
  const items = groups.filter((g) => allowed(session.perms, g.perm)).map((g) => ({ ...g, items: g.items.filter((i) => allowed(session.perms, i.perm)) })).filter((g) => g.items.length);
  const active = (href: string) => path === href || (href !== '/agency' && href !== '/operations' && href !== '/executive' && path.startsWith(href + '/'));
  return (
    <nav className="flex-1 overflow-y-auto px-3 pb-6 scroll-thin" aria-label="Main navigation">
      {items.map((g) => (
        <div key={g.title} className="mt-5">
          {!collapsed && <div className="mb-1.5 px-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/35">{g.title}</div>}
          <ul className="space-y-0.5">
            {g.items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} onClick={onNavigate} title={i.label} className={cx('group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition', active(i.href) ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25' : 'text-white/70 hover:bg-white/[0.06] hover:text-white')}>
                  <i.icon className="h-[17px] w-[17px] shrink-0" />
                  {!collapsed && <span className="flex-1 truncate">{i.label}</span>}
                  {!collapsed && i.tag && <span className={cx('rounded px-1 text-[9.5px] font-bold', active(i.href) ? 'bg-white/20' : i.tag === 'R' ? 'bg-violet-400/15 text-violet-300' : 'bg-white/10 text-white/50')}>{i.tag === 'R' ? 'ROADMAP' : 'GUIDED'}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
export function AppShell({ session, portal, children, topRight }: { session: ClientSession; portal: 'agency' | 'hub'; children: ReactNode; topRight?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const router = useRouter();
  const groups = portal === 'agency' ? AGENCY_NAV : HUB_NAV;
  const notif = useApi<any[]>('/notifications');
  const path = usePathname();
  useEffect(() => { notif.reload(); /* refresh bell on navigation */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  const unseen = (notif.data ?? []).filter((n) => !n.seenAt).length;
  const logout = async () => { await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {}); router.push('/login'); router.refresh(); };
  return (
    <SessionCtx.Provider value={session}>
      <ToastProvider>
        <div className="flex min-h-screen">
          <aside className={cx('fixed inset-y-0 left-0 z-40 hidden flex-col bg-ink-800 transition-all lg:flex', collapsed ? 'w-[76px]' : 'w-[264px]')}>
            <div className="flex h-16 items-center justify-between px-4"><Link href={portal === 'agency' ? '/agency' : '/operations'}><Logo compact={collapsed} /></Link>{!collapsed && <button aria-label="Collapse sidebar" onClick={() => setCollapsed(true)} className="rounded p-1 text-white/40 hover:text-white"><ChevronsLeft className="h-4 w-4" /></button>}</div>
            {collapsed && <button aria-label="Expand sidebar" onClick={() => setCollapsed(false)} className="mx-auto mb-2 rounded p-1 text-white/40 hover:text-white"><Menu className="h-4 w-4" /></button>}
            <Sidebar groups={groups} session={session} collapsed={collapsed} />
            {!collapsed && <div className="border-t border-white/10 p-4 text-[11px] leading-relaxed text-white/40">Sabre-first <b className="text-white/60">mock</b> GDS · simulated bank, KYC, supplier & FX. Not production.</div>}
          </aside>
          {mobile && (
            <div className="fixed inset-0 z-50 flex lg:hidden" onClick={() => setMobile(false)}>
              <aside className="flex w-[270px] flex-col bg-ink-800" onClick={(e) => e.stopPropagation()}><div className="flex h-16 items-center px-4"><Logo /></div><Sidebar groups={groups} session={session} collapsed={false} onNavigate={() => setMobile(false)} /></aside>
              <div className="flex-1 bg-ink-900/50" />
            </div>
          )}
          <div className={cx('flex min-w-0 flex-1 flex-col transition-all', collapsed ? 'lg:pl-[76px]' : 'lg:pl-[264px]')}>
            <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/85 px-4 backdrop-blur sm:px-6">
              <button aria-label="Open menu" className="rounded-md p-1.5 text-navy lg:hidden" onClick={() => setMobile(true)}><Menu className="h-5 w-5" /></button>
              <div className="lg:hidden"><Logo dark={false} compact /></div>
              <div className="hidden min-w-0 items-center gap-2 sm:flex">
                <Building2 className="h-4 w-4 text-muted" />
                <span className="truncate text-sm font-semibold text-navy" data-testid="context-agency">{session.isHub ? 'Hubfares · all authorised agencies' : session.agencyName}</span>
                {!session.isHub && session.agencyStatus !== 'ACTIVE' && <Badge tone="red">{session.agencyStatus}</Badge>}
              </div>
              <div className="ml-auto flex items-center gap-2 sm:gap-3">
                <DemoBadge className="hidden md:inline-flex" />
                {topRight}
                <Link href={portal === 'agency' ? '/agency/notifications' : '/operations'} aria-label="Notifications" className="relative rounded-full p-2 text-muted hover:bg-slate-100"><Bell className="h-[18px] w-[18px]" />{unseen > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">{unseen}</span>}</Link>
                <div className="hidden text-right leading-tight sm:block"><div className="text-[13px] font-semibold text-navy" data-testid="user-name">{session.name}</div><div className="text-[11px] text-muted" data-testid="user-role">{ROLE_LABEL[session.role] ?? session.role}</div></div>
                <button onClick={logout} aria-label="Sign out" className="rounded-full p-2 text-muted hover:bg-slate-100 hover:text-navy"><LogOut className="h-[18px] w-[18px]" /></button>
              </div>
            </header>
            <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </SessionCtx.Provider>
  );
}
