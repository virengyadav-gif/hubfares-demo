# HUBFARES - Build, Test & Demo Execution Runbook

> **Document ID:** HF-BTD-004  
> **Version:** 1.1.1 - post-audit corrected runbook for approved Hubfares PRD v1.1  
> **Status:** Implementation and execution instructions, not a claim that code or tests already exist  
> **Audience:** Development agent, technical reviewer, demonstrator, and QA operator  
> **Target:** One-day capability POC; reliable local demo takes precedence over incomplete breadth

## 0. Authority, scope and definitions

**Read in this order before implementation:**

1. [`01_PRODUCT_SPEC.md`](01_PRODUCT_SPEC.md) - **what** the product does: roles, screens, 23 workflows (`WF-01..WF-23`), business rules, 25 acceptance checks (`AC-001..AC-025`), and scenarios (`S-A..S-M`).
2. [`02_TECHNICAL_DESIGN.md`](02_TECHNICAL_DESIGN.md) - **how** it works: Next.js/TypeScript/SQLite modular monolith, API contracts, money, transactions, authorization, event/mocks.
3. [`03_DEMO_DATA_AND_MOCKS.md`](03_DEMO_DATA_AND_MOCKS.md) - **with what data**: stable fixture IDs, exact two fare profiles, rates, mock outcomes, reports and scenario inputs.
4. **This file** - **in what sequence** to implement, prove, rehearse, reset and recover.

The approved Word document at `../references/Approved_PRD_v1.1.docx` is the baseline. **The two enumerated POC clarifications in Product Spec §13.1 are already resolved across the package. For any new disagreement, do not silently choose:** record the exact sections and stop work on that affected requirement until approved. This runbook may define test mechanics and prioritization, but **must not create or alter product requirements, money formulas, demo fixtures or APIs**.

**Delivery labels:** `F` = functional simulation with persistent shared data; `G` = explicitly guided scenario/preview; `R` = roadmap preview, not a functioning external integration. This POC uses **no actual GDS, PAN/Aadhaar, bank or supplier connections**. Never show a fake provider confirmation as live.

**Critical distinctions:** Agency downstream markup is **UI-only**; Hubfares simplified core commercials affect **new quotes only**. Exactly **two** synthetic fare-rule profiles. INR/USD/EUR is **display conversion only**. Six XLSX report datasets are **frozen**, role-scoped examples; **passbook and CXO dashboards are live** against demo database state. The OTA support chatbot is scripted, not an LLM, and a support case **does not** cancel a booking or issue a wallet refund.

### 0.1 Deliverables produced by the development agent

- Runnable, type-safe application source, dependency lockfile and migrations.
- Persistent, seeded SQLite **demo** DB and account/agency isolation.
- All approved `F` workflows; meaningful, clearly labeled `G` and `R` experiences.
- Mock adapter implementation and repeatable failure toggles, no live outbound provider calls.
- Actual structured fixture files, sample documents, six real `.xlsx` reports, seed/reset/validation scripts.
- Automated tests, browser E2E tests, manual QA checklist and demo scenario launcher/reset.
- Local start instructions, working demo accounts, scenario map, known limitations and build evidence.

### 0.2 What counts as working

| Label | Required evidence | Not sufficient |
|---|---|---|
| `F` | Form/API validates; authorized action writes canonical data; refresh preserves change; linked screens update; negative path is safe; relevant tests pass | Clickable mockup, toast with no data mutation |
| `G` | Guided inputs, believable deterministic sample outcome, clear `Guided demo` notice; no false provider effect | Dead navigation or unlabeled simulated execution |
| `R` | Meaningful preview explaining intended workflow, missing integration and production prerequisites | Disabled button without explanation, "Connected" status |
| Cross-module | A booking/refund/payment appears correctly in OTA, Operations, ledger and CXO (where applicable) | Independent hardcoded cards or inconsistent totals |

### 0.3 One-day strategy and time policy

The one-day goal is a **capability demonstration**, not production delivery. Implement vertical business slices and make them demonstrably correct before polishing later modules. Do not promise an hours estimate or infer that all F work is automatically complete inside the day. When schedule slips, follow the explicit reduction rules in Section 4, with status recorded as incomplete; **do not silently downgrade an F feature to G**.

---

## 1. Build gates and implementation order

### Gate 0 - Inventory, reconcile, start clean

**Tasks**

- [ ] Read all four reference documents and enumerate the 23 workflows, 25 acceptance checks and screen IDs.
- [ ] Initialize issue/deviation register with columns `ID | Requirement | Source | Decision needed | Owner | Status`; do not guess business policy.
- [ ] Confirm chosen stack/versions from Technical Design; do not introduce an alternative framework casually.
- [ ] Add application skeleton and `.env.example` in mock mode; protect `.env.local`.
- [ ] Decide deterministic test DB path **separate from demo DB** and reserve seed manifest version `hubfares-v1.1-seed-002` plus included `fixtures/seed-contract.v1.json` as the opening-data oracle.
- [ ] Ensure reference screenshots are design inspiration, not reused logos/assets without authorization.

**Exit gate:** repository boots, basic route is reachable, docs are in place, user-visible `Demo Environment` label exists, no provider credentials required.

### Gate 1 - Foundation, identity, fixtures and persistent state

**Tasks**

- [ ] Initialize Next.js + TypeScript + Tailwind + configured component/chart packages, validation and tests.
- [ ] Create database migrations from Technical Design, not an independent schema invented from UI needs.
- [ ] Implement seeded login/logout, server-validated session, role guards, agency scope, active/suspended checks.
- [ ] Implement domain repositories/services and standard response/error envelope.
- [ ] Generate canonical fixture JSONs and `demo_metadata`; implement `fixtures:validate`.
- [ ] Implement atomic seed/reset with deterministic stable IDs and isolated test DB.
- [ ] Generate six actual `.xlsx` files from frozen report fixtures; verify workbook validity.
- [ ] Establish logging/audit events and idempotency-key persistence for consequential actions.

**Exit gate:** test login for Hub Admin, Ops, CXO, Skyline, Orbit and Aster; across-agency request denied; two resets with fixed clock yield identical seed; all six workbook fixtures parse; schema/fixture validator passes.

### Gate 2 - Onboarding and agency organization (`WF-01..WF-04`)

**Tasks**

- [ ] Build public registration with fields and upload-assist notice displayed **before** upload.
- [ ] Handle supported synthetic document upload, extraction, provenance, low-confidence review and user confirmation.
- [ ] Keep extracted status separate from simulated KYC Verified; mock PAN/Aadhaar outcomes and green ticks only after mock verification.
- [ ] Build pending application queue; approve/reject/request info; activate agency + initial admin **once**.
- [ ] Build agency sub-user creation, role/permission edits and deactivation; enforce server-side ownership.

**Exit gate:** use `S-A` to create/approve an agency, log in as its admin, create sub-user, then try cross-agency lookup; AC-001..003 pass.

### Gate 3 - Search, fare rules and quote (`WF-07`, `WF-08`, `WF-17`, `WF-23`)

**Tasks**

- [ ] Build Sabre **mock** flight search, filters, brands, sorting, date strip, empty/loading/error states.
- [ ] Render Fare Details, Fare Rules, Baggage and Flight Details; show only two predefined profiles `A_FLEXIBLE`, `B_RESTRICTED`.
- [ ] Use exact slab values/boundaries from Technical Design and Data & Mocks; show cancellation/change/no-show/seat tabs on **each** fare option.
- [ ] Implement deterministic **core Hubfares** pricing rule matching; affect subsequent quotes but preserve historical snapshots.
- [ ] Add INR/USD/EUR selector to Results, Fare Details, Review and Confirmation; retain INR in persisted quote, booking and ledger.
- [ ] Build Agency Admin **Manage Markup UI-only** saving/editing/disabling; deliberately keep it outside pricing code paths.
- [ ] Build guided advanced commercial builder (include/exclude, priority, `BF/TF` draft strings, history); **never evaluate** expression strings.

**Exit gate:** offer `offer_005` and profiles render expected slabs; `S-F` and `S-G` pass; AC-006,007,014..017 pass; tests confirm markup and advanced drafts cannot change quotes.

### Gate 4 - Booking, funding, ticket and passbook (`WF-05`, `WF-06`, `WF-09`, `WF-10`)

**Tasks**

- [ ] Implement wallet ledger, distinct credit ledger, available funds, holds, overdue restrictions and immutable postings.
- [ ] Implement simulated bank event matching, exception queue, idempotent wallet credit and duplicate replay control.
- [ ] Implement quote revalidation: same price, changed price requiring acceptance, expired/failed offer.
- [ ] Build traveler review/confirmation, funding reservation, PNR creation, **separate** ticket issuance, hold consumption/release.
- [ ] Implement booking list/detail, filters and Ops all-agency view with tenant authorization.
- [ ] Ensure passbook, wallet, Ops and CXO queries read same persisted booking/finance state.

**Exit gate:** `S-B`, `S-C`, `S-H` work after refresh; booking failure releases funding hold; repeated issue/match does not duplicate money or ticket; AC-004,005,008..010 pass.

### Gate 5 - Cancellation, refunds, supplier states and PNR import (`WF-11..WF-14`)

**Tasks**

- [ ] Quote cancellation from booked fare-rule snapshot and **exact boundary** by scheduled departure instant.
- [ ] Display supplier penalty separately from disclosed service fee, refundable component and estimated agency refund.
- [ ] Implement cancel/void eligibility and confirmation with one cancellation case/claim.
- [ ] Apply OTA policy: Skyline/Aster supplier-settlement route; Orbit immediate-if-eligible route.
- [ ] Keep supplier receipt/receivable separate from agency payout; distinct idempotency keys for each.
- [ ] Build mock PNR retrieval with GDS + PCC + PNR scope and nonduplicated import commit.
- [ ] Hook refund/PNR outcomes into agency and Operations views, passbook and executive aggregates.

**Exit gate:** `S-D`, `S-E` pass; two time profiles, both refund modes, already-cancelled, unknown/wrong PCC and duplicate imports handled; AC-011..013 pass.

### Gate 6 - Operations, CXO, reports and chat (`WF-18..WF-22`)

**Tasks**

- [ ] Build Operations approval/refund/payment/support queues with linked record IDs.
- [ ] Build executive booking-cohort KPIs, agency profit ranking, cancellation/refund trends, credit/financial-risk views and drilldowns.
- [ ] Implement authorized six-report catalogue/download service; OTA export filtered **server-side**; frozen snapshot distinct from live BI.
- [ ] Build OTA-only finite-state Help drawer: language selection; nested refund/status/flight/change/modify/complaint/more menus; Back/Restart/Close; owned PNR/case lookup.
- [ ] Create one persisted support case after explicit confirmation; same `case_id` visible in Operations; **no financial/airline mutation**.
- [ ] Build guided/manual order, amendments, rebooking, supplier reconciliation, carts, GDS/PCC and roadmap previews with honest labels.

**Exit gate:** `S-I`, `S-J`, `S-K`, `S-L` work, including role denial and live/static distinction; AC-018..023 pass.

### Gate 7 - Verification, presentation and packaging

**Tasks**

- [ ] Run typecheck/lint/build, fixture validation, unit, API integration and browser E2E tests.
- [ ] Rehearse `S-A..S-L` in order with fresh reset; capture outcomes, including failure cases.
- [ ] Perform final reset and run `S-M`, then inspect all dashboards, ledgers and report downloads.
- [ ] Review desktop view and mobile OTA flow; inspect visual references against clean orange/charcoal/white design.
- [ ] Validate `F/G/R` status labels and ensure no live integration claims appear.
- [ ] Document evidence, unresolved issues, exact start credentials procedure, tested URLs, fixture anchor, known limitations and fallback plan.

**Exit gate:** Section 8 readiness checklist passes, or deliver a truthful **partial POC** with explicitly listed incomplete F items.

---

## 2. Build traceability: vertical slices and ownership

Only Product Spec defines user behavior; only Technical Design owns implementation mechanics and financial formulas. This map tells the agent **what to implement together** to avoid disconnected pages.

| Slice | Workflow(s) | Screens / services | Canonical records updated | Gate |
|---|---|---|---|---|
| Agency setup | WF-01..04 | ONB-01..03; OPS-02/03; OTA-02 | Application, DocumentExtraction, Verification, Agency, User, Audit | 2 |
| Flight shopping | WF-07,08,23 | OTA-03..05/22; search/FX adapters | SearchEvent, Quote selection; no ledger | 3 |
| Commercial configuration | WF-17,22 | ADM-03/08; OTA-19 | Core commercial version; separate markup UI/drafts | 3/6 |
| Payment and credit | WF-05,06 | OTA-12/13; OPS-07; ADM-02 | PaymentEvent, Match, WalletLedger, CreditPolicy | 4 |
| Book and ticket | WF-09,10 | OTA-06..09; OPS-05 | QuoteSnapshot, Booking, FundingReservation, Ticket, Ledger | 4 |
| Cancellation | WF-11,12 | OTA-10/11; ADM-04; OPS-06 | CancelCase, RefundClaim, WalletLedger, SupplierReceivable | 5 |
| Supplier settlement | WF-13 | OPS-08 | Guided supplier receipt and exception | 5/6 |
| Offline import | WF-14,15 | OTA-14; OPS-10 | ImportLookup, ImportedBooking / guided ManualOrder | 5/6 |
| Guided servicing | WF-16 | OTA-17/18; OPS-09 | Guided Amendment/Cart case | 6 |
| Reports and BI | WF-18,19 | OTA-15/23; EXE-01..05 | Frozen XLSX reads; live aggregate queries | 6 |
| OTA Help to Ops | WF-20,21 | OTA-20/21; OPS-12/13 | HelpSession, SupportCase, CaseHistory | 6 |
| Config impact | WF-22 | ADM-02..04; OTA/CXO | Prospective policies, live derived displays | 3-6 |

**Invariant:** `AgencyId` is present on tenant-owned entities; all sensitive record access uses the authenticated server session, not an arbitrary user-supplied agency parameter.

---

## 3. Continuous development discipline

### 3.1 Slice completion procedure

For each gate/slice:

1. Write/confirm the relevant test expectation from Product Spec acceptance `AC-...` and this runbook `TC-...`.
2. Implement database/schema/API/service changes before binding the UI to them.
3. Run small targeted automated tests and a real browser journey; do not use direct DB row editing to fake UI success.
4. Inspect audit/events, money arithmetic, role and tenant scope after mutations.
5. Refresh, log out/in, and re-open affected UI. Values must survive without separate localStorage balances.
6. Update implementation status table: `F complete`, `F partial`, `G done`, `R preview done`, `blocked`, with evidence and affected AC numbers.
7. If a flow breaks another feature, fix the contract/test before moving to the next gate.

### 3.2 No shortcuts that invalidate the demo

- Never copy fixture balance into dashboard state and then mutate it independently.
- Never show ticket number on a PNR-only, ticket-pending or booking-failed record.
- Never treat uploaded/document-extracted PAN as automatically verified.
- Never interpret agency markup or advanced commercial expressions as executable pricing.
- Never convert INR display equivalents into ledger currency or POS market fares.
- Never route an OTA support chatbot case directly to a GDS cancellation/refund service.
- Never publish all-agency XLSX to OTA browsers and filter with JavaScript.
- Never imply frozen report files refresh when a new ticket/refund is created.
- Never bypass server authorization just to make demo role switching easier.
- Never claim tests passed unless the implemented app was actually run and test evidence recorded.

### 3.3 Environment and scripts contract

These commands are **required targets**, not assertions that a code repository already implements them. Implement scripts per Technical Design §12 and Data & Mocks §1:

```bash
npm install
npm run db:migrate
npm run fixtures:validate
npm run reports:build
npm run seed
npm run dev
npm run test
npm run test:e2e
npm run demo:reset
npm run build
npm run start
```

Recommended additional commands: `npm run typecheck`, `npm run lint`, `npm run test:integration`, `npm run smoke`. Any replacement names **must be reconciled in README and automation**, never left undocumented.

**Mock environment example (development only; see Technical Design §12.1):**

```dotenv
NODE_ENV=development
DEMO_MODE=mock
DEMO_AUTH_MODE=seeded
DEMO_CLOCK_MODE=system
DEMO_RESET_ENABLED=true
DATABASE_URL=file:./data/hubfares-demo.sqlite
APP_BASE_URL=http://localhost:3000
LOG_LEVEL=info
```

- Use `DEMO_CLOCK_MODE=fixed` plus explicit `DEMO_FIXED_NOW` for deterministic test assertions; never presume current system date equals the fixture example date.
- Use an isolated temporary database per automated test suite; never run destructive test-reset against the demonstration database.
- `npm run demo:reset` must require explicit confirmation/authorization and **must fail outside mock mode** or if DB path is not allowlisted.
- Migrations, fixture validation, seed and report generation should fail nonzero with an actionable error if inputs are inconsistent.
- A session-signing secret belongs only in ignored local env, not committed fixture data.

### 3.4 Verification methods

| Layer | Test runner / evidence | What it proves |
|---|---|---|
| Static | TypeScript, lint, production build | Interfaces and package integration compile |
| Pure unit | Vitest/Jest or equivalent | Slab boundaries, FX, pricing, ledger and KPI arithmetic |
| API/DB integration | Isolated SQLite and route requests | Authorization, mutations, idempotency, rollback and persistence |
| Browser E2E | Playwright or equivalent | User journey, visible behavior, filters, downloads, navigation |
| Manual visual | Desktop and mobile viewport inspection | Fare-rule details, card density, overlays, chat and readable tables |
| Operator rehearsal | S-A..S-M checklist | Demo story can be repeated in meeting conditions |

Do not substitute screenshot-only testing for API/DB assertions on financial or tenancy flows.

---

## 4. Prioritization and permissible cuts

### 4.1 Hard delivery spine - must not be disconnected

1. Registration → extract/review → Operations approval → agency activation and sub-user permissions.
2. Search → fare card/rules → revalidation → PNR → separate ticket issuance.
3. Wallet funding/credit eligibility → funding reservation → settlement/posting → passbook.
4. Booking detail → cancellation quote → agency-specific refund state → wallet/supplier separation.
5. Imported PNR → stored booking, idempotent duplicate handling.
6. Admin simplified commercial → **new quote** pricing; OTA markup **UI-only**.
7. Executive profitability/cancellation/credit from shared records and read-only CXO role.
8. Display-only FX and two static fare-rule profiles in booking journey.
9. Six real agency-scoped static XLSX downloads.
10. OTA Help → owned PNR → confirmed case → same case in Ops.

### 4.2 Reduce implementation depth in this order if blocked

1. Inventory/insurance/cabs/ancillaries roadmap aesthetics (keep a brief honest preview).
2. Advanced commercial builder history polish (keep selection/draft UI and `Guided demo` label).
3. GDS queue/PCC visualization details (keep an accurate mock-provider status).
4. Operations SLA/chart animation (keep cases and meaningful status).
5. Guided amendment/rebooking/manual-order depth (keep end-to-end illustrated outcome, not live airline mutations).
6. Additional chart variants and filters beyond approved critical KPI drilldowns.
7. Nonessential responsive refinements **after** core desktop and OTA mobile usability.

**No automatic reclassification:** If an approved F flow cannot be completed, label it `Incomplete functional simulation`, record its failing `AC`/`TC` IDs, and show a fallback only if client explicitly knows it is a limited demonstration. Do **not** declare a static screenshot to be the accepted workflow.

### 4.3 Stop-and-escalate conditions

Stop the **affected** implementation (continue independent modules) when any of these occur:

- Documents disagree on a business amount/rule, status transition, provider integration claim or tenant permission.
- A core financial rule cannot reconcile to recorded ledger/booking data.
- A seeded example uses a real PAN/Aadhaar/bank/credential or is otherwise unsafe.
- A requested action would allow cross-OTA access or generate duplicate wallet/refund postings.
- External access is requested but credentials/authorization and explicit product approval are missing.
- A proposed new feature changes approved F/G/R boundaries.

Record: source reference, observed ambiguity, proposed options, blocked slice, suggested safe next step. Do not substitute speculative production behavior.

---

## 5. Automated and manual test suite

### 5.1 Conventions and fixtures

Each `TC-xxx` is a mandatory validation case unless explicitly tagged `Visual/Guided`. `AC-xxx` maps to Product Spec §14. `S-*` maps to Data & Mocks §15. Tests must use controlled clock, fresh isolated database and stable seeded identifiers.

**Test result fields:** `TC ID | AC link | Test type | Input/fixture | Expected API+UI+DB | Actual | Pass/Fail/Blocked | Evidence | Issue ID`.

**Supported seed shorthand:** `Skyline=agency_skyline`, `Orbit=agency_orbit`, `Aster=agency_aster`, `New Partner=app_new_partner`; `SBD101` is the known import PNR; `offer_005` is a search/booking fixture. Additional scenario fixture IDs must be copied from `03_DEMO_DATA_AND_MOCKS.md`, not improvised by tests.

**Financial assertions:** use integer minor units, one stable clock, DB state and audit rows; test both success and negative paths. An expected UI amount must be derived from the same canonical service as API result.

### 5.2 Authentication, onboarding, document intelligence and roles

| Test | AC | Action / fixture | Required proof |
|---|---|---|---|
| TC-001 | AC-001 | Register Bluebird/new synthetic OTA with required fields | Application created in correct state; reference and Operations queue item present. |
| TC-002 | AC-001 | Omit required registration fields / malformed email/PIN | Field errors; no submitted application or agency activation. |
| TC-003 | AC-001 | Upload supported synthetic PAN/business PDF | Extracted fields highlighted with source/confidence; user can accept/edit; confirmed values persist. |
| TC-004 | AC-001 | Upload `unreadable-demo.png` or unsupported file | Graceful error/manual completion, not a fabricated extraction result. |
| TC-005 | AC-002 | Extract supported document, **before** mock verification | Status = Extracted/Review; **no** green `Verified` tick. |
| TC-006 | AC-002 | Ops mock PAN/Aadhaar verification + decision | Distinct verification outcome; approve creates exactly one agency/admin, reject/more-info handles correctly. |
| TC-007 | AC-003 | Skyline Admin creates/deactivates sub-user | User belongs to Skyline; role navigation and access change after reload. |
| TC-008 | AC-003,025 | Skyline user requests Orbit booking/refund/case API ID | `404` neutral or specified permission error; no data leak or mutation. |
| TC-009 | AC-003,025 | Aster finance viewer books or edits user; CXO edits credit | `403`/neutral denial at API, not just hidden UI. |
| TC-010 | AC-025 | Suspended/inactive agency attempts booking | No new booking/reservation; permitted read-only history remains as specified. |

### 5.3 Funding, payment events, credit and passbook

| Test | AC | Action / fixture | Required proof |
|---|---|---|---|
| TC-011 | AC-004 | Match valid simulated event for Skyline | One `WalletCredit` keyed to unique external reference; balance/passbook/OTA dashboard update. |
| TC-012 | AC-004,025 | Replay identical payment event/client request | Same result or already-processed, **no** second wallet credit; unique idempotency enforced. |
| TC-013 | AC-004 | Wrong amount, unknown reference, ambiguous agency | Unmatched exception visible to Ops; **zero** wallet credit until legitimate resolution. |
| TC-014 | AC-005 | Increase/decrease Orbit credit limit | Available spending changes for new bookings; existing credit draws/bookings unchanged. |
| TC-015 | AC-005 | Insufficient wallet + allowed credit | Booking rejected with no ACTIVE hold/debit/PNR/ticket. |
| TC-016 | AC-005 | Overdue Aster credit blocked by policy | New credit draw denied; wallet-only booking behavior follows stored policy. |
| TC-017 | AC-004,005,025 | Verify wallet, hold and separate credit calculations | Opening+credits-debits=current cash; active holds reduce availability once; credit outstanding separate. |
| TC-018 | AC-025 | Repeat booking/payment after network-like retry | Idempotency prevents double charge/credit while valid retry returns previous result. |

### 5.4 Flight search, fare, commercial, FX and booking

| Test | AC | Action / fixture | Required proof |
|---|---|---|---|
| TC-019 | AC-006 | Search `BOM -> LON` for seeded future date | Coherent offers, airline/stops/price filters, sort, cheapest/fastest and expandable brands. |
| TC-020 | AC-006 | Search unsupported route/date | Honest no-results with filter reset; no unrelated invented live offer. |
| TC-021 | AC-007 | Open Fare Rules on `A_FLEXIBLE` and `B_RESTRICTED` cards | Cancellation, date-change, no-show, seat tabs; **two** profiles only, correct values. |
| TC-022 | AC-007,011 | Time to departure `1:59:59`, `2:00:00`, `23:59:59`, `24:00:00`, post-departure | Slabs `S0,S1,S1,S2,no-show` respectively; consistent booking/cancellation service. |
| TC-023 | AC-008 | Revalidate stable quote; accept; book | Booking + simulated PNR + funding reservation; no ticket until separate issue. |
| TC-024 | AC-008 | Issue ticket for created booking | Unique ticket; reserved funds consumed in one transaction; ledger, Ops and dashboards linked. |
| TC-025 | AC-008,009 | Price-change revalidation | Explicit new price and accept step; decline leaves no booking/charge. |
| TC-026 | AC-009 | Trigger mock booking or ticket-provider failure | No duplicate ticket; funding hold released or safely recovered; clear failed state. |
| TC-027 | AC-009,025 | Replay create/issue action with same idempotency key | Exactly one PNR, ticket and financial posting; fingerprint mismatch returns conflict. |
| TC-028 | AC-010 | Search/manage own bookings by PNR, date, passenger, status | Correct filtered result and stored snapshots; Ops sees all authorized, OTA only own. |
| TC-029 | AC-014 | Edit **Hubfares core** fee then request new quote | New quote reflects rule, old booking/quote immutable; applied-rule explanation visible. |
| TC-030 | AC-015 | Skyline Admin saves Domestic INR 50, International INR 100 markup UI | Saved/edit/disable works; flight result, booking, ledger and CXO values identical. |
| TC-031 | AC-016 | Create advanced commercial draft with `5*BF` and inclusion/exclusion | Criteria/history preview saved; zero effect on executable pricing; expressions never evaluated. |
| TC-032 | AC-017 | Switch INR->USD->EUR using scenario `S-G` | Display values from fixed rate table, original INR quote/booking/ledger unchanged. |
| TC-033 | AC-017 | Missing EUR rate or invalid display currency | Base INR and explanatory notice; no fabricated rate or transaction change. |
| TC-034 | AC-025 | Verify F and mock status across booking journey | `Demo` label and `SIMULATED` source appear; no false provider, payment or ticket claim. |

### 5.5 Cancellation, supplier settlement and PNR import

| Test | AC | Action / fixture | Required proof |
|---|---|---|---|
| TC-035 | AC-011 | Cancel eligible ticketed booking with profile A and >=24h departure | Fee from **booked** A profile; service fee shown separately; one cancellation/claim. |
| TC-036 | AC-011 | Cancel eligible booking with profile B and 2-24h departure | Fee from **booked** B profile; exact time slab, passenger/sector assumptions disclosed. |
| TC-037 | AC-011,025 | Cancel already-cancelled/voided or ineligible booking | Clear rejection; no second claim, refund or wallet credit. |
| TC-038 | AC-012 | Skyline supplier-settlement policy cancellation | Claim `PENDING_SUPPLIER`; supplier receivable tracked; **no** agency wallet refund credit yet. |
| TC-039 | AC-012 | Orbit immediate-eligible cancellation | Exactly one eligible agency wallet refund credit; supplier may separately remain pending. |
| TC-040 | AC-012,025 | Replay payout and import supplier receipt with wrong amount | No second payout; exception created when supplier actual differs from expected. |
| TC-041 | AC-013 | Import `SBD101` with permitted `SABRE` PCC | Preview then one imported booking linked to correct agency; appears in Manage Booking. |
| TC-042 | AC-013,025 | Repeat same provider/PCC/PNR import | `Already imported` or previous result; no duplicate booking or charge. |
| TC-043 | AC-013,025 | Unknown PNR, wrong PCC, other agency ownership | Neutral reject; no unauthorized itinerary exposure, record or financial entry. |

### 5.6 Reports, executive KPIs, chatbot and guided scope

| Test | AC | Action / fixture | Required proof |
|---|---|---|---|
| TC-044 | AC-018 | Download all six report types as Hub Admin/Ops | Six valid `.xlsx` downloads, each **100** frozen synthetic data rows and sample labels. |
| TC-045 | AC-018,025 | Skyline/Orbit/Aster downloads and forged agency IDs | Each OTA gets own 40/35/25 respective rows only; forged ID cannot change scope. |
| TC-046 | AC-018 | Create new booking, then re-download report | Frozen file rows unchanged; passbook/CXO changed; report explicitly says static extract. |
| TC-047 | AC-019 | Booking and cancellation on controlled cohort | GBV/retained sales/net revenue/contribution/margin/cancellation recompute from same records. |
| TC-048 | AC-019 | Review high-sales/low-margin OTA and period/agency filters | Ranking, selected cohort, route/airline and detail links reconcile to source rows. |
| TC-049 | AC-019,025 | Check pending supplier vs credited agency refund, overdue credit | Exposure categories distinct, no double-subtraction or false supplier receipt. |
| TC-050 | AC-020 | OTA Help in English/Hindi/Hinglish; nested menu, Back, Restart, Close | Scripted finite-state navigation works, prompts belong to selected category. |
| TC-051 | AC-020,025 | Own PNR and another OTA's PNR in Help | Own record returned; foreign/unknown PNR gives neutral not found, no leakage. |
| TC-052 | AC-020,021 | Chat refund/complaint -> confirm -> create case | Same unique `case_id`, agency/PNR/category visible in OTA and Ops. **No booking/ledger mutation.** |
| TC-053 | AC-021 | Ops assigns/statuses case; OTA checks status | Shared case timeline, no external airline/financial execution. |
| TC-054 | AC-022 | Guided amendment, rebooking, manual order, supplier statement | Readable guided steps/results; no live airline ticket or supplier transfer. |
| TC-055 | AC-023 | Roadmap GDS, queues, insurance/inventory/ancillary previews | Explicit `Planned integration`; no dead buttons or false Connected banner. |
| TC-056 | AC-024 | Reset after booking + refund + payment + new case | Known IDs, wallet/credit, dashboard cohorts, sample PNRs restored; no leftovers. |
| TC-057 | AC-024,025 | Fixed clock reset twice and compare canonical state hashes | Identical seed manifest, IDs, totals, frozen XLSX checksums; test DB isolated. |
| TC-058 | AC-025 | Desktop/mobile smoke, page reload, broken route/error states | No broken primary actions/overlap; status visible, error recoverable. |

### 5.6a Post-audit mandatory regression tests — additional functional paths

The six cases below close previously missing contract paths. They are **separate acceptance tests**, not decorative checks; all have controlled DB assertions in addition to UI proof.

| Test | AC | Action / fixed fixture | Required proof |
|---|---|---|---|
| TC-059 | AC-006,008 | `roundtrip_bom_lon_return`: select `offer_005` outbound and `offer_008` inbound; price, revalidate both legs and ticket one adult | One quote with two ordered `quote_segments`, total **INR 55,832.50**, one booking with two `booking_segments`, one simulated PNR/ticket, **one** aggregate funding hold/charge; no price/leg loss on reload. |
| TC-060 | AC-011,012 | Full-itinerary return cancellation from TC-059 under fixed mock clock; also induce failure on inbound before ticketing in separate isolated test | Two leg-specific slabs/penalties in a **single claim**; B S2+B S2 example refund **INR 49,732.50**; no partial cancel/partial charge; inbound provider failure releases entire original hold. |
| TC-061 | AC-012,025 | Booking-time refund policy version test: create Skyline booking under `refund_sky_v1` supplier-based; publish v2 `IMMEDIATE_IF_ELIGIBLE`; cancel original booking, then separately create/cancel new booking | Original booking and claim remain **SUPPLIER_SETTLEMENT v1**, no early wallet credit; newly created booking snapshots **v2**, immediate eligible refund as approved; no retroactive changes to old amount/status. Reset version after test. |
| TC-062 | AC-012,022,025 | Starting `refund_sky_003` pending, post the **on-demand** mock receipt `settle_sky_003` / `DEMO-SUP-6903-001` (**INR 6,903**), match, then Finance calls `payout-demo` | Supplier matched/received persist; **no wallet credit at receipt step**; authorized payout creates **exactly one INR 7,403 wallet credit**, claim closes, pending liability/receivable/CXO/passbook move consistently. Replay receipt/payout causes no second entry. |
| TC-063 | AC-019,025 | Query opening cohort, voided `book_seed_004` and cancelled bookings; compare dashboard counts and statuses | Opening ticketed **19**, cancelled **5**, voided **1**; cancellation **5/19**, void **1/19**; unticketed/failed absent; void does not inflate cancellation numerator. |
| TC-064 | AC-019,024,025 | Fixed-clock reset, compare all 24 seed bookings and exact ledger/KPI oracle in `seed-contract.v1.json` | Wallet Skyline INR **201,000**, Orbit INR **38,903**, Aster INR **30,000**; GBV INR **256,200**, net revenue INR **5,941**, contribution INR **5,276**; same seed yields identical IDs/state/metrics; no invented top-ups. |

### 5.7 Minimum test coverage and evidence policy

- **Every `AC-001..AC-025` must link to at least one `TC-...`**. The **64 cases** above are the mandatory baseline, including post-audit `TC-059..064`; add tests only for approved behavior found missing in implementation.
- Financial state changes require **DB assertions and UI checks**, not just snapshot testing.
- Tenant security requires **direct API requests** with forged IDs plus browser route checks.
- Guided/roadmap testing is **manual+UI proof**, not an assertion of real integration.
- Unit tests should cover the exact 2h/24h fare slabs, money minor units, FX, financial holds, revenue/expense formulas and date-cohort denominator treatment.
- Browser E2E must execute at least `S-A`, `S-B`, `S-D`, `S-E`, `S-G`, `S-J`, `S-K`; other scenarios can be split across API tests and manual rehearsal, but **must** have executed evidence before final status is marked pass.
- Store evidence as timestamped command output, browser screenshot/video if available, expected vs actual amounts, and API/DB references with no PII or credentials. Never fabricate green statuses.

---

## 6. Demo runbook - operator-ready stories

### 6.1 Pre-demo setup (before inviting client to view)

1. Verify `DEMO_MODE=mock`, persistence location, base URL and stable clock-anchor mode.
2. Confirm `npm run build`, `npm run fixtures:validate`, `npm run test`, `npm run test:e2e` statuses from this version (log actual outcomes; rerun if code changed).
3. Run authorized `npm run demo:reset` or demo reset action. Check seed manifest `hubfares-v1.1-seed-002`, all **24** historical booking rows and the expected baseline KPI/wallet values in `fixtures/seed-contract.v1.json`.
4. Confirm test accounts are available via **restricted local operator instructions** (do not display a password to the audience).
5. Open public registration, Skyline OTA, Hub Ops, Hub Finance and CXO tabs/sessions; verify **each session maintains distinct identity**. Prefer separate browser profiles/incognito contexts, not one shared login cookie.
6. Test search for `BOM -> LON`, PNR `SBD101`, report download, chat case menu, FX selector and Executive overview.
7. Open backup fallback screenshot/video only if explicitly prepared and labeled `Preview`; do not masquerade it as a live working feature.
8. Set presentation viewport to desktop for Operations/CXO; confirm OTA portal works at narrow viewport if shown.
9. Keep an operator-only fixture reference sheet (`agency_skyline`, `agency_orbit`, `app_new_partner`, `offer_005`, `SBD101`) and note which stories mutate data.
10. Verify no real PAN/Aadhaar, provider credentials or client personal data are visible.

### 6.2 Suggested client-facing sequence

**Act 1 - Intelligent onboarding (`S-A`; WF-01..04)**

- **Actor:** New **Bluebird Travels** DRAFT applicant (not already submitted `app_new_partner`) -> Hub Ops -> new Agency Admin.
- **Open:** `PUB-01` -> `ONB-01`/`ONB-02` -> `OPS-02`/`OPS-03` -> `ONB-03` -> `OTA-02`.
- **Show:** Notice explaining auto-extraction; upload synthetic document; source-linked editable fields; verification occurs **separately**; green tick only after mock check; approve activates agency and admin.
- **Say:** "The document processing works on supported demo samples; PAN/Aadhaar verification is simulated pending an authorized provider."
- **Expected evidence:** application ID, newly active agency, sub-user permission, audit/event.

**Act 2 - Configure agency terms (`S-C` preparation; WF-06,17,22)**

- **Actor:** Hub Finance/Admin.
- **Open:** `ADM-02`, `ADM-03`, `ADM-04`.
- **Show:** Skyline upfront wallet vs Orbit weekly INR 200,000 credit; refund timing per agency; simplified Hubfares fee changed for **future quotes**.
- **Say:** "Agency-specific terms are a working demo policy. Complex airline commercial expressions are a separate guided builder."
- **Expected:** new booking funding eligibility and new quote change while historical price remains unchanged.

**Act 3 - Search, rules, currency, ticket (`S-B`, `S-G`; WF-07..09,23)**

- **Actor:** Skyline OTA Agent.
- **Open:** `OTA-03` -> `OTA-04`/`OTA-05` -> `OTA-06` -> `OTA-07`.
- **Show:** `BOM -> LON`, multiple Sabre-mock offers/fare brands; filters; both fare profiles and time slabs; switch INR -> USD -> EUR **without changing booking amount**; revalidate, enter synthetic passenger, confirm, issue simulated ticket. Optionally showcase **functional return** `offer_005 + offer_008`, two priced legs, one quote/PNR/ticket/payment (TC-059); partial-leg cancel remains deferred.
- **Say:** "Sabre is the modeled provider for now. The currency selector is informational, not foreign-currency billing or market-specific GDS fares."
- **Expected:** booking ID, PNR then ticket number, wallet funding event, Manage Booking row, Operations row and CXO cohort update.

**Act 4 - Wallet and credit (`S-B`, `S-C`, `S-H`; WF-05,06,18)**

- **Actor:** Skyline / Orbit / Hub Finance.
- **Open:** `OTA-12` -> `OPS-07` -> `OTA-13`; optionally Orbit booking.
- **Show:** simulated payment event auto-match and **one** wallet credit; passbook debit after ticket; Orbit credit available/outstanding separate from wallet; unmatched event remains an exception.
- **Expected:** exact unique payment ref, one credit ledger record, available funding moves consistently.

**Act 5 - Cancel and handle two refund policies (`S-D`; WF-11..13)**

- **Actor:** Skyline and Orbit agents; Hub Ops.
- **Open:** `OTA-08/09` -> `OTA-10` -> `OTA-11` -> `OPS-06`/`OPS-08`.
- **Show:** `book_seed_001` A_FLEXIBLE departing D+12 => S2; `book_seed_011` B_RESTRICTED departing H+10 => S1; Skyline supplier-based refund pending and Orbit eligible immediate wallet credit; supplier receivable remains separate. Demonstrate the positive settlement payout for `refund_sky_003` in a **reset/isolated pass** per TC-062.
- **Expected:** exactly one claim per cancellation, only policy-eligible wallet credit, updated exposure/CXO. Supplier-match event alone makes **no** wallet credit; separate authorized action posts it once. An Admin payout-policy edit does **not** change the booked policy on 001/011 (TC-061).
- **Operator note:** Use `book_seed_001` and `book_seed_011` from fixture specification; **do not use already cancelled `book_seed_003`**. Reset if those seeded eligible bookings were mutated earlier.

**Act 6 - Bring offline sales into view (`S-E`; WF-14)**

- **Actor:** Agency / Operations.
- **Open:** `OTA-14` and `OTA-08`.
- **Show:** Select Sabre + valid PCC, enter `SBD101`, retrieve known synthetic booking, import, see booking across modules. Second import blocked.
- **Expected:** one imported booking reference, correct agency ownership, no ticketing charge invented.

**Act 7 - Agency markup, advanced commercial preview (`S-F`; WF-17)**

- **Actor:** Skyline Agency Admin, then Hub Finance.
- **Open:** `OTA-19`, `ADM-03`, `ADM-08`.
- **Show:** OTA Domestic INR 50 / International INR 100 saved in UI; **no fare or financial impact**. Contrast working simple Hubfares commercial fee changing only subsequent quotes. Guided advanced criteria, draft expressions `BF/TF` and history.
- **Expected:** core rule effect only; no OTA-markup/expression pricing side effects.

**Act 8 - Download example reports (`S-J`; WF-18)**

- **Actor:** Hub Ops and Skyline OTA.
- **Open:** `OTA-15/23` or authorized Hub reporting area.
- **Show:** Two booking reports; four amendment reports; six genuine XLSX downloads with sample labels. Hub sees 100 rows/type, Skyline sees 40 rows/type; new booking does not mutate these frozen examples.
- **Expected:** files open successfully and contain only authorized agency rows.

**Act 9 - OTA guided support -> Operations (`S-K`; WF-20,21)**

- **Actor:** Skyline OTA -> Hub Ops.
- **Open:** floating `OTA-20` -> `OTA-21` -> `OPS-13` / `OPS-12`.
- **Show:** Welcome; language; Refund/Change/Flight Status/Modify/Complaints/More; Back/Restart; own PNR lookup; confirm complaint/refund **support request**; `case_id` appears in Operations.
- **Expected:** case state updates; no booking cancellation or wallet refund occurs from creating the case.

**Act 10 - Executive intelligence and future path (`S-L`, `S-I`; WF-19)**

- **Actor:** Hub CXO, then Hub Ops/Admin.
- **Open:** `EXE-01..05`, guided amendment/manual/rebooking and GDS settings.
- **Show:** OTA revenue, net platform revenue, estimated contribution, cancellation trends, overdue credit, supplier receivables, unmatched payments, top/low-margin OTA drill-down; demonstrate effect of newly ticketed/cancelled record.
- **Say:** "These analytics are derived from connected demo transactions. GDS queues, production banking and extended services are future adapters or guided examples."
- **Expected:** coherent booked-cohort metrics with `Date basis: booking date` and illustrative financial definitions, not claims of audited profit.

### 6.3 Recommended live-demo narration rules

- Say **"simulated Sabre PNR"**, **"sample verification"**, **"demo bank event"**, **"display conversion"**, **"sample report extract"**; do not call mock events airline/government/bank confirmations.
- Demonstrate **one complete connected business story** before showing a catalog of future modules.
- Show an error/exception intentionally: duplicate import, unmatched payment or insufficient funds. Recover in view to demonstrate robustness.
- Do not overpromise full production GDS coverage, live seats/fares, financial accounting certification or a free-form AI assistant.
- Keep customer-facing interface clean; technical debug/scenario toggles remain operator-only.

---

## 7. Reset, recovery and troubleshooting

### 7.1 Reset protocol (`S-M`)

**Preconditions:** `DEMO_MODE=mock`, Super Admin or authorized local operator, expected DB allowlisted, browser session identity understood, backup captured if necessary.

1. Stop active mutation sequence; close any incomplete confirmation dialogs.
2. Run authorized reset with explicit confirmation.
3. Seed transaction restores canonical records and fixture version; regenerate derived state; **do not** modify frozen XLSX contents.
4. Rerun `fixtures:validate` and basic database integrity checks.
5. Reopen independent sessions; refresh search, wallet, Ops, help and CXO views.
6. Verify `agency_skyline`, `agency_orbit`, `agency_aster`, `app_new_partner`, profile IDs, `SBD101`, and key booking IDs exist as expected.
7. Confirm newly created demo bookings/cases/payment posts are gone; opening ledger and KPI baseline matches recorded expected snapshot.
8. Replay `S-B` or one short mutation to confirm system works after reset; reset again for clean client state.

With `DEMO_CLOCK_MODE=fixed`, two resets must produce identical IDs, balances and derived metrics. With system clock mode, use one anchor per reset and compare **structural invariants**; expect date-relative seed timestamps to differ between resets at different anchors.

### 7.2 Recovery matrix

| Failure symptom | Likely cause | Safe diagnostic and fallback |
|---|---|---|
| Login role wrong / tenant record visible | Session mixture or missing server scoping | Stop demo; reopen separate browser profiles; validate `/api/v1/auth/me`; **do not** continue if leak remains. |
| Extractor reads nothing | Unsupported/low quality synthetic file | Show manual review fallback and supported demo sample; never fabricate extraction. |
| PAN shows Verified immediately after OCR | UI conflates extraction and KYC | Block release; separate statuses, rerun TC-005/006. |
| Flight search empty | Wrong anchored date/route/filter | Reset filters; choose prescribed fixture route/date; verify seeded offers. |
| FX labels inconsistent | Multiple rate copies or rounding before conversion | Read single `fx_demo_rates` source, recheck original INR and TC-032. |
| Wrong fare penalty at exactly 2h/24h | Inclusive/exclusive boundary bug or wrong profile | Set fixed clock; check `S0 [0,2h)`, `S1 [2h,24h)`, `S2 [24h,∞)`; inspect booking snapshot. |
| Booking price changes after commercial edit | Historical quote recomputed | Block release; use immutable booking/quote snapshot; rerun TC-029. |
| Ticket issued but wallet/credit not posted | Split transaction or failed ledger commit | Stop that scenario; roll back in test DB; restore demo via reset after fixing atomic operation. |
| Wallet credited twice | Idempotency not stored or duplicate event processed | Stop financial demo; inspect unique external reference; repair; reset and rerun TC-011/012. |
| Refund shows both pending and paid incorrectly | Agency payout mixed with supplier settlement | Check separate payout/supplier statuses and one wallet credit; rerun TC-038/039. |
| Imported PNR duplicates | Missing provider/PCC/PNR uniqueness | Enforce unique import key, reset and rerun TC-041/042. |
| OTA report reveals other agency | Client-side filtering or wrong session | **Stop immediately**; remove download endpoint from demo; repair server-side export and rerun TC-045. |
| Reports unexpectedly change after booking | Live SQL used for frozen export | Restore static source, separate report timestamps and CXO live queries. |
| Chat support cancels booking | Help action wired to cancellation endpoint | Stop and correct: case only, no money/GDS changes; rerun TC-052. |
| KPI differs from booking/ledger | Independent totals, mixed cohort, double subtraction | Recompute from booked cohort with documented definitions; compare query rows and TC-047/049. |
| Demo reset erases incorrect DB | Missing mock-mode/path guard | Disable reset; restore backup if available; fix allowlist and confirmation before reuse. |
| Guided screen implies live provider | Missing labels/copy | Add `Guided demo`/`Planned integration`, disable false provider success action. |

### 7.3 Controlled failure rehearsal

Before presenting, intentionally verify and recover from: unreadable document, insufficient funding, quote price change, mock ticket failure, incorrect PNR/PCC, duplicate import, duplicate payment, blocked credit, invalid chatbot PNR, missing FX rate and static report role denial. These must be deterministic fixture scenarios, not random faults triggered during the client demo.

### 7.4 Local process and operational checks

- Confirm DB path is writable and excluded from public static assets; keep `DEMO_MODE=mock`.
- For startup failure, inspect migration errors, DB locks, missing fixture file, missing session secret and port collision; do not rebuild tables ad hoc.
- For API failure, inspect request ID, role/agency ID, operation idempotency key, adapter mode and returned structured error code. Exclude sensitive documents/passwords from logs.
- For corrupted seed, stop mutations and reset only after restoring known fixture version; do not manually edit wallet totals.
- For frontend state drift, force reload and compare API response; server/DB is authoritative.
- If browser assets/network are unavailable, use local served fonts/icons/assets rather than depending on external images at presentation time.

---

## 8. Final readiness gate and signoff

### 8.1 Gate checklist

| Area | Required before calling demo-ready |
|---|---|
| Setup | Clean install/migration/seed/validation start works in documented environment. |
| Quality | Typecheck, build, test and E2E commands executed; actual failures disclosed. |
| `F` scope | Every implemented F flow passes corresponding AC and TC, with same data after refresh. |
| `G/R` scope | Every guided/roadmap entry opens an honest, meaningful screen; no fake provider execution. |
| Booking/funds | Holds, tickets, wallet/credit, cancel/payout idempotency and reversals safe. |
| Security | No cross-tenant UI/API or XLSX leaks; wrong roles rejected server-side. |
| Fare/FX | Two profiles and boundary slabs; INR/USD/EUR display only; no currency mutation. |
| Commercial | Core changes future quotes only; OTA markup and advanced expressions UI-only. |
| Reports | Six genuine frozen XLSX reports, 100 rows all-agency, 40/35/25 scoped, clearly sample. |
| Analytics | Booking-cohort denominators and financial terms are consistent and explainable. |
| Chat | OTA nested menus and case-to-Ops linkage work; no unauthorized side effects. |
| Repeatability | `S-M` reset works; S-A..S-L rehearsal completed with written result. |
| Presentation | At least one backup route for foreseeable failure; demo tabs and account context ready. |
| Disclosure | `Demo Environment`, mock integrations and incomplete features stated accurately. |

### 8.2 Evidence register format

Create a **runtime** status record (e.g. `implementation-status.md` generated during development). This is **not** a competing product specification.

```text
Build commit / timestamp:
Environment: NODE_ENV / DEMO_MODE / DB path (no secrets)
Fixture version / anchor:
Command                 Exit    Evidence link or log
npm run build           ____    ____
npm run fixtures:validate ____  ____
npm run test            ____    ____
npm run test:e2e        ____    ____
npm run demo:reset      ____    ____

AC range: 001..025
Passed: ___  Failed: ___  Blocked: ___  Not run: ___
Scenarios S-A..S-M:
  completed / failed / blocked + issue references

Incomplete approved F requirements:
Guided/Roadmap previews available:
Known issues / severity:
Stop-ship concerns (money, tenancy, fake integrations):
Demo operator confirmation:
```

### 8.3 Stop-ship vs nonblocking issues

**Stop-ship for a demonstration claiming connected functionality:** tenant/report leakage, duplicated wallet credit or refund, booking/ticket status contradictions, cancellation using wrong booked rule, loss of financial postings, corrupted resets, mislabeling of simulated external confirmations, missing working core journey.

**May remain explicitly labeled G/R or partial:** ancillary inventory, insurance, cabs, advanced BF/TF execution, live GDS queues, real currency API, live multilingual NLP, production security/compliance, nonessential chart variations.

**Final truthfulness rule:** `F complete` only after an executed positive path, negative path, persistent state inspection and a passing linked check. The agent must not infer completion from code existence, mock UI screenshot, or a planned script name.

---

## 9. Requirement-to-test crosswalk and QA operator schedule

| Product AC | Test case IDs | Primary scenario |
|---|---|---|
| AC-001 | TC-001..004 | S-A |
| AC-002 | TC-005..006 | S-A |
| AC-003 | TC-007..010 | S-A / tenant negative |
| AC-004 | TC-011..013, TC-017 | S-B, S-H |
| AC-005 | TC-014..017 | S-C |
| AC-006 | TC-019..020, TC-059 | S-B, return-trip regression |
| AC-007 | TC-021..022 | S-B, S-D |
| AC-008 | TC-023..025, TC-059 | S-B, return-trip regression |
| AC-009 | TC-025..027 | Mock failure path |
| AC-010 | TC-008, TC-028 | S-B, S-E |
| AC-011 | TC-022, TC-035..037, TC-060 | S-D, return-trip cancellation |
| AC-012 | TC-038..040, TC-060..062 | S-D, supplier settlement and policy versioning |
| AC-013 | TC-041..043 | S-E |
| AC-014 | TC-029 | S-F |
| AC-015 | TC-030 | S-F |
| AC-016 | TC-031 | S-F |
| AC-017 | TC-032..033 | S-G |
| AC-018 | TC-044..046 | S-J |
| AC-019 | TC-047..049, TC-063..064 | S-L, opening financial oracle |
| AC-020 | TC-050..052 | S-K |
| AC-021 | TC-052..053 | S-K |
| AC-022 | TC-054, TC-062 | S-I, mock receipt-to-payout |
| AC-023 | TC-034, TC-055 | S-I, R previews |
| AC-024 | TC-056..057, TC-064 | S-M |
| AC-025 | TC-008..010, TC-012, TC-017..018, TC-027, TC-034, TC-037, TC-040, TC-042..043, TC-045, TC-049, TC-051..052, TC-057..058, TC-061..064 | Cross-cutting |

**Count convention:** `TC-001..TC-064` are all distinct and mandatory (**64 tests**). Scenario count remains **13 (`S-A..S-M`)** and product workflow count **23 (`WF-01..WF-23`)**; the return trip, supplier payout, refund-version and KPI-oracle checks are extra QA coverage, **not added product modules**.

**Suggested verification order:** compile/fixture tests -> `TC-001..018` identity/finance -> `TC-019..034` flights/pricing -> `TC-035..043` cancel/import -> `TC-044..058` BI/support/security -> `TC-059..064` post-audit regression -> complete `S-A..S-M` operator rehearsal. If one test alters a fixture needed by the next, use isolated DB per test or reset deliberately; **do not** reuse mutated fixture assumptions silently.

---

## 10. Technical signoff and document handoff

- [`01_PRODUCT_SPEC.md`](01_PRODUCT_SPEC.md) remains authoritative for user-observable features and workflow status.
- [`02_TECHNICAL_DESIGN.md`](02_TECHNICAL_DESIGN.md) remains authoritative for schema, API and business transaction math.
- [`03_DEMO_DATA_AND_MOCKS.md`](03_DEMO_DATA_AND_MOCKS.md) remains authoritative for exact synthetic record values and mock outcomes.
- **This file** is authoritative for build gates, test IDs, execution, rehearsal, reset and recovery.
- `AGENTS.md` enforces these authority rules; `README.md` explains commands/startup without inventing new requirements.

**Implementation agent completion report must state:** gate reached, build commit/time, working demo URL/local command, fixture version, AC/TC results, S-A..S-M rehearsal results, remaining approved F gaps, known G/R limitations and any client-scope decisions requiring approval. Never claim production-ready Sabre, payment, KYC or financial compliance because a simulated POC worked.
