<<<<<<< HEAD
# HUBFARES POC

**B2B Travel Distribution & Operations Platform**  
**Approved product baseline:** Hubfares PRD v1.1 (19 November 2026)  
**Corrected reference package:** revision 1.1.1 / seed `hubfares-v1.1-seed-002`  
**Delivery target:** One-day, interactive **capability proof of concept**, not a production system  
**Project owner / development:** Hubfares / VARP Techlabs

> **Package correction:** This is the **post-audit corrected version**, preserving the approved Hubfares PRD v1.1. Product-implementation clarifications are fixed consistently across the six documents: functional two-leg return itinerary, booking-time refund policy, exact receipt-to-payout handoff, deterministic 24-booking seed/KPI oracle, consistent fare boundaries, and 64 explicit tests. See the separate delivery audit report; it is **not** a controlling seventh specification.

> **Start here.** This repository is a controlled implementation package. The four files in `docs/` describe the approved behavior, technical design, synthetic data and verification plan. `AGENTS.md` governs how an AI development agent must act. **Do not start development from this README alone.**

## 1. Mission and success criteria

Build a premium, independently branded, **B2B-only** platform in which Hubfares operates for travel agencies/OTAs; no direct retail booking portal is in scope. Demonstrate an integrated journey: registration and document autofill -> Hubfares approval -> agency credit/commercial setup -> mock flight search and detailed fare rules -> booking/PNR/ticket -> wallet/passbook -> cancellation/refund -> Operations and executive analytics. Add deterministic mock PNR import, agency support cases, reports and guided future-capability previews.

The goal is to **show what VARP can build** while making essential local workflows genuinely interactive, persistent and internally consistent. Production integrations are not available and must never be misrepresented as live.

**Completion is proven by executed tests and a rehearsed, repeatable demo, not by navigation screenshots or promises.**

## 2. Documentation map: exactly six controlling Markdown files

Read **every document in full** before implementing the application. Follow this sequence:

| Order | File | Exclusive authority |
|---|---|---|
| 1 | [`AGENTS.md`](AGENTS.md) | Developer-agent operating rules, conflict protocol, change control, evidence requirements |
| 2 | [`docs/01_PRODUCT_SPEC.md`](docs/01_PRODUCT_SPEC.md) | **WHAT** to build: roles, screens, F/G/R scope, 23 workflows (`WF-01..WF-23`), product acceptance checks (`AC-001..AC-025`) |
| 3 | [`docs/02_TECHNICAL_DESIGN.md`](docs/02_TECHNICAL_DESIGN.md) | **HOW** to build: stack, domains, schema, API/DTO contracts, money, security, mock-adapter boundaries |
| 4 | [`docs/03_DEMO_DATA_AND_MOCKS.md`](docs/03_DEMO_DATA_AND_MOCKS.md) | **WITH WHAT DATA**: canonical fixtures, stable IDs, two fare profiles, FX rates, mock responses and report datasets |
| 5 | [`docs/04_BUILD_TEST_DEMO.md`](docs/04_BUILD_TEST_DEMO.md) | **HOW TO PROVE IT**: Gates 0-7, 64 test cases (`TC-001..TC-064`), scenarios `S-A..S-M`, demo runbook and recovery |
| 6 | [`README.md`](README.md) | Repo entry point, setup overview, operating guide and handoff navigation; **not** an additional product authority |

**Signed-off historical reference:** [`references/Approved_PRD_v1.1.docx`](references/Approved_PRD_v1.1.docx). Product spec is the implementation authority; the Word PRD documents approved intent. The two **explicit post-audit implementation clarifications** in Product Spec §13.1 reconcile the historical document's ambiguity for the POC. For **other** material disagreements, **log the exact conflict and block the affected requirement**; do not silently pick one. Screenshots in `references/screenshots/` (when present) are visual/functionality inspiration, **not** approval to copy TripJack branding, assets or every visible module.

### What to do when sources disagree

1. Identify the subject: product behavior, engineering contract, fixture, or test/demo.
2. Read the corresponding owner document above and the cross-referenced requirement IDs.
3. If a material contradiction remains, record **paths, sections, contradictory statements, affected IDs, and proposed minimal resolution**; request approval for that specific issue.
4. Continue independent approved work. Do not resolve money, permissions, supplier behavior or scope by guessing.
5. If an approved change is made, update the **owning** specification plus affected fixtures/tests together. README or chat comments cannot override requirements.

## 3. Non-negotiable demonstration boundaries

| Topic | Approved boundary |
|---|---|
| Scope depth | **F** = stateful functional simulation; **G** = labeled guided scenario; **R** = labeled future roadmap preview. Do not silently downgrade F to G. |
| GDS | **Sabre-first simulator**; Travelport/Amadeus adapter-ready previews. No real search, inventory, PNR, ticket or refund provider calls. |
| Identity and payments | Supported synthetic-document extraction; separate **simulated** PAN/Aadhaar verification; simulated bank/UPI matching and supplier settlements. |
| Commercials | Agency Admin's downstream markup rules are **UI-only**; never alter booking fare, wallet, ledger or executive results. A simplified **Hubfares-to-OTA** rule may affect **new quotes only**. Advanced BF/TF expressions are guided UI, never evaluated. |
| Currency | INR/USD/EUR **display-only** using one seeded rate table. INR is the sample transaction/ledger currency; changing display currency cannot change POS, booking or settlement values. |
| Return booking | Fully functional **two-leg** quote/booking with one PNR/ticket/funding action; whole-itinerary cancellation only. No partial-leg or multi-city fulfillment. |
| Refund-policy versions | **Booking-time** payout-mode/version snapshot; later Admin changes affect new bookings only. Mock supplier receipt must be separately matched and **authorized payout** invoked once. |
| Fare rules | Exactly **two** reusable static time-slab profiles (`A_FLEXIBLE`, `B_RESTRICTED`); cancellation uses the booked fare snapshot. |
| Reports | Six genuine **static example XLSX** report types (~100 all-agency rows each), with **server-enforced agency scope**. They do **not** change after new demo bookings. |
| Live views | Booking data, wallet/passbook, support cases, Operations and management dashboards **do** reflect shared persisted demo transactions; cancellation rate excludes VOIDED from numerator (separate void rate). |
| Chatbot | **OTA-only scripted help assistant**, not a live LLM. It may create a support case visible to Operations; chat never directly cancels tickets or moves money. |
| Security and claims | Tenant access enforced on server; synthetic data only; clear `Demo`, `Simulated`, `Sample extract`, `Guided demo` and `Planned integration` status labels. |

Do not label this POC production-ready, audited, Sabre-certified, real-time, financially compliant, or externally integrated.

## 4. Repository layout

The **existing corrected reference package** contains the six Markdown files, the approved PRD, reference screenshots and **`fixtures/seed-contract.v1.json`**. This JSON asset is an exact deterministic input/validation oracle; the remaining fixture files and the working application are **not yet built**. The remaining items below are **implementation targets** to create; their presence is not implied by this tree.

```text
hubfares-poc/
  README.md
  AGENTS.md
  docs/
    01_PRODUCT_SPEC.md
    02_TECHNICAL_DESIGN.md
    03_DEMO_DATA_AND_MOCKS.md
    04_BUILD_TEST_DEMO.md
  references/
    Approved_PRD_v1.1.docx
    screenshots/                    # 9 file entries / 7 unique supplied reference images
  fixtures/                         # TO GENERATE from 03_DEMO_DATA_AND_MOCKS.md
    seed-contract.v1.json           # INCLUDED baseline oracle: 24 bookings + claims + expected KPI values
    agencies.json
    users.json
    flights.json
    fare-rules.json
    core-commercial-rules.json
    downstream-markup-ui.json
    bookings.json
    payments.json
    refunds.json
    fx-rates.json
    import-pnrs.json
    chatbot-scenarios.json
    documents/                     # synthetic supported text/OCR examples
    reports/                       # six real frozen XLSX report types
  src/                              # TO IMPLEMENT as specified in Technical Design
  scripts/                          # seed, reset, fixture validation, report build
  tests/                            # unit, integration, Playwright E2E
  data/                             # writable local demo SQLite; do not expose publicly
  .env.example                      # safe, committed mock defaults
  package.json / package-lock.json  # TO GENERATE; pin working dependency versions
```

The detailed Next.js route, component, service, adapter and database organization is defined in [`02_TECHNICAL_DESIGN.md` §2](docs/02_TECHNICAL_DESIGN.md). Do not invent a second mutable data store for business or KPI values.

## 5. Technology and local environment

**Locked POC architecture:** modular monolith; Next.js App Router + React + strict TypeScript + Tailwind; same-origin server APIs; file-backed SQLite with Drizzle ORM and `better-sqlite3`; Zod validation; Vitest unit/integration; Playwright E2E; ExcelJS for six real sample reports; deterministic provider adapters.

**Prerequisites for the implementation agent:**

- Node.js in a supported LTS release with matching npm; install app dependencies from the committed lockfile once generated.
- Writable local filesystem for SQLite, generated reports and seed/reset artifacts.
- Browser for desktop and mobile layout checks.
- **No** Sabre, KYC, bank, supplier or LLM credentials are required in mock mode.

**Expected `.env.example` contract** (create the file during implementation; values are not secrets):

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

Place session secrets, if necessary, in a local uncommitted `.env.local`. Restrict demo reset to an authorized seeded Super Admin/operator, mock mode and an allowlisted local demo DB. **Never reset a production database.** `DEMO_CLOCK_MODE=fixed` is recommended for repeatable fare-slab boundary testing; seed documents specify the date anchor.

### Intended development/runtime commands

**These commands are interfaces that the development agent must implement, not commands that are confirmed runnable in the reference-only package:**

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

- Local development endpoint after `npm run dev`: `http://localhost:3000` **unless the developer documents a different configured port**.
- `npm run fixtures:validate` verifies foreign keys, two fare profiles, money/PNR uniqueness, tenant ownership and report fixtures.
- `npm run reports:build` produces six **real** XLSX sample files, not CSV files with renamed extensions.
- `npm run seed` (to be implemented) establishes manifest `hubfares-v1.1-seed-002`, **translates `fixtures/seed-contract.v1.json` into 24 exact bookings, historical refund/ledger events**, then builds other linked records from the Data & Mocks spec. Fixed-clock expected baseline: **GBV INR 256,200; net revenue INR 5,941; contribution INR 5,276**.
- `npm run demo:reset` is gated/confirmed and restores canonical state; it leaves frozen Excel extracts unchanged.
- `npm run test` and `npm run test:e2e` use a **separate test database** and must record actual outcomes. `npm run build` must succeed without TypeScript errors.
- If a script has not been implemented, report it as **missing**, not passed.

## 6. First instructions to the development agent

**Before generating application code:**

1. Inspect this actual repository (do not rely on a prior chat summary). Confirm that all six Markdown files and the approved PRD are readable.
2. Read `AGENTS.md` and the four specifications **in full** in the authority order in §2. Inspect optional reference screenshots if supplied.
3. Enumerate all **23 workflows**, **25 product acceptance checks**, **64 tests**, **13 demo scenarios**, and F/G/R feature classifications. Preserve existing screen/requirement IDs.
4. List any missing **implementation assets** (currently expected: code, package scripts, JSON, demo documents, XLSX reports, migrations and tests). These are build tasks, not grounds to rewrite the spec.
5. Record any real cross-document conflict with exact sections and the blocked IDs; avoid asking questions where documents are already clear.
6. Produce a compact plan following [`04_BUILD_TEST_DEMO.md` Gates 0-7](docs/04_BUILD_TEST_DEMO.md): owner domain, dependencies, test proof and demo impact per gate.
7. Then **implement and execute**, proving each connected vertical slice end to end before marking it done.

**Starter message to paste into the new development chat:**

> Build the approved Hubfares one-day B2B capability POC from this repository. First open `README.md` and obey `AGENTS.md`. Read the four files in `docs/` in full, in numeric order, and inspect `references/Approved_PRD_v1.1.docx` for approved-baseline conflicts only. Before coding, give a concise scope/dependency inventory, identify truly missing implementation assets and any exact conflicting requirements, and outline Gates 0-7. Then implement the Next.js/TypeScript/SQLite modular monolith with persistent connected workflows, deterministic mocks, fixture generation, six scoped XLSX reports, access checks, 64 tests and 13 resettable demo scenarios. Do not invent real GDS/bank/KYC integrations or expand product scope. Execute commands, report actual test evidence and clearly distinguish complete, partial, blocked and future-only capabilities.

## 7. Build order and required evidence

Follow [`04_BUILD_TEST_DEMO.md`](docs/04_BUILD_TEST_DEMO.md) for **detailed** gate tasks; this is only the high-level navigation map.

| Gate | Outcome / prerequisite |
|---|---|
| 0 | Inventory sources, document conflicts, scaffold, mock-mode boot |
| 1 | Database/migrations, fixtures, demo accounts, tenant authorization, seed/reset |
| 2 | Registration, document extraction review, mock checks, approval, sub-users |
| 3 | Flight offers, branded fares, two rule profiles, display FX, core commercials, OTA markup UI |
| 4 | Wallet/credit, payment matching, booking revalidation, PNR, ticket and passbook |
| 5 | Cancellation/refund timing, supplier exposure and simulated offline PNR import |
| 6 | Operations, CXO, scoped Excel reports, OTA scripted Help cases and guided/roadmap screens |
| 7 | Automated/manual tests, scenario rehearsal, recovery, demo-ready evidence |

At each gate record: completed WF/screen/AC/TC IDs; code/DB/API proof; actual test result; remaining scope; blockers and next gate. An `F` requirement is **not** done when only its UI is visible.

**Stop the connected demo claim** if tenant/report data leaks, duplicate financial posting occurs, ticket and ledger contradict, fare penalty uses the wrong saved rule, reset is unsafe, a provider simulation is misrepresented as live, or the core journey is broken. Document failures and resolve them rather than hiding them with a scripted path.

## 8. Demo operation and rehearsal

Use [`04_BUILD_TEST_DEMO.md` §6-7](docs/04_BUILD_TEST_DEMO.md) for the **exact** scene, sample IDs, expected changes and recovery steps. The approved sequence is:

1. **Onboard** a new OTA: document-assist notice, upload/extract/review, separate mock verification, approval and sub-user.
2. **Configure** the OTA's credit, refund timing and simplified Hubfares commercial terms.
3. **Search and book:** BOM-LON, fare brands, both time-slab rule profiles, display-only INR/USD/EUR, revalidation, mock PNR then ticket.
4. **Show finance:** simulated bank event, one wallet credit, credit availability, passbook and downstream booking updates.
5. **Cancel/refund:** contrast supplier-settlement and eligible immediate-credit agency policies.
6. **Import PNR:** Sabre mock + permitted PCC + seeded `SBD101`; repeat import is rejected.
7. **Show separation:** Agency Admin edits UI-only INR 50/100 markup; Hub Admin demonstrates working simplified core commercial rule and guided advanced expressions.
8. **Download reports:** six static, scoped `Sample extract` XLSX files; distinguish from live passbook/CXO data.
9. **Help case:** OTA scripted multilingual menu -> owned PNR -> confirmed support case -> Operations case board; no automatic airline or wallet action.
10. **CXO intelligence:** OTA revenue/contribution, cancellations, aging/refund exposure and credit risk from current demo records; then preview future integrations.

**Validated baseline source:** `fixtures/seed-contract.v1.json` contains exact 24 records, claims, opening wallet/credit and KPI expected values. The implementing agent must not invent alternative numbers or claim other fixture files already exist.

**Reference screenshots:** The ZIP retains **nine original file entries, seven unique pictures**; reference-02 equals reference-05 and reference-04 equals reference-06 byte-for-byte. Duplicates are retained for source provenance and **do not** imply additional screens or capabilities.

**Deterministic fixture anchors**: `agency_skyline`, `agency_orbit`, `agency_aster`, `app_new_partner`, `book_seed_001`, `book_seed_011`, `SBD101`, and demo manifest `hubfares-v1.1-seed-002`. Consult the fixture specification before using or changing a record. Keep separate browser sessions for OTA and Hubfares roles where possible.

### Before presenting

- [ ] `npm run fixtures:validate`, `npm run test`, `npm run test:e2e`, `npm run build` executed with recorded results.
- [ ] All six XLSX exports open and enforce OTA vs Hubfares agency scope.
- [ ] Demonstration account method, mock date anchor, seeded PNRs and funded agency are recorded for the operator.
- [ ] `S-A..S-M` rehearsed with actual status/evidence; no hidden fail.
- [ ] Reset is restricted and restores clean seed state; recheck the key financial and booking baselines.
- [ ] Sabre, PAN/Aadhaar, bank, supplier and FX screens accurately label simulation.
- [ ] Screen share/browser zoom, offline fallback and recovery steps have been rehearsed.
- [ ] Known limitations and G/R integration dependencies are ready to disclose.

### Reset safely

1. Confirm mock mode, authorized operator and allowlisted demo SQLite path.
2. Confirm any rehearsal action is complete and back up current demo state if necessary.
3. Run authorized `npm run demo:reset` (or its protected UI equivalent) with confirmation.
4. Revalidate fixtures and verify the expected agency/PNR/booking IDs, balances and dashboard baseline.
5. Reopen/reload role-specific sessions. Run one short mutation and reset again if verifying readiness.

Never manually edit wallet balances to repair a demo. Never run reset against a live/unknown database.

## 9. Reference-package status versus implemented-product status

> **Implementation update (19 Nov 2026):** the application, fixtures, XLSX, scripts and tests are now built. See `HANDOFF.md` to run it and `docs/IMPLEMENTATION_STATUS.md` for executed evidence. The paragraph below describes the original reference package.

As this README is authored, the **documentation baseline is complete**. The repository currently contains the six controlling Markdown files (this README included), the approved Word PRD and nine user-supplied design-reference screenshots. **It does not yet imply that application source, DB migrations, JSON fixtures, images, real XLSX workbooks, npm scripts, automated tests or a runnable website have been built.**

The new development agent must create them and maintain evidence. Update *implementation status* as work proceeds, but do not rewrite these product authorities to claim incomplete work is done.

## 10. Handoff package and final proof

At handoff, the implementer must provide:

- Actual run command and verified local/demo URL (if deployment is performed).
- Git commit/version, environment template and dependency lockfile.
- Fixture manifest, seeded account/role access procedure and safe reset instructions.
- Summary of `AC-001..025`, `TC-001..064` and `S-A..S-M` with **executed** results.
- Explicit F complete/partial, G demonstrated and R preview statuses; unfinished approved requirements.
- Financial, cross-tenant, PDF/OCR, XLSX and support-case evidence.
- Known risks, unavailable external integrations and client-ready disclosure wording.

**Operating principle:** Six sources, one approved scope, one canonical demo database, deterministic mock providers, tests before completion claims, and a repeatable honest demonstration.
=======
# hubfares-demo
>>>>>>> 528126c78595311f34a2baf909dc648828cab2a2
