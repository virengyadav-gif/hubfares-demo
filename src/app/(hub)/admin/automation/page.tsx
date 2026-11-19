'use client';
import { useState } from 'react';
import { Card, PageHeader, Toggle, SimTag, Notice } from '@/components/ui';
const RULES = ['Auto-assign chatbot refund cases to Operations queue', 'Alert Finance when a payment is unmatched for > 2 hours', 'Notify agency when wallet balance < ₹25,000', 'Escalate supplier refunds pending > 7 days', 'Auto-approval of applications after all mock checks are green (still requires checks)', 'Send booking confirmation by email / SMS / WhatsApp'];
export default function Page() {
  const [on, setOn] = useState<boolean[]>([true, true, false, true, false, false]);
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Admin" title="Workflow & notification settings" subtitle="Preview of configurable automations." badges={<SimTag kind="Guided demo" />} />
      <Notice tone="info" className="mb-4">Toggles here are an interactive preview and are not persisted. Real email/SMS/WhatsApp delivery and SLA automation are planned integrations; in-app notifications are live.</Notice>
      <Card>{RULES.map((r, i) => <div key={r} className="flex items-center justify-between border-b border-line py-3 last:border-0"><span className="text-sm">{r}</span><Toggle checked={on[i]} onChange={(v) => setOn(on.map((x, j) => (j === i ? v : x)))} /></div>)}</Card>
    </div>
  );
}
