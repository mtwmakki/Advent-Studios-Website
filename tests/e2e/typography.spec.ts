import { test, expect, type Locator } from '@playwright/test';

const family = (l: Locator) => l.evaluate((el) => getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim());

test('Srotone only for the logo and hero headline; Geist everywhere else', async ({ page }) => {
  await page.goto('');
  for (const sel of ['h1', '.logo__word']) expect(await family(page.locator(sel).first()), sel).toBe('Srotone');
  for (const sel of [
    '#about h2', '#services h2', '#services h3', '#offer h2', '#faq h2', 'footer h2', '#marquee .marquee__item', '.menu__word',
    '.hero__sub', '#about .about__body', '.service-card__text', '#site-nav nav a', 'a.btn', '.faq__q button', '.faq__a p', '[data-dashboard]',
  ]) {
    expect(await family(page.locator(sel).first()), sel).toBe('Geist Variable');
  }
  for (const sel of ['.mono-label', '.dash__tn']) expect(await family(page.locator(sel).first()), sel).toBe('Geist Mono Variable');
});
