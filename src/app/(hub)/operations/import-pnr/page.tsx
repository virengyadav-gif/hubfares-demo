import { PageHeader } from '@/components/ui';
import { PnrImport } from '@/components/booking/PnrImport';
export default function Page() { return <><PageHeader eyebrow="Operations" title="Import PNR" subtitle="Import a seeded offline PNR into a permitted agency. Simulated Sabre retrieve." /><PnrImport hub base="/operations/bookings" /></>; }
