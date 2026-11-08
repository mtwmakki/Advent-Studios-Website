import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y <= h; y += 600) {
      if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    if (window.__lenis) window.__lenis.scrollTo(0, { immediate: true, force: true });
    else window.scrollTo(0, 0);
  });
  await page.waitForTimeout(3200); // past the reveal failsafe, so nothing is mid-animation
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('[aria-hidden="true"]').analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test('no axe violations on desktop', async ({ page }) => {
  await page.goto('');
  await scrollThrough(page);
  expect(await axe(page)).toEqual([]);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('no axe violations on phone', async ({ page }) => {
    await page.goto('');
    await scrollThrough(page);
    expect(await axe(page)).toEqual([]);
  });
});

test('one h1 and ordered headings', async ({ page }) => {
  await page.goto('');
  const levels = await page.evaluate(() =>
    [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')]
      .filter((h) => !h.closest('[aria-hidden="true"], [hidden]'))
      .map((h) => Number(h.tagName[1])),
  );
  expect(levels.filter((l) => l === 1)).toHaveLength(1);
  for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
});

test('touch targets at least 44px', async ({ page }) => {
  await page.goto('');
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('a, button')]
      .filter((el) => el.offsetParent !== null && !el.closest('[aria-hidden="true"]'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.width < 44 || r.height < 44))
      .map(({ el, r }) => `${el.textContent?.trim() || el.getAttribute('aria-label')} ${Math.round(r.width)}x${Math.round(r.height)}`),
  );
  expect(small).toEqual([]);
});

test('licences page is linked from the footer and served', async ({ page, request }) => {
  await page.goto('');
  const link = page.locator('footer').getByRole('link', { name: 'Licenses' });
  const href = await link.getAttribute('href');
  expect(href).toBeTruthy();
  const res = await request.get(new URL(href!, page.url()).toString());
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('mouse-follower');
});
