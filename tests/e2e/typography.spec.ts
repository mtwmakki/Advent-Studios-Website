import { test, expect, type Locator } from '@playwright/test';

const family = (l: Locator) => l.evaluate((el) => getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim());

test('Srotone only for the logo and hero headline; Geist everywhere else', async ({ page }) => {
  await page.goto('');
  for (const sel of ['h1', '.logo__word']) expect(await family(page.locator(sel).first()), sel).toBe('Srotone');
  for (const sel of [
    '#about h2', '#services h2', '#services h3', '#offer h2', '#faq h2', 'footer h2', '#marquee .marquee__item', '.menu__word',
    '.hero__sub', '#about .about__body', '.service-card__text', '#site-nav nav a', 'a.btn', '.faq__q button', '.faq__a p',
  ]) {
    expect(await family(page.locator(sel).first()), sel).toBe('Geist Variable');
  }
  for (const sel of ['.mono-label']) expect(await family(page.locator(sel).first()), sel).toBe('Geist Mono Variable');
});

// Owner's rule: the Advent Studio logo is always Srotone. Never change it.
for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]] as const) {
  test(`every Advent Studio logo wordmark is Srotone (${name})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('');
    const words = page.locator('.logo__word');
    const count = await words.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(words.nth(i)).toHaveText('Advent Studio');
      expect(await family(words.nth(i)), `logo ${i + 1}`).toBe('Srotone');
    }
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('800 20px Srotone');
    });
    expect(loaded, 'Srotone 800 is loaded for the logo').toBe(true);
  });
}
