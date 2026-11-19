import { openDb } from '../src/server/db/client';
import { overview, cancellations, creditRisk } from '../src/features/executive/service';
const h = openDb('/home/claude/hubfares-poc/data/hubfares-demo.sqlite');
const o = overview(h.db as any, {});
const pick = (k: any) => ({ gbv: k.grossBookingValueMinor/100, net: k.netPlatformRevenueMinor/100, contrib: k.estimatedContributionMinor/100, retained: k.retainedAgencySalesMinor/100, pending: k.agencyRefundPendingMinor/100, recv: k.supplierReceivableMinor/100 });
console.log('TOTAL', pick(o.total));
for (const a of o.byAgency) console.log(a.agencyName, pick(a), 'overdue', a.overdueMinor/100, 'blocked', a.creditBlocked, 'wallet', a.walletCashMinor/100);
const r = creditRisk(h.db as any); console.log('unmatched', r.unmatchedPayments.map((p:any)=>[p.ref,p.status,p.reason]));
