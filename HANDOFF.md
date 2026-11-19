# Hubfares POC — Handoff

Demo-ready B2B travel POC on simulated providers. **Not production-ready.** Evidence: `docs/IMPLEMENTATION_STATUS.md`.

## Start (macOS, Node 20+; tested on Node 22)

```bash
cd hubfares-poc
cp .env.example .env          # first time only
npm install
npm run demo:reset            # seeds data/hubfares-demo.sqlite and checks the oracle (must print "Reset OK")
npm run dev                   # http://localhost:3000
```

For a smoother demo (no on-demand compile pauses): `npm run build && npm start`.
Check a running server: `npm run smoke`.

## Accounts

Operator demo password (restricted — do not put on slides): `Hubfares@Demo2026`

| Email | Role | Use for |
|---|---|---|
| superadmin@hubfares.example.com | Super Admin | Reset, all admin |
| finance@hubfares.example.com | Hub Admin Finance | Credit, refund policies, commercials, payments |
| ops@hubfares.example.com | Hub Operations | Onboarding approval, bookings, refunds, cases |
| cxo@hubfares.example.com | CXO | Executive dashboards |
| admin@skyline.example.com / agent@skyline.example.com | Skyline (prepaid, supplier-settlement refunds) | Book, refund, import, Help |
| admin@orbit.example.com / agent@orbit.example.com | Orbit (weekly credit, immediate refunds) | Credit booking |
| admin@aster.example.com / finance@aster.example.com | Aster (overdue credit blocked) | Finance-viewer limits |

## Presentation sequence (~25 min)

1. **S-A Onboarding** — open `/partner/register`, upload `fixtures/documents/company-registration-demo.pdf`, review extracted fields, submit → as Ops: run mock checks, approve.
2. **S-B + S-G Booking** — Skyline agent: search BOM→LON, open fare rules (Flexible vs Restricted), switch INR→USD→EUR, continue, revalidate, create PNR, issue ticket → Wallet/Passbook.
3. **S-C Credit** — Orbit agent books a higher fare; wallet first, then credit.
4. **S-D Cancellation** — `HFB1001` (A_FLEXIBLE, S2) vs `HFB1011` (B_RESTRICTED, S1); show supplier-settlement vs immediate credit.
5. **S-H Payments** — Ops › Payment Matching: match, replay (no double credit), exceptions.
6. **S-E Import PNR** — Skyline: PCC `S9KY`, PNR `SBD101`; import once, repeat is blocked.
7. **S-F Commercials** — Finance changes core fee; new quote changes, old booking does not; OTA markup has no pricing effect.
8. **S-K Help** — Skyline: Need Help → Hindi → refund request → same CASE id in Ops.
9. **S-J Reports** — download XLSX as Ops (100 rows) and Skyline (40 rows).
10. **S-L Executive** — CXO overview, OTA ranking, risk.
11. **S-I / Roadmap** — guided amendment & manual order; Roadmap previews labelled "Planned integration".
12. **S-M Reset** — Admin › Demo › type `RESET DEMO`.

## Reset

- UI: Super Admin → Admin › Demo → type `RESET DEMO`.
- CLI: `npm run demo:reset` (refuses non-demo DB names and `DEMO_MODE≠mock`; exits non-zero if any oracle check fails — don't present until it prints "Reset OK").
- Recovery if the DB is corrupted: stop the server, delete `data/hubfares-demo.sqlite*`, run `npm run demo:reset`.

## Tests

```bash
npm run typecheck && npm test && npm run fixtures:validate
npm run build && E2E_USE_BUILD=1 npm run test:e2e   # uses its own DB on port 3100
```

## Disclosure wording for clients

"This is a proof-of-concept running on simulated GDS, bank, KYC, supplier and FX data. No real bookings, payments, tickets or identity checks are performed. Integrations shown as 'Planned integration' are not built."

Known limitations: see `docs/IMPLEMENTATION_STATUS.md` §6.
