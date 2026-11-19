import { PageHeader } from '@/components/ui';
import { Passbook } from '@/components/finance/Passbook';
export default function Page() { return <><PageHeader eyebrow="Finance" title="Payment passbook" subtitle="Live ledger — updates with every demo payment, ticket and refund (unlike the static Excel samples)." /><Passbook /></>; }
