import { PageHeader } from '@/components/ui';
import { BookingList } from '@/components/booking/BookingList';
export default function Page() { return <><PageHeader eyebrow="Booking Carts" title="Bookings" subtitle="All bookings of your agency — search by booking ID, PNR, passenger or ticket." /><BookingList base="/agency/bookings" /></>; }
