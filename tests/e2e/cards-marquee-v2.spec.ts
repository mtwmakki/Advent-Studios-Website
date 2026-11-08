import { test, expect } from '@playwright/test';

const MARK = '0,100 0,58 58,0 160,0 160,100 104,100 104,70 92,70 62,100';

test('the Block A mark appears only in the logo and intro, not in cards or marquee', async ({ page }) => {
  await page.goto('');
  const where = await page.evaluate((mark) =>
    [...document.querySelectorAll('polygon')]
      .filter((p) => p.getAttribute('points') === mark)
      .map((p) => (p.closest('#intro') ? 'intro' : p.closest('.logo') ? 'logo' : 'elsewhere')),
  MARK);
  expect(where.filter((w) => w === 'elsewhere')).toEqual([]);
  await expect(page.locator('#marquee svg')).toHaveCount(0);
});

test('marquee words alternate solid and outline', async ({ page }) => {
  await page.goto('');
  const styles = await page.locator('#marquee [data-marquee-item]').first().locator('.marquee__word').evaluateAll((ws) =>
    ws.map((w) => ({ stroke: parseFloat(getComputedStyle(w).webkitTextStrokeWidth || '0'), color: getComputedStyle(w).color })),
  );
  expect(styles.length).toBe(5);
  styles.forEach((s, i) => {
    if (i % 2 === 0) expect(s.stroke, `word ${i} solid`).toBe(0);
    else {
      expect(s.stroke, `word ${i} outline`).toBeGreaterThan(0);
      expect(s.color, `word ${i} hollow`).toBe('rgba(0, 0, 0, 0)');
    }
  });
});

test('each card has a full-bleed media slot on its right half', async ({ page }) => {
  await page.goto('');
  const cards = page.locator('[data-service-card]');
  await expect(cards).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    const card = (await cards.nth(i).boundingBox())!;
    const media = (await cards.nth(i).locator('[data-card-media]').boundingBox())!;
    expect(Math.abs(media.x + media.width - (card.x + card.width))).toBeLessThan(2);
    expect(Math.abs(media.width - card.width / 2)).toBeLessThan(card.width * 0.08);
    expect(Math.abs(media.height - card.height)).toBeLessThan(2);
  }
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('media sits below the text, full card width', async ({ page }) => {
    await page.goto('');
    const card = page.locator('[data-service-card]').first();
    const c = (await card.boundingBox())!;
    const m = (await card.locator('[data-card-media]').boundingBox())!;
    const btn = (await card.getByRole('link', { name: 'Talk about this' }).boundingBox())!;
    expect(m.y).toBeGreaterThan(btn.y + btn.height - 1);
    expect(Math.abs(m.width - c.width)).toBeLessThan(2);
  });
});
