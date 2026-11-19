'use client';
/** OTA-15 / OTA-23 — six static sample XLSX reports; the same catalogue is reused in Ops and Executive. Server-scoped. */
import { useState } from 'react';
import { FileSpreadsheet, Download } from 'lucide-react';
import { useApi, fmtDate } from '@/lib/client';
import { Card, Badge, Notice, Loading, ErrorBox, Modal, Button, SimTag } from '@/components/ui';

export function ReportsCatalog() {
  const { data, loading, error } = useApi<any>('/reports/catalog');
  const [pick, setPick] = useState<any>(null);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const groups = ['Booking-based', 'Amendments-based'];
  return (
    <div className="space-y-5">
      <Notice tone="warn" title="Preloaded sample report - static illustration; dashboard totals update during the demonstration.">Frozen snapshot {fmtDate(data.snapshotAt)} · scope: <b>{data.scope}</b>. Files are generated and scoped on the server; they do not refresh after demo bookings or refunds. The Passbook and dashboards are live.</Notice>
      {groups.map((g) => (
        <div key={g}><h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">{g}</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.reports.filter((r: any) => r.category === g).map((r: any) => (
              <Card key={r.type} className="flex flex-col">
                <div className="flex items-start justify-between"><FileSpreadsheet className="h-7 w-7 text-ok-600" /><SimTag kind="Sample extract" /></div>
                <div className="mt-3 font-semibold">{r.title}</div>
                <div className="text-xs text-muted">{r.rowCount} rows · .xlsx · {r.filename}</div>
                <div className="mt-2 line-clamp-2 text-[11.5px] text-muted">{r.columns.join(' · ')}</div>
                <Button className="mt-4" size="sm" variant="secondary" icon={<Download className="h-3.5 w-3.5" />} onClick={() => setPick(r)} data-testid={`report-${r.type}`}>Download</Button>
              </Card>
            ))}
          </div>
        </div>
      ))}
      <Modal open={!!pick} onClose={() => setPick(null)} title={`Download ${pick?.title}`} footer={<><Button variant="secondary" onClick={() => setPick(null)}>Cancel</Button><a href={pick ? `/api/v1/reports/${pick.type}/download` : '#'} onClick={() => setTimeout(() => setPick(null), 300)} data-testid="download-confirm"><Button icon={<Download className="h-4 w-4" />}>Download XLSX</Button></a></>}>
        {pick && <div className="space-y-2 text-sm"><div className="flex gap-2"><Badge tone="amber">Sample extract</Badge><Badge tone="gray">{pick.rowCount} rows</Badge></div><p>Row scope: <b>{data.scope}</b>.</p><p className="text-muted">Snapshot {fmtDate(data.snapshotAt)}. Synthetic data; not a live export.</p></div>}
      </Modal>
    </div>
  );
}
