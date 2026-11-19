import { PageHeader } from '@/components/ui';
import { ReportsCatalog } from '@/components/finance/Reports';
export default function Page() { return <><PageHeader eyebrow="Finance" title="Reports" subtitle="Excel reports for your agency, filtered by period and transaction status." /><ReportsCatalog /></>; }
