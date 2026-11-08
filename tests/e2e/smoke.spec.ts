import { test, expect } from '@playwright/test';

test('page loads with title and logo', async ({ page }) => {
  await page.goto('');
  await expect(page).toHaveTitle(/Advent Studio/);
  await expect(page.getByRole('img', { name: 'Advent Studio' }).first()).toBeVisible();
});

test('no request fails under the base path', async ({ page }) => {
  const failures: string[] = [];
  page.on('response', (r) => { if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', (r) => failures.push(`failed ${r.url()}`));
  await page.goto('', { waitUntil: 'networkidle' });
  expect(failures).toEqual([]);
});

test('Srotone is loaded', async ({ page }) => {
  await page.goto('');
  const ok = await page.evaluate(async () => {
    await document.fonts.ready;
    await document.fonts.load('800 48px Srotone');
    return document.fonts.check('800 48px Srotone') && [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Srotone' && f.status === 'loaded');
  });
  expect(ok).toBe(true);
});
