'use client';
import { PageHeader, Notice, SimTag } from '@/components/ui';
import { ClaimsBoard } from '@/components/finance/ClaimsBoard';
export default function Page() {
  return <><PageHeader eyebrow="Operations" title="Supplier refund reconciliation" subtitle="Compare expected vs received supplier refunds against preloaded statement events." badges={<SimTag kind="Guided demo" />} /><Notice tone="info" className="mb-4">Statement matching is a guided flow with persisted mock receipts. Real supplier remittances and bank reconciliation are planned integrations. Under/over-settlement creates an exception — never silent rounding.</Notice><ClaimsBoard supplierFocus /></>;
}
