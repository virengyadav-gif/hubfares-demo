# HUBFARES POC - Instructions for the Development Agent

> **Document:** `AGENTS.md` | **Applies to:** the entire `hubfares-poc/` repository  
> **Product baseline:** Hubfares approved PRD v1.1, 19 November 2026  
> **Mission:** Deliver an honest, reliable, interactive **one-day B2B travel-platform capability POC**.  
> **Status:** Post-audit corrected governance rules (reference package rev 1.1.1); does **not** add product requirements.

## 1. How to start

1. Open `README.md` for repository setup and navigation. Then read all four files listed below in full.
2. **Read these files in full, in order, before writing code**. Do not implement from summaries or screenshots alone:
   - `docs/01_PRODUCT_SPEC.md` - **what** to build; roles, screens, business behavior, approved scope, 23 workflows (`WF-01` through `WF-23`) and 25 acceptance criteria (`AC-001` through `AC-025`).
   - `docs/02_TECHNICAL_DESIGN.md` - **how** to build; stack, schemas, state transitions, APIs, authorization and domain services.
   - `docs/03_DEMO_DATA_AND_MOCKS.md` - **which exact synthetic data and mock behavior**; fixture identities, rates, fare rules, case IDs and sample Excel reports.
   - `docs/04_BUILD_TEST_DEMO.md` - **build order and proof**; Gates 0-7, 64 test cases (`TC-...`), 13 scenarios (`S-A` through `S-M`) and demo runbook.
3. Read `references/Approved_PRD_v1.1.docx` when checking scope disputes. It is the **approved historical baseline**, not an invitation to reimplement superseded language without reconciliation.
4. Inspect `references/screenshots/` when populated; they are **design references**, not requirements to copy third-party logos, branding, assets or every visible feature.
5. Before coding, produce a compact inventory of approved `F`, `G`, `R` items, dependencies, implementation gates, setup constraints and known blockers. Do **not** request permission for unambiguous implementation work already authorized by the specifications.

## 2. Authority and conflict handling

| Subject | Authoritative location |
|---|---|
| Product scope, roles, visible behavior, workflow transitions, F/G/R status | `docs/01_PRODUCT_SPEC.md` |
| Stack, module boundaries, schema, API, arithmetic, security implementation | `docs/02_TECHNICAL_DESIGN.md` |
| Exact fixtures, seeded numbers, simulation outcomes, deterministic scenario IDs | `docs/03_DEMO_DATA_AND_MOCKS.md` |
| Implementation gates, test execution, demo steps, release criteria | `docs/04_BUILD_TEST_DEMO.md` |
| Original approved product decisions | `references/Approved_PRD_v1.1.docx` |
| Agent process, reporting and deviation discipline | This `AGENTS.md` |

**The two explicit Product Spec §13.1 post-audit implementation clarifications (functional two-leg return, booking-time refund policy) are **already resolved POC defaults** and should **not** be reopened merely because the unamended historical DOCX used ambiguous wording.** They do not authorize new production scope. **Do not silently reconcile any other genuine conflict.** Record a conflict with (a) exact source paths/sections, (b) the inconsistent statements, (c) impact, and (d) the smallest proposed resolution. Mark the **affected requirement** blocked, seek a product decision, and continue independent work. A business-policy ambiguity is **not** permission to invent a rule. A missing file or broken reference is a blocker to be reported, not grounds to guess its contents.

**Change control:** No developer-created scope additions, silent F-to-G downgrades, new payment/refund policies, unapproved fields, or replacement technology stacks. If the user approves a change, update the owning specification and affected references/tests together. A README, code comment, chat message or mock response cannot override an approved requirement.

## 3. Scope locks - never violate these

- **B2B only.** Hubfares operates the platform; travel agencies/OTAs are distinct tenant organizations. No public B2C customer storefront.
- **One-day POC, not production.** Core workflows must work on shared persisted demo state; the rest must be clearly guided or roadmap showcases.
- **No live GDS connections.** Sabre-first **simulator**; Travelport and Amadeus are adapter-ready/planned. No actual airline booking, PNR issuance, ticketing or cancellation.
- **No live bank, PAN/Aadhaar verification or supplier settlement.** All external confirmations must say `Demo`, `Simulated` or `Sample`. Do not use real customer identity or payment details.
- **Agency Admin downstream markup is UI-only.** Create/edit/enable/disable its rules, but never apply them to offers, ticket prices, bookings, wallet, ledger, refunds or CXO analytics.
- **Hubfares-to-OTA simplified commercial rules are functional** and change **new quotes only**. The advanced commercial expression/rule builder is a guided UI; never evaluate expressions such as `5*BF` or `1*TF`.
- **Functional round-trip booking** requires two selected/revalidated legs, one quote with ordered segments, one booking/PNR/ticket flow, one aggregate funding transaction and full-itinerary-only cancellation; no multi-city/partial-leg booking in Phase 0.
- **Refund payout policy is snapshotted at booking creation.** Later agency policy edits affect new bookings only; cancellation and claims read the booked policy version. A guided supplier receipt **never auto-credits** the wallet; a separate authorized idempotent payout is required.
- **Exactly two fare-rule profiles**: `A_FLEXIBLE` and `B_RESTRICTED`, with the precise time slabs and boundaries from the governing documents. Do not create third profiles or screen-specific copies. Cancellation uses the booked fare snapshot.
- **Currency is display-only:** INR, USD and EUR use seeded example rates. Original stored booking, wallet, credit and ledger amounts stay in their agreed transaction/base currency; currency switching does not select a different point-of-sale market.
- **Six fixed synthetic `.xlsx` transaction report types**, about 100 rows each. OTA downloads must be server-side agency-scoped. These sample files **do not change after demo actions**. Wallet/passbook and executive dashboards **do** reflect current shared demo data.
- **OTA-only scripted help chatbot**, not an LLM. Nested menus, authorized PNR/case lookup and guided complaint/refund/change requests create support cases visible to Operations; the bot never directly cancels a booking or credits a wallet.
- **Document autofill is separate from verification.** OCR/text extraction may prefill an editable field, but cannot turn PAN/Aadhaar green until the corresponding explicitly simulated verification step.
- **Independent visual identity:** premium orange/charcoal/light interface inspired by supplied references; do not reproduce TripJack branding.

## 4. Architecture rules

- Build the prescribed **Next.js App Router + TypeScript strict + Tailwind + same-origin server APIs + SQLite/Drizzle** modular monolith. Follow the exact choices and interfaces in `02_TECHNICAL_DESIGN.md`; use a lockfile and compatible pinned dependencies.
- Implement **domain services first** (agency, flights, pricing, booking, money, refunds, support, analytics). UI components call application APIs/services; they do not own finance or ticketing rules.
- All OTA-owned records are scoped by authenticated agency identity **on the server**. Never trust an arbitrary `agencyId`, role flag or price posted by the client. Disabled navigation is not authorization.
- Use **one persisted canonical data model**. The same booking, ticket, PNR, cancellation and ledger records drive OTA, Operations, Admin and CXO views. No separately hardcoded dashboard counters or client-only wallet balances.
- Keep money in **integer minor units** and rates/percentages in deterministic representations as prescribed. Monetary transitions require clear atomic transaction boundaries, policy snapshots and idempotency checks.
- Preserve the distinctions: booking vs PNR vs ticket; wallet cash vs credit facility; refund payable vs supplier receivable; supplier refund received vs OTA wallet credited; booking price vs display-converted amount.
- Use **typed adapter interfaces** for GDS, document extraction, mock KYC, payment events, supplier settlement and FX. The default runtime stays `DEMO_MODE=mock` and must boot **without any external credentials or network provider calls**.
- Implement clean form/API validation, stateful error messages, empty/loading/error states and meaningful guided/roadmap previews. Never simulate success by showing a toast without the required database write.
- Avoid unauthorized new services, microservices, event brokers, live APIs, second database, unnecessary infrastructure or complex libraries. Keep code understandable and testable.

## 5. Build discipline - work through gates

Follow `04_BUILD_TEST_DEMO.md` **Gates 0-7** in order:

| Gate | Outcome |
|---|---|
| 0 | Source inventory, discrepancies, scaffold, mock environment |
| 1 | Durable schema, fixtures, reset, authentication and isolation |
| 2 | Registration, extraction review, mock verification, approval, sub-users |
| 3 | Search, branded fares, fare rules, currency, core commercials, markup UI |
| 4 | Payment matching, wallet/credit, booking, ticketing and passbook |
| 5 | Cancellation/refunds, supplier states, offline PNR import |
| 6 | Operations, executive analytics, six reports, OTA support chatbot, guided scope |
| 7 | Full QA, demo rehearsal, recovery and release evidence |

For **each vertical slice**:

1. Identify the exact `WF`, screen, feature family, `AC`, `TC` and scenario IDs. Avoid inventing sub-requirement meanings from feature-family ranges.
2. Confirm schema, DTO, mock fixture, success path, failure paths and authorization boundary.
3. Implement **service + persistence + API + UI**, then prove the record is correct after refresh or new login.
4. Run targeted tests including negative behavior, money invariants and cross-agency denial.
5. Verify cross-module downstream effects with the **same stored record IDs**, not duplicated UI fixtures.
6. Record a concise progress status: `F complete`, `F partial`, `G demonstrated`, `R preview`, `blocked`, or `not started`, with test evidence and known gaps.
7. Fix regressions before moving on; if blocked, continue only independent slices and disclose the gap.

**Definition of done:**

- `F`: approved user action validates, writes canonical state, survives refresh, updates relevant views, rejects invalid/unauthorized paths and passes its executed tests.
- `G`: user can complete a deterministic sample journey and sees `Guided demo` labeling; no misleading real-provider effect.
- `R`: preview explains intended capability and missing production dependencies; no dead links or false `Connected` messages.

**Never equate** screen presence, code generation, mock-data display, or a planned test with completed functionality.

## 6. Seed data, external mocks and Excel safeguards

- Build **actual fixtures**, synthetic PDFs/images and **six real Excel workbooks** from `03_DEMO_DATA_AND_MOCKS.md`; do not treat the specification as an already generated asset.
- Preserve canonical fixture names, stable IDs, scenario toggles, selected flight/PNR ownership, currency rates and exact two fare-rule definitions. Use a deterministic demo clock/anchor when specified; avoid `Math.random()` in testable results.
- `npm run seed`, `npm run fixtures:validate`, `npm run reports:build`, and `npm run demo:reset` must be real scripts, not placeholders.
- Reset must be restricted to an authorized operator in **mock mode**, target a known safe demo DB, restore atomically and fail closed if validation fails. Use an **independent test database** during automated tests.
- Client-visible sample documents must be fictional and data-minimized; do not commit real identity documents, credentials, PAN/Aadhaar numbers or payment tokens.
- Generate/download reports with **server-verified authorization**. Never send a full all-agency Excel file to an OTA browser and filter it with client-side JavaScript.
- Do not claim the static Excel reports update when booking/refund records change; dynamic passbook/CXO data must be computed from the database.

## 7. Testing, evidence and stop-ship policy

**Run real commands and record their result** (commands are target interfaces until implemented):

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

- Validate the provided **`fixtures/seed-contract.v1.json`** as the deterministic 24-booking opening baseline (expected cash, credit, GBV, revenue, contribution, refunds). It is a data asset governed by document 03, not a seventh specification.
- Implement the **64 specified `TC-...` cases** and map them to **25 `AC-...` criteria**; rehearse all **13 `S-A..S-M`** scenarios according to `04_BUILD_TEST_DEMO.md`.
- At minimum test role isolation, report leakage, booking/ticket state, cancellation slab boundaries, held funds/release, wallet idempotency, duplicate refunds, seeded FX consistency, source-specific policy application, owned PNR lookup and support-case handoff.
- Run tests against a separate DB. Capture actual command outputs, failures, build commit, fixture version/anchor, and known limitations. Do not say “passed” without execution evidence.
- **Stop-ship when claiming a connected demo:** any cross-tenant leak, duplicate credit/refund, contradictory ticket state, wrong booked fare rule, lost finance record, unsafe reset, fake live-provider confirmation, or missing core end-to-end path.
- Guided/roadmap capabilities may remain limited **if clearly labeled and disclosed**. Never silently relabel an approved F requirement as G to make a deadline.

## 8. Operating procedure for blockers and decisions

When something is unclear:

1. Search the **governing section** of all relevant approved documents first; inspect actual files, not a previous chat summary.
2. If the answer is unambiguous, proceed and cite the requirement ID in your implementation progress.
3. If a **material business rule, money behavior, auth boundary, scope level or provider claim** is truly unspecified/conflicting, log an issue with exact document sections, a proposed minimal choice and affected work; ask for a decision before implementing that path.
4. Continue independent approved work rather than stopping the project unnecessarily.
5. Do not invent client approvals, real supplier availability, API credentials, official exchange rates, financial compliance, test results or a deployment URL.

A minor reversible engineering choice consistent with `02_TECHNICAL_DESIGN.md` may be made autonomously and documented in the implementation summary. It must not become a new product policy.

## 9. Communications and handoff

- Keep updates **short and factual**: completed slice, evidence, next gate, blockers, and incomplete requirements.
- Track runtime progress in chat and/or a generated implementation-status artifact (allowed as **execution evidence**, not as a seventh product authority). Do not rewrite the approved spec to make implementation appear complete.
- Do not promise asynchronous/background delivery. In each active session, execute and report what was actually completed.
- Before declaring the POC demo-ready, provide: running instructions, tested local URL, seeded role/account procedure (without exposing real secrets), fixture version, reset steps, test summary, known limitations and the `S-A..S-M` operator walkthrough.
- Final delivery must clearly distinguish **working local simulation**, **guided showcase**, and **future integrations**. Do not call the POC production-ready or claim integrations have been certified.

## 10. Handoff readiness checklist

- [ ] All approved reference files read and any gaps/conflicts recorded.
- [ ] Exact core stack and folder structure match the technical design.
- [ ] Requirement and test IDs remain stable: `WF-01..23`, `AC-001..025`, `TC-...`, `S-A..S-M`.
- [ ] One canonical database powers connected bookings, finance, cases and CXO views.
- [ ] Role/agency authorization is enforced at API and download boundaries.
- [ ] Functional two-leg return + booking-time refund policy version; exact supplier-receipt-to-payout path; cancellation KPI excludes voided numerator.
- [ ] Two fare profiles, display-only INR/USD/EUR and UI-only OTA markup are preserved.
- [ ] Six sample XLSX report files exist and never falsely advertise real-time updates.
- [ ] Sabre, KYC, bank and supplier mocks are transparently labeled.
- [ ] Chatbot remains OTA-facing scripted self-service, with cases handed to Operations.
- [ ] Build/test/fixture/reset commands are actually implemented and executed.
- [ ] Demo and failure scenarios are rehearsed; all known issues disclosed.

**Working rule:** Build only what the approved documents authorize; demonstrate it using shared, trustworthy demo state; prove it through reproducible tests; be transparent about every simulation and every gap.
