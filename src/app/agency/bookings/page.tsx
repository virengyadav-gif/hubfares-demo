import { PageHeader } from '@/components/ui';
import { BookingList } from '@/components/booking/BookingList';
export default function Page() { return <><PageHeader eyebrow="Manage Booking" title="Bookings" subtitle="Your agency's bookings only — scoped on the server." /><BookingList base="/agency/bookings" /></>; }
