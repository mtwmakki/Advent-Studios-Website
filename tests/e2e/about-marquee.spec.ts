import { test, expect, type Page } from '@playwright/test';
import { site } from '../../src/content/site';

const trackX = (page: Page) =>
  page.locator('[data-marquee-track]').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);

test('about section with statement and values', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('#about h2')).toHaveText(site.about.statement);
  await expect(page.locator('#about [data-values] li')).toHaveCount(4);
});

test('marquee has exactly one accessible copy', async ({ page }) => {
  await page.goto('');
  await page.locator('#marquee').scrollIntoViewIfNeeded();
  const visibleCopies = page.locator('#marquee [data-marquee-item]:not([aria-hidden="true"])');
  await expect(visibleCopies).toHaveCount(1);
  for (const s of ['Web design', 'UI/UX', 'Apps', 'Automation', 'Brand']) await expect(visibleCopies).toContainText(s);
  expect(await page.locator('#marquee [data-marquee-item][aria-hidden="true"]').count()).toBeGreaterThan(0);
});

test('marquee moves on its own', async ({ page }) => {
  await page.goto('');
  await page.locator('#marquee').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const a = await trackX(page);
  await page.waitForTimeout(500);
  expect(await trackX(page)).not.toBe(a);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('marquee stays still under reduced motion', async ({ page }) => {
    await page.goto('');
    await page.locator('#marquee').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const a = await trackX(page);
    await page.waitForTimeout(500);
    expect(await trackX(page)).toBe(a);
  });
});
