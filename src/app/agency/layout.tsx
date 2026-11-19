import { headers } from 'next/headers';
import { requireAgencySession } from '@/server/auth/page';
import { AppShell } from '@/components/shell/AppShell';
import { CurrencyProvider, CurrencySwitcher } from '@/components/flight/currency';
import { HelpChat } from '@/components/support/HelpChat';
export const dynamic = 'force-dynamic';
export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const s = await requireAgencySession(h.get('x-pathname') ?? '/agency');
  return (
    <CurrencyProvider>
      <AppShell session={s} portal="agency" topRight={<CurrencySwitcher compact />}>{children}</AppShell>
      {s.perms.includes('AGENCY_SUPPORT') && <HelpChat />}
    </CurrencyProvider>
  );
}
