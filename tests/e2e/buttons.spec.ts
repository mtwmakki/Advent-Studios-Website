import { test, expect } from '@playwright/test';

test('rolling label duplicates are hidden from screen readers', async ({ page }) => {
  await page.goto('');
  const rolls = page.locator('[data-roll]');
  const count = await rolls.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const roll = rolls.nth(i);
    await expect(roll.locator(':scope > [aria-hidden="true"]')).toHaveCount(1);
  }
  const first = page.locator('a.btn').first();
  const label = (await first.locator('[data-roll] > :not([aria-hidden])').first().textContent())?.trim();
  await expect(first).toHaveAccessibleName(label!);
});

test('buttons are reachable by keyboard and show focus ring', async ({ page }) => {
  await page.goto('');
  const firstBtn = page.locator('a.btn').first();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab');
    if (await firstBtn.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(firstBtn).toBeFocused();
  const outline = await firstBtn.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
});

test('magnetic moves toward pointer on desktop', async ({ page }) => {
  await page.goto('');
  const btn = page.locator('a.btn[data-magnetic]').first();
  await btn.scrollIntoViewIfNeeded();
  const box = (await btn.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2, { steps: 5 });
  await expect
    .poll(async () => btn.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41), { timeout: 1500 })
    .toBeGreaterThan(0);
});
