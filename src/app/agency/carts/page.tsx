'use client';
/** Held carts — PNRs created and on hold, waiting for the ticket to be issued. */
import Link from 'next/link';
import { Clock, ShoppingCart, Ticket } from 'lucide-react';
import { useApi, inr, fmtDate } from '@/lib/client';
import { Card, PageHeader, Badge, Button, Empty, Loading } from '@/components/ui';
export default function Page() {
  const { data, loading } = useApi<any[]>('/bookings?status=PNR_CREATED');
  return (
    <div>
      <PageHeader eyebrow="Servicing" title="Held carts" subtitle="Itineraries with a confirmed PNR and funds on hold, waiting for ticket issue." />
      {loading && !data ? <Loading /> : !data?.length ? <Card><Empty title="No held carts" icon={<ShoppingCart className="h-6 w-6" />}>Bookings with a PNR that are not yet ticketed appear here.</Empty></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between"><div className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-brand-500" /><b>{c.routeSummary.replace(/-/g, ' → ')}</b></div><Badge tone="blue">On hold</Badge></div>
              <div className="mt-2 text-sm text-muted">{c.id} · PNR <span className="font-mono font-semibold text-navy">{c.gdsPnr}</span> · {c.leadPassenger}{c.passengerCount > 1 ? ` +${c.passengerCount - 1}` : ''}</div>
              <div className="mt-3 flex items-center justify-between"><div className="text-xl font-bold">{inr(c.sellAmountMinor)}</div><div className="flex items-center gap-1 text-xs font-semibold text-warn-600"><Clock className="h-4 w-4" />Departs {fmtDate(c.firstDepartureAt)}</div></div>
              <div className="mt-4"><Link href={`/agency/bookings/${c.id}`}><Button size="sm" icon={<Ticket className="h-4 w-4" />}>Open & issue ticket</Button></Link></div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
