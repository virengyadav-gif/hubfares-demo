import { PageHeader } from '@/components/ui';
import { PnrImport } from '@/components/booking/PnrImport';
export default function Page() { return <><PageHeader eyebrow="Offline bookings" title="Import PNR" subtitle="Bring a GDS booking made outside Hubfares into Manage Booking — once. Retrieve is simulated." /><PnrImport base="/agency/bookings" /></>; }
