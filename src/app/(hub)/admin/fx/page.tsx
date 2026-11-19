'use client';
import { useApi } from '@/lib/client';
import { Card, PageHeader, Table, Td, SimTag, Notice } from '@/components/ui';
export default function Page() {
  const { data } = useApi<any[]>('/fx-demo-rates');
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Admin" title="FX adapter settings" subtitle="Display-only INR / USD / EUR conversion." badges={<SimTag kind="Planned integration" />} />
      <Card title="Seeded demo rate table" pad={false}><Table head={['Currency', 'INR per unit', 'Rate date', 'Source']}>{(data ?? []).map((r) => <tr key={r.quoteCurrency}><Td className="font-semibold">{r.quoteCurrency}</Td><Td className="tabular">{r.inrPerUnit}</Td><Td>{r.effectiveDate}</Td><Td>Demo rates (illustrative, not market)</Td></tr>)}</Table></Card>
      <Notice tone="info" className="mt-4" title="Roadmap">A provider FX adapter (and any Sabre/Travelport currency entitlement) is not connected. Conversion never changes booking, wallet, credit or settlement currency, nor point-of-sale.</Notice>
    </div>
  );
}
