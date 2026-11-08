import { test, expect, type Page } from '@playwright/test';

async function ready(page: Page) {
  await page.goto('');
  await expect(page.locator('#intro')).toBeHidden({ timeout: 2500 });
  await page.waitForTimeout(700); // idle-time setup
}
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);
async function scrollTo(page: Page, y: number) {
  await page.evaluate((y) => (window.__lenis ? window.__lenis.scrollTo(y, { immediate: true, force: true }) : window.scrollTo(0, y)), y);
  await page.waitForTimeout(200);
}

test('menu links scroll to their section on desktop', async ({ page }) => {
  await ready(page);
  await scrollTo(page, 600);
  await page.locator('#menu-toggle').click();
  await page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: 'FAQ' }).click();
  await expect.poll(async () => (await page.locator('#faq').boundingBox())!.y, { timeout: 3000 }).toBeLessThan(200);
});

test.describe('scripts blocked', () => {
  test('intro overlay clears even if the script bundle fails', async ({ page }) => {
    await page.route('**/_astro/*.js', (r) => r.abort());
    await page.goto('');
    await expect(page.locator('#intro')).toBeHidden({ timeout: 4000 });
  });
});

test('focused service-card button is not covered by the next card', async ({ page }) => {
  await ready(page);
  for (let i = 0; i < 3; i++) {
    const btn = page.locator('[data-service-card]').nth(i).getByRole('link', { name: 'Talk about this' });
    await btn.focus();
    await page.waitForTimeout(1500);
    const onTop = await btn.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!hit && el.contains(hit);
    });
    expect(onTop, `card ${i + 1} button visible`).toBe(true);
  }
});

test('keyboard focus moves to the section a nav link points to', async ({ page }) => {
  await ready(page);
  await page.locator('#site-nav').getByRole('link', { name: 'FAQ', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('#faq'))).toBe(true);
  const y = await scrollY(page);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => !!document.activeElement?.closest('#faq'))).toBe(true);
  expect(await scrollY(page)).toBeGreaterThan(y - 400);
});

test('re-opening the menu during its close animation leaves it open', async ({ page }) => {
  await ready(page);
  await scrollTo(page, 600);
  const toggle = page.locator('#menu-toggle');
  await toggle.click();
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  await toggle.click();
  await page.waitForTimeout(1000);
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
});

test('menu toggle keeps its own transform after a hover', async ({ page }) => {
  await ready(page);
  await scrollTo(page, 600);
  const toggle = page.locator('#menu-toggle');
  await toggle.hover();
  await page.mouse.move(10, 400);
  await page.waitForTimeout(1200);
  expect(await toggle.evaluate((el) => el.style.transform)).toBe('');
});
