import { test, expect } from '@playwright/test';

test('desktop gets lenis and cursor', async ({ page }) => {
  await page.goto('');
  await page.mouse.move(400, 300);
  await expect(page.locator('html')).toHaveClass(/\blenis\b/);
  await expect(page.locator('.mf-cursor')).toHaveCount(1);
});

test.describe('touch device', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('touch device gets no cursor follower', async ({ page }) => {
    await page.goto('');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.mf-cursor')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveClass(/\blenis\b/);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('reduced motion: all section headings visible, no lenis, no cursor', async ({ page }) => {
    await page.goto('');
    await page.waitForLoadState('networkidle');
    await page.mouse.move(400, 300);
    const headings = page.locator('h1, h2');
    const n = await headings.count();
    for (let i = 0; i < n; i++) {
      const h = headings.nth(i);
      await h.scrollIntoViewIfNeeded();
      await expect(h).toBeVisible();
      expect(await h.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
    }
    await expect(page.locator('html')).not.toHaveClass(/\blenis\b/);
    await expect(page.locator('.mf-cursor')).toHaveCount(0);
  });
});
