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

test('the demo video downloads nothing on page load', async ({ page }) => {
  const videoRequests: string[] = [];
  page.on('request', (r) => { if (/\/videos\/work-dashboard\.(mp4|webm)/.test(r.url())) videoRequests.push(r.url()); });
  await page.goto('', { waitUntil: 'networkidle' });
  expect(videoRequests).toEqual([]);
});

test('the player shows the whole laptop footage without cropping', async ({ page }) => {
  await ready(page);
  // The page's own video loads nothing until needed, so read the file's size with a test copy.
  const { vw, vh, pw, ph } = await page.evaluate(async () => {
    const src = document.querySelector<HTMLSourceElement>('#work [data-melt-video] source[type="video/mp4"]')!.src;
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'metadata';
    await new Promise((r) => { v.addEventListener('loadedmetadata', r, { once: true }); v.src = src; });
    const p = document.querySelector<HTMLElement>('#work [data-melt-to]')!.getBoundingClientRect();
    return { vw: v.videoWidth, vh: v.videoHeight, pw: p.width, ph: p.height };
  });
  expect(vw / vh).toBeCloseTo(16 / 10, 2);
  expect(Math.abs(pw / ph - vw / vh)).toBeLessThan(0.01);
});

test('desktop: the melting video is drawn with WebGL over the player', async ({ page }) => {
  await ready(page);
  const playerTop = await docTop(page, '#work [data-melt-to]');
  const box0 = (await page.locator('#work [data-melt-to]').boundingBox())!;
  await scrollTo(page, playerTop - (900 - box0.height) / 2);
  await page.waitForTimeout(900);
  await expect(page.locator('canvas[data-melt]')).toBeVisible();
  await expect(page.locator('#work')).toHaveClass(/\bis-gl\b/);
  const box = (await page.locator('#work [data-melt-to]').boundingBox())!;
  const shot = await page.screenshot({ clip: { x: box.x + box.width / 2 - 2, y: box.y + box.height / 2 - 2, width: 4, height: 4 } });
  // The page background is Bone; the footage there is the dark laptop scene.
  const png = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    return Array.from(ctx.getImageData(1, 1, 1, 1).data);
  }, shot.toString('base64'));
  expect(png[0] + png[1] + png[2]).toBeLessThan(300);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('no WebGL; the plain video is shown in place', async ({ page }) => {
    await page.goto('');
    await page.waitForTimeout(800);
    await expect(page.locator('canvas[data-melt]')).toHaveCount(0);
    const v = page.locator('#work [data-melt-video]');
    await v.scrollIntoViewIfNeeded();
    await expect(v).toBeVisible();
    expect(await v.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
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
  test('thread and melt never cause sideways scrolling', async ({ page }) => {
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
