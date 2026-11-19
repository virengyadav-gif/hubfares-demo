'use client';
import { Clock, ShoppingCart } from 'lucide-react';
import { useApi, inr } from '@/lib/client';
import { Card, PageHeader, SimTag, Badge, Button, Empty } from '@/components/ui';
export default function Page() {
  const d = useApi<any>('/guided/samples').data;
  return (
    <div>
      <PageHeader eyebrow="Servicing" title="Manage carts & held bookings" subtitle="Preview of draft/held itineraries with expiry." badges={<SimTag kind="Guided demo" />} />
      <div className="grid gap-4 md:grid-cols-2">
        {(d?.heldCarts ?? []).map((c: any) => (
          <Card key={c.id}>
            <div className="flex items-start justify-between"><div className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-brand-500" /><b>{c.route}</b></div><Badge tone={c.status === 'EXPIRING' ? 'red' : 'blue'}>{c.status.toLowerCase()}</Badge></div>
            <div className="mt-2 text-sm text-muted">{c.flight} · {c.travelers} traveller(s)</div>
            <div className="mt-3 flex items-center justify-between"><div className="text-xl font-bold">{inr(c.holdAmountMinor)}</div><div className="flex items-center gap-1 text-sm font-semibold text-warn-600"><Clock className="h-4 w-4" />Expires in {c.holdExpiresInMinutes} min</div></div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand-500" style={{ width: `${Math.min(100, c.holdExpiresInMinutes)}%` }} /></div>
            <div className="mt-4 flex gap-2"><Button size="sm" variant="secondary" disabled title="Guided preview — supplier hold sync is a planned integration">Retrieve held booking</Button></div>
            <p className="mt-2 text-[11px] text-muted">{c.label}</p>
          </Card>
        ))}
        {!d?.heldCarts?.length && <Card><Empty title="No held carts for your agency" /></Card>}
      </div>
    </div>
  );
}
