import { PageHeader } from '@/components/ui';
import { Passbook } from '@/components/finance/Passbook';
export default function Page() { return <><PageHeader eyebrow="Finance" title="Payment passbook" subtitle="Every payment, ticket, amendment and refund on your account, with running balance." /><Passbook /></>; }
