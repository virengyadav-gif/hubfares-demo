'use client';
/** OTA / Ops / Executive reports — five report types, filtered on the server by date range and status. */
import { useState } from 'react';
import { FileSpreadsheet, Download } from 'lucide-react';
import { useApi } from '@/lib/client';
import { Card, Badge, Loading, ErrorBox, Modal, Button, Field, Select, Input } from '@/components/ui';
import { PeriodPicker, defaultPeriod, periodLabel, Period } from '@/components/analytics/period';

export function ReportsCatalog() {
  const { data, loading, error } = useApi<any>('/reports/catalog');
  const [period, setPeriod] = useState<Period>(defaultPeriod('90d'));
  const [pick, setPick] = useState<any>(null); const [status, setStatus] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const groups = ['Booking-based', 'Amendments-based'];
  const open = (r: any) => { setPick(r); setStatus(''); setFrom(period.from); setTo(period.to); };
  const href = pick ? `/api/v1/reports/${pick.type}/download?${new URLSearchParams(Object.entries({ from, to, status }).filter(([, v]) => v)).toString()}` : '#';
  return (
    <div className="space-y-5">
      <Card><div className="flex flex-wrap items-center justify-between gap-3"><div className="text-sm"><span className="text-muted">Scope:</span> <b>{data.scope}</b> <span className="mx-2 text-muted">·</span><span className="text-muted">Period:</span> <b>{periodLabel(period)}</b></div><PeriodPicker value={period} onChange={setPeriod} /></div></Card>
      {groups.map((g) => (
        <div key={g}><h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">{g}</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.reports.filter((r: any) => r.category === g).map((r: any) => (
              <Card key={r.type} className="flex flex-col">
                <div className="flex items-start justify-between"><FileSpreadsheet className="h-7 w-7 text-ok-600" /><Badge tone="gray">.xlsx</Badge></div>
                <div className="mt-3 font-semibold">{r.title}</div>
                <div className="text-xs text-muted">Statuses: {r.statuses.map((s: string) => s.replace(/_/g, ' ').toLowerCase()).join(', ')}</div>
                <div className="mt-2 line-clamp-2 text-[11.5px] text-muted">{r.columns.join(' · ')}</div>
                <Button className="mt-4" size="sm" variant="secondary" icon={<Download className="h-3.5 w-3.5" />} onClick={() => open(r)} data-testid={`report-${r.type}`}>Download</Button>
              </Card>
            ))}
          </div>
        </div>
      ))}
      <Modal open={!!pick} onClose={() => setPick(null)} title={`Download ${pick?.title ?? ''}`} footer={<><Button variant="secondary" onClick={() => setPick(null)}>Cancel</Button><a href={href} onClick={() => setTimeout(() => setPick(null), 300)} data-testid="download-confirm"><Button icon={<Download className="h-4 w-4" />}>Download XLSX</Button></a></>}>
        {pick && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3"><Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} name="report-from" /></Field><Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} name="report-to" /></Field></div>
            <Field label="Transaction status"><Select value={status} onChange={(e) => setStatus(e.target.value)} name="report-status" data-testid="report-status"><option value="">All statuses</option>{pick.statuses.map((s: string) => <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>)}</Select></Field>
            <p className="text-muted">Report: <b>{pick.title}</b> · scope <b>{data.scope}</b>. Leave dates empty to include all dates.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
