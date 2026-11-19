import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { loginAs } from './helpers';

test.describe.serial('Hubfares connected demo (E2E)', () => {
  test('S-A onboarding: specimen PAN + Aadhaar + registration autofill → submit → request info (email) → verify → approve → admin adds user', async ({ browser }) => {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    await page.goto('/partner/register');
    await expect(page.getByText('Upload your business documents to automatically prefill available details. Review extracted information before submitting.')).toBeVisible();
    await page.getByTestId('file-input').setInputFiles([path.resolve('fixtures/documents/sample-pan-card.png'), path.resolve('fixtures/documents/sample-aadhaar-card.png'), path.resolve('fixtures/documents/sample-company-registration.pdf')]);
    // Values are filled automatically (no click needed) and stay marked as extracted.
    await expect(page.locator('input[name="organization.pan"]')).toHaveValue('AAKCB0777B');
    await expect(page.locator('input[name="organization.agencyName"]')).toHaveValue('Bluebird Travels');
    await expect(page.locator('input[name="director.firstName"]')).toHaveValue('Riya');
    await expect(page.locator('input[name="director.lastName"]')).toHaveValue('Kulkarni');
    await expect(page.locator('input[name="address.city"]')).toHaveValue('Pune');
    await expect(page.locator('input[name="address.postalCode"]')).toHaveValue('411001');
    const review = page.getByTestId('extraction-review');
    await expect(review).toContainText('Aadhaar card');
    await expect(review).toContainText('PAN card');
    for (let i = 0; i < 30; i++) { const b = review.getByRole('button', { name: /^(Accept|Use extracted)$/ }).first(); if (!(await b.count())) break; await b.click(); }
    await page.locator('input[name="organization.turnoverInr"]').fill('25000000');
    await page.locator('input[name="director.email"]').fill('riya@bluebird.example.com');
    await page.locator('input[name="director.mobile"]').fill('+919000000777');
    await page.locator('input[name="finance.firstName"]').fill('Kunal');
    await page.locator('input[name="finance.lastName"]').fill('Shah');
    await page.locator('input[name="finance.email"]').fill('finance@bluebird.example.com');
    await page.locator('input[name="finance.mobile"]').fill('+919000000778');
    await page.getByTestId('submit-application').click();
    await expect(page.getByText(/Please (fix|acknowledge)/).first()).toBeVisible();
    await page.locator('input[name="acknowledged"]').check();
    await page.getByTestId('submit-application').click();
    await page.waitForURL(/partner\/status/);
    await expect(page.getByText('Application submitted')).toBeVisible();
    const ref = (await page.getByTestId('app-reference').innerText()).trim();
    expect(ref).toMatch(/^HF-APP-\d{4}$/);

    const ops = await loginAs(browser, 'ops@hubfares.example.com');
    await ops.goto('/operations/applications');
    await expect(ops.getByTestId('app-HF-APP-0042')).toBeVisible();
    await ops.getByTestId(`app-${ref}`).getByRole('link', { name: 'Review' }).click();
    await expect(ops.getByTestId('approve')).toBeDisabled();
    // Request more information → emailed; every action stays available afterwards.
    await ops.getByRole('button', { name: 'Request info' }).click();
    await ops.getByPlaceholder(/What information do you need/).fill('Please share the GST certificate');
    await ops.getByTestId('decision-confirm').click();
    await expect(ops.getByText('Information request emailed to riya@bluebird.example.com').first()).toBeVisible();
    await expect(ops.getByTestId('more-info-notice')).toContainText('riya@bluebird.example.com');
    await expect(ops.getByRole('button', { name: 'Reject' })).toBeVisible();
    await ops.getByTestId('kyc-PAN').click();
    await expect(ops.getByTestId('kyc-verified').first()).toBeVisible();
    await ops.getByTestId('kyc-IDENTITY').click();
    await expect(ops.getByTestId('kyc-verified')).toHaveCount(2);
    await ops.getByTestId('approve').click();
    await expect(ops.getByText('Agency active')).toBeVisible();

    const admin = await loginAs(browser, 'riya@bluebird.example.com');
    await expect(admin).toHaveURL(/\/agency\/search$/);
    await expect(admin.getByTestId('context-agency')).toHaveText('Bluebird Travels');
    await admin.goto('/agency/users');
    await admin.getByTestId('add-user').click();
    await admin.locator('input[name="name"]').fill('Meena Agent');
    await admin.locator('input[name="email"]').fill('meena@bluebird.example.com');
    await admin.locator('input[name="mobile"]').fill('+919000000779');
    await admin.getByTestId('create-user').click();
    await expect(admin.getByTestId('user-meena@bluebird.example.com')).toBeVisible();
    await admin.reload();
    await expect(admin.getByTestId('user-meena@bluebird.example.com')).toBeVisible();
    await ctx.close();
  });

  test('S-B + S-G: BOM→LON search, both profiles, INR→USD→EUR display only, revalidate, PNR then ticket, passbook & Ops', async ({ browser }) => {
    const page = await loginAs(browser, 'agent@skyline.example.com');
    const before = (await (await page.request.get('/api/v1/wallet')).json()).data;
    await page.goto('/agency/search');
    await expect(page.locator('input[name="departureDate"]')).not.toHaveValue('');
    await page.getByTestId('search-submit').click();
    const card = page.getByTestId('offer-offer_005');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Restricted rules');
    await expect(card).toContainText('Flexible rules');
    await page.getByTestId('rules-brand_005_saver').click();
    await expect(page.getByRole('dialog')).toContainText('₹3,000.00 + ₹50.00 fee');
    await expect(page.getByRole('dialog')).toContainText('Non-refundable');
    await page.getByRole('dialog').getByRole('button', { name: 'Select this fare' }).click();
    const sw = page.getByTestId('currency-switcher').first();
    await sw.getByRole('radio', { name: 'USD' }).click();
    await expect(page.getByTestId('price').filter({ hasText: '$340.36' }).first()).toBeVisible();
    await sw.getByRole('radio', { name: 'EUR' }).click();
    await expect(page.getByText(/€291\.74/).first()).toBeVisible();
    await page.getByTestId('continue-booking').click();
    await page.waitForURL(/\/agency\/book\//);
    await expect(page.getByText(/€291\.74/).first()).toBeVisible();
    await expect(page.getByText('₹30,632.50 charged in INR').first()).toBeVisible();
    await page.getByTestId('currency-switcher').first().getByRole('radio', { name: 'INR' }).click();
    await page.getByTestId('revalidate').click();
    await page.locator('input[name="pax0-first"]').fill('Asha');
    await page.locator('input[name="pax0-last"]').fill('Demo');
    await page.getByTestId('confirm-booking').click();
    await expect(page.getByTestId('pnr')).toHaveText(/^SBN\d{3}$/);
    await expect(page.getByTestId('ticket-number')).toHaveText('Not yet issued');
    const bookingId = (await page.getByTestId('booking-id').innerText()).trim();
    await page.getByTestId('issue-ticket').click();
    await expect(page.getByTestId('busy-overlay')).toBeVisible();
    await expect(page.getByTestId('ticket-number')).toHaveText(/098-2400\d{6}/);
    await expect(page.getByTestId('busy-overlay')).toHaveCount(0);
    await expect(page.getByTestId('balance-after')).toContainText('Remaining wallet balance');
    const after = (await (await page.request.get('/api/v1/wallet')).json()).data;
    expect(before.walletCashMinor - after.walletCashMinor).toBe(3063250);
    await page.goto('/agency/passbook');
    await expect(page.getByRole('link', { name: bookingId })).toBeVisible();
    const ops = await loginAs(browser, 'ops@hubfares.example.com');
    await ops.goto(`/operations/bookings/${bookingId}`);
    await expect(ops.getByTestId('detail-id')).toHaveText(bookingId);
    await expect(ops.getByText('Ticketed').first()).toBeVisible();
  });

  test('S-D: A_FLEXIBLE S2 (Skyline, supplier-settlement) vs B_RESTRICTED S1 (Orbit, immediate credit)', async ({ browser }) => {
    const sky = await loginAs(browser, 'agent@skyline.example.com');
    await sky.goto('/agency/bookings/HFB1001');
    await sky.getByTestId('cancel-quote').click();
    await expect(sky.getByTestId('refund-estimate')).toHaveText('₹7,403.00');
    await expect(sky.getByRole('dialog')).toContainText('24 hours or more');
    await expect(sky.getByRole('dialog')).toContainText('after the airline refund is received');
    await sky.getByTestId('cancel-confirm').click();
    await expect(sky.getByText(/will be credited after the airline refund is received/)).toBeVisible();
    await expect(sky.getByTestId('agency-refund-status')).toContainText('₹7,403.00');
    await expect(sky.getByTestId('supplier-refund-status')).toContainText('Awaited');
    const orb = await loginAs(browser, 'admin@orbit.example.com');
    const w0 = (await (await orb.request.get('/api/v1/wallet')).json()).data.walletCashMinor;
    await orb.goto('/agency/bookings/HFB1011');
    await orb.getByTestId('cancel-quote').click();
    await expect(orb.getByRole('dialog')).toContainText('2–24 hours');
    await expect(orb.getByTestId('refund-estimate')).toHaveText('₹11,450.00');
    await orb.getByTestId('cancel-confirm').click();
    await expect(orb.getByText(/credited to your wallet/).first()).toBeVisible();
    const w1 = (await (await orb.request.get('/api/v1/wallet')).json()).data.walletCashMinor;
    expect(w1 - w0).toBe(1145000);
  });

  test('S-E: Import PNR — no mandatory fields, list by PCC, bulk import, duplicates blocked', async ({ browser }) => {
    const page = await loginAs(browser, 'agent@skyline.example.com');
    await page.goto('/agency/import-pnr');
    await expect(page.getByTestId('pnr-row-SBD101')).toBeVisible(); // empty filters list everything available
    await expect(page.getByTestId('pnr-row-SBD404')).toContainText('Already imported');
    await page.locator('input[name="pcc"]').fill('S9KY');
    await page.getByTestId('pnr-lookup').click();
    await expect(page.getByTestId('pnr-row-SBD113')).toBeVisible();
    await expect(page.getByTestId('pnr-select-SBD404')).toBeDisabled();
    await page.getByTestId('pnr-select-SBD101').check();
    await page.getByTestId('pnr-select-SBD113').check();
    await page.getByTestId('pnr-import').click();
    await expect(page.getByTestId('import-result-SBD101')).toContainText('Imported');
    await expect(page.getByTestId('import-result-SBD113')).toContainText('Imported');
    await expect(page.getByTestId('pnr-row-SBD101')).toContainText('Already imported');
    await page.getByTestId('import-result-SBD113').getByRole('link', { name: /^HFB3\d{3}$/ }).click();
    await expect(page.getByTestId('pax-select').or(page.getByText('Imported PNR')).first()).toBeVisible();
    await expect(page.locator('[data-testid^="pax-"]')).toHaveCount(3);
  });

  test('S-J: five XLSX reports — Skyline 40 rows (scoped), Ops 100 rows; status + date filters', async ({ browser }) => {
    const rows = async (email: string, type: string, status = '') => {
      const page = await loginAs(browser, email);
      await page.goto(email.includes('hubfares') ? '/operations/reports' : '/agency/reports');
      await expect(page.getByTestId('report-other-transactions')).toHaveCount(0);
      await page.getByTestId(`report-${type}`).click();
      await page.locator('input[name="report-from"]').fill(''); await page.locator('input[name="report-to"]').fill('');
      if (status) await page.getByTestId('report-status').selectOption(status);
      const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-confirm').click()]);
      const file = path.join(fs.mkdtempSync('/tmp/hf-dl-'), dl.suggestedFilename());
      await dl.saveAs(file);
      const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(file);
      const ws = wb.getWorksheet('Transactions')!;
      const agencies = new Set<string>(); let n = 0;
      ws.eachRow((r, i) => { if (i > 2) { n++; agencies.add(String(r.getCell(3).value)); } });
      await page.context().close();
      return { n, agencies: [...agencies], name: dl.suggestedFilename() };
    };
    const sky = await rows('agent@skyline.example.com', 'refund-transactions');
    expect(sky.n).toBe(40); expect(sky.agencies).toEqual(['agency_skyline']); expect(sky.name).toBe('refund-transactions-skyline.xlsx');
    const ops = await rows('ops@hubfares.example.com', 'airline-transactions');
    expect(ops.n).toBe(100); expect(ops.agencies.sort()).toEqual(['agency_aster', 'agency_orbit', 'agency_skyline']);
    const credited = await rows('ops@hubfares.example.com', 'refund-transactions', 'CREDITED');
    expect(credited.n).toBeGreaterThan(0); expect(credited.n).toBeLessThan(100);
  });

  test('S-K: OTA Help (Hindi menus) → refund request for own PNR → same CASE id in Ops; foreign PNR neutral', async ({ browser }) => {
    const page = await loginAs(browser, 'agent@skyline.example.com');
    await page.goto('/agency');
    await page.getByTestId('help-bubble').click();
    const chat = page.getByRole('dialog', { name: 'Hubfares Help' });
    await chat.getByRole('button', { name: 'हिन्दी' }).click();
    await expect(chat.getByRole('button', { name: 'रिफंड का दावा' })).toBeVisible();
    await chat.getByRole('button', { name: 'भाषा बदलें' }).click();
    await chat.getByRole('button', { name: 'English' }).click();
    await chat.getByRole('button', { name: 'Claim a Refund' }).click();
    await chat.getByRole('button', { name: 'Cancel-booking refund' }).click();
    await chat.getByLabel('Reference').fill('SBX002');
    await chat.getByRole('button', { name: 'Check' }).click();
    await chat.getByLabel('Details').fill('Customer requests cancellation refund');
    await chat.getByRole('button', { name: 'Review request' }).click();
    await expect(chat).toContainText('does not cancel, change or refund anything');
    await chat.getByTestId('chat-submit').click();
    const caseId = (await chat.getByTestId('chat-case-id').innerText()).trim();
    expect(caseId).toMatch(/^CASE-\d{4}$/);
    const b = (await (await page.request.get('/api/v1/bookings/HFB1002')).json()).data;
    expect(b.bookingStatus).toBe('TICKETED');
    await chat.getByRole('button', { name: 'Main Menu' }).first().click();
    await chat.getByRole('button', { name: 'Refund Status' }).click();
    await chat.getByRole('button', { name: 'By PNR' }).click();
    await chat.getByLabel('Reference').fill('SBX011');
    await chat.getByRole('button', { name: 'Check' }).click();
    await expect(chat.getByTestId('chat-error')).toHaveText('No matching booking found for your agency. Verify the reference or contact Hubfares Support.');
    const ops = await loginAs(browser, 'ops@hubfares.example.com');
    await ops.goto('/operations/cases');
    await expect(ops.getByTestId(`case-${caseId}`)).toContainText('Skyline Travels');
    await ops.getByTestId(`case-${caseId}`).click();
    await ops.getByTestId('case-to-IN_PROGRESS').click();
    await expect(ops.getByRole('dialog')).toContainText('In progress');
  });

  test('Isolation: Skyline user cannot open Orbit booking via URL; finance-viewer cannot see booking nav', async ({ browser }) => {
    const page = await loginAs(browser, 'agent@skyline.example.com');
    await page.goto('/agency/bookings/HFB1013');
    await expect(page.getByText('No matching record found for your agency.', { exact: false })).toBeVisible();
    const fin = await loginAs(browser, 'finance@aster.example.com');
    await expect(fin).toHaveURL(/\/agency\/search$/); // every OTA role lands on Book a Flight
    await expect(fin.locator('input[name="departureDate"]')).not.toHaveValue('');
    await fin.getByTestId('search-submit').click();
    await fin.getByTestId('brand-brand_005_saver').check();
    await expect(fin.getByText('Your role can view fares')).toBeVisible();
    await expect(fin.getByTestId('continue-booking')).toHaveCount(0);
    await expect(fin.getByRole('link', { name: 'Wallet & Credit' })).toBeVisible();
    const r = await fin.request.post('/api/v1/quotes', { data: { tripType: 'ONE_WAY', legs: [{ offerId: 'offer_015', brandId: 'brand_015_saver' }], adults: 1 } });
    expect(r.status()).toBe(403);
  });

  test('TC-058 mobile OTA smoke: search page and Help drawer usable at 390px', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto('/login');
    await page.getByPlaceholder('name@agency.example.com').fill('agent@skyline.example.com');
    await page.getByPlaceholder('Password', { exact: true }).fill('Hubfares@Demo2026');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/agency/);
    await page.goto('/agency/search');
    await expect(page.locator('input[name="departureDate"]')).not.toHaveValue('');
    await page.getByTestId('search-submit').click();
    await expect(page.getByTestId('offer-offer_005')).toBeVisible();
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('link', { name: 'Booking Carts' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Manage Amendments' })).toBeVisible();
    await ctx.close();
  });

  test('Trace TC-021/028/034/055: rules both profiles, filter by PNR, no dev labels / no Sabre for OTA, roadmap previews', async ({ browser }) => {
    const page = await loginAs(browser, 'agent@skyline.example.com');
    // P0-3: no developer-facing labels in the product shell
    await expect(page.getByText(/Demo environment|Simulated|Guided|Sample extract|mock/i)).toHaveCount(0);
    // TC-021: open flexible profile rules too (restricted covered in S-B)
    await page.goto('/agency/search');
    await expect(page.locator('input[name="departureDate"]')).not.toHaveValue('');
    await page.getByTestId('search-submit').click();
    await page.getByTestId('offer-offer_005').locator('[data-testid^="rules-"]').last().click();
    await expect(page.getByRole('dialog')).toContainText(/Flexible/i);
    await page.keyboard.press('Escape');
    // TC-028: filter own bookings by PNR
    const list = (await (await page.request.get('/api/v1/bookings')).json()).data as any[];
    const own = list.find((b: any) => b.pnr?.gdsPnr || b.gdsPnr);
    const pnr = own.pnr?.gdsPnr ?? own.gdsPnr;
    expect(list.every((b: any) => b.agencyId === own.agencyId)).toBe(true);
    await page.goto('/agency/bookings');
    await page.getByLabel('Search bookings').fill(pnr);
    await expect(page.getByTestId(`row-${own.id}`)).toBeVisible();
    // P0-5: booking detail shows the PNR but no GDS / Sabre identity to the OTA
    await page.goto(`/agency/bookings/${own.id}`);
    await expect(page.getByTestId('detail-pnr')).toHaveText(pnr);
    await expect(page.getByText(/Sabre|SABRE|Simulated|mock/)).toHaveCount(0);
    // TC-055: roadmap previews labelled, no false Connected banner
    const ops = await loginAs(browser, 'ops@hubfares.example.com');
    await ops.goto('/roadmap');
    await expect(ops.getByText('Planned integration').first()).toBeVisible();
    await expect(ops.getByText(/^Connected$/)).toHaveCount(0);
  });

  test('P0-1 partial cancellation: cancel 1 of 3 passengers — PNR split, refund per passenger, others stay ticketed', async ({ browser }) => {
    const page = await loginAs(browser, 'agent@skyline.example.com');
    await page.goto('/agency/bookings/HFB1026');
    await page.getByTestId('cancel-quote').click();
    await expect(page.getByTestId('pax-select')).toBeVisible();
    await page.getByTestId('cancel-pax-HFB1026_pax1').uncheck();
    await page.getByTestId('cancel-pax-HFB1026_pax3').uncheck();
    await expect(page.getByRole('dialog')).toContainText('The PNR will be split');
    await expect(page.getByTestId('refund-estimate')).toHaveText('₹15,103.00');
    await expect(page.getByTestId('cancel-confirm')).toHaveText('Cancel 1 of 3 passengers');
    await page.getByTestId('cancel-confirm').click();
    await expect(page.getByText(/1 passenger cancelled · new PNR SBS\d{3}/)).toBeVisible();
    await expect(page.getByTestId('split-HFB1026-S1')).toBeVisible();
    await page.getByRole('tab', { name: /Itinerary/ }).click();
    await expect(page.locator('[data-testid^="pax-HFB1026_"]')).toHaveCount(2);
    await page.getByTestId('split-HFB1026-S1').click();
    await expect(page.getByTestId('detail-id')).toHaveText('HFB1026-S1');
    await expect(page.getByText('Split from another booking')).toBeVisible();
  });

  test('P1-23/24 date change: pick a new date, see charges, confirm → ticket reissued and shown in history', async ({ browser }) => {
    const page = await loginAs(browser, 'agent@skyline.example.com');
    await page.goto('/agency/amendments');
    await page.getByTestId('amend-booking').selectOption('HFB1025');
    await page.getByTestId('amend-start').click();
    await page.waitForURL(/HFB1025\?amend=1/);
    const d = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
    await page.getByTestId('new-date').fill(d);
    await expect(page.getByTestId('date-change-quote')).toBeVisible();
    await expect(page.getByTestId('date-change-total')).toHaveText('₹3,100.00');
    await page.getByTestId('confirm-date-change').click();
    await expect(page.getByText(/^Date changed to/)).toBeVisible();
    await expect(page.getByTestId('history')).toContainText('Ticket reissued (date change)');
    await page.goto('/agency/amendments');
    await expect(page.locator('[data-testid^="amd-AMD2"]').first()).toContainText('Completed');
  });

  test('P2-42 maker-checker: Super Admin credit-limit change waits for CXO approval, then applies', async ({ browser }) => {
    const sa = await loginAs(browser, 'superadmin@hubfares.example.com');
    await sa.goto('/admin/credit');
    await sa.locator('input[name="creditLimit"]').fill('250000');
    await sa.getByTestId('publish-credit').click();
    await expect(sa.getByText(/Sent for approval · APR1\d{3}/)).toBeVisible();
    await expect(sa.getByText(/Awaiting approval: APR1/).first()).toBeVisible();
    const cxo = await loginAs(browser, 'cxo@hubfares.example.com');
    await cxo.goto('/executive/approvals');
    const row = cxo.locator('[data-testid^="approval-APR1"]').first();
    await expect(row).toContainText('₹2,00,000 → ₹2,50,000');
    await row.getByRole('button', { name: 'Approve' }).click();
    await expect(cxo.getByText(/approved and applied/)).toBeVisible();
    const w = (await (await sa.request.get('/api/v1/wallet?agencyId=agency_orbit')).json()).data;
    expect(w.creditLimitMinor).toBe(25000000);
  });

  test('P1-19 reconciliation statuses and P1-13 management period/granularity', async ({ browser }) => {
    const ops = await loginAs(browser, 'ops@hubfares.example.com');
    await ops.goto('/operations/payments');
    await expect(ops.getByTestId('recon-status-UTR26111001')).toHaveText(/Awaiting Match|Matched/);
    await expect(ops.getByTestId('recon-status-UTR26110501')).toHaveText('Matched');
    const cxo = await loginAs(browser, 'cxo@hubfares.example.com');
    await cxo.goto('/executive/sales');
    await expect(cxo.getByTestId('period-label')).toContainText('Last 30 days');
    await cxo.getByRole('radio', { name: 'monthly' }).click();
    await expect(cxo.getByText('Monthly GBV')).toBeVisible();
  });
});
