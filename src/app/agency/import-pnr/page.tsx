import { PageHeader } from '@/components/ui';
import { PnrImport } from '@/components/booking/PnrImport';
export default function Page() { return <><PageHeader eyebrow="Offline bookings" title="Import PNR" subtitle="Bring GDS bookings made outside Hubfares into Booking Carts. Search with any field — or none — and import one or many PNRs at once." /><PnrImport base="/agency/bookings" /></>; }
