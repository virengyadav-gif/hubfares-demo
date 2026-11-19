import { PageHeader } from '@/components/ui';
import { BookingList } from '@/components/booking/BookingList';
export default function Page() { return <><PageHeader eyebrow="Operations" title="All bookings" subtitle="Every authorised agency. The same records drive OTA views, ledgers and executive KPIs." /><BookingList base="/operations/bookings" hub /></>; }
