import { headers } from 'next/headers';
import { requireHubSession } from '@/server/auth/page';
import { AppShell } from '@/components/shell/AppShell';
export const dynamic = 'force-dynamic';
export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const s = await requireHubSession(h.get('x-pathname') ?? '/operations');
  return <AppShell session={s} portal="hub">{children}</AppShell>;
}
