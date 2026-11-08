import { test, expect } from '@playwright/test';

test('intro plays once per session', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('#intro')).toBeVisible();
  await expect(page.locator('#intro')).toBeHidden({ timeout: 2500 });
  await page.reload();
  for (let i = 0; i < 5; i++) {
    await expect(page.locator('#intro')).toBeHidden();
    await page.waitForTimeout(100);
  }
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('intro skipped under reduced motion', async ({ page }) => {
    await page.goto('', { waitUntil: 'commit' });
    await page.waitForSelector('#intro', { state: 'attached' });
    await expect(page.locator('#intro')).toBeHidden();
  });
});

test('nav links scroll to sections', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('#intro')).toBeHidden({ timeout: 2500 });
  await page.locator('#site-nav').getByRole('link', { name: 'About', exact: true }).click();
  await expect.poll(async () => (await page.locator('#about').boundingBox())!.y, { timeout: 2500 }).toBeLessThan(200);
});

test('nav collapses into menu button after scrolling', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('#intro')).toBeHidden({ timeout: 2500 });
  await expect(page.locator('#menu-toggle')).toBeHidden();
  await page.mouse.wheel(0, 400);
  await expect(page.locator('#menu-toggle')).toBeVisible();
  await expect(page.locator('#site-nav').getByRole('link', { name: 'About', exact: true })).toBeHidden();
});

test('keyboard can open, use and close the menu', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('#intro')).toBeHidden({ timeout: 2500 });
  await page.mouse.wheel(0, 400);
  const toggle = page.locator('#menu-toggle');
  await expect(toggle).toBeVisible();
  await toggle.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('dialog', { name: 'Menu' });
  await expect(menu).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('#menu'))).toBe(true);
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    // Focus cycles through the menu and the close toggle, never the page behind.
    expect(await page.evaluate(() => !!document.activeElement?.closest('#menu, #menu-toggle'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('phone shows menu button from the top', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('#intro')).toBeHidden({ timeout: 2500 });
    await expect(page.locator('#menu-toggle')).toBeVisible();
  });
});
