# HUBFARES — Product Specification

> **Document ID:** HF-PS-001  
> **Version:** 1.1.1 (post-audit corrected implementation specification of approved PRD v1.1)  
> **Baseline:** `references/Approved_PRD_v1.1.docx`, approved 19 November 2026  
> **Owner:** VARP Techlabs / Hubfares product team  
> **Target:** One-day interactive B2B travel-platform capability POC  
> **Status:** Approved scope; implementation detail only  

## 0. Instructions and scope authority

This document is the **single product-requirements authority** for the Hubfares POC. It specifies **what** must be shown and how users, workflows, business state and screens interconnect. Technical implementation choices belong to `02_TECHNICAL_DESIGN.md`; fixtures and provider simulation contracts belong to `03_DEMO_DATA_AND_MOCKS.md`; build order and exhaustive test cases belong to `04_BUILD_TEST_DEMO.md`.

The **post-audit POC implementation clarifications** in §13.1 (functional two-leg return and booking-time refund-policy snapshot) explicitly resolve ambiguities in the original Word PRD **for this demo package only**. These enumerated clarifications take implementation precedence without pretending to be new production commitments. For **any other** material conflict between the approved Word PRD and this file, **stop and report the exact conflict rather than silently choosing**. A later approved change must be added to the decision log and this document before implementation. Do not create new requirements based only on screenshots, sample prices or vendor references. TripJack is a **visual/functionality reference**, not a request to copy its branding or implement every visible service.

### 0.1 Immutable product decisions

| Area | Locked decision |
|---|---|
| Customers | **B2B only**: Hubfares is platform owner; OTAs/travel agencies are customers; no direct B2C storefront. |
| POC success | Show a coherent near-complete platform through **real local state changes** for essential flows and honest simulations for unconnected providers. |
| Time constraint | One-day POC; breadth visible, working depth prioritized; no claim of production completion. |
| GDS | **Sabre-first mock**; Travelport and Amadeus planned via adapters; **no live GDS integration/credentials**. |
| Bookings | Simulated searches, PNRs, tickets, cancellations, refunds and imports; persist linked demo records. |
| Onboarding | Supported synthetic document extraction/autofill, human review and **simulated** PAN/Aadhaar verification. |
| Wallet/payments | Simulated automated matching/credit; no real bank/UPI transfer. |
| Credit/refunds | Agency-specific, demonstrably configurable; refund timing depends on OTA policy. |
| OTA organization | Agency Admin manages agency sub-users. |
| Agency markup | **UI-only** create/edit/disable; **must not affect search fares, bookings, wallet or financial reports**. |
| Hubfares commercials | **Small deterministic functional subset** affects **future new quotes**; advanced expression/inclusion-exclusion builder is guided UI only. |
| FX | INR/USD/EUR **display-only** conversion with seeded demo rates; no change to POS/market, original price, payment or settlement currency. |
| Fare rules | **Exactly two static illustrative profiles**, with time slabs; use same selected profile from fare results through cancellation quote. |
| Reports | **Six sample XLSX download types**, ~100 synthetic rows per file, role-scoped; files are snapshots and **do not refresh** after demo actions. |
| Executive BI | **Interactive and linked to demo records**; OTA revenue, estimated contribution, cancellations, credit/refund exposure. |
| Chat | **OTA-facing** guided **scripted** support chatbot, not an LLM; PNR-scoped lookups and case creation visible to Operations. |
| Visuals | Independent Hubfares UI, premium light surfaces, orange accents and dark operations navigation. |
| Privacy/security | Synthetic identities and traveler records; agency isolation; clear Demo/Simulated labels. |

### 0.2 Delivery levels

- **F — Functional simulation:** interactive workflow, applicable validations, persistent shared demo records, downstream state changes, deterministic mock providers. Must pass behavior tests.
- **G — Guided simulation:** navigable and credible scenario with preloaded/sample outcome; not a general-purpose production capability. May create clearly labeled demo cases where specifically required.
- **R — Roadmap showcase:** useful product preview and future integrations, **no fake success** or implied completion.

A screen existing does not make its feature F. An external-provider success animation does not mean that provider was contacted. Every F flow requires honest success *and* failure/edge paths. Every G/R screen carries a visible label: `Guided demo` or `Planned integration`.

### 0.3 Primary journeys to rehearse

1. New OTA registers → sees upload-assist notice → uploads synthetic document → reviews extracted values → submits → Operations approves → Agency Admin activated.
2. Hubfares Admin sets OTA credit/refund and simplified commercial rules → OTA can see available funding and contextual policy.
3. OTA searches BOM–LON or BOM–DEL → compares fare brands/rules → switches INR/USD/EUR display → revalidates → books → receives simulated PNR, then ticket.
4. Booking appears in Manage Booking, agency wallet/passbook, Operations and executive KPIs.
5. OTA requests cancellation → uses exact fare-rule profile/time slab → shows supplier vs OTA refunds → applies agency-specific payout → dashboards update.
6. OTA imports a seeded offline PNR using GDS/PCC; duplicate attempts are blocked.
7. Simulated bank event automatically matches and credits wallet once; unmatched/duplicate events show exceptions.
8. Agency Admin configures downstream markup UI (**no fare impact**); Admin explores guided advanced commercial rule builder.
9. OTA opens Help chatbot → selects refund/change/complaint → enters owned PNR → confirms → case visible to Operations.
10. CXO compares OTA revenue/contribution/cancellations/credit risk; Operations/Agency download six **static sample** Excel report types.

---

## 1. Product model, users and navigation

### 1.1 Business boundary

Hubfares distributes flight content and supports registered travel-agency operations. Agencies can have multiple authorized users and can resell to their customers outside this POC. Supplier/GDS relationships and a possible agency downstream markup layer must remain **distinct** from the Hubfares-to-OTA commercial and wallet/credit transactions.

### 1.2 Roles

| Role | Permissions in POC | Isolation |
|---|---|---|
| `SUPER_ADMIN` | All privileged configuration and authorized all-agency access. | Hubfares scope only. |
| `HUB_ADMIN_FINANCE` | Agency credit/refund/commercial policy; finance, payments, reports, privileged user management. | All authorized agencies. |
| `HUB_OPS` | Application approvals, booking servicing, support queues, imported/manual orders, refunds and reconciliation guided flows, permitted all-agency reports. | All authorized agencies. |
| `HUB_CXO` | Interactive financial/operational analytics, drill-downs and read-only summaries. | All permitted aggregate/record views; no monetary writes. |
| `AGENCY_ADMIN` | Own agency users, markup UI, wallet/passbook, booking/servicing, own reports and support. | **Own agency only.** |
| `AGENCY_AGENT` | Authorized own-agency searches, bookings, servicing, support; sub-user permissions restrict financial and user-management actions. | **Own agency only.** |
| `AGENCY_FINANCE_VIEWER` (optional) | Agency wallet, passbook, reports; no booking or policy changes. | **Own agency only.** |

**AUTH-001** Successful role selection/login shows only permitted navigation. **AUTH-002** All record queries/actions are agency-scoped on the server if an API is used; changing a client-side ID cannot reveal other agency data. **AUTH-003** Unauthorized actions are rejected, not merely hidden. **AUTH-004** Admin impersonation/role switching, if used for demo, is visibly labeled and audited. **AUTH-005** Inactive/suspended agency cannot create new bookings, but authorized users can view prior records/support where permitted.

### 1.3 Navigation trees

- **Public:** Welcome; Partner Registration; Upload and Autofill; Registration Status; Demo Login.
- **OTA:** Dashboard; Book a Flight; Manage Booking; Import PNR; Wallet & Credit; Passbook; Reports; Manage Users; Manage Markup (Agency Admin); Amendments; Notifications; **Need Help**.
- **Operations:** Overview; Onboarding; Agencies; Users; Bookings; Import PNR; Manual Orders; Carts; Amendments; Refund Applications; Support Cases; Payment/Supplier Reconciliation; Sample Reports; GDS/PCC guided preview.
- **Admin:** Roles; Agency Policies; Credit & Payment; Core Commercial Rules; Advanced Rule Builder; Refund Rules; GDS/Supplier/PCC; Automation; Audit; FX adapter roadmap.
- **Executive:** Overview; OTA Performance; Revenue & Contribution; Sales Trends; Cancellation & Refunds; Credit Risk; Operations Performance; Reports.

Reusable tabs/drawers are preferred over 60 custom pages. Roadmap menu items **must open a meaningful labeled preview**, not a dead end.

---

## 2. Functional scope and master requirement register

The **WF-xx**, **screen IDs** and **AC-xxx** are stable cross-document identifiers. Requirement-code ranges (for example, `ONB-001–010`) denote **feature families**, not individually numbered atomic requirements; tests should cite the exact workflow, screen and acceptance criterion, never invent a meaning for an undefined sub-ID. `G` for OTA markup means interactive **UI state only**, not computed commercial behavior. `F/G` means explicitly divided functional and guided subparts.

| ID | Feature / result | Level | Governing workflow(s) | Primary UI |
|---|---|---|---|---|
| AUTH-001–005 | Role login, permissions, tenant isolation | F | All | AUTH-01 |
| ONB-001–010 | Partner registration, drafts and submission | F | WF-01 | ONB-01/03 |
| DOC-001–009 | Upload, extraction, review and autofill | F | WF-02 | ONB-02 |
| KYC-001–006 | Mock verification and green status indicators | G | WF-03 | OPS-03 |
| APR-001–007 | Approval, rejection, clarification and activation | F | WF-03 | OPS-02/03 |
| USR-001–007 | Agency sub-users and permissions | F | WF-04 | OTA-02 |
| WAL-001–010 | Wallet, payment matching, ledger and passbook | F | WF-05/18 | OTA-12/13, OPS-07 |
| CRD-001–008 | OTA credit policy and booking eligibility | F | WF-06/22 | ADM-02 |
| SRCH-001–011 | Flight search, filters, brands and comparison | F | WF-07 | OTA-03/04 |
| FARE-001–011 | Rules, two profiles and time slabs | F | WF-08 | OTA-05 |
| BOOK-001–011 | Revalidation, PNR, ticket, error states | F | WF-09 | OTA-06/07 |
| MNG-001–007 | Search/list/inspect/manage booking | F | WF-10 | OTA-08/09 |
| CAN-001–010 | Cancellation/void quotation and confirmation | F | WF-11 | OTA-10 |
| REF-001–010 | OTA-specific payout and financial state | F | WF-12 | OTA-11, OPS-06 |
| SUP-001–006 | Supplier settlement/reconciliation preview | G | WF-13 | OPS-08 |
| PNR-001–008 | GDS/PCC seeded offline PNR import | F | WF-14 | OTA-14 |
| MAN-001–005 | Manual/offline order | G | WF-15 | OPS-10 |
| AMD-001–007 | Change/reissue/rebooking guidance | G | WF-16 | OTA-17, OPS-09 |
| CART-001–003 | Draft/held booking preview | G | WF-16 / preview | OTA-18 |
| COM-001–009 | Hubfares simplified functional commercials | F | WF-17/22 | ADM-03 |
| MKP-001–009 | OTA self-managed downstream markup UI only | G | WF-04/17 | OTA-19 |
| ACR-001–010 | Advanced inclusion/exclusion commercial builder | G | WF-17 | ADM-08 |
| RPT-001–009 | Six XLSX snapshot report downloads | G | WF-18 | OTA-15/23 shared in Ops/Exec |
| EXE-001–013 | Interactive executive KPIs and drill-down | F | WF-19 | EXE-01–05 |
| CHAT-001–018 | OTA menu-driven Help, cases, lookups | F | WF-20 | OTA-20/21 |
| CASE-001–008 | Ops support queue, SLA/assignment guided | F/G | WF-20/21 | OPS-12/13 |
| NTF-001–004 | Guided notifications and alerts | G | WF-21 | OTA-16/OPS-01 |
| FX-001–009 | INR/USD/EUR display-only conversion | F | WF-23 | OTA-22, shared |
| CFG-001–006 | Policy changes propagate to new transactions | F | WF-22 | ADM-02/03/04 |
| GDS-001–005 | Provider/PCC setup preview and adapter readiness | G/R | WF-14 + preview | ADM-05, OPS-11 |
| ROAD-001–008 | Inventory, ancillary, insurance, cabs, check-in, actual integrations | R | Preview | Roadmap menus |

A detailed method/data contract for each entity is in `02_TECHNICAL_DESIGN.md`. A fixture implementing F/G scenarios must be explicitly documented in `03_DEMO_DATA_AND_MOCKS.md`. Detailed test cases must reference these IDs in `04_BUILD_TEST_DEMO.md`.

---

## 3. Workflow contracts (23 approved workflows)

Every workflow below describes actors, entry, ordered actions, resulting changes, guards and cross-module effects. **No UI screen is considered implemented until its required behavior is supported.**

### WF-01 — OTA self-registration [F] / ONB-001–010

- **Actor/entry:** Unauthenticated OTA visitor → Partner Registration.
- **Form groups:** Organization: name, estimated annual turnover (INR), entity type, PAN, GSTIN if applicable, business/agency registration and website. Director/proprietor: salutation (Mr/Ms/Mx), first/last name, email, mobile. Finance controller: same. Communications: email/mobile/optional website. Address: lines 1/2, country, state, city, PIN/postal code. Documents and acknowledgment.
- **Actions:** Open → optional Save Draft → complete fields and/or upload documents → review extracted values → Submit.
- **Validations:** Required fields and email/mobile formats; basic field dependencies; no duplicate demo PAN/agency registration; file constraints; acknowledgment before submission.
- **State/output:** Registration application and document references; `Draft → Submitted → Under Review`; visible tracking reference and status.
- **Connection:** Operations onboarding queue count increments; record links to WF-02/03; approval later activates agency and initial Admin.
- **Exceptions:** Missing required values, duplicate agency, invalid contacts, unreadable file, interrupted draft. Submit must not activate agency directly.

### WF-02 — Document upload and intelligent autofill [F] / DOC-001–009

- **Entry notice before upload:** **“Upload your business documents to automatically prefill available details. Review extracted information before submitting.”** Keep notice prominent; the user must know extraction will happen.
- **Input:** Supported sample PDF/image business documents; masked identity files where needed. Show supported file types and max size as defined in technical design.
- **Actions:** Upload → `Uploaded → Processing → Extracted` or recoverable failure → classify source → extract supported text/fields → map to application → highlight values + source/confidence → user accepts/edits → save confirmed fields.
- **Required extracted candidates:** Agency/legal name, PAN/GSTIN, name/address/contact, registration metadata if present. Do **not** invent missing values.
- **Conflict handling:** Existing manually typed value vs document value requires user choice. Low-confidence fields flagged `Review required`; failed extraction still permits manual entry.
- **Connection:** Confirmed form values persist into application; extraction does **not** set PAN/Aadhaar verification to `Verified`.
- **Exceptions:** Unreadable PDF, unsupported document, missing fields, mismatched contact, repeated upload. Use reproducible synthetic samples and actual extraction for those supported files—not a hardcoded success response for every arbitrary upload.

### WF-03 — Mock KYC and agency approval [F/G] / KYC-001–006, APR-001–007

- **Actor:** Hubfares Operations/Admin opens application.
- **Checks:** `Not Submitted`, `Pending Verification`, `Verified`, `Failed`; extracted and verified are distinct statuses. Green tick appears only for completed **simulated verification**; label as demo/mock.
- **Actions:** View submitted form and documents → run seeded PAN/identity/business mock checks → approve, reject or request more info → record decision and reviewer → update agency state.
- **Approved outcome:** Create `Active` agency, initial `Agency Admin`, basic default policies and activation alert. Application status/history remains traceable.
- **Optional rule preview:** Automatic approval can be shown as *configurable*, but may not bypass required mock checks; it is not a real KYC approval.
- **Exceptions:** Incomplete documents, mismatched values, duplicate PAN, already processed application, permissions. Rejected/pending applications cannot book.

### WF-04 — OTA sub-user management [F] / USR-001–007

- **Actor:** Agency Admin after activation.
- **Actions:** Add sub-user (name/email/mobile/role) → optionally restrict booking, cancellation and finance views → activate/deactivate/change permitted role → view agency directory.
- **Connection:** User inherits current agency ID and may only access that agency's data; audit events reflect changes. `Manage Markup` is reachable from Manage Users / Agency Settings but is separately UI-only.
- **Exceptions:** Duplicate user login, attempting to grant Hubfares roles, another agency ID, inactive organization.

### WF-05 — Automated payment matching and wallet funding [F] / WAL-001–010

- **Actor:** OTA views Wallet; Hubfares Finance/Operations views matching queue.
- **Actions:** Show wallet balance + Hubfares payment details → initiate *demo* payment or select received event → match amount/agency/reference/unique transaction ID → credit wallet exactly once → create passbook entry and notification.
- **States:** `Initiated → Received → Matched → Credited`; alternatives `Pending`, `Unmatched`, `Duplicate`, `Rejected`, `Reversed`.
- **Connection:** Wallet available amount rises; passbook and executive wallet/funding metrics reflect the same ledger. Finance may demonstrate unmatched-event resolution.
- **Exceptions:** Duplicate webhook/reference, wrong amount, wrong agency, unlinked transfer, reversal. Failed match cannot credit wallet; retry must not double-credit. No external bank activity.

### WF-06 — OTA credit terms [F] / CRD-001–008

- **Actor:** Privileged Hubfares Admin/Finance.
- **Actions:** Select agency → configure prepaid/upfront, daily, weekly or custom 15-day cycle; credit limit, effective date, blocking threshold → Save.
- **Effect:** Show approved/utilized/available credit, dues and overdue amount; booking check combines available wallet and permitted credit based on stored policy. Record version/effective date for new transactions.
- **Connections:** Agency dashboard, booking eligibility, financial-risk executive view, wallet/credit statement.
- **Exceptions:** Insufficient spending power, credit disabled, overdue blocked, unapproved agency, negative/invalid limit, unauthorized updates.

### WF-07 — Flight search, filtering and brand selection [F] / SRCH-001–011

- **Actor:** Authorized OTA agent/Admin.
- **Input:** One-way/round-trip, origin/destination, departure/return, adult/child/infant, cabin, optional preferred airline/special fare. **Functional round-trip** requires selecting **two actual seeded flight offers**, an outbound and inbound leg (each with a fare brand), before quote/review/booking. **Multi-city search/booking is not a functional POC flow** (it may be visible in markup configuration/roadmap).
- **Actions:** Submit valid criteria → Sabre simulator returns seeded flights → apply filters: airline, price, stops, departure/arrival time, duration, fare/refundability, cabin/brand → sort cheapest/fastest etc. → select branded fare.
- **Result card:** Airline, flight no., route, schedules/time zone as seeded, duration, stop count, availability, fare brands, selling price, baggage, refundability, compare/book and Fare Rules.
- **Extras:** Date-price strip, filter reset, no-results/loader, INR/USD/EUR selector applying to display equivalents only.
- **Connection:** A one-way selection creates one `quoteSegment`; a round-trip selection creates exactly two ordered `quoteSegments` (outbound, inbound) each with its own `FlightOffer + FareBrand + fareRuleProfileId + applied Hubfares commercial rule`. The quote's INR amount is the **sum** of per-leg priced components; no single-offer shortcut is permitted for return trips. Agency markup config is NOT applied.
- **Exceptions:** Return before outbound, unsupported airports, zero passengers, invalid adult/infant mix, expired/search-empty scenario. Demo market-specific GDS fare re-pricing is prohibited.

### WF-08 — Branded-fare details and time-based rules [F] / FARE-001–011

- **Entry:** Every flight option/fare brand has Fare Rules action; desktop inline expansion, mobile sheet.
- **Primary tabs:** Flight Details, Fare Details, Fare Rules, Baggage Information.
- **Fare-rule categories:** Cancellation Fee, Date Change Fee, No Show Fee, Seat Chargeable Fee. Each displays relevant timeframe, rule, amount/currency, refundable/nonrefundable note and per-passenger/per-sector applicability.
- **Profiles:** Assign **exactly two** predefined synthetic profiles `A_FLEXIBLE` and `B_RESTRICTED` (see §5.3); no extra profile invented in code. Same profile must drive later cancellation estimate.
- **Connection:** Fare brand selection stores rule-profile ID; booking snapshots fare/rules; cancellation uses that snapshot, not mutable current defaults.
- **Exceptions:** Tab with no seeded fee shows meaningful `Not available in demo` or explicit rule, not invented result. Note airline fee indicative and taxes/service charges may apply.

### WF-09 — Revalidate, book, issue PNR/ticket [F] / BOOK-001–011

- **Entry:** Selected flight/fare.
- **Actions:** Revalidate **every selected leg** (success/price changed/failure) → if any leg changes, require acceptance of **the full new itinerary total** → collect traveler names and applicable fields → review both legs/price/terms for return → check funding on the **total** → confirm → generate one internal booking ID for the itinerary → one simulated GDS PNR → `Ticketing Pending` → simulated `Ticketed` with ticket reference(s). Persist two ordered booking segments for return trips; a failed leg blocks or safely rolls back the entire booking. A one-way trip contains one segment.
- **Connection:** New booking is agency-scoped and visible in Manage Booking, Operations and executive aggregates; ledger posts reserved/charged funds at one consistent chosen stage, preventing duplicates. Booking snapshots base currency, policies, supplier cost, selling price and fare rules.
- **Critical:** **PNR creation and ticket issuance are distinct**; ticket number never appears before ticket state. Round-trip F scope is **full-itinerary booking and full-itinerary cancellation only**; partial passenger/leg cancellation and multi-city are deferred. Ticket issuance is one atomic itinerary operation, not two separately billed bookings.
- **Exceptions:** Insufficient wallet/credit, fare expired, price change declined, PNR failure, ticketing failed. Any held funds on failed booking must release/reverse once. No airline was contacted.

### WF-10 — Manage Booking [F] / MNG-001–007

- **Actor:** OTA own agency; Operations all permitted agencies.
- **List fields:** Booking ID, created date, OTA, passenger, route, airline, GDS/provider, internal/GDS/airline PNR (if available), ticket reference, booking/ticket/payment status, amount/currency, imported/manual flag.
- **Filters:** Date window, booking ID/PNR, agency (Hubfares roles), passenger, route, airline, fare type, GDS, status.
- **Detail:** Itinerary, passenger and ticket, quote snapshot, fare rules, wallet/credit impact, cancellation/refund/amendment history, applied policy.
- **Actions:** Open details, available cancellation, guided amendment, refund case/support. Action availability follows permissions and ticket state.
- **Exceptions:** Unknown PNR, cross-agency lookup, invalid action on cancelled/failed booking, unissued ticket.

### WF-11 — Cancellation vs void [F] / CAN-001–010

- **Entry:** Eligible ticketed booking; select **Cancel full itinerary** or **Void full itinerary** when the mock provider permits. Partial passenger/segment selection can be shown as roadmap-only, never as a functioning Phase 0 action.
- **Actions:** Determine mock void eligibility separately from cancellation → compute illustrative penalty using the **booked fare-rule profile for each selected booked segment**, based on that segment's scheduled departure and fee applicability → sum applicable penalties/fees (one-way: one segment; round-trip: two segments) → itemize supplier penalty, disclosed Hubfares fee, nonrefundable components/tax assumptions → calculate one estimated full-itinerary OTA refund → display confirmation → transition booking and create one refund claim. **Partial passenger/leg cancellation is not a functional POC action.**
- **Connection:** Refund logic WF-12, ledger/credit, supplier receivable, Ops queue, CXO cancellation trend. **Do not credit twice.**
- **Exceptions:** Already voided/cancelled, unissued ticket, after-departure no-show, quote not available, negative estimate; no unsupported partial-sector/partial-passenger success.
- **Disclosure:** The agent-facing charge may include legitimate disclosed service fees; never imply that an airline void is identical to a normal refund, and never hide fee treatment.

### WF-12 — Agency-specific refund payout [F] / REF-001–010

- **Entry:** Approved cancellation/refund claim under agency refund policy.
- **Path 1 — settlement-based:** `Requested → Validated → Approved → Pending Supplier → Supplier Funds Received → Wallet Credited → Reconciled/Closed`.
- **Path 2 — eligible immediate:** `Requested → Validated → Approved → Wallet Credited → Supplier Receivable Outstanding → Supplier Settled → Reconciled/Closed`.
- **Rules:** Payout timing and approval thresholds configurable per agency; supplier eligibility and received amount separate. **The effective agency refund payout policy is snapshotted at booking creation (or imported-booking record creation); cancellation uses that immutable version even if Admin changes agency policy later.** New versions apply only to bookings created afterward. No retroactive override is executable in Phase 0. Record refund policy ID/version/mode in booking and claim, estimated/actual amount and one-time wallet-credit reference.
- **Connection:** OTA Refund Tracking, passbook, Ops Refund Queue, supplier aging and CXO risk/cancellations.
- **Exceptions:** Supplier pays later/different amount, hold, rejected, partial settlement, duplicate refund; no promise of a real bank/airline payout.

### WF-13 — Supplier refund matching [G] / SUP-001–006

- **Actor:** Hubfares Operations/Finance.
- **Steps:** Open claim → choose preloaded supplier statement/refund event → compare expected and received → Match or Exception → show pending/settled aging and operations resolution.
- **Connection:** The *supplier statement match UI* is guided, but matching an explicitly triggered **mock supplier-received event must persist a receipt and make an approved settlement-based claim eligible for the functional one-time wallet payout endpoint** (WF-12). The receipt alone must **not** post a wallet credit; a distinct authorized payout action does. CXO supplier receivable views reflect coherent case state. No real external payment is implied.
- **Exceptions:** Delayed settlement, underpayment, unmatched reference, manual review.

### WF-14 — Import offline PNR [F] / PNR-001–008

- **Actor:** Authorized OTA/Admin or Hubfares Operations.
- **Steps:** Select GDS (Sabre default; Travelport/Amadeus options simulated), permitted PCC, known sample PNR → mock retrieve → display complete itinerary/passengers/ticket status → confirm agency mapping → import once.
- **Connection:** Booking gets internal ID and source `IMPORTED`; appears in Manage Booking and executive aggregates; original GDS/PCC references preserved. **Six static XLSX files remain unchanged.**
- **Exceptions:** Unknown PNR, already imported, wrong GDS/PCC, agency mismatch, missing permission. Import is a retrieve-and-create operation, **not** ticket issuance.

### WF-15 — Manual/offline booking [G] / MAN-001–005

- **Actor:** Hubfares Operations.
- **Steps:** Enter example agency, itinerary, passenger, supplier reference, amount → review → confirm demo manual order → show identifiable offline/manual record.
- **Connection:** Guided mock order links to agency where appropriate; no GDS ticket or real supplier execution implied.
- **Exceptions:** Missing supplier reference, invalid agency, incomplete itinerary.

### WF-16 — Amendments, reissue, rebooking and hold [G] / AMD-001–007, CART-001–003

- **Steps:** Open ticketed booking → choose date change, permitted correction, rebooking, or ancillary request → select predefined new option → display fare difference + amendment charge → submit demo amendment case → show `Requested → Quoted → Approved → Reissued/Closed` timeline.
- **Extras:** Sample draft/held booking card, expiry countdown/indicator and retrieve-held-booking preview. Case notes appear in Operations.
- **Limit:** Airline-dependent name/passport changes, baggage, seats, meals and reissue are **guided previews**, not live ticket changes. Multi-city full flow is roadmap.

### WF-17 — Two separated commercial layers [F/G] / COM-001–009, MKP-001–009, ACR-001–010

1. **Hubfares → OTA simplified core rule (F):** privileged Admin selects agency and limited criteria (global, agency, airline/route) → sets illustrative commission/rebate, markup/service fee effective for **new quotes** → saves → sees applied rule on new search quote. Existing booked prices are immutable snapshots.
2. **OTA downstream markup (G UI-only):** Agency Admin creates/edit/deactivates fixed or percentage rule filtered by journey (Domestic/International/Both), trip type (One-way/Return/Multi-city), airline and cabin; optional user assignment. Seed examples: **Domestic INR 50; International INR 100**. **Absolutely no computed effect** on Flight Search, Booking, Wallet, refunds or CXO POC financials. Mark UI `Configuration preview—fare integration planned`.
3. **Hubfares advanced rule builder (G):** rule header (description, priority, enabled, airline, search/air type); inclusion/exclusion for travel/booking period, flight number, supplier, sector, destination, marketing/operating carrier, fare basis, booking class, private account code, user, pax type, price, cabin, weekday; lines (IATA commission/markup/service fee, expressions e.g. `5*BF`, `1*TF`, fixed INR 270/180; per booking/all segments/infant flags), add/remove lines, preview/history.
- **Critical boundaries:** `BF` and `TF` are reference expressions with **undefined production semantics**; **do not execute** them. Advanced builder/history does not evaluate rule conflicts, settlement or tax. OTA markup does not alter Hubfares core price.

### WF-18 — Passbook + sample report downloads [F/G] / WAL-*, RPT-001–009

- **F passbook:** Agency-scoped debit/credit transaction list with opening balance, booking/payment references, timestamp, refunds/adjustments and computed closing balance; date filter. Derived from ledger and **updates with demo actions**.
- **G reports:** six XLSX files (~100 synthetic rows each): Booking-based `Airline Transactions`, `Booking Transactions`; Amendment-based `Refund Transactions`, `Exchange Transactions`, `Ancillary Services`, `Others`.
- **Access:** Hubfares Admin/Call Center all-authorized agencies; read-only CXO may download the same **all-agency** fixed reports; OTA users **own agency rows only**; no frontend-only filtering of all-agency file. The **same** report catalogue/export component (`OTA-15/23`) is reused within the authorized Operations and Executive navigation **without additional screen IDs or independent report engines**. Samples labeled `Sample extract` and **remain static** after demo actions.
- **Connection:** Reports may share seeded IDs with core system but are not the live analytics data source; CXO dashboards are live within POC.

### WF-19 — Executive business intelligence [F] / EXE-001–013

- **Actor:** CXO, Super Admin, authorized Finance.
- **Views:** Overview; OTA revenue/contribution; Sales Trends; Cancellation/Refund Trends; Financial Risk/Credit; Operations Performance; Booking Funnel if seeded events exist.
- **Filters:** Date range, OTA, airline, route, domestic/international, ticket/refund state; date basis and cohort definitions visible. Compare prior period if fixtures support it.
- **Drill-down:** KPI → associated OTA/booking/refund records; rank best/worst OTAs by contribution/cancellation and overdue credit.
- **Live demo link:** New booking / cancellation / refund / wallet credit / credit policy changes update aggregates where relevant. Static XLSX reports do not update.
- **Critical definitions:** §7 below; contribution is **illustrative**, not audited company profit. Avoid double counting refunds or supplier cost.

### WF-20 — OTA guided support chatbot [F] / CHAT-001–018

- **Actor/entry:** Signed-in OTA user clicks persistent `Need Help` bubble (dashboard/booking screens). Help drawer opens, greets, offers language and main menu. **No live LLM**.
- **Main menu:** Claim a Refund, Refund Status, Flight Status, Change Flight, Modify Booking, Complaints/Support, More Options, Language. Nested menus in §8.
- **Lookup:** Ask PNR or case ID where applicable; optionally prefill selected booking context; verify current agency ownership; display seeded state and useful next choices.
- **Action:** Refund/amendment/complaint requests show summary and explicit `Submit request`; generate **internal demo support case** with stable ID/status, visible to Operations. Submission is **not** airline cancellation/refund/change execution.
- **Navigation:** Back, Main Menu, Restart, Change Language, Close and Call Center escalation; preserve context when appropriate.
- **Exceptions:** Other-agency PNR returns neutral not-found, unsupported requests get fallback; never fabricate flight status/refund timing or silently change money.

### WF-21 — Operations cases, alerts [F/G] / CASE-001–008, NTF-001–004

- **F:** Cases created via chatbot appear in authorized Operations queue with agency, category, related booking/PNR, issue summary, origin and reference; basic status tracking.
- **G:** View examples of onboarding, ticketing exception, overdue credit, unmatched payment, pending supplier refund; assign operator, priority/SLA, change `Open → Assigned → In Progress → Awaiting External → Resolved/Closed`; show notification previews.
- **Limit:** Real email/SMS/WhatsApp delivery and customer service SLA automation are future integrations.

### WF-22 — Configuration changes affect outcomes [F] / CFG-001–006

- **Admin action:** Change agency credit term/limit, **simplified Hubfares** commercial rule or agency refund policy.
- **Expected:** Subsequent booking eligibility and **new quotes** follow effective credit/core commercial settings. **Newly created bookings** snapshot the then-effective refund payout policy. **Cancellation of a previously created booking follows its original refund-policy snapshot**, even when Admin has since published a new policy. Existing quote, fare and ticket snapshots remain fixed. Show both policy versions and effective dates; no silent retroactive payout changes.
- **Connections:** OTA operations, ledger/passbook, Ops and CXO dashboard update coherently; sample XLSX remains fixed.
- **Negative constraint:** Neither OTA downstream markup UI nor advanced expression builder changes pricing/financial state.

### WF-23 — Display currency INR/USD/EUR [F] / FX-001–009

- **Surfaces:** Results, fare details, booking review, confirmation; common selector persists through current journey.
- **Actions:** Select INR/USD/EUR → derive same base offer price using **single seeded rate table** with rate date and `Demo rates` source label → consistently round **display** amount; retain original currency alongside converted equivalent where useful.
- **Invariant:** No API market/POS switch; no mutation of supplier/booking/ledger currency, wallet charge, tax or credit utilization. Does not change original GDS quote or open live Sabre FX integration.
- **Failure:** If demo rate unavailable, show original price with a clear notice; no invented exchange rate.

---
## 4. Complete screen inventory and interactive behavior

**Convention:** Screen IDs refer to experiences; they may be routes, tab sets, drawers, dialogs or shared widgets. Do not create duplicate pages for a modal. F screens must read/write shared records; G/R screens should make their limits visible. Every page needs a title, navigation/back behavior and loading/empty/error states appropriate to its level.

### 4.1 Public, identity and onboarding

| ID | Screen | Level | Critical UI, inputs and actions | Record/transition |
|---|---|---|---|---|
| PUB-01 | Welcome / Partner Portal | F | Hubfares product pitch, `Partner Registration`, `Demo Login`, no retail ticketing. | Starts onboarding/session. |
| AUTH-01 | Demo Login / Role Selection | F | Predefined accounts or role selector, agency context, logout, role-aware menu, obvious demo badge. | Authorized session and agency scope. |
| ONB-01 | Agency Registration | F | Organization, turnover, director/proprietor, finance contact, communications, address, PAN/GST where appropriate, consent, draft/submit. | Creates/updates RegistrationApplication. |
| ONB-02 | Document Upload / Autofill Review | F | Notice before upload; drag/drop/file picker, file status, preview, extracted fields, confidence indicator, edit/accept, retry. | Document + confirmed form values; not KYC Verified. |
| ONB-03 | Registration Status | F | Application reference, timeline, pending/more-info/rejected/approved, re-open requested fields. | Reflects Operations decision. |

### 4.2 OTA portal

| ID | Screen | Level | Critical UI, inputs and actions | Shared state or scope |
|---|---|---|---|---|
| OTA-01 | Agency Dashboard | F | Wallet/credit cards, bookings, ticketed count, refunds, recent transactions, quick Search/Import, next payment due, Help. | Own agency; live demo aggregates. |
| OTA-02 | Agency Users | F | User list, create, edit limited permissions, activate/deactivate, Manage Markup entry. | AgencyUser; authorized admin. |
| OTA-03 | Flight Search | F | One-way/return, airports, dates, traveler mix, cabin, optional airline/special fares, clear/search. | Search criteria, agency/policy context. |
| OTA-04 | Results / Branded Fares | F | Date fare strip, cheapest/fastest, filters/sort, expandable flight cards, fare brands, compare, Fare Rules, Book, currency. | Selected offer/brand, rule profile, quote. |
| OTA-05 | Fare Details / Rules | F | Flight/Fare/Fare Rules/Baggage tabs; cancellation/change/no-show/seat fee sub-tabs; time slabs and details note. | Two approved rule profiles. |
| OTA-06 | Passenger / Booking Review | F | Traveler info, fare check, currency equivalent, base amount, conditions, funding check, confirm. | Creates pending booking on confirmation. |
| OTA-07 | Booking Confirmation / PNR | F | Internal ID, simulated PNR, ticket status, ticket number when issued, itinerary, next steps. | Linked booking/ticket/financial state. |
| OTA-08 | Manage Booking List | F | Filters for date, PNR, passenger, route, airline, GDS, status; own rows. | Agency-scoped booking query. |
| OTA-09 | Booking Detail / Servicing | F | PNR/ticket/passengers/itinerary/policy/history; Cancel, Refund status, guided Amend, Help. | Booking detail/action eligibility. |
| OTA-10 | Cancellation / Refund Quote | F | Void eligibility, time slab, supplier fee/service fee, refundable components, estimated refund; confirm. | Cancellation + claim once. |
| OTA-11 | Refund Tracking | F | Refund reference, state timeline, policy timing, supplier pending vs agency credited. | Own refund claims and ledger effects. |
| OTA-12 | Wallet / Credit | F | Wallet balance, add demo funds, approved/utilized/available credit, dues; payment scenario. | Ledger and credit policy. |
| OTA-13 | Payment Passbook | F | Debit/credit, reference, date filter, running/open/close balance, refund movements. | Real shared ledger; **not** static reports. |
| OTA-14 | Import PNR | F | GDS, PCC, sample PNR, retrieve, itinerary preview, confirm import, error/duplicate state. | Imported booking. |
| OTA-15 | Reports | G | Two categories, six report cards, Sample badge and download. | Agency-authorized XLSX snapshot. |
| OTA-16 | Notifications / Profile | G | Notices, activity, profile preview; where linked, seeded event notifications. | Safe preview. |
| OTA-17 | Amendment / Rebooking Wizard | G | Choose change type, quote and difference, review, create guided case. | Demo amendment case, no GDS action. |
| OTA-18 | Manage Carts / Held Bookings | G | Sample cart, hold status/expiry, retrieve and preview. | Guided draft/hold scenario. |
| OTA-19 | Manage Markup | G | Agency Admin only; add/edit/disable rules by journey/trip/airline/cabin/amount; clear UI-only notice. | Saved UI configuration **never** price. |
| OTA-20 | Need Help Chat Drawer | F | Floating icon, greeting, language, menu, Back/Restart/Close/Escalate. | Scoped scripted conversation. |
| OTA-21 | Chat PNR / Case Summary | F | PNR or case ID input, neutral not-found, known record summary, confirmation, internal case reference. | Owned booking/case; Ops queue. |
| OTA-22 | Currency Switcher | F | INR/USD/EUR on offer/review/confirmation, rate source/date notice. | Display only; not finance. |
| OTA-23 | Report Download Dialog | G | Choose XLSX, show row scope + sample snapshot notice, download. | Own-agency file selection. |

### 4.3 Hubfares Operations / Call Center

| ID | Screen | Level | Critical UI, inputs and actions | State |
|---|---|---|---|---|
| OPS-01 | Operations Overview | F | Pending agency applications, booking/refund counts, alerts, shortcuts, support cases. | Shared all-authorized data. |
| OPS-02 | Agency Applications | F | Queue, filters, statuses, open review. | Application records. |
| OPS-03 | KYC / Approval Detail | F/G | Source docs, extracted/verified distinct, green status ticks, simulate checks, approve/reject/more-info. | Agency activation. |
| OPS-04 | Agency Directory | F | Agency details, status, users, bookings, policy summary, safe navigation. | All-authorized agencies. |
| OPS-05 | All Bookings | F | Global filters, PNR/ticket/agency/status, open details and authorized actions. | Shared booking query. |
| OPS-06 | Cancellation / Refund Queue | F/G | Live created refunds, policy and status; supplier processing guided. | Refund/claims and exceptions. |
| OPS-07 | Payment Matching | F | Events, matched/unmatched/duplicate states, resolution scenario, linked ledger. | Payment / Wallet. |
| OPS-08 | Supplier Refund Reconciliation | G | Supplier claim/statement preview, expected vs received and exception. | Guided supplier claim. |
| OPS-09 | Amendment/Rebooking Cases | G | List submitted changes, sample quote and status. | Guided case timeline. |
| OPS-10 | Manual Order | G | Agency/itinerary/reference/price form, preview, show offline record. | No supplier ticket. |
| OPS-11 | GDS/PCC Queues | G/R | Configured providers/PCC, sample queue notification, planned connection badge. | No live queue polling. |
| OPS-12 | Support Cases / Assignment | G | Case list, owner, priority, SLA, status timeline, escalation preview. | Guided operations. |
| OPS-13 | Chatbot-originated Cases | F/G | Real in-demo submitted case, reference, originating OTA/PNR, Ops visibility, guided assignment. | Same case ID as chat. |

### 4.4 Admin and configuration

| ID | Screen | Level | Critical UI, inputs and actions | State |
|---|---|---|---|---|
| ADM-01 | Roles / Users / Permissions | F | Role catalog, authorized activation/permission changes. | User access. |
| ADM-02 | Credit & Payment Policies | F | Agency selector, prepaid/daily/weekly/custom, limit, due rules, activate. | New booking eligibility. |
| ADM-03 | Hubfares Core Commercial Rules | F | Simple global/agency/airline/route criteria, fee/commission, active/effective, preview applied. | New quote sell price. |
| ADM-04 | OTA Refund Policies | F | Agency selection, immediate-eligible vs supplier-settlement, approval/limit; version/effective date. | **New bookings snapshot new policy; existing booking claims retain booked version.** |
| ADM-05 | GDS / Supplier / PCC | G | Sabre-first simulated provider, Travelport/Amadeus adapter/PCC placeholders, safe status. | Guided setup only. |
| ADM-06 | Workflow / Notification Settings | G | Approval triggers, notifications, automation rules preview. | No real external delivery. |
| ADM-07 | Audit Trail | G | Seeded plus relevant recorded events; actor/action/time/reference. | Product audit story. |
| ADM-08 | Advanced Rule Builder + History | G | General criteria, include/exclude, expression rows, per booking/segment/infant, priority, history. | Preview only; expressions not executed. |
| ADM-09 | FX Adapter Settings | R | INR/USD/EUR supported, seeded rate source, future provider adapter, integration status. | Do not claim Sabre FX connected. |

### 4.5 Executive management

| ID | Screen | Level | Critical UI, inputs and actions | State |
|---|---|---|---|---|
| EXE-01 | Executive Overview | F | GBV, retained agency sales, revenue, contribution, margin, active OTAs, exposure, filters. | Live shared demo aggregation. |
| EXE-02 | OTA Revenue / Profitability | F | Rank OTA by bookings, sales, net revenue, contribution, margin%, cancellation%, credit outstanding; drill down. | Agency/booking-ledger aggregates. |
| EXE-03 | Cancellation / Refund Trends | F | Time trend, cancellations by agency/airline/route, pending vs settled, refund aging. | Booking and refund cohorts. |
| EXE-04 | Credit / Financial Risk | F | Credit limit/utilization/overdue, wallet trend, unmatched payments, supplier receivable/agency refund obligations. | Finance state. |
| EXE-05 | Operations Performance | F/G | Approval time, cases and SLA, ticketing issues, refund turnaround, workload; seeded where guided. | Ops records/events. |

### 4.6 Shared component contract

| Component | Behavior |
|---|---|
| User/agency context | Current role and permitted agency always visible; never silently switch tenant. |
| Search/filter toolbar | Clear / reset, current filter chips, expected loading, no-results panel. |
| Booking/fare details drawer | Consistent selected offer/brand/currency and rule profile; accessible close/back. |
| `Demo Environment` label | Persistent but discreet across portals. |
| Status labels | Use separate visual semantics for verified vs extracted, ticketed vs PNR-created, pending supplier vs credited, F vs G/R. |
| Confirmation dialog | Before approval, booking, cancellation, credit/refund or case submission. |
| Notification/toast | Explain success/failure and link to affected record; no false external-provider completion. |
| Download control | Sends only agency-appropriate sample XLSX. |
| Demo launcher/reset | Authorized user can restore deterministic seed data; explicit confirmation and status. |
| Help bubble | OTA only; remains available within relevant agency portal screens. |

---

## 5. Detailed field, rule and financial specification

### 5.1 Registration form rules / ONB-*, DOC-*, KYC-*

| Group | Mandatory fields / behavior | Validation / note |
|---|---|---|
| Organization | Agency name, estimated turnover, organization type, PAN (synthetic) | GSTIN and registration ID where applicable; website optional. |
| Director/proprietor | Salutation, first/last name, email and +91 mobile for Indian example | Field-level valid format; no real KYC assertion. |
| Finance controller | Salutation, first/last name, email, mobile | Can differ from director. |
| Communication | Email and mobile | Website optional. |
| Registered address | Address 1, country, state, city, postal code | Address 2 optional. |
| Documents | PAN, relevant business registration/GST evidence, optional masked identity example | Show upload, extraction, source and review. |
| Consent | Acknowledge correctness and document-use explanation | Required before submit. |
| Status | Draft/submitted/under review/approved/rejected/more-info | Show timeline and rejection/clarification reasons. |

**Document extraction ≠ document verification.** Always show the user's reviewed value as the form's final value. Green KYC ticks represent **mock verification**, not OCR success. Do not store or display raw Aadhaar numbers unnecessarily.

### 5.2 Agency-admin downstream markup / MKP-*

| Field | Allowed POC UI values |
|---|---|
| Rule name | Short user-defined label |
| Journey | Domestic / International / Both |
| Trip Type | One-way / Return / Multi-city (criterion only) |
| Airline | All / selected available airline(s) |
| Cabin | All / Economy / Premium Economy / Business / First |
| Markup type | Fixed amount / Percentage |
| Value | Positive numeric amount or percentage; display currency or percentage suffix |
| Target | Agency-wide; optional selected sub-users |
| Enabled | Active / Inactive |
| Actions | Add, Edit, Save, Disable; optional **hypothetical** calculation explanation |

**Must not wire to search results, final fare, ledger, booking, refund, executive KPIs or taxes in Phase 0**. Saving UI state should be demonstrable; no backend pricing dependency. An OTA's end-customer selling layer is outside this B2B portal.

### 5.3 The **only two** approved fare-rule profiles / FARE-*

These amounts are **synthetic** illustrative samples, not airline rules. Use identical numbers in fixtures, fare details, booking snapshots and cancellation quotation; do not copy different numbers from reference screenshots as additional profiles.

| Profile | Time before scheduled departure | Cancellation fee | Date change fee |
|---|---|---|---|
| `A_FLEXIBLE` | 0–2 h | Non-refundable | Not permitted |
| `A_FLEXIBLE` | 2–24 h | INR 1,999 + INR 50 fee | INR 2,500 + fare difference |
| `A_FLEXIBLE` | >=24 h | INR 1,047 + INR 50 fee | INR 1,500 + fare difference |
| `B_RESTRICTED` | 0–2 h | Non-refundable | Not permitted |
| `B_RESTRICTED` | 2–24 h | INR 5,000 + INR 50 fee | INR 3,500 + fare difference |
| `B_RESTRICTED` | >=24 h | INR 3,000 + INR 50 fee | INR 2,000 + fare difference |

- **No Show:** sample default non-refundable after departure, except explicit seeded rule variation within an existing profile; do not invent a third profile.
- **Seat chargeable fee:** indicative airline/seat-dependent display; not assumed refundable.
- **Time windows:** `S0` is departure in **less than 2 h**, `S1` is **2 h up to but excluding 24 h**, `S2` is **24 h or more**; exactly 2 h belongs to `S1` and exactly 24 h to `S2` (Technical Design §4.2). For round-trip full-itinerary cancellation, calculate the slab **separately per booked segment's scheduled departure**, using each segment's stored rule profile, then aggregate one quote. Show the first upcoming departure as a summary, but **never reuse its slab for a different leg**. Charges in the seeded F model apply once per eligible booked segment per adult passenger; other passenger-specific treatments must be explicit fixtures rather than guessed.
- **Currency:** Values in approved samples are INR; display FX equivalents informational only. Underlying fee calculation uses stored booking/policy currency with explicit conversion if different, to be specified technically.
- **Refundability:** A branded fare's general `Refundable` label does not override a time-slab `Non-refundable` condition near departure. Both may be shown with context.
- **Snapshot:** Each booking **segment** keeps fareRuleProfileId and applicable values, and booking stores the originally effective refund-payout-policy version. Later rule/policy edits cannot rewrite transaction history. Cancellation-time clock selects a slab from the stored rule snapshot.

### 5.4 Flight quote and booking financial components / BOOK-*, COM-*

Distinguish these terms:

- `Supplier base charge` and `Supplier taxes/fees` — synthetic amount Hubfares owes supplier.
- `Hubfares-to-OTA sell amount` — configured agency-facing amount including **simplified executable Hubfares commercial rule** and disclosed fees.
- `Agency rebate/commission` — Hubfares commercial commitment tracked separately when applicable.
- `OTA downstream markup` — **UI-only proposed rule**, not part of any POC quote.
- `Display currency equivalent` — FX preview, not charged amount.
- `Wallet debit / credit utilized` — funding settlement for agency-facing booked price.

**Pricing invariants:** Applied rule is recorded with quote/booking; taxes and fees must not double-count; fare revalidation requiring acceptance before booking; no ticket before simulated issuance; price cannot change historically when Admin modifies a rule.

### 5.5 Ledger and credit model / WAL-*, CRD-*

- Agency ledger includes unique ID, agency ID, reference, type, amount, currency, created-at, status, debit/credit direction, idempotency key and audit reference.
- Account view shows opening balance + credits − debits = closing balance; actual booking debit may use reservation/hold before ticket success; choose one consistent accounting sequence in technical design.
- Credit facility is **separate** from prepaid cash wallet. `available spending power` is determined from positive wallet availability plus permitted credit availability subject to policy and overdue blocks. **Do not add liabilities to wallet cash balance.**
- A payment event cannot credit the same unique external reference twice; reversal should be an explicit compensating ledger record, not silent mutation of prior entry.
- A refund posted to wallet can happen at most once per approved refund/payout event; linked refund case tracks settlement separately.
- Passbook may list booking debits, payment credits, eligible refund credits, adjustments and reversals; filters by date and booking/reference.
- Executive metrics should use aggregate underlying ledger/claims, not a second independent hardcoded finance dataset for recent actions.

### 5.6 Cancellation / refund estimation / CAN-*, REF-*

1. Retrieve original fare/penalty **snapshot**, passenger/sector applicability, scheduled departure time, original charged amount, refundable/nonrefundable components.
2. Determine applicable static time slab and mocked void eligibility. Display both reasons and sample status.
3. Quote `estimated OTA refund = eligible refundable charge components − applicable supplier penalty − separately disclosed eligible service charges`, bounded to nonnegative and no greater than refundable paid amount. Actual calculation contract and tax assumptions will be specified in Technical Design.
4. Show break-up clearly, including supplier/airline penalty vs Hubfares service charges; request explicit user confirmation.
5. Create cancellation status and refund claim once; apply OTA-specific payout timing. If paid immediately, separately retain supplier receivable; if supplier-based, hold agency wallet credit until seeded settlement event.
6. Reconcile supplier receipt vs expected amount without inventing a bank event. Under/over-settlement produces Operations exception, not silent rounding.

**Never** use the current fare-brand UI amount instead of a booking/segment snapshot when calculating a previously created booking's refund. **One refund claim covers an entire eligible return itinerary; evaluate each leg's own slab before adding fees and refund components.** Historical fee and refund-payout-policy versions remain immutable for old records.

### 5.7 Core Hubfares commercials vs advanced builder / COM-*, ACR-*

**Functional simplified commercial** supports global or selected OTA and limited airline/route criteria, percentage/fixed fee with defined currency/calculation base, enable/effective date, preview and priority. For POC the precedence is: authorized booking-level exception (if implemented) → agency + airline/route → agency default → supplier/GDS/airline default → global default. Do not silently invent conflict-resolution rules; Technical Design formalizes exact deterministic evaluation.

**Guided advanced builder** has:

| Group | Reference fields |
|---|---|
| Header | Description, priority, search type, air type, airline, enabled, view plans/history |
| Inclusion/exclusion | Travel period, booking period, flight numbers, supplier IDs, sector, destination |
| Carrier/fare | Marketing/operating carrier, fare basis, booking class, private account codes |
| User/pax/price | User ID, Adult/Child/Infant, price range, cabin, weekdays |
| Commercial line | IATA commission, Markup, Service Fee; expression (`5*BF`, `1*TF`, `270`, `180`) |
| Applicability | Booking, all segments, infant flag; add/remove and order lines |
| Preview/history | Show chosen criteria and expression text; revision record; **not** evaluated against live offers |

`BF`, `TF`, supplier-specific IATA contracts, segment/tax calculation semantics are **unconfirmed**. No arbitrary rule evaluator in one-day POC.

### 5.8 Currency display / FX-*

- Supported selector values: **INR / USD / EUR**.
- Rate source: fixed seeded `Demo` rate table with effective date; show original currency and selected display equivalent when meaningful.
- Same offer/brand must show consistent converted amount on Results, Fare Details, Review and Confirmation; apply one clearly documented rounding convention.
- Original booked fare/settlement/credit/wallet remains in its authoritative stored currency; display FX does **not** alter POS/market or airport-specific availability.
- No real Sabre currency endpoint required; future FX provider integration is an adapter concern. Sabre rates must not be assumed authorized, available, or universally valid across Travelport.

### 5.9 Report catalogue / RPT-*

| Category | Excel report | POC scope | Sample columns (as applicable) |
|---|---|---|---|
| Booking-based | Airline Transactions | ~100 fixed sample rows | Date, agency, booking, PNR, airline, route, fare, supplier, amount/status |
| Booking-based | Booking Transactions | ~100 fixed sample rows | Date, agency, booking, pax reference, PNR, fare type, price, currency, status |
| Amendments | Refund Transactions | ~100 fixed sample rows | Case/booking ID, agency, requested/credited, supplier status, amount/date |
| Amendments | Exchange Transactions | ~100 fixed sample rows | Original/new booking, agency, reissue, change fee, fare difference, status |
| Amendments | Ancillary Services | ~100 fixed sample rows | Booking, agency, service type, supplier, amount, status |
| Amendments | Others | ~100 fixed sample rows | Case, agency, adjustment/other service, amount, status |

- Files physically downloadable as **`.xlsx`**, not merely CSV renamed to XLSX.
- `HUB_OPS`/authorized Admin can download all agency rows; OTA users receive only their agency's rows. If pre-generating files, generate safe agency-specific variants. A browser-only filter of all-agency Excel is a **security bug**.
- Filenames, dates, row scope, `Sample/Illustrative` label and extract timestamp are visible.
- Static sample report snapshots remain valid even after a demo booking; **do not misrepresent them as live refreshed output**. Ledger/passbook and executive dashboard do update.

## 6. OTA guided support chatbot — complete decision tree

Phase 0 chatbot is **OTA-only**, scripted and finite-state. It is **not** a generative LLM. The chatbot must feel helpful and fully navigable within its supported intents and must not claim to perform GDS or bank operations. Chat language controls menu labels/scripted copy; don't promise free-form multilingual NLP.

### 6.1 Shared conversational steps / CHAT-001–018

`Open Help` → Welcome → Language (English/Hindi/Hinglish, changeable) → Main Menu → Submenu → Identify booking/case where required → Validate own agency → Display seeded contextual result → Action or request summary → Explicit confirmation → Internal support case ID (when submitted) → Track status / Back / Main Menu / Restart / Close.

**Persistent control actions:** Back, Main Menu, Restart, Change Language, Close, Talk to Call Center. Conversation context may prefill selected booking; switching role or agency invalidates old booking context.

**PNR validation:** PNR belongs to logged-in agency; match provider+PNR in authorized booking scope; do not leak another agency's passenger, itinerary or even existence. Neutral error: `No matching booking found for your agency. Verify the reference or contact Hubfares Support.`

### 6.2 Menu-by-menu required behavior

| Main menu | Required nested options | Prompt(s) / data | Result / side effect |
|---|---|---|---|
| **Language** | English, Hindi, Hinglish | Choose language; Back | Render scripted labels; preserve safe context. |
| **Claim a Refund** | Cancel-booking refund; Airline-initiated cancellation; Partial refund; Estimate refund; Submit claim | PNR → select issue/reason → load fare/rules/booking status → show indicative amount/next steps → confirmation | **Support case** `REFUND_REQUEST`; **no automatic cancellation** solely from chat. |
| **Refund Status** | By PNR; By case ID; Pending with Supplier; Escalate delayed refund | PNR/case ID → own agency check | Refund timeline and supplier/credited distinction; optional `REFUND_ESCALATION` case. |
| **Flight Status** | By PNR; Airline + flight number/date | Owned PNR or seeded carrier/flight/date | Demo Scheduled/Delayed/Cancelled with `Simulated status`; no live feed. |
| **Change Flight** | Change departure date; Change itinerary; Estimated charges; Submit amendment | PNR → choose change → show sample eligible options/fare difference → summary | Guided `AMENDMENT_REQUEST` case, not airline change. |
| **Modify Booking** | Change contact; Passenger-detail correction; Add baggage; Add meal; Seat request; Other | PNR → choose requested field/service → confirm request | `MODIFICATION_REQUEST` case; no unsupported direct ticket edit. |
| **Complaints / Support** | Booking issue; Payment issue; Ticketing issue; Refund complaint; Amendment; Other | Optional own PNR plus category, free-text complaint/comment, contact preference | `COMPLAINT` support case with generated case ID; visible in Operations. |
| **More Options** | E-ticket; Fare Rules; Invoice/receipt; Wallet help; Existing support cases; Contact Support | Owned PNR or reference where appropriate | Show available seeded resource, deep-link or roadmap/help message. |

### 6.3 Structured output rules

1. **Confirmation summary** includes category, agency, PNR (when relevant), booking passenger/route summary (authorized), reason/details and notice that the case is a **demo support request**.
2. On Submit, create one SupportCase with generated reference (`CASE-...`), status `Open`, category, source `CHATBOT`, agency ID, user ID, booking ID, createdAt and events. Show exact same ID in Operations queue.
3. `Check status` by case ID must retrieve that case and its current demo state; use permitted agency scope.
4. Prevent accidental double submission: repeated Confirm for the same request should not create duplicates without a new explicit action.
5. If booking is unavailable, no eligible refund or amount uncomputable, show supported escalation/help and **do not invent** a settlement date or fee.
6. Free-text user input is accepted only for supported fields (PNR, case, complaint details); unsupported natural-language questions receive menu guidance.
7. The POC's broader CXO and Operations copilot conversations are **roadmap**, not a missing chatbot requirement.

### 6.4 Operations case linkage

`OTA chatbot case created` → `OPS-13 / OPS-12` queue row appears → Operator can inspect agency, category, PNR, summary and source → guided assignment/status update → same status visible to OTA in support history or chatbot status query. **No financial refund movement occurs** until a separate permitted cancellation/refund workflow is executed.

---

## 7. Executive management intelligence — precise product metrics

### 7.1 Executive KPI dictionary / EXE-001–013

All financial measures are **illustrative**, sourced from consistent synthetic booking, supplier and ledger data. This is not statutory revenue, GAAP/Ind AS net profit or audited margin. Choose one coherent booking-date/ticket-date/refund cohort method in technical design, show active date basis on UI and use it consistently across filters.

| KPI | Agreed meaning / display |
|---|---|
| Gross Booking Value (GBV) | Gross value of ticketed agency sales within the selected basis/window. |
| Bookings / Tickets | Count of relevant confirmed bookings and ticketed transactions, broken down by status. |
| Retained agency sales | Agency charges − associated agency refunds, on matching period/cohort basis. |
| Retained supplier cost | Supplier charges − supplier refunds/credits on corresponding transactions. |
| Net platform revenue (illustrative) | Retained agency sales − retained supplier cost − agency rebates/commissions − additional pass-through external payments. |
| Estimated contribution | Net platform revenue − modeled direct processing/variable operational costs. |
| Contribution margin % | Estimated contribution / retained agency sales × 100; show N/A for zero denominator. |
| Active OTAs | Distinct registered agencies with qualifying transactions in selected window. |
| Average Booking Value | Ticketed GBV / ticketed bookings; N/A if no bookings. |
| Cancellation rate | **Ticketed-and-subsequently-CANCELLED** booking IDs / all historically TICKETED booking IDs in the booking-date cohort. **VOIDED** orders remain in the denominator if tickets were originally issued, but not the cancellation numerator; show a **separate void count/rate**. Pre-ticket failures/abandoned holds appear in neither. Show counts and date basis. |
| Refunds pending | OTA refund obligations not yet credited/settled, without treating supplier receivables as payout. |
| Supplier refund receivable | Amount expected from supplier but not yet actually matched/received. |
| Credit exposure / overdue | Utilized agency credit; separately show over-due amounts and aging. |
| Booking conversion | Confirmed or ticketed bookings / recorded searches; only if seed/event dataset records searches; otherwise omit metric. |

**Avoid double counting:** If an agency refund is already reducing retained agency sales, do not separately subtract that same refund as another cost. Supplier refund reduces retained supplier cost. A wallet credit is a cash/settlement event, not new operating revenue. An agency credit limit is capacity, not sales.

### 7.2 Required executive screens and chart behavior

| View | Required charts / tables / interactions |
|---|---|
| Overview | KPI cards (GBV, revenue, contribution, margin, active OTAs, refunds, utilized credit), previous-period comparison if fixtures exist. |
| OTA profitability | Ranked agency table: OTA, bookings, gross sales, net revenue, estimated contribution, margin%, cancellation%, credit outstanding; click row to agency/booking drill-down. |
| Sales and growth | Daily/weekly/monthly sales; routes; airline/supplier performance; domestic/international; first-time vs returning agencies if fixture supports it. |
| Cancellations and refunds | Cancellation by OTA, route, airline, reason, over time; refund aging, supplier pending/settled, refund-recovery gaps. |
| Financial risk | Approved/utilized/overdue credit; agency credit flags; wallet funding trends; unmatched simulated payments; refund obligation and supplier receivable. |
| Operations | Agency approval duration, pending/failed ticketing, open cases, SLA aging, refund turnaround, assigned workload. |
| Booking funnel | Search → selected offer → attempted booking → confirmed → ticketed; include only when corresponding synthetic events recorded. |

**Filters:** date range, agency, airline, route, domestic/international and applicable state. Ranking should be sortable. At least one high-volume/low-margin agency and one elevated-cancellation agency must be obvious in seed data. Drill-down should show the underlying authorized set, not unrelated fabricated rows. Management must not have write access from the executive dashboard.

**Demo transitions to verify:** Ticketed booking updates booking counts/GBV; cancellation updates cancelled count and corresponding refund/revenue components; refund payout changes pending liabilities/agency wallet; new credit policy changes exposure/available limit but does not retroactively change booking sales; historical sample XLSX remains static.

---

## 8. Cross-module interoperability contracts

This section is **binding**: it tells the development agent which records and screens must change when a user performs an essential action. Implementation specifics for event handling and data schema belong to Technical Design.

| Event / user action | Must create or update | Must visibly affect | Must not affect |
|---|---|---|---|
| OTA submits registration | Application, document metadata, pending status | Registration Status; Ops onboarding queue | Active agency/booking permissions before approval |
| Document extraction accepted | Confirmed registration field values + source | Editable application | Mock KYC `Verified` automatically |
| Operations approves | Agency Active, initial Agency Admin, audit event | Login, Agency Directory, onboarding counters | Other agencies |
| Agency Admin creates user | Agency-scoped user and permission | Agency Users; role-aware access | Hubfares-wide privileges |
| Payment event matched | Payment status, ledger credit once | Wallet, Passbook, agency dashboard, finance/executive relevant metrics | A second credit on retry |
| Credit policy saved | Agency policy with version/effective date | Booking spending eligibility, credit widgets, risk view | Historic bookings and fare quotes already accepted |
| Simplified Hubfares commercial changed | New rule effective prospectively | New search quote selling price / applied rule | Previous ticket price; downstream OTA markup |
| OTA downstream markup saved | Agency markup UI state only | Manage Markup list/status | Search results, booking fares, wallet, CXO profit |
| Advanced rule builder saved | Guided rule draft/history | Admin rule preview | Any executable fare/commission in POC |
| Currency selected | Display selected currency | Results, Fare Details, Review, Confirmation | Base fare, POS, ticket, ledger, credit and payout |
| Flight/fare selected | Selected offer/brand/rule | Fare details, review | Other flight's profile |
| Booking ticketed | Booking, PNR, ticket, financial charge/hold release | Manage Booking, OTA Dashboard, Passbook, Ops Booking, CXO | Static XLSX download contents |
| Booking fails after hold | Booking failure, reservation reversal/release | Error state, wallet availability | Net charged balance after safe reversal |
| Cancellation confirmed | Booking cancellation, refund case, quote snapshot | Booking detail, Refund Tracking, Ops queue, CXO | Duplicate refund credit |
| Supplier-based refund | Pending supplier until received; payout later | Refund status, Ops outstanding, CXO receivable/liability | Early OTA wallet credit |
| Immediate-eligible refund | OTA credit plus supplier receivable | Wallet, Passbook, Refund Tracking, Ops, CXO | Supplier `received` unless actual simulated settlement event |
| PNR imported | Booking with external refs/source once | Manage Booking, Ops bookings, CXO if included in definition | Automatic new GDS ticketing; static XLSX |
| OTA chatbot case submitted | SupportCase and case event | OTA case status, Ops case queue | Airline booking, refund or wallet movement |
| Six sample XLSX downloaded | Authorized file response | Browser download confirmation | Live booking/ledger record; data from another OTA |
| Demo reset | Restore seed fixture and demo state | Every affected portal | Production/real customer data (never present) |

### 8.1 Mandatory ownership graph

`Agency → AgencyUsers → Bookings → PNR/Tickets → Cancellation/Refund cases → Ledger/credit → OTA Dashboard/Operations/CXO`.  
`Agency → CreditPolicy/RefundPolicy/CoreCommercialPolicy → future quote/booking/refund behavior`.  
`Agency → UI-only MarkupRule` **without a pricing edge**.  
`GDS/PCC/Supplier → mocked Search/PNR/Booking/Settlement`.  
`SupportConversation → SupportCase → Operations queue` **without a direct financial execution edge**.  
`ReportFixture XLSX → authorized static download` **without an event-driven refresh edge**.

### 8.2 Stable references

Each booking should have a distinct internal ID; mock provider PNR and airline PNR may differ; ticket number appears only after ticket issuance. All linked payment/refund/case records carry the booking ID where appropriate. Agency ID is mandatory for private records. Every financial entry has a unique transaction ID plus idempotency key. Currency/monetary amounts must have units and explicit decimal treatment.

---

## 9. State models and forbidden transitions

| Domain | Normal progression | Alternate/exception states | Forbidden behavior |
|---|---|---|---|
| Agency application | Draft → Submitted → Under Review → Active | More Info Required, Rejected, Suspended, Inactive | Booking before Active or reapproval without rule. |
| KYC document | Not Submitted → Uploaded → Extracted → Pending Verification → Verified | Processing, Failed | `Extracted` automatically means `Verified`. |
| Booking | Draft → Priced → PNR Created → Ticketing Pending → Ticketed | Price Changed, Booking Failed, Ticketing Failed, Cancel Requested, Cancelled, Voided, Amendment Requested, Reissued | Ticket number before Ticketed; double ticket issuance. |
| Payment | Initiated → Received → Matched → Credited | Unmatched, Duplicate, Rejected, Reversed | Same external payment credited twice. |
| Refund | Requested → Validated → Approved → Pending Supplier or Immediate Credit → Reconciled → Closed | Rejected, On Hold, Partially Settled, Exception | Refund credit twice or supplier received implied by OTA credit. |
| Support case | Open → Assigned → In Progress → Awaiting External → Resolved/Closed | Reopened, Escalated (guided) | Chat case submission automatically cancels airline booking. |
| Amendment | Requested → Quoted → Approved → Reissued/Closed | Rejected, On Hold | Reissue real ticket in guided-only mode. |

- Date/time handling must be consistent: show traveler/flight local time with zone when available; cancellation countdown uses a defined absolute instant.
- Ineligible actions must be disabled or yield a clear validation message, never mutate existing records.
- Status changes should have actor/time/related reference so audit and customer-support timelines agree.
- Side effects must not happen twice on retries or repeated clicks.

---

## 10. Demonstration fixtures — product contract (details in file 03)

This section specifies **required coverage**, not literal implementation records or actual FX rates.

| Fixture family | Minimum coverage |
|---|---|
| Agencies | **Skyline Travels** (prepaid, supplier-settlement), **Orbit Corporate Travel** (weekly credit, eligible immediate refund), **Aster Holidays** (daily credit, cancellation-heavy), **New Partner Travel** (pending onboarding). All fictional. |
| User roles | Predefined hub Admin, Operations, CXO and OTA Admin/Agent demo accounts with deterministic scope. |
| Flights | 15–25 coherent offers, multiple airline/fare brands, BOM–DEL, BOM–LON and representative routes, refundable/non-refundable examples and both rule profiles. |
| Bookings | 20–30 coherent bookings across ticketed, draft, failed, cancelled, voided and refund states, with passenger and agency linkage. |
| PNR import | 5–10 known seeded PNR scenarios including valid, invalid, duplicate and wrong-PCC/agency. |
| Finance | Wallet/credit, unique payment references, supplier charges, passbook ledger, refunds/receivables, pending vs received, credit risk cases. |
| FX | One fixed INR/USD/EUR rate table, rate date, `Demo` source and identical conversion results across related screens. |
| Fare rules | Exactly 2 static profiles from §5.3; at least two departure-time cancellation examples. |
| Agency markup | Domestic INR 50 and International INR 100 sample UI rules; deliberately nonexecuting. |
| Advanced rules | Supplier and route criteria, include/exclude, sample `5*BF`, `1*TF`, fixed `270`/`180` text, history preview. |
| Onboarding | Synthetic PAN/Aadhaar/business-document examples, extraction success/failure, verified/pending/failed mock checks. |
| Reports | Six distinct **real XLSX** fixture types with ~100 synthetic rows each; authorized agency-scoped extracts. |
| Chat/help | Owned and unknown PNR, known refund case, simulated flight status, amendment, complaint and linked Ops case. |
| Analytics | Historical transactions sufficient for prior-period trends, top and weak OTA performance, cancellations, credit aging and supplier refunds. |
| Reset | Reproducible seed restoration including counters/IDs and all F workflows. |

A seeded case must not contain conflicting booking, wallet and refund totals. Flight dates should be in the future relative to the **actual demo execution date** or clearly labeled as historical fixtures where appropriate. Do not use real passengers, PAN/Aadhaar, credit cards, bank credentials or employee records.

---

## 11. Guided and roadmap experiences — explicit boundaries

| Capability | POC allowed behavior | Actual production integration deferred |
|---|---|---|
| Travelport / Amadeus | Provider options, settings, adapter descriptions and seeded examples; Sabre-first simulator default. | Credential, certification, live content, ticketing, servicing, queue polling. |
| Supplier settlement | Sample claim and statement-match flow, exceptions. | Real settlements, airline/GDS accounting, bank reconciliation. |
| Amendments/rebooking | Sample quote, fee difference, demo case, timeline. | True fare/exchange/ticketing/airline servicing. |
| Manual orders | Guided Operations entry and sample booking reference. | Real supplier order/ticket execution. |
| Booking carts/holds | Example held cart and expiration UX. | Actual supplier hold/expiry synchronization. |
| GDS queue monitoring | Queue preview with statuses/alerts. | Live queue polling and actioning. |
| Inventory / inventory orders | Future product screen/roadmap explanation. | Contracted inventory/seat allocation/order processing. |
| Insurance | Optional configurator preview. | Provider eligibility, pricing, issuance. |
| VAS/ancillaries | Travel add-on preview and guided case creation. | Airline ancillaries, insurance, visa, special services, actual issuance. |
| Cab / transfers | Optional offline service preview. | Transport supplier contract, fulfillment, payments. |
| Check-in / flight status | Static/help info; seeded flight status inside OTA chatbot. | Real airline check-in/live flight-status APIs. |
| PWS Amendments | Roadmap-only glossary placeholder; exact term not established. | Product discovery required. |
| KYC | Extract supported synthetic docs; mock PAN/Aadhaar status, green tick only on completed mock check. | Authorized verification services, privacy/legal policies. |
| Payments | Deterministic matching event and ledger credit simulation. | Real banking/UPI gateway, webhook signatures and bank statement integration. |
| Advanced commercial expression engine | Editable inclusion/exclusion, formulas and history UI; no evaluation. | Full supplier contract semantics, conflict resolution, tax/segment bases. |
| OTA downstream markup | Editable Agency Admin UI; no price effect. | Executable customer-facing markup, precedence and tax treatment. |
| Market/POS currency | Display conversions only. | GDS market-based offers, foreign-currency ticketing and settlement. |
| Management/Operations generative copilot | Not present as Phase 0 AI. | Later LLM, tool calls and operational controls. |

Any future menu item must link to a sensible roadmap preview with a title, future workflow synopsis and status. No fake production success state.

---

## 12. Product UX constraints and client presentation identity

- **Visual direction:** Premium independent Hubfares brand using **orange `#F47B31`**, charcoal sidebar **`#25272B`**, light canvas `#F6F7F9`, white cards, dark text `#26374A` and muted labels `#687483` as suggested design tokens. Use accessible contrast; avoid exact TripJack logo/brand reproduction.
- **Operations:** Collapsible dark sidebar, compact searchable tables, clear filters and actionable queues; dense without cramped UI.
- **OTA:** Responsive web pages, clean search result cards, expandable fare variants, actionable fare rules, visible wallet/credit status and persistent Help icon.
- **CXO:** Premium light dashboard, KPI definitions, honest labels, charts that filter/drill down and financially coherent records.
- **Mandatory feedback states:** Loading, zero results, validation error, permission denied, simulated provider unavailable, success, duplicate action, pending; no dead buttons or inert controls advertised as working.
- **Simulation transparency:** `Demo Environment` global, plus context notes `Simulated Sabre response`, `Sample fare rules`, `Demo payment`, `Illustrative financials`, `Sample XLSX extract`, `Guided workflow`, `Planned integration` as appropriate.
- **Mobile:** Fare-rule tables must remain readable; mobile sheet and responsive action buttons; do not copy original screenshot's cramped layout.
- **Document upload:** Inform user **before** upload that extracting fields will prefill the form and ask for review. Green ticks reflect *mock verified* only.
- **Support chat:** OTA Help icon should offer genuine menu progress, clear reply choices, PNR lookup, case confirmation and visible Back/Restart.

---

## 13. Nonfunctional product requirements and safety boundaries

**NFR-001** Secure agency data isolation, server-authorized reads/writes and explicit role scopes where an API/backend exists.  
**NFR-002** Synthetic data only; protect document files and mask sensitive IDs in screens.  
**NFR-003** Financial idempotency, immutable or compensating ledger effects, duplicate payment/refund prevention.  
**NFR-004** Booking/refund state-machine validation and historical policy/rule snapshots.  
**NFR-005** Consistent calendar, monetary precision, labels and timestamps between screens.  
**NFR-006** Predictable demo reset, repeatability and recovery after failed scenario.  
**NFR-007** Clear simulated-versus-live integration boundaries; no false provider certification/compliance claim.  
**NFR-008** Responsive layouts, accessible keyboard controls and readable tables.  
**NFR-009** Config changes must not silently rewrite past booking/financial records.  
**NFR-010** Basic audit events for onboarding approval, users, financial events, booking and policy changes.  
**NFR-011** Performance suitable for a small seeded local/demo dataset; avoid unnecessary production infrastructure in a one-day build.  
**NFR-012** Separate production target architecture from implemented POC safeguards (no claim of enterprise certification).

Production-phase items include live encryption/key/secrets controls, MFA, security audits, rate limiting, queue workers, monitoring, backup/DR, deployment approvals, regulatory/PCI review where applicable and statutory finance treatments. These are architecture/roadmap items, not Phase 0 acceptance claims.

---

### 13.1 Explicit post-audit implementation clarifications (POC only; not new production commitments)

- **Round-trip depth:** return searches **and two-leg selection/quote/PNR/ticket/full-itinerary cancellation** are functional mock workflows. One quote/booking/PNR combines two ordered segment snapshots and one atomic financial charge; no partial cancellation or multi-city booking in Phase 0.
- **Refund-policy effective time:** the agency refund payout mode/version becomes binding **at booking creation** and is carried into the claim; an Admin change affects **future bookings**, not cancellation of historical bookings. A genuinely exceptional authorized override requires later approval and is not a POC feature.
- **Settlement handoff:** mock supplier matching is guided but must produce persisted receipt evidence for a separate authorized, idempotent payout service. Supplier receipt alone never credits an OTA wallet.
- **KPI terminology:** `CANCELLED` and `VOIDED` are distinct; cancellation rate explicitly excludes voided from its numerator.


## 14. Product acceptance matrix and traceability

`04_BUILD_TEST_DEMO.md` assigns executable `TC-...` IDs to every F requirement below and concise observable checks to every G/R feature. This section is the product-level definition of done, not a replacement for test scripts.

| Check ID | Requirement | Observable pass condition | Related screen(s) |
|---|---|---|---|
| AC-001 | ONB/DOC | Agency can register with valid fields; supported document extracts editable values; low-confidence/unreadable fallback works. | ONB-01/02/03 |
| AC-002 | KYC/APR | Mock check shows distinct Extracted/Verified statuses; green tick only for completed mock check; Operations approval activates agency. | OPS-02/03 |
| AC-003 | USR/AUTH | Agency Admin can manage sub-user; another OTA's data inaccessible via UI/API. | OTA-02, AUTH-01 |
| AC-004 | WAL | Matched simulated payment credits wallet/passbook **exactly once**. | OTA-12/13, OPS-07 |
| AC-005 | CRD | Changing agency limit/terms changes new-booking eligibility; insufficient credit blocks. | ADM-02, OTA-06 |
| AC-006 | SRCH | Search returns coherent seeded offers with filters, brands, cheapest/fastest and no-results states; a return search selects two ordered compatible legs. | OTA-03/04 |
| AC-007 | FARE | Every fare opens correct tabbed rule; only two static profiles; time-slab information consistent. | OTA-04/05 |
| AC-008 | BOOK | One-way or **two-leg return** quote revalidates every leg, creates **one** booking/PNR and ticket per demo adult, atomically funds the **aggregate** price, and persists ordered segment snapshots. | OTA-06/07/08 |
| AC-009 | BOOK | Booking failure/insufficient funds is safe and reversible; no duplicate ticket or deduction. | OTA-06/07 |
| AC-010 | MNG | OTA manages only own bookings; Operations sees all permitted; PNR and detail filters work. | OTA-08/09, OPS-05 |
| AC-011 | CAN/REF | Full-itinerary cancellation uses each booked leg's profile, departure/slab and fee, sums one refundable amount, confirms and creates exactly one claim; no partial-leg execution. | OTA-10/11 |
| AC-012 | REF/WAL | Payout timing uses **booking-time policy version**, not later Admin edits. Pending supplier is never silently wallet-credited; matched mock receipt plus separate authorized payout produces exactly one credit. | ADM-04, OTA-11/13 |
| AC-013 | PNR | Known seeded PNR imports once with correct agency/PCC; invalid or duplicate blocked. | OTA-14 |
| AC-014 | COM | Simplified Hubfares commercial changes **future** quotes only; past bookings retain price snapshot. | ADM-03, OTA-04 |
| AC-015 | MKP | Agency markup editor saves Domestic INR 50 / International INR 100 rule UI; **no** fare/financial impact. | OTA-19, OTA-04 |
| AC-016 | ACR | Advanced builder shows include/exclude, priority, expression lines, preview/history; does **not** execute `BF`/`TF`. | ADM-08 |
| AC-017 | FX | INR/USD/EUR display consistently on results/review/confirmation, with seeded rate/date; base booking/ledger unchanged. | OTA-22, OTA-04/06/07 |
| AC-018 | RPT | Six genuine XLSX report types (~100 synthetic rows each) download; OTA rows only own agency; static sample label. | OTA-15/23 |
| AC-019 | EXE | OTA-wise contribution, cancellation **excluding voided**, separate void rate, credit/refund KPIs use shared state; filters/drill-downs reconcile to fixture baseline. | EXE-01–05 |
| AC-020 | CHAT | OTA chatbot nested menus, English/Hindi/Hinglish, Back/Restart; own PNR lookup; case creation linked to Ops. | OTA-20/21, OPS-13 |
| AC-021 | CASE | Ops sees new chat case/reference, owner/category/PNR, can demonstrate status without GDS effects. | OPS-12/13 |
| AC-022 | SUP/AMD/MAN | Supplier reconciliation, amendment/rebooking and manual order are honest guided flows with sensible preview. | OPS-08/09/10 |
| AC-023 | R | Roadmap items have clear labeled preview; none claim real multi-GDS, FX, banking, KYC or airline execution. | ADM-05/09 + roadmap |
| AC-024 | RESET | Seed reset restores a reproducible initial state without partial leftovers. | Shared admin demo reset |
| AC-025 | NFR | No cross-agency access, financial double events, impossible transitions, unmasked real identity data or broken primary controls. | All F screens |

### 14.1 Minimum scenario coverage for delivery

- **S-A** Document-assisted onboarding → approval → activate agency.
- **S-B** Prepaid wallet fund → search → branded fare → PNR/ticket → passbook.
- **S-C** Weekly credit agency booking → credit utilization change.
- **S-D** Cancel two bookings with different fare profiles/time slabs → supplier-based vs eligible immediate refund.
- **S-E** Import offline known PNR; reject duplicate import.
- **S-F** Edit simple Hubfares commercial → new quote price changes; OTA markup UI rule does **not**.
- **S-G** Switch INR→USD→EUR display; original booking currency remains unchanged.
- **S-H** Unmatched sample payment → Finance exception; matching credited once.
- **S-I** Guided amendment/rebooking and manual order screens.
- **S-J** Six report XLSX downloads, Admin all-authorized vs OTA own-agency samples.
- **S-K** OTA Help → refund/complaint PNR lookup → create support case → same case visible in Operations.
- **S-L** CXO ranks high-revenue/low-margin agency and traces cancellation/refund change after transaction.
- **S-M** Reset and repeat S-A through S-L consistently.

---

## 15. Decisions, limitations and unresolved production discovery

### 15.1 Locked inclusion/exclusion reminders

- **Included and functional in Phase 0:** Agency onboarding/extraction/approval; agency users; seeded flight search with brands and two rules; booking+PNR+ticket lifecycle; agency wallet/credit, automated demo payment matching, passbook; cancellation/refund policies; Import PNR; simplified Hubfares commercial rule; display currency; executive analytics; OTA scripted chatbot and case creation.
- **Included as guided or UI-only:** Agency markup editor, advanced commercial expression editor, six static XLSX reports, supplier settlement matching, manual orders, amendments/rebooking, held carts, Ops case assignment/alerts, mock KYC verification.
- **Shown as future:** Actual GDS/KYC/banking/FX API connections, advanced execution of commercial/markup, true multi-city booking, supplier settlement, live flight status/check-in, supplier inventory, insurance, cabs, VAS, PWS amendments, executive/Operations generative copilot.

### 15.2 Questions that must **not** be guessed into production behavior

| Unresolved production detail | POC treatment |
|---|---|
| Sabre/Travelport/Amadeus API product, contracts, PCC entitlements/certification | Mock GDS adapters, seeded PNR and provider options. |
| Sabre currency service entitlement and cross-provider FX licensing | One local display converter with seeded rates; provider adapter later. |
| Bank/UPI partner, bank transaction format, webhook authentication | Mock event matching + idempotent ledger. |
| PAN/Aadhaar identity vendor, lawful identity processing and retention | Masked synthetic docs + simulated verification. |
| Supplier fare/ticket/void permissions and settlement timetable | Two synthetic rule profiles + guided supplier state. |
| Agency markup calculation base, downstream channel, tax and rule precedence | UI-only, **no** effective price. |
| Full expression engine `BF`/`TF`, IATA terms, segment vs booking math | Advanced builder preview only. |
| Tax invoices, actual accounting/profit basis and revenue recognition | Illustrative executive contribution formulas. |
| Multi-currency point of sale, foreign-currency billing and FX hedge | Display-only INR/USD/EUR. |
| Final report schema, update frequency and production access policy | Six scoped static example Excel files. |
| Live chat routing, production SLAs, multilingual NLP and airline requests | Scripted OTA menus + internal support case. |
| PWS amendments / contracted inventory / other TripJack-only modules | Roadmap until Hubfares confirms business need. |

### 15.3 Later roadmap (no date commitment)

1. **Phase 1 — Production foundation:** secure tenancy and roles; real Sabre and KYC/bank integrations where authorized; robust ledger and settlement; production deployment/audit; executable OTA markup; support-case orchestration.
2. **Phase 2 — Operations scaling:** Travelport/Amadeus, advanced commercial rule engine, multi-city booking, full servicing/queues, supplier settlement, generated reports and advanced FX/POS.
3. **Phase 3 — Intelligence:** generative support and management copilots, triage, margin optimization, intelligent reconciliation and optional inventory/ancillaries.

---

## 16. Inter-file integration contract and future handoff

All six reference documents are now present. Use this interface to prevent duplicated authorities:

| File | This specification defines | That file must define (without changing product scope) |
|---|---|---|
| `README.md` | Business context and project navigation | Setup guide, run/reset instructions, links/reading order. |
| `AGENTS.md` | Scope, business rules, permissions | Agent governance, edit discipline, verification and issue escalation. |
| `02_TECHNICAL_DESIGN.md` | User-observable behavior and state ownership | Concrete stack, routes, database schema, DTOs, business services, exact rule boundary math, transaction mechanism, authorization implementation. |
| `03_DEMO_DATA_AND_MOCKS.md` | Required sample scenarios and approved fare profiles | Exact synthetic seed records, deterministic provider responses, named PNRs, FX rates, six authorized XLSX fixtures, synthetic extractable PDFs. |
| `04_BUILD_TEST_DEMO.md` | Acceptance criteria `AC-001..025` and scenarios `S-A..M` | Task plan, automated/manual TC IDs, test fixtures, demo-run script, reset, deployment/debug checks. |
| Word PRD v1.1 | Approved source baseline | Historical client-approved reference; any change requires explicit approval, not silent edits. |

**Completion rule for this file:** Every `F` item has a record source, explicit state transition, permitted actor, exception condition and testable result. Every `G/R` capability has a meaningful preview and truthful limitation. Core data is **shared, not duplicated** across booking, wallet, refunds, operations and executive screens.
