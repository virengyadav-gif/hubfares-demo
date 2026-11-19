'use client';
import { PageHeader } from '@/components/ui';
import { ClaimsBoard } from '@/components/finance/ClaimsBoard';
export default function Page() { return <><PageHeader eyebrow="Operations" title="Refund applications" subtitle="Live claims from confirmed cancellations. Payout timing follows each booking's snapshotted policy." /><ClaimsBoard /></>; }
