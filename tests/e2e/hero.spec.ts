import { test, expect, type Page } from '@playwright/test';
import { site } from '../../src/content/site';

async function scrollPanelToTop(page: Page) {
  await page.evaluate(() => {
    const el = document.querySelector('#hero-panel')!;
    const y = el.getBoundingClientRect().top + window.scrollY;
    if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  });
}

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
    await expect(page.locator('#hero-panel')).toBeVisible();
  });
});

test('panel grows to full width on scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('');
  await expect(page.locator('#intro')).toBeHidden({ timeout: 2500 });
  expect((await page.locator('#hero-panel').boundingBox())!.width).toBeLessThan(1300);
  await scrollPanelToTop(page);
  await expect.poll(async () => (await page.locator('#hero-panel').boundingBox())!.width, { timeout: 4000 }).toBeGreaterThanOrEqual(1430);
});

test('dashboard is hidden from assistive tech but described', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('[data-dashboard]')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByText('Demo: a project dashboard we designed and built')).toBeAttached();
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('reduced motion keeps panel contained and dashboard static', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('[data-tile="Open features"] [data-count]')).toHaveText('24');
    await scrollPanelToTop(page);
    await page.waitForTimeout(600);
    expect((await page.locator('#hero-panel').boundingBox())!.width).toBeLessThan(1300);
  });
});
