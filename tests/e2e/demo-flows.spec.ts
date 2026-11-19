import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { loginAs } from './helpers';

test.describe.serial('Hubfares connected demo (E2E)', () => {
  test('S-A onboarding: Bluebird upload → extract → submit → mock KYC → approve → admin creates sub-user', async ({ browser }) => {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    await page.goto('/partner/register');
    await expect(page.getByText('Upload your business documents to automatically prefill available details. Review extracted information before submitting.')).toBeVisible();
    await page.getByTestId('file-input').setInputFiles([path.resolve('fixtures/documents/company-registration-demo.pdf'), path.resolve('fixtures/documents/pan-card-demo.pdf'), path.resolve('fixtures/documents/identity-masked-demo.pdf')]);
    const review = page.getByTestId('extraction-review');
    await expect(review).toContainText('Bluebird Travels');
    await expect(review).toContainText('Review required');
    await expect(page.getByText('Not verified').first()).toBeVisible();
    for (let i = 0; i < 30; i++) { const b = review.getByRole('button', { name: /^(Accept|Use extracted)$/ }).first(); if (!(await b.count())) break; await b.click(); }
    await expect(page.locator('input[name="organization.agencyName"]')).toHaveValue('Bluebird Travels');
    await expect(page.locator('input[name="organization.pan"]')).toHaveValue('DEMOB0777B');
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
    await expect(ops.getByTestId('kyc-verified')).toHaveCount(0);
    await ops.getByTestId('kyc-PAN').click();
    await expect(ops.getByTestId('kyc-verified').first()).toBeVisible();
    await ops.getByTestId('kyc-IDENTITY').click();
    await expect(ops.getByTestId('kyc-verified')).toHaveCount(2);
    await ops.getByTestId('approve').click();
    await expect(ops.getByText('Agency active')).toBeVisible();

    const admin = await loginAs(browser, 'riya@bluebird.example.com');
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
    await expect(page.getByTestId('ticket-number')).toHaveText(/098-2400\d{6}/);
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
    await expect(sky.getByRole('dialog')).toContainText('S2');
    await expect(sky.getByRole('dialog')).toContainText('Supplier-settlement');
    await sky.getByTestId('cancel-confirm').click();
    await expect(sky.getByText(/Refund pending supplier settlement/)).toBeVisible();
    const orb = await loginAs(browser, 'admin@orbit.example.com');
    const w0 = (await (await orb.request.get('/api/v1/wallet')).json()).data.walletCashMinor;
    await orb.goto('/agency/bookings/HFB1011');
    await orb.getByTestId('cancel-quote').click();
    await expect(orb.getByRole('dialog')).toContainText('S1');
    await expect(orb.getByTestId('refund-estimate')).toHaveText('₹11,450.00');
    await orb.getByTestId('cancel-confirm').click();
    await expect(orb.getByText(/credited to wallet/)).toBeVisible();
    const w1 = (await (await orb.request.get('/api/v1/wallet')).json()).data.walletCashMinor;
    expect(w1 - w0).toBe(1145000);
  });

  test('S-E: import SBD101 once; repeat is blocked', async ({ browser }) => {
    const page = await loginAs(browser, 'agent@skyline.example.com');
    await page.goto('/agency/import-pnr');
    await page.locator('input[name="pcc"]').fill('S9KY');
    await page.locator('input[name="pnr"]').fill('SBD101');
    await page.getByTestId('pnr-lookup').click();
    await expect(page.getByText('098-2400801001')).toBeVisible();
    await page.getByTestId('pnr-import').click();
    await expect(page.getByText('PNR SBD101 imported once')).toBeVisible();
    await page.getByTestId('pnr-lookup').click();
    await expect(page.getByText(/already exists as/)).toBeVisible();
    await page.getByTestId('pnr-import').click();
    await expect(page.getByText('Already imported', { exact: true }).first()).toBeVisible();
  });

  test('S-J: six XLSX downloads — Skyline 40 rows (scoped), Ops 100 rows', async ({ browser }) => {
    const rows = async (email: string, type: string) => {
      const page = await loginAs(browser, email);
      await page.goto(email.includes('hubfares') ? '/operations/reports' : '/agency/reports');
      await page.getByTestId(`report-${type}`).click();
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
    await expect(fin.getByRole('link', { name: 'Book a Flight' })).toHaveCount(0);
    await expect(fin.getByRole('link', { name: 'Wallet & Credit' })).toBeVisible();
    const r = await fin.request.post('/api/v1/quotes', { data: { tripType: 'ONE_WAY', legs: [{ offerId: 'offer_015', brandId: 'brand_015_saver' }], adults: 1 } });
    expect(r.status()).toBe(403);
  });

  test('TC-058 mobile OTA smoke: search page and Help drawer usable at 390px', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto('/login');
    await page.getByPlaceholder('name@agency.example.com').fill('agent@skyline.example.com');
    await page.getByPlaceholder('Operator demo password').fill('Hubfares@Demo2026');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/agency/);
    await page.goto('/agency/search');
    await page.getByTestId('search-submit').click();
    await expect(page.getByTestId('offer-offer_005')).toBeVisible();
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('link', { name: 'Manage Booking' })).toBeVisible();
    await ctx.close();
  });

  test('Trace TC-021/028/034/055: rules modal both profiles, own-booking filter by PNR, Demo/Simulated labels, roadmap previews', async ({ browser }) => {
    const page = await loginAs(browser, 'agent@skyline.example.com');
    // TC-034: Demo label in shell
    await expect(page.getByText('Demo environment', { exact: false }).first()).toBeVisible();
    // TC-021: open flexible profile rules too (restricted covered in S-B)
    await page.goto('/agency/search');
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
    // TC-034: booking detail shows simulated provider
    await page.goto(`/agency/bookings/${own.id}`);
    await expect(page.getByText('Simulated GDS PNR')).toBeVisible();
    await expect(page.getByText(/Sabre \(mock\)/).first()).toBeVisible();
    // TC-055: roadmap previews labelled, no false Connected banner
    const ops = await loginAs(browser, 'ops@hubfares.example.com');
    await ops.goto('/roadmap');
    await expect(ops.getByText('Planned integration').first()).toBeVisible();
    await expect(ops.getByText(/^Connected$/)).toHaveCount(0);
  });
});
