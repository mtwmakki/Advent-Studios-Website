import { test, expect } from '@playwright/test';
import { site } from '../../src/content/site';

test('offer shows placeholders and books via WhatsApp', async ({ page }) => {
  await page.goto('');
  const offer = page.locator('#offer');
  await expect(offer).toContainText('[X] founding clients');
  await expect(offer.getByRole('link', { name: 'Book a call' })).toHaveAttribute('href', /^https:\/\/wa\.me\//);
});

test('faq toggles with mouse and keyboard', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('#intro')).toBeHidden({ timeout: 2500 });
  const q1 = page.getByRole('button', { name: site.faq[0].q });
  const q2 = page.getByRole('button', { name: site.faq[1].q });
  await expect(q1).toHaveAttribute('aria-expanded', 'false');
  await q1.scrollIntoViewIfNeeded();
  await q1.click();
  await expect(q1).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText(site.faq[0].a)).toBeVisible();
  await q2.focus();
  await page.keyboard.press('Enter');
  await expect(q2).toHaveAttribute('aria-expanded', 'true');
  await expect(q1).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Enter');
  await expect(q2).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText(site.faq[1].a)).toBeHidden();
});

test('footer has CTA, email and three socials', async ({ page }) => {
  await page.goto('');
  const footer = page.locator('footer');
  for (const name of ['Chat on WhatsApp', 'LinkedIn', 'Instagram', 'Behance']) {
    await expect(footer.getByRole('link', { name, exact: true })).toHaveCount(1);
  }
  await expect(footer.locator('a[href^="mailto:"]')).toHaveCount(1);
  await expect(footer.getByRole('link', { name: 'Chat on WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\//);
});

test.describe('no JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('faq answers are readable without JavaScript', async ({ page }) => {
    await page.goto('');
    for (const item of site.faq) await expect(page.getByText(item.a)).toBeVisible();
  });
});
