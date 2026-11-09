import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const MISSING = 'this-page-does-not-exist/at-all';

const family = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim());

test('a missing page answers with the 404 page', async ({ page }) => {
  const errors: string[] = [];
  const failed: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Chrome logs the page's own 404 status as a console error; that one is expected.
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes(MISSING)) failed.push(`${r.status()} ${r.url()}`); });
  const res = await page.goto(MISSING);
  expect(res?.status()).toBe(404);
  await expect(page).toHaveTitle(/Page not found/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page drifted off the grid.');
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
  expect(failed, 'fonts, scripts and styles all load from a nested missing URL').toEqual([]);
});

test('the big 404 is set in Srotone Pixel and hidden from screen readers', async ({ page }) => {
  await page.goto(MISSING);
  const code = page.locator('[data-error-code]');
  await expect(code).toHaveText('404');
  await expect(code).toHaveAttribute('aria-hidden', 'true');
  expect(await family(page, '[data-error-code]')).toBe('Srotone Pixel');
  expect(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('700 200px "Srotone Pixel"'); })).toBe(true);
  // Screen readers still hear what happened.
  await expect(page.getByText('Error 404: page not found')).toBeAttached();
});

test('the logo stays Srotone and leads home, along with the home button', async ({ page }) => {
  await page.goto(MISSING);
  expect(await family(page, '.logo__word')).toBe('Srotone');
  await expect(page.getByRole('link', { name: 'Advent Studio, home' })).toHaveAttribute('href', '/Advent-Studios-Website/');
  const home = page.getByRole('main').getByRole('link', { name: 'Back to home' });
  await expect(home).toHaveAttribute('href', '/Advent-Studios-Website/');
  await home.click();
  await expect(page.locator('#hero h1')).toBeVisible();
});

test('the 404 page offers a WhatsApp call', async ({ page }) => {
  await page.goto(MISSING);
  const links = page.getByRole('link', { name: 'Book a call' });
  expect(await links.count()).toBeGreaterThan(0);
  for (let i = 0; i < (await links.count()); i++) await expect(links.nth(i)).toHaveAttribute('href', /^https:\/\/wa\.me\//);
});

test('no axe violations on the 404 page', async ({ page }) => {
  await page.goto(MISSING);
  await page.waitForTimeout(3200);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('[aria-hidden="true"]').analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('the 404 fits the screen without sideways scrolling', async ({ page }) => {
    await page.goto(MISSING);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const box = (await page.locator('[data-error-code]').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  });
});
