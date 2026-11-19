'use client';
import { useApi } from '@/lib/client';
import { Card, PageHeader, Table, Td, Badge, SimTag, Notice } from '@/components/ui';
export default function Page() {
  const ag = useApi<any[]>('/agencies').data;
  const PCC = [['SABRE', 'H7FA', 'Hubfares + permitted Skyline/Orbit/Aster', 'Mock · available'], ['SABRE', 'S9KY', 'Skyline Travels only', 'Mock · available'], ['SABRE', 'O4RB', 'Orbit Corporate only', 'Mock · available'], ['TRAVELPORT', 'T1PA', '—', 'Planned integration'], ['AMADEUS', 'A1MA', '—', 'Planned integration']];
  return (
    <div>
      <PageHeader eyebrow="Admin" title="GDS / supplier / PCC setup" subtitle="Provider adapters and pseudo-city code mappings." badges={<SimTag kind="Guided demo" />} />
      <div className="mb-5 grid gap-4 md:grid-cols-3">{[['Sabre', 'Mock adapter active — deterministic seeded search, PNR, ticket and retrieve.', 'amber', 'Simulated'], ['Travelport', 'Adapter interface ready; no credentials, content or certification.', 'violet', 'Planned integration'], ['Amadeus', 'Adapter interface ready; no credentials, content or certification.', 'violet', 'Planned integration']].map(([n, d, t, l]) => <Card key={n}><div className="flex items-center justify-between"><b>{n}</b><Badge tone={t}>{l}</Badge></div><p className="mt-2 text-sm text-muted">{d}</p></Card>)}</div>
      <Card title="PCC mappings (invented demo identifiers)" pad={false}><Table head={['Provider', 'PCC', 'Agency scope', 'Status']}>{PCC.map((p) => <tr key={p[1]}><Td className="font-semibold">{p[0]}</Td><Td className="font-mono">{p[1]}</Td><Td>{p[2]}</Td><Td><Badge tone={p[3].startsWith('Planned') ? 'violet' : 'amber'}>{p[3]}</Badge></Td></tr>)}</Table></Card>
      <Notice tone="info" className="mt-4">Suppliers: Sabre-routed settlements (mock), Consolidator A/B (mock). {ag?.length ?? 0} agencies configured. No live GDS connection or credentials exist in this POC.</Notice>
    </div>
  );
}
