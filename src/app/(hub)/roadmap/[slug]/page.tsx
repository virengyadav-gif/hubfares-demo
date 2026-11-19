import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader, Card, Badge, Notice } from '@/components/ui';
import { ROADMAP } from '../data';
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const r = ROADMAP.find((x) => x.slug === slug); if (!r) notFound();
  return (
    <div className="max-w-3xl">
      <Link href="/roadmap" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" />Roadmap</Link>
      <PageHeader title={r.title} subtitle={r.summary} badges={<><Badge tone="violet">Planned integration</Badge><Badge tone="gray">{r.phase}</Badge></>} />
      <Notice tone="warn" className="mb-5" title="Not connected">This is a preview of intended capability. No provider is contacted and no action here has any effect.</Notice>
      <div className="grid gap-5 sm:grid-cols-2"><Card title="Future workflow"><ol className="list-decimal space-y-1 pl-5 text-sm">{r.flow.map((f) => <li key={f}>{f}</li>)}</ol></Card><Card title="Production prerequisites"><ul className="list-disc space-y-1 pl-5 text-sm">{r.deps.map((d) => <li key={d}>{d}</li>)}</ul></Card></div>
    </div>
  );
}
