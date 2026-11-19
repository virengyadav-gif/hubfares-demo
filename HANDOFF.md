# Hubfares POC — Handoff (release 2, 20 Nov 2026)

B2B travel platform POC on simulated suppliers (no real tickets, payments or identity checks). Evidence: `docs/IMPLEMENTATION_STATUS.md`. Change list: `docs/CHANGES_R2.md`.

## Start — use production mode for demos (fast)

```bash
cd hubfares-poc
cp .env.example .env          # first time only
npm install
npm run demo                  # reset data + production build + start → http://localhost:3000
```

`npm run dev` is for development only: every page compiles on first visit (2–6 s), which is what made clicks feel slow. Production mode serves pages and API calls in milliseconds.

Already built? `npm run demo:reset && npm start`. Check a running server: `npm run smoke`.

## Accounts (password for all: `Hubfares@Demo2026`)

| Email | Role | Use for |
|---|---|---|
| superadmin@hubfares.example.com | Super Admin | Credit changes (sent for approval), all admin |
| finance@hubfares.example.com | Hub Finance | Credit, refunds, commercials, payments |
| ops@hubfares.example.com | Hub Operations | Onboarding, bookings, refunds, cases, import |
| cxo@hubfares.example.com | CXO | Executive dashboards, **Approvals** |
| admin@skyline.example.com / agent@skyline.example.com | Skyline (prepaid) | Book, partial cancel, date change, import |
| admin@orbit.example.com / agent@orbit.example.com | Orbit (weekly credit, immediate refunds) | Credit booking |
| admin@aster.example.com / finance@aster.example.com | Aster (daily credit, overdue-blocked) | Finance viewer, credit block |

All OTA users land on **Book a Flight** after sign-in.

## Sample documents for onboarding

In `fixtures/documents/` (also in `samples/` at the zip root):
- `sample-pan-card.png` → fills PAN, agency name, entity type
- `sample-aadhaar-card.png` → fills director name, salutation, address, city, state, PIN (masked number shown)
- `sample-company-registration.pdf` → fills registration no., GSTIN, contacts

Values are static (no live extraction) and stay marked *Extracted* until Hubfares verifies them.

## Presentation sequence (~30 min)

1. **Onboarding** — `/partner/register`, upload the PAN + Aadhaar samples → fields fill automatically. Submit. As Ops: *Request info* (shows "emailed to …"), then verify PAN + identity and approve — all actions stay available.
2. **Search & book** — Skyline agent lands on Book a Flight; BOM → London, fare rules (incl. seat/baggage charges), INR/USD/EUR, revalidate, PNR, **Issue ticket** (progress overlay, double-click safe) → remaining wallet balance shown.
3. **Partial cancellation** — Booking Carts → **HFB1026** (3 passengers) → Cancel → keep only *Ms Pooja Khanna* ticked → PNR is split to a new PNR, one passenger cancelled, two stay ticketed. Per-passenger penalty breakup; agency and airline refund statuses shown separately. (HFB1025 = 2 pax Skyline, HFB1027 = 2 pax Orbit immediate refund.)
4. **Date change** — Manage Amendments → pick a booking → choose new date → charges (airline fee + fare difference + service fee) → confirm → tickets reissued; History tab shows the reissue.
5. **Import PNR** — leave all fields empty → list of all PNRs; or PCC `S9KY` only; select several → *Import selected*. Duplicates are blocked.
6. **Payments** — Ops › Payment Matching: Received / Awaiting Match / Matched / Unmatched with reasons.
7. **Maker-checker** — Super Admin › Credit & Payment → change Orbit limit → *Submit for approval*. CXO › Approvals → Approve → applied.
8. **Executive** — date range (prefilled Last 30 days) + Daily/Weekly/Monthly; negatives in red; refund aging from claim date.
9. **Reports** — five reports, period + status filters, download XLSX.
10. **Reset** — `npm run demo:reset` (Demo Control is hidden from the menu; page still at `/admin/demo`).

## Reset & recovery

- CLI: `npm run demo:reset` (refuses non-demo DBs; must print "Reset OK").
- Corrupted DB: stop the server, delete `data/hubfares-demo.sqlite*`, run `npm run demo:reset`.

## Tests

```bash
npm run typecheck && npm test && npm run fixtures:validate
npm run build && E2E_USE_BUILD=1 npm run test:e2e     # own DB on port 3100
```

## Disclosure for clients

"Proof-of-concept on simulated airline, bank, KYC and supplier connections. No real bookings, payments, tickets or identity checks are performed."
