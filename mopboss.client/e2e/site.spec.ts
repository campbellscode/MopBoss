import { expect, test, type Page } from '@playwright/test';

const ROUTES = ['/', '/services', '/about', '/gallery', '/quote'];
const WIDTHS = [320, 375, 390, 768, 1024, 1440, 1920];

/** Collects console errors (CSP violations show up here) and uncaught exceptions. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  // WebKit reports a same-origin Next.js prefetch (?_rsc=) cancelled by navigation as an
  // "access control" error, both as a console message and as an unhandled rejection.
  // It is not a CSP or CORS failure. Everything else counts.
  const prefetchAborted = /\?_rsc=.*due to access control checks/;
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !prefetchAborted.test(msg.text())) errors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    if (!prefetchAborted.test(err.message)) errors.push(err.message);
  });
  return errors;
}

for (const route of ROUTES) {
  test(`${route} fits every width, has one h1, no placeholders and no console errors`, async ({
    page,
  }) => {
    const errors = watchErrors(page);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      // Let prefetches settle: WebKit logs an aborted prefetch as an "access control" error.
      await page.goto(route, { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('[data-placeholder]')).toHaveCount(0);
      const text = await page.locator('main').innerText();
      expect(text, `bracketed placeholder text at ${width}px`).not.toMatch(/\[[A-Za-z][^\]]*\]/);
    }
    expect(errors).toEqual([]);
  });
}

test('the phone layout swaps in the thumb bar, which stays at the bottom', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const bar = page.getByRole('navigation', { name: 'Quick navigation' });
  await expect(bar).toBeVisible();
  await page.mouse.wheel(0, 3000);
  const box = await bar.boundingBox();
  expect(Math.round(box!.y + box!.height)).toBeGreaterThanOrEqual(843);
  await expect(page.getByRole('link', { name: 'Get a quote' }).last()).toBeVisible();

  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(bar).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});

test('keyboard users get a skip link and a visible focus ring', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit does not Tab to links by default (macOS setting)');
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(outline).not.toBe('none');
});

test('the before/after slider works from the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const slider = page.getByRole('slider', { name: /before and after reveal/i });
  await slider.focus();
  const before = Number(await slider.inputValue());
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
  const after = Number(await slider.inputValue());
  expect(after).toBe(before + 10);
  const p = await slider.evaluate((el) =>
    (el.parentElement as HTMLElement).style.getPropertyValue('--p'),
  );
  expect(p).toBe(`${after}%`);
});

test('the gallery sweep reaches 100% and announces it', async ({ page }) => {
  await page.goto('/gallery');
  await page.getByRole('button', { name: 'Sweep it for me' }).click();
  await expect(page.getByRole('status')).toHaveText('100% spotless', { timeout: 5000 });
  await expect(page.getByRole('slider', { name: /before and after reveal/i })).toHaveValue('100');
});

test('the magnetic CTA follows the cursor by the prototype amounts', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Pointer geometry is measured once, in Chromium');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const cta = page.locator('#hero a', { hasText: 'Get the Boss Treatment' });
  const halo = cta.locator('..');
  const box = (await halo.boundingBox())!;
  await page.mouse.move(box.x + box.width - 2, box.y + box.height - 2);
  // The button eases into place (0.28s transition), so wait for it to settle.
  const offset = async () => {
    const t = await cta.evaluate((el) => getComputedStyle(el).transform);
    const m = t.match(/-?[\d.]+/g)?.map(Number) ?? [];
    return { x: m[4] ?? 0, y: m[5] ?? 0 };
  };
  await expect.poll(async () => (await offset()).x, { timeout: 3000 }).toBeGreaterThan(30);
  await page.waitForTimeout(400);
  const { x, y } = await offset();
  // x = (offset from centre) × 0.22, y = × 0.34, as in Main.dc.html.
  expect(x).toBeCloseTo((box.width / 2 - 2) * 0.22, 0);
  expect(y).toBeCloseTo((box.height / 2 - 2) * 0.34, 0);
  test.info().annotations.push({
    type: 'magnetic',
    description: `max offset ${x.toFixed(1)}px, ${y.toFixed(1)}px`,
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('loads clean: no film or mop, nothing hidden for scroll reveals', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveClass(/(^|\s)js(\s|$)/);
    const hidden = await page.evaluate(
      () =>
        [...document.querySelectorAll('svg')].filter(
          (el) =>
            el.getAttribute('viewBox') === '0 0 220 700' && getComputedStyle(el).display !== 'none',
        ).length,
    );
    expect(hidden).toBe(0); // the mop is not displayed
    const invisible = await page.evaluate(
      () =>
        [...document.querySelectorAll('.rv')].filter((el) => getComputedStyle(el).opacity !== '1')
          .length,
    );
    expect(invisible).toBe(0);
  });
});

test.describe('JavaScript disabled', () => {
  test.use({ javaScriptEnabled: false });

  test('pages stay readable and the quote form says it needs JavaScript', async ({ page }) => {
    for (const route of ['/', '/services', '/about', '/gallery']) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      const invisible = await page.evaluate(
        () =>
          [...document.querySelectorAll('.rv')].filter((el) => getComputedStyle(el).opacity !== '1')
            .length,
      );
      expect(invisible, `${route} hides content without JavaScript`).toBe(0);
    }
    await page.goto('/quote');
    // Playwright's text locators skip <noscript>, so check the rendered paragraph directly.
    const note = await page.evaluate(() => {
      const p = document.querySelector('noscript')?.parentElement?.querySelector('p');
      const shown = [...document.querySelectorAll('p')].find((el) =>
        el.textContent?.includes('needs JavaScript'),
      );
      return shown ? { text: shown.textContent, height: shown.getBoundingClientRect().height } : p;
    });
    expect(note).toMatchObject({ text: expect.stringContaining('(513) 319-4988') });
    expect((note as { height: number }).height).toBeGreaterThan(0);
  });
});
