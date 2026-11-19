import Link from 'next/link';
import { Rocket } from 'lucide-react';
import { PageHeader, Card, Badge } from '@/components/ui';
import { ROADMAP } from './data';
export default function Roadmap() {
  return (
    <div>
      <PageHeader eyebrow="Roadmap" title="Future integrations & modules" subtitle="Labelled previews — none of these are connected or functional in this POC." badges={<Badge tone="violet">Planned integration</Badge>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{ROADMAP.map((r) => <Link key={r.slug} href={`/roadmap/${r.slug}`}><Card className="h-full transition hover:border-brand-300"><Rocket className="h-5 w-5 text-violet-600" /><div className="mt-2 font-semibold">{r.title}</div><p className="mt-1 text-sm text-muted">{r.summary}</p><div className="mt-3"><Badge tone="violet">{r.phase}</Badge></div></Card></Link>)}</div>
    </div>
  );
}
