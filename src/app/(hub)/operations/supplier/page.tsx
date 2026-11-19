'use client';
import { PageHeader, Notice } from '@/components/ui';
import { ClaimsBoard } from '@/components/finance/ClaimsBoard';
export default function Page() {
  return <><PageHeader eyebrow="Operations" title="Supplier refund reconciliation" subtitle="Compare expected vs received airline refunds against supplier statement entries. Aging counts from the date each refund claim was raised." /><Notice tone="info" className="mb-4">Under- or over-payment by the supplier creates an exception — amounts are never rounded silently. A supplier receipt never credits the agency wallet; the payout is a separate authorised step.</Notice><ClaimsBoard supplierFocus /></>;
}
