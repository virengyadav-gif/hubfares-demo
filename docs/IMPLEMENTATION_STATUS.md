# Hubfares POC — Implementation Status

Record date: 20 Nov 2026 · Fixture version `hubfares-v1.2-seed-003` · Release 2 (see `docs/CHANGES_R2.md`) · Status: **demo-ready POC, not production-ready.**

## Release 2 verification (executed 20 Nov 2026)

| Check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm test` (unit + integration, 11 files) | 94/94 pass |
| `npm run fixtures:validate` | 53/53 pass |
| `npm run build` | Pass |
| `E2E_USE_BUILD=1 npm run test:e2e` (run 3× consecutively) | 13/13 pass each run |
| `npm run demo:reset` | 28/28 oracle checks pass |
| `npm run smoke` | Pass |
| Page crawl, 7 roles, every menu page | 0 errors; no Demo/Simulated/Guided/mock/Sabre text on OTA pages (Sabre/PCC shown to Hubfares staff only, by design) |
| Production timings | page navigation 80–200 ms; API responses 4–20 ms |

New automated coverage: `partial-cancel.test.ts` (7), `amendments.test.ts` (5), `bulk-import.test.ts` (4), `approvals.test.ts` (4), `onboarding-v2.test.ts` (3), `credit-policies.test.ts` (4), report filters, granularity; E2E specs for partial cancel, date change, bulk import, maker-checker, reconciliation, request-info and specimen autofill.

Changed expectations (by request): 5 reports instead of 6; seed totals rebalanced (oracle above in CHANGES_R2); TC-054 now covers real date change + reissue; OTA no longer sees provider/meta "SIMULATED"; finance viewer lands on search.

---

## Release 1 record (19 Nov 2026)

This file records what was built and what was *executed* as evidence. It does not change the six controlling specs.

## 1. Executed verification (latest run)

| Check | Command | Result |
|---|---|---|
| Type safety | `npm run typecheck` | Pass (0 errors) |
| Fixture/oracle validation | `npm run fixtures:validate` | 53/53 pass |
| Unit + integration (API/service, temp SQLite) | `npm test` | 65/65 pass, 5 files |
| Production build | `npm run build` | Pass |
| Browser E2E (Chromium, prod build, own test DB) | `E2E_USE_BUILD=1 npm run test:e2e` | 9/9 pass |
| Demo reset with oracle | `npm run demo:reset` | 28/28 oracle checks pass |
| HTTP smoke vs running server | `npm run smoke` | Pass |
| Page crawl, 6 roles × all nav pages | ad-hoc Playwright crawl | 51 pages, 0 console/HTTP errors |

Opening oracle (verified by reset): GBV ₹256,200 · net revenue ₹5,941 · contribution ₹5,276 · cancellation rate 5/19 · void 1/19.

## 2. Gate table

| Gate | Implemented | IDs | Evidence | Status | Outstanding |
|---|---|---|---|---|---|
| 0 Inventory/reconcile | Specs, PRD, screenshots, seed contract read; conflicts logged (§6) | — | This file §6 | Done | — |
| 1 Foundation | Next.js 15 / TS strict / Tailwind 4 / SQLite-Drizzle, migrations, sessions, RBAC, idempotency, audit, deterministic seed + guard | WF-15, WF-16 | `fixtures:validate`, AUTH test, TC-008/009/018/027 | Done | — |
| 2 Onboarding & agency org | Partner register, PDF extraction (pdf text), mock KYC, Ops approve, agency users | WF-01..04 | TC-001..007, E2E S-A | Done | No image OCR (manual review path) |
| 3 Search, rules, quote | Mock Sabre search, two fare profiles, rules modal, FX display, core rules, markup UI (no effect), advanced drafts (never evaluated) | WF-07, 08, 17, 23 | TC-019..021, 029..032, E2E S-B/S-G, Trace spec | Done | — |
| 4 Booking/funding/ticket/passbook | Revalidate, price-change accept, PNR hold, ticket, wallet → credit allocation, payment matching, passbook | WF-05, 06, 09, 10 | TC-011..018, 022..027, 059, 060, E2E S-B | Done | — |
| 5 Cancel/refund/supplier/import | Slab calc from booking snapshot, claims, immediate vs supplier-settlement, receipt matching, payout, PNR import | WF-11..14 | TC-035..043, 060..062, E2E S-D/S-E | Done | `supplier_event_sky_003_short` not implemented (no amount in contract) |
| 6 Ops, CXO, reports, chat | Ops consoles, executive views (live KPIs), six static XLSX scoped server-side, scripted Help chat → cases | WF-18..22 | TC-044..053, 063, E2E S-J/S-K | Done | — |
| 7 Verify/present/package | Reset CLI + UI, smoke, E2E, handoff | — | §1, `HANDOFF.md` | Done | Operator rehearsal in meeting conditions by Ravi |

## 3. Test-case traceability (TC-001..064)

All 64 TCs have automated evidence. Files: `tests/unit/calc.test.ts`, `tests/integration/*.test.ts`, `tests/e2e/demo-flows.spec.ts`.

| TCs | Where |
|---|---|
| 001–010 | integration/onboarding-auth; E2E S-A, Isolation |
| 011–018, 022–027, 029–032, 059, 060 | integration/booking-finance; E2E S-B/S-G |
| 019–021 | integration/booking-finance; E2E S-B + Trace (both profiles) |
| 028, 034, 055 | E2E Trace spec |
| 033 | unit/calc (FX rounding) |
| 035–043, 060–062, 022 (service) | integration/cancel-import; E2E S-D, S-E |
| 044–054, 056, 057, 063, 064 | integration/reports-exec-support-reset; E2E S-J, S-K |
| 058 | E2E mobile 390px |

## 4. Scenarios S-A..S-M

| Scenario | Executed by | Result |
|---|---|---|
| S-A onboarding Bluebird | E2E | Pass |
| S-B Skyline book/ticket | E2E | Pass |
| S-C Orbit credit | integration (S-C/TC-017) | Pass |
| S-D A_FLEXIBLE S2 vs B_RESTRICTED S1 | E2E + integration | Pass |
| S-E import SBD101 once | E2E + integration | Pass |
| S-F core fee vs markup | integration TC-029/030 | Pass |
| S-G INR→USD→EUR | E2E | Pass ($340.36 / €291.74; ledger ₹30,632.50) |
| S-H payment matching | integration TC-011..013 + S-H | Pass |
| S-I guided amendment/manual order | integration TC-054 | Pass |
| S-J six XLSX | E2E + integration | Pass (100 / 40 / 35 / 25 rows) |
| S-K Help chat → case | E2E + integration | Pass |
| S-L KPIs move consistently | integration TC-047/048 | Pass |
| S-M reset | integration TC-056/057/064 + `demo:reset` | Pass |

## 5. F / G / R labels

- **F (functional on mock data):** onboarding, extraction, mock KYC, agency users, search, fare rules, quote/revalidate, booking/PNR/ticket, wallet, credit, payment matching, passbook, cancellation/refunds, supplier settlement, PNR import, core commercial rules, executive dashboards, reports download, Help chat & cases, audit, notifications, reset.
- **G (guided demo, labelled):** amendments, manual orders, supplier reconciliation, GDS/PCC queues, sample reports, automation toggles (not persisted).
- **R (roadmap preview, labelled "Planned integration"):** Travelport, Amadeus, insurance, inventory, ancillaries and other future modules.

## 6. Known limitations and reconciled conflicts

- All external systems are simulated: Sabre, bank/UTR, KYC, supplier, FX. No real money, tickets or identity checks.
- Image uploads: only the specimen PAN/Aadhaar cards are recognised (static values); other images route to manual review. PDFs use text extraction.
- Child/infant fares not offered (adults only).
- Void is only present in seeded history; live cancellations never offer void.
- `supplier_event_sky_003_short` from the contract is not implemented (no amount specified).
- Applicant emails (request info) are recorded and shown as sent; no real email is delivered.
- Chatbot unchanged in release 2 by request.
- Upload-notice wording follows the Product Spec / PRD where docs disagreed.
- Single SQLite file, single process; no horizontal scaling, backups or production security review.
