import { test, expect, type Locator } from '@playwright/test';

const family = (l: Locator) => l.evaluate((el) => getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim());

test('headlines use Srotone, reading and UI text use Geist', async ({ page }) => {
  await page.goto('');
  for (const sel of ['h1', '#about h2', '#services h3', '#offer h2', 'footer h2', '#marquee .marquee__item']) {
    expect(await family(page.locator(sel).first()), sel).toBe('Srotone');
  }
  for (const sel of ['.hero__sub', '#about .about__body', '.service-card__text', '#site-nav nav a', 'a.btn', '.faq__q button', '.faq__a p', '[data-dashboard]']) {
    expect(await family(page.locator(sel).first()), sel).toBe('Geist Variable');
  }
  expect(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('500 16px "Geist Variable"'); })).toBe(true);
});
