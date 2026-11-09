import { test, expect, type Page } from '@playwright/test';

async function ready(page: Page) {
  await page.goto('');
  await expect(page.locator('#intro')).toBeHidden({ timeout: 2500 });
  await page.waitForTimeout(800); // idle-time setup
}
async function scrollTo(page: Page, y: number) {
  await page.evaluate((y) => (window.__lenis ? window.__lenis.scrollTo(y, { immediate: true, force: true }) : window.scrollTo(0, y)), y);
  await page.waitForTimeout(350);
}
const docTop = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => el.getBoundingClientRect().top + window.scrollY);

test('the hero no longer has a dashboard panel', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('#hero-panel')).toHaveCount(0);
  await expect(page.locator('#hero [data-dashboard]')).toHaveCount(0);
});

test('the two statement lines drift in opposite directions on scroll', async ({ page }) => {
  await ready(page);
  const top = await docTop(page, '#work h2');
  const x = () => page.locator('#work [data-drift]').evaluateAll((els) => els.map((el) => new DOMMatrix(getComputedStyle(el).transform).m41));
  await scrollTo(page, top - 700);
  const a = await x();
  await scrollTo(page, top - 100);
  const b = await x();
  expect(a.length).toBe(2);
  expect(b[0]).toBeGreaterThan(a[0] + 10);
  expect(b[1]).toBeLessThan(a[1] - 10);
});

// Scroll progress through the foldable's pinned track: 0 at its start, 1 at its end.
async function scrollFold(page: Page, f: number) {
  const { top, h } = await page.locator('#work [data-fold]').evaluate((el) => ({ top: el.getBoundingClientRect().top + window.scrollY, h: (el as HTMLElement).offsetHeight }));
  const vh = await page.evaluate(() => window.innerHeight);
  await scrollTo(page, Math.round(top + (h - vh) * f));
  await page.waitForTimeout(500);
}
const angle = (page: Page) => page.locator('#work [data-fold]').evaluate((el) => Number(el.getAttribute('data-fold-angle')));

test('nothing for the foldable downloads on page load', async ({ page }) => {
  const heavy: string[] = [];
  page.on('request', (r) => { if (/fold-inner\.mp4|\/_astro\/fold\.[\w-]+\.js/.test(r.url())) heavy.push(r.url()); });
  await page.goto('', { waitUntil: 'networkidle' });
  expect(heavy).toEqual([]);
});

test('the inner screen shows the whole dashboard without cropping', async ({ page }) => {
  await ready(page);
  const { vw, vh } = await page.evaluate(async () => {
    const src = document.querySelector<HTMLElement>('#work [data-fold]')!.dataset.inner!;
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'metadata';
    await new Promise((r) => { v.addEventListener('loadedmetadata', r, { once: true }); v.src = src; });
    return { vw: v.videoWidth, vh: v.videoHeight };
  });
  await scrollFold(page, 0.1);
  await expect(page.locator('canvas[data-fold-canvas]')).toHaveCount(1, { timeout: 8000 });
  const screen = await page.evaluate(() => (window as any).__fold.screenAspect as number);
  expect(Math.abs(vw / vh - screen)).toBeLessThan(0.01);
});

test('desktop: the foldable opens from closed to flat as you scroll, drawn in 3D', async ({ page }) => {
  await ready(page);
  await scrollFold(page, 0);
  await expect(page.locator('canvas[data-fold-canvas]')).toHaveCount(1, { timeout: 8000 });
  await expect(page.locator('#work')).toHaveClass(/\bis-3d\b/, { timeout: 8000 });
  await expect.poll(() => angle(page)).toBeLessThan(5);
  await scrollFold(page, 0.5);
  await expect.poll(() => angle(page)).toBeGreaterThan(40);
  expect(await angle(page)).toBeLessThan(150);
  await scrollFold(page, 1);
  await expect.poll(() => angle(page), { timeout: 4000 }).toBeGreaterThan(178);
  // The device is drawn: the middle of the stage is the dark screen, not the Bone page.
  const box = (await page.locator('#work [data-fold-stage]').boundingBox())!;
  const shot = await page.screenshot({ clip: { x: box.x + box.width / 2 - 40, y: box.y + box.height / 2 - 2, width: 4, height: 4 } });
  const px = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    return Array.from(ctx.getImageData(1, 1, 1, 1).data);
  }, shot.toString('base64'));
  expect(px[0] + px[1] + px[2]).toBeLessThan(300);
});

test('the foldable stays pinned while it opens', async ({ page }) => {
  await ready(page);
  await scrollFold(page, 0.2);
  const a = (await page.locator('#work [data-fold-stage]').boundingBox())!.y;
  await scrollFold(page, 0.7);
  const b = (await page.locator('#work [data-fold-stage]').boundingBox())!.y;
  expect(Math.abs(a - b)).toBeLessThan(2);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('no 3D and no pinning; a still of the open device is shown', async ({ page }) => {
    await page.goto('');
    await scrollTo(page, 300);
    await page.waitForTimeout(800);
    await expect(page.locator('canvas[data-fold-canvas]')).toHaveCount(0);
    const still = page.locator('#work [data-fold-still]');
    await still.scrollIntoViewIfNeeded();
    await expect(still).toBeVisible();
    const h = await page.locator('#work [data-fold]').evaluate((el) => (el as HTMLElement).offsetHeight);
    expect(h).toBeLessThan(900 * 1.4);
  });
});

test.describe('no JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('a still of the open device is shown', async ({ page }) => {
    await page.goto('');
    const still = page.locator('#work [data-fold-still]');
    await still.scrollIntoViewIfNeeded();
    await expect(still).toBeVisible();
    expect(await still.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  });
});

test('the orange thread draws with scroll and ends at the footer WhatsApp button', async ({ page }) => {
  await ready(page);
  const path = page.locator('svg[data-thread] path');
  // The thread is set up on the first scroll; it is far below the first screen.
  await expect(page.locator('svg[data-thread]')).toHaveCount(0);
  await scrollTo(page, 200);
  await expect(page.locator('svg[data-thread]')).toHaveAttribute('aria-hidden', 'true');
  expect(await path.evaluate((p) => getComputedStyle(p).stroke)).toBe('rgb(255, 79, 26)');
  const offset = () => path.evaluate((p) => parseFloat(getComputedStyle(p).strokeDashoffset));
  await scrollTo(page, (await docTop(page, '#work')) - 200);
  const a = await offset();
  await scrollTo(page, await docTop(page, '#about'));
  const b = await offset();
  expect(b).toBeLessThan(a);
  const end = await path.evaluate((p: SVGPathElement) => {
    const pt = p.getPointAtLength(p.getTotalLength());
    const m = p.getScreenCTM()!;
    return { x: pt.x * m.a + m.e, y: pt.y * m.d + m.f + window.scrollY };
  });
  const btn = await page.locator('footer a.btn--xl').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { l: r.left, r: r.right, t: r.top + window.scrollY, b: r.bottom + window.scrollY };
  });
  expect(end.x).toBeGreaterThanOrEqual(btn.l - 4);
  expect(end.x).toBeLessThanOrEqual(btn.r + 4);
  expect(end.y).toBeGreaterThanOrEqual(btn.t - 4);
  expect(end.y).toBeLessThanOrEqual(btn.b + 4);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('thread and foldable never cause sideways scrolling', async ({ page }) => {
    await page.goto('');
    await page.waitForTimeout(1500);
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (const f of [0.15, 0.3, 0.5, 0.8, 1]) {
      await scrollTo(page, Math.round((h - 844) * f));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    }
    await expect(page.locator('svg[data-thread] path')).toHaveCount(1);
  });
});
