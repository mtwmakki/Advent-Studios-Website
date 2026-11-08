import { test, expect, type Page } from '@playwright/test';
import { site } from '../../src/content/site';

async function scrollTo(page: Page, y: number) {
  await page.evaluate((y) => {
    if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  }, y);
  await page.waitForTimeout(250);
}

/** Scrolls until the second card's top reaches `limit`, then returns card 1's top. */
async function stackedTop(page: Page, limit: number) {
  const cards = page.locator('[data-service-card]');
  const card2Doc = await cards.nth(1).evaluate((el) => {
    // Document offset of card 2 ignoring sticky: walk offsetTop chain.
    let y = 0, n: HTMLElement | null = el as HTMLElement;
    while (n) { y += n.offsetTop; n = n.offsetParent as HTMLElement | null; }
    return y;
  });
  await scrollTo(page, card2Doc - limit + 10);
  expect((await cards.nth(1).boundingBox())!.y).toBeLessThanOrEqual(limit + 2);
  return (await cards.nth(0).boundingBox())!.y;
}

test('four services in order', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('#services h3')).toHaveText(site.services.map((s) => s.title));
});

test('card buttons open WhatsApp with the service', async ({ page }) => {
  await page.goto('');
  const link = page.locator('[data-service-card]').nth(2).getByRole('link', { name: 'Talk about this' });
  await expect(link).toHaveAttribute('href', /talk%20about%20Custom%20apps%20%26%20automation\.$/);
});

test('cards stack on desktop', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('#intro')).toBeHidden({ timeout: 2500 });
  const top = await stackedTop(page, 120);
  expect(top).toBeGreaterThanOrEqual(80);
  expect(top).toBeLessThanOrEqual(112);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('mobile: cards stack and page has no horizontal overflow', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('#intro')).toBeHidden({ timeout: 2500 });
    const top = await stackedTop(page, 96);
    expect(top).toBeGreaterThanOrEqual(56);
    expect(top).toBeLessThanOrEqual(88);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      await scrollTo(page, Math.round((height - 844) * f));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    }
  });
});
