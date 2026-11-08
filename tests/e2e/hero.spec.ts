import { test, expect } from '@playwright/test';
import { site } from '../../src/content/site';

test('hero headline and CTA', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('h1')).toHaveText(site.hero.headline);
  const cta = page.locator('#hero').getByRole('link', { name: 'Book a call' });
  await expect(cta).toHaveAttribute('href', /^https:\/\/wa\.me\//);
});

test.describe('no JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('content is visible with JavaScript disabled', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('h1')).toBeVisible();
    const h2s = page.locator('h2');
    for (let i = 0; i < (await h2s.count()); i++) await expect(h2s.nth(i)).toBeVisible();
    await expect(page.locator('#work video')).toBeVisible();
  });
});

test('the demo footage is hidden from assistive tech but described', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('#work video')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#work figcaption')).toContainText('Demo: the project dashboard we designed and built');
});
