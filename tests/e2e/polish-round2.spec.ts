import { test, expect } from '@playwright/test';

test('headline line masks leave room for tall glyphs (i-dots, accents)', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('#intro')).toBeHidden({ timeout: 2500 });
  await page.waitForTimeout(1500);
  const gaps = await page.locator('h1 .reveal-line-mask').evaluateAll((masks) =>
    masks.map((m) => {
      const line = m.querySelector('.reveal-line')!;
      const fs = parseFloat(getComputedStyle(line).fontSize);
      return (line.getBoundingClientRect().top - m.getBoundingClientRect().top) / fs;
    }),
  );
  expect(gaps.length).toBeGreaterThan(1);
  for (const g of gaps) expect(g).toBeGreaterThanOrEqual(0.1);
});

test('the card being read is not dimmed while the next one only peeks in', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('#intro')).toBeHidden({ timeout: 2500 });
  await page.waitForTimeout(700);
  const cards = page.locator('[data-service-card]');
  const y2 = await cards.nth(1).evaluate((el) => { let y = 0, n: HTMLElement | null = el as HTMLElement; while (n) { y += n.offsetTop; n = n.offsetParent as HTMLElement | null; } return y; });
  // Put card 2's top at 75% of the viewport height.
  await page.evaluate((y) => window.__lenis!.scrollTo(y - innerHeight * 0.75, { immediate: true, force: true }), y2);
  await page.waitForTimeout(400);
  const shade = await cards.nth(0).locator('[data-shade]').evaluate((el) => Number(getComputedStyle(el).opacity));
  expect(shade).toBeLessThan(0.05);
});
