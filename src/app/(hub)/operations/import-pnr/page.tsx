import { PageHeader } from '@/components/ui';
import { PnrImport } from '@/components/booking/PnrImport';
export default function Page() { return <><PageHeader eyebrow="Operations" title="Import PNR" subtitle="Find PNRs by PCC, PNR, passenger or date — or list them all — and import one or many into the owning agency." /><PnrImport hub base="/operations/bookings" /></>; }
