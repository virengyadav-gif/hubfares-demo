'use client';
/** OTA-05 — Flight Details / Fare Details / Fare Rules / Baggage tabs. Rules come from one of the two approved profiles. */
import { useState } from 'react';
import { Plane, Luggage, Utensils } from 'lucide-react';
import { Tabs, Badge, cx } from '@/components/ui';
import { Price } from './currency';
import { inr, fmtTime, fmtDay, dur } from '@/lib/client';

export type Profile = { id: 'A_FLEXIBLE' | 'B_RESTRICTED'; version: number; label: string; cancellationSlabs: any[]; dateChangeSlabs: any[]; noShow: any; seatFee: any; ancillaries?: any };
const feeOrFree = (m: number | undefined) => (m === undefined ? 'On request' : m === 0 ? 'Free' : `from ${inr(m)}`);
const TF: Record<string, string> = { S0: '0 hrs to 2 hrs', S1: '2 hrs to 24 hrs', S2: '24 hrs or more' };
export function ProfileBadge({ id }: { id: string }) {
  return <Badge tone={id === 'A_FLEXIBLE' ? 'green' : 'amber'}>{id === 'A_FLEXIBLE' ? 'Flexible rules' : 'Restricted rules'}</Badge>;
}
export function RuleTables({ profile, route, currentSlab }: { profile: Profile; route: string; currentSlab?: string }) {
  const [t, setT] = useState<'cxl' | 'chg' | 'ns' | 'seat'>('cxl');
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2"><span className="rounded-md border-b-2 border-brand-500 bg-brand-50 px-2.5 py-1 text-sm font-bold text-brand-700">{route}</span><ProfileBadge id={profile.id} /><span className="text-xs text-muted">Fare rules v{profile.version}</span></div>
      <p className="mb-2 text-xs text-bad-600">* Time frame measured from the scheduled departure of each booked sector.</p>
      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-line text-center text-[12.5px] font-semibold sm:grid-cols-4" role="tablist">
        {([['cxl', 'Cancellation Fee'], ['chg', 'Date Change Fee'], ['ns', 'No Show Fee'], ['seat', 'Seat & Extras']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={t === k} onClick={() => setT(k)} className={cx('border-line px-2 py-2.5 transition sm:border-r last:border-r-0', t === k ? 'bg-brand-500 text-white' : 'bg-slate-50 text-navy hover:bg-slate-100')}>{l}</button>)}
      </div>
      <table className="mt-3 w-full overflow-hidden rounded-lg text-sm ring-1 ring-line">
        <thead className="bg-slate-50 text-left text-[12px] uppercase tracking-wide text-muted"><tr><th className="px-3 py-2">Time frame</th><th className="px-3 py-2">Rule</th></tr></thead>
        <tbody className="divide-y divide-line">
          {t === 'cxl' && profile.cancellationSlabs.map((s) => <tr key={s.id} className={cx(currentSlab === s.id && 'bg-brand-50')}><td className="px-3 py-2.5">{TF[s.id]}{currentSlab === s.id && <Badge tone="orange" className="ml-2">Applies now</Badge>}</td><td className="px-3 py-2.5 font-semibold tabular">{s.nonRefundable ? 'Non-refundable' : `${inr(s.supplierPenaltyMinor)} + ${inr(s.serviceFeeMinor)} fee`}</td></tr>)}
          {t === 'chg' && profile.dateChangeSlabs.map((s) => <tr key={s.id}><td className="px-3 py-2.5">{TF[s.id]}</td><td className="px-3 py-2.5 font-semibold tabular">{s.permitted ? `${inr(s.supplierPenaltyMinor)} + fare difference` : 'Not permitted'}</td></tr>)}
          {t === 'ns' && <tr><td className="px-3 py-2.5">After scheduled departure</td><td className="px-3 py-2.5 font-semibold">Non-refundable</td></tr>}
          {t === 'seat' && <>
            <tr><td className="px-3 py-2.5">Standard seat</td><td className="px-3 py-2.5 font-semibold tabular" data-testid="seat-standard">{feeOrFree(profile.seatFee?.standardFromMinor)}</td></tr>
            <tr><td className="px-3 py-2.5">Preferred seat</td><td className="px-3 py-2.5 font-semibold tabular">{feeOrFree(profile.seatFee?.preferredFromMinor)}</td></tr>
            <tr><td className="px-3 py-2.5">Extra-legroom seat</td><td className="px-3 py-2.5 font-semibold tabular">{feeOrFree(profile.seatFee?.extraLegroomFromMinor)}</td></tr>
            {profile.ancillaries && <>
              <tr><td className="px-3 py-2.5">Excess baggage</td><td className="px-3 py-2.5 font-semibold tabular">{inr(profile.ancillaries.excessBaggagePerKgMinor)} per kg</td></tr>
              <tr><td className="px-3 py-2.5">Pre-booked meal</td><td className="px-3 py-2.5 font-semibold tabular">{feeOrFree(profile.ancillaries.mealFromMinor)}</td></tr>
              <tr><td className="px-3 py-2.5">Name change</td><td className="px-3 py-2.5 font-semibold">{profile.ancillaries.nameChange}</td></tr>
            </>}
          </>}
        </tbody>
      </table>
      <ul className="mt-3 space-y-1 text-[12px] text-bad-600/90">
        <li>The airline fee is indicative and depends on the time of cancellation / re-issue under the booked fare rules.</li>
        <li>Mentioned fees are per adult passenger per sector. A “Refundable” brand label does not override the non-refundable window near departure.</li>
        <li>Seat and extras prices are indicative and depend on airline, aircraft and seat. Seat charges are not refundable.{profile.seatFee?.note ? ` ${profile.seatFee.note}` : ''}</li>
        <li>Apart from airline charges, applicable taxes and service charges may apply.</li>
      </ul>
    </div>
  );
}
export function FareDetailsTabs({ offer, brand, profile }: { offer: any; brand: any; profile: Profile }) {
  const [tab, setTab] = useState<'flight' | 'fare' | 'rules' | 'bag'>('rules');
  const c = brand.components;
  return (
    <div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'flight', label: 'Flight Details' }, { id: 'fare', label: 'Fare Details' }, { id: 'rules', label: 'Fare Rules' }, { id: 'bag', label: 'Baggage Information' }]} />
      <div className="pt-4">
        {tab === 'flight' && (
          <div className="flex items-start gap-4 text-sm">
            <Plane className="mt-1 h-5 w-5 text-brand-500" />
            <div className="flex-1 space-y-1">
              <div className="font-semibold">{offer.airlineName} · {offer.flightNumber} · {offer.aircraft}</div>
              <div>{offer.origin} {fmtTime(offer.departureAt, offer.originTz)} ({fmtDay(offer.departureAt, offer.originTz)}, {offer.originTz}) → {offer.destination} {fmtTime(offer.arrivalAt, offer.destinationTz)} ({fmtDay(offer.arrivalAt, offer.destinationTz)}, {offer.destinationTz})</div>
              <div className="text-muted">{dur(offer.durationMin)} · {offer.stops === 0 ? 'Non-stop' : `${offer.stops} stop via ${offer.via}`} · {offer.cabin.replace('_', ' ').toLowerCase()} · operated by {offer.operatingCarrier}</div>
            </div>
          </div>
        )}
        {tab === 'fare' && (
          <table className="w-full text-sm"><tbody className="divide-y divide-line">
            {[['Base fare', c.supplierBaseMinor], ['Taxes & fees', c.supplierTaxMinor], ['Platform fee', c.fixedFeeMinor], ['Platform fee (%)', c.percentFeeMinor], ['Service fee', c.disclosedServiceFeeMinor]].map(([k, v]) => <tr key={k as string}><td className="py-2 text-muted">{k}</td><td className="py-2 text-right tabular">{inr(v as number)}</td></tr>)}
            <tr><td className="py-2 font-bold">Agency price (per adult)</td><td className="py-2 text-right"><Price minor={brand.sellMinor} /></td></tr>
          </tbody><tfoot><tr><td colSpan={2} className="pt-2 text-[11.5px] text-muted">Hubfares net fare per adult. Your own resale markup is not included.</td></tr></tfoot></table>
        )}
        {tab === 'rules' && <RuleTables profile={profile} route={`${offer.origin}-${offer.destination}`} />}
        {tab === 'bag' && (
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-line p-3"><Luggage className="h-4 w-4 text-brand-500" /><div className="mt-1 text-muted">Check-in</div><div className="font-semibold">{brand.baggage.checkIn} per adult</div></div>
            <div className="rounded-lg border border-line p-3"><Luggage className="h-4 w-4 text-brand-500" /><div className="mt-1 text-muted">Cabin</div><div className="font-semibold">{brand.baggage.cabin}</div></div>
            <div className="rounded-lg border border-line p-3"><Utensils className="h-4 w-4 text-brand-500" /><div className="mt-1 text-muted">Meal</div><div className="font-semibold">{brand.meal ?? '—'}</div></div>
            {profile.ancillaries && <div className="rounded-lg bg-slate-50 p-3 text-xs text-muted sm:col-span-3">Excess baggage {inr(profile.ancillaries.excessBaggagePerKgMinor)} per kg · seats {feeOrFree(profile.seatFee?.standardFromMinor).toLowerCase()} (standard) · indicative, airline conditions apply.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
