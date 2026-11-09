import { test, expect, type Page } from '@playwright/test';

async function ready(page: Page) {
  await page.goto('');
  await expect(page.locator('#intro')).toBeHidden({ timeout: 2500 });
  await page.mouse.move(400, 300);
  await page.waitForTimeout(900); // idle-time setup (cursor, marquee, glass)
}
async function scrollTo(page: Page, y: number) {
  await page.evaluate((y) => (window.__lenis ? window.__lenis.scrollTo(y, { immediate: true, force: true }) : window.scrollTo(0, y)), y);
  await page.waitForTimeout(400);
}
async function hoverMarquee(page: Page) {
  const top = await page.locator('#marquee').evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  await scrollTo(page, top - 300);
  const box = (await page.locator('#marquee').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2, { steps: 4 });
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 6 });
  return box;
}
const opacity = (page: Page, sel: string) => page.locator(sel).evaluate((el) => Number(getComputedStyle(el).opacity));

test('the cursor is a small glass bead', async ({ page }) => {
  await ready(page);
  const style = await page.locator('.mf-cursor').evaluate((el) => {
    const s = getComputedStyle(el, '::before');
    return { backdrop: s.backdropFilter || (s as unknown as { webkitBackdropFilter: string }).webkitBackdropFilter, bg: s.backgroundImage };
  });
  expect(style.backdrop).toContain('blur');
  expect(style.bg).toContain('radial-gradient');
});

test('over the marquee the bead becomes a round lens that magnifies the words', async ({ page }) => {
  await ready(page);
  await hoverMarquee(page);
  const lens = page.locator('[data-glass-lens]');
  await expect(lens).toHaveAttribute('aria-hidden', 'true');
  await expect.poll(() => opacity(page, '[data-glass-lens]'), { timeout: 3000 }).toBeGreaterThan(0.95);
  // It grows with a small elastic overshoot, then settles at 220px.
  await expect.poll(async () => Math.round((await lens.boundingBox())!.width), { timeout: 3000 }).toBeGreaterThan(214);
  await expect.poll(async () => Math.round((await lens.boundingBox())!.width), { timeout: 3000 }).toBeLessThan(226);
  const box = (await lens.boundingBox())!;
  expect(Math.abs(box.width - box.height)).toBeLessThan(2);
  // It shows a live copy of the marquee, magnified 1.4 times.
  await expect(lens.locator('.marquee__word').first()).toHaveText('Web design');
  const scale = await lens.locator('[data-glass-content]').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  expect(scale).toBeCloseTo(1.4, 2);
  // The small bead steps aside while the lens is out.
  await expect(page.locator('.mf-cursor')).toHaveClass(/-hidden/);
});

test('over the hero the lens magnifies the headline, and steps aside over the Book a call button', async ({ page }) => {
  await ready(page);
  const h1 = (await page.locator('#hero h1').boundingBox())!;
  await page.mouse.move(h1.x + h1.width * 0.4, h1.y + h1.height * 0.3, { steps: 6 });
  await expect.poll(() => opacity(page, '[data-glass-lens]'), { timeout: 3000 }).toBeGreaterThan(0.95);
  await expect(page.locator('[data-glass-lens] h1')).toContainText('studio for apps');
  await expect(page.locator('.mf-cursor')).toHaveClass(/-hidden/);
  // Links and buttons get the normal cursor so their hover effects show.
  const cta = (await page.locator('#hero a.btn').boundingBox())!;
  await page.mouse.move(cta.x + cta.width / 2, cta.y + cta.height / 2, { steps: 6 });
  await expect.poll(() => opacity(page, '[data-glass-lens]'), { timeout: 3000 }).toBeLessThan(0.05);
  await expect(page.locator('.mf-cursor')).not.toHaveClass(/-hidden/);
});

test('leaving the marquee shrinks the lens back into the glass cursor', async ({ page }) => {
  await ready(page);
  const box = await hoverMarquee(page);
  await expect.poll(() => opacity(page, '[data-glass-lens]'), { timeout: 3000 }).toBeGreaterThan(0.95);
  await page.mouse.move(box.x + box.width * 0.5, box.y - 160, { steps: 6 });
  await expect.poll(() => opacity(page, '[data-glass-lens]'), { timeout: 3000 }).toBeLessThan(0.05);
  await expect(page.locator('.mf-cursor')).not.toHaveClass(/-hidden/);
});

test('the open foldable shows the Live demo label on the cursor', async ({ page }) => {
  await ready(page);
  const { top, h } = await page.locator('#work [data-fold]').evaluate((el) => ({ top: el.getBoundingClientRect().top + window.scrollY, h: (el as HTMLElement).offsetHeight }));
  await scrollTo(page, top + h - 900);
  await expect(page.locator('canvas[data-fold-canvas]')).toHaveCount(1, { timeout: 8000 });
  await page.waitForTimeout(1500);
  const stage = (await page.locator('#work [data-fold-stage]').boundingBox())!;
  await page.mouse.move(stage.x + stage.width / 2 - 30, stage.y + stage.height / 2, { steps: 4 });
  await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2, { steps: 4 });
  await expect(page.locator('.mf-cursor')).toHaveClass(/-text/, { timeout: 3000 });
  await expect(page.locator('.mf-cursor-text')).toHaveText('Live demo');
});

test.describe('touch device', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('no glass lens on touch screens', async ({ page }) => {
    await page.goto('');
    await scrollTo(page, 1500);
    await page.waitForTimeout(800);
    await expect(page.locator('[data-glass-lens]')).toHaveCount(0);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('no glass lens with reduced motion', async ({ page }) => {
    await page.goto('');
    await page.mouse.move(400, 300);
    await page.waitForTimeout(800);
    await expect(page.locator('[data-glass-lens]')).toHaveCount(0);
  });
});
