import { Browser, Page, expect } from '@playwright/test';
export const PW = 'Hubfares@Demo2026';
export async function loginAs(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.getByPlaceholder('name@agency.example.com').fill(email);
  await page.getByPlaceholder('Password', { exact: true }).fill(PW);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/(agency|operations|executive)/);
  return page;
}
export async function seededDate(page: Page, route: string): Promise<string> {
  const r = await page.request.get('/api/v1/search/seeded-dates');
  const j = await r.json();
  expect(j.data[route]?.length).toBeGreaterThan(0);
  return j.data[route][0];
}
