'use client';
/** EXE-05 — Operations performance (live cases/bookings; some SLA examples seeded = guided). */
import { useApi } from '@/lib/client';
import { PageHeader, Loading, Kpi, Card, Table, Td, SimTag } from '@/components/ui';
import { ChartCard, CountBars, C } from '@/components/analytics';
export default function OpsPerf() {
  const { data } = useApi<any>('/executive/operations');
  if (!data) return <Loading />;
  return (
    <div>
      <PageHeader eyebrow="Executive" title="Operations performance" subtitle="Approvals, ticketing issues, case load and SLA from live records." />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Pending applications" value={data.pendingApplications} /><Kpi label="Avg approval time" value={data.avgApprovalHours === null ? 'N/A' : `${data.avgApprovalHours.toFixed(1)} h`} sub="Submission to decision" />
        <Kpi label="Open cases" value={data.openCases} sub={`${data.slaBreached} SLA breached`} tone={data.slaBreached ? 'bad' : 'brand'} /><Kpi label="Ticketing issues" value={data.ticketingIssues} sub={`${data.pendingTicketing} PNRs awaiting ticket`} tone="warn" /><Kpi label="Refunds pending supplier" value={data.refundsPendingSupplier} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Cases by status"><CountBars data={data.casesByStatus.map((x: any) => ({ name: x.status.toLowerCase().replace(/_/g, ' '), count: x.count }))} x="name" keys={[{ key: 'count', name: 'Cases', color: C.brand }]} /></ChartCard>
        <Card title="Workload by assignee" pad={false}><Table head={['Assignee', 'Open cases']}>{data.workload.map((w: any) => <tr key={w.assignee}><Td>{w.assignee}</Td><Td>{w.open}</Td></tr>)}</Table></Card>
      </div>
    </div>
  );
}
