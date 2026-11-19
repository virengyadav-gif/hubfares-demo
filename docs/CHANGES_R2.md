# Release 2 — change list (20 Nov 2026)

Implements the approved P0 / P1 / P2 list. The chatbot was intentionally left unchanged (only its example flight number text changed to match the new flight-number format).

| # | Change | Where |
|---|---|---|
| P0-1 | PNR split + partial cancellation: choose passengers; selected passengers move to a new PNR (`HFBxxxx-S1`, PNR `SBSxxx`) and are cancelled; others stay ticketed. Per-passenger penalty/refund. Multi-passenger seed bookings HFB1025 (2), HFB1026 (3), HFB1027 (2, Orbit), HFB1028 (2, Aster) | Booking detail › Cancel |
| P0-2 | Speed: production demo script (`npm run demo`), turbopack dev, "Loading, please wait…" overlay on navigation/slow actions, route loading states. Measured: pages < 200 ms, APIs < 20 ms in production | global |
| P0-3 | Removed Guided / Simulated / Demo Environment / Sample / Preloaded / mock labels and developer notes; data renamed (booking IDs HFBxxxx, refund IDs RFDxxxx, ticket nos 098-…, PCCs S9KY/O4RB/H7FA, UTRs, flight numbers, names without "(Demo)"). Placeholders kept | all screens |
| P0-4 | Every OTA role lands on Book a Flight; finance viewers can view fares but not book | login |
| P0-5 | Sabre/GDS/provider/PCC hidden from OTA search, booking list/detail, confirmation, tickets, import and API responses (still visible to Hubfares staff) | OTA |
| P0-6 | Menu: Manage Booking → **Booking Carts**, Amendments → **Manage Amendments**, Held Carts unchanged | OTA menu |
| P0-7 | GDS/PCC Queues, GDS/Supplier/PCC, Demo Control removed from menus (pages/services kept) | Hub menu |
| P0-8 | "Others" report removed everywhere (5 reports) | Reports |
| P0-9 | FX Adapter → **Manage Exchange** (rates now editable, audited) | Admin |
| P0-10 | Ticket issue: progress overlay with steps; button locked; idempotent server call | Book page |
| P0-11 / P1-35 | Request More Information: emails applicant (shown as "emailed to …"), status More info requested; verify / approve / reject / ask again stay available | Ops › Onboarding |
| P1-13 | Date range (prefilled) + Daily/Weekly/Monthly on executive views; reports filter by period | Executive, Reports |
| P1-14 | Seed rebalanced: every OTA now has positive net revenue/contribution; negative amounts shown in red (tables, KPIs, charts) | data, UI |
| P1-17 | Dashboard metrics state their period ("· Last 30 days", "· today", "· now") | OTA & Ops dashboards |
| P1-18 | Refund aging counted from the claim date (Raised + Age columns) | Supplier reconciliation, Executive |
| P1-19 | Reconciliation: Received → Awaiting Match / Matched / Unmatched / Rejected with exception reason | Ops › Payment Matching |
| P1-20 | Report downloads verified: report title, status column, period + status filters, hub-only supplier columns | Reports |
| P1-21 | Remaining wallet balance (and credit) shown after ticketing | Book page |
| P1-22 | Fare rules: seat (standard/preferred/extra-legroom), excess baggage, meal, name change | Fare rules |
| P1-23/24 | Real date change: pick date → quote (airline fee + fare difference + service fee) → confirm → charge, tickets exchanged & reissued; history timeline on every booking | Booking detail, Manage Amendments |
| P1-25 | Import PNR: all fields optional, list/filter by PCC, PNR, passenger, dates; select & bulk import; next steps per booking | Import PNR |
| P1-27 | Cancellation shows penalty breakup, expected refund, separate agency and airline refund statuses | Booking detail |
| P1-29 | Markup "Apply to users" removed — agency-level markup for all users | Manage Markup |
| P1-32 | Prepaid / daily / weekly credit: limits, utilisation, overdue, automatic block and unblock verified by tests | tests |
| P1-34 | Specimen PAN card and Aadhaar card images that autofill registration (static values) | `fixtures/documents`, register page |
| P2-42 | Maker-checker: credit-policy changes and booking blocks go to the CXO; applied only after approval; requester cannot approve | Admin › Credit & Payment, Executive › Approvals |
| — | Children field alignment fixed; "Fares: N/A in demo" removed | Search |
| — | Held Carts now lists real PNRs on hold; Automation settings persist | OTA, Admin |

Seed oracle (v1.2-seed-003, fixed anchor): GBV ₹4,61,200 · net revenue ₹24,341 · contribution ₹23,536 · 23 ticketed / 5 cancelled / 1 voided.
