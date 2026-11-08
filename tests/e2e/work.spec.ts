import { test, expect } from '@playwright/test';
import { site } from '../../src/content/site';

test('work section follows the hero with the case study story', async ({ page }) => {
  await page.goto('');
  const order = await page.evaluate(() => [...document.querySelectorAll('main > section')].map((s) => s.id));
  expect(order.indexOf('work')).toBe(order.indexOf('hero') + 1);
  const work = page.locator('#work');
  await expect(work.getByRole('heading', { level: 2 })).toHaveText(site.work.title);
  for (const b of site.work.story) {
    await expect(work.getByRole('heading', { level: 3, name: b.label })).toBeVisible();
    await expect(work.getByText(b.text)).toBeVisible();
  }
  await expect(work).toContainText('sample data');
});

test('this website is listed as proof', async ({ page }) => {
  await page.goto('');
  const proof = page.locator('#work [data-site-proof]');
  for (const item of site.work.siteProof.items) await expect(proof).toContainText(item);
});

test('nav links to the work section', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('#site-nav').getByRole('link', { name: 'Work', exact: true })).toHaveAttribute('href', '#work');
});
