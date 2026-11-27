import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * The quote journey against an intercepted API (the e2e build points at
 * http://127.0.0.1:5999, which never exists). Nothing is sent anywhere.
 */

type Reply = { status: number; body?: unknown };

async function fakeApi(page: Page, replies: Reply[]) {
  const keys: string[] = [];
  const bodies: unknown[] = [];
  await page.route('http://127.0.0.1:5999/api/quote', async (route: Route) => {
    const cors = {
      'access-control-allow-origin': 'http://127.0.0.1:3100',
      'access-control-allow-methods': 'POST',
      'access-control-allow-headers': 'content-type, idempotency-key',
    };
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: cors });
    keys.push(route.request().headers()['idempotency-key']);
    bodies.push(route.request().postDataJSON());
    const reply = replies.shift() ?? { status: 202, body: { reference: 'MB-7K3Q9X' } };
    return route.fulfill({
      status: reply.status,
      headers: cors,
      contentType: 'application/json',
      body: JSON.stringify(reply.body ?? {}),
    });
  });
  return { keys, bodies };
}

async function fillToReview(page: Page) {
  const next = () => page.getByRole('button', { name: /^Continue/ }).click();
  await page.getByRole('button', { name: /^Deep Cleaning/ }).click();
  await next();
  await page.getByRole('button', { name: /^House/ }).click();
  await next();
  await page.getByRole('button', { name: '1,000 to 2,000' }).click();
  await next();
  await page.getByRole('button', { name: /^Weekly/ }).click();
  await next();
  await page.getByLabel('Your name').fill('Dana Smith');
  await page.getByLabel('Phone').fill('(513) 555-0100');
  await next();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Give it a once-over.');
}

const send = (page: Page) => page.getByRole('button', { name: /^Send my request/ }).click();

test('a successful request shows the customer their reference', async ({ page }) => {
  const api = await fakeApi(page, []);
  await page.goto('/quote');
  await fillToReview(page);

  await send(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Consider it handled, Dana.');
  await expect(page.getByText('MB-7K3Q9X')).toBeVisible();
  await expect(page.getByText(/demo/i)).toHaveCount(0);
  expect(api.keys).toHaveLength(1);
  expect(api.bodies[0]).toMatchObject({
    service: 'Deep Cleaning',
    contact: { name: 'Dana Smith' },
  });
});

test('an uncertain send keeps the answers and the retry reuses the same key', async ({ page }) => {
  const api = await fakeApi(page, [{ status: 503 }]);
  await page.goto('/quote');
  await fillToReview(page);

  await send(page);
  await expect(page.getByRole('alert').filter({ hasText: "couldn't confirm" })).toBeVisible();
  await expect(page.getByText('Dana Smith · (513) 555-0100')).toBeVisible();

  await send(page);
  await expect(page.getByText('MB-7K3Q9X')).toBeVisible();
  expect(api.keys).toHaveLength(2);
  expect(api.keys[1]).toBe(api.keys[0]);
});

test('rate limiting is explained, with the phone number', async ({ page }) => {
  await fakeApi(page, [{ status: 429 }]);
  await page.goto('/quote');
  await fillToReview(page);

  await send(page);

  const alert = page.getByRole('alert').filter({ hasText: 'Too many requests' });
  await expect(alert).toBeVisible();
  await expect(alert.getByRole('link', { name: '(513) 319-4988' })).toBeVisible();
});

test('the whole flow works on a phone-sized screen from the keyboard', async ({
  page,
  browserName,
}) => {
  test.skip(browserName === 'webkit', 'WebKit does not Tab to buttons by default (macOS setting)');
  await fakeApi(page, []);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/quote');

  // Keyboard only: Tab to the first option, choose it, and continue with Enter.
  await page.getByRole('button', { name: /^Residential Cleaning/ }).focus();
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: /^Continue/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What kind of place is it?');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('a blocked Continue announces what is missing', async ({ page }) => {
  await page.goto('/quote');
  // aria-disabled keeps the button focusable and clickable for people; Playwright treats
  // it as disabled, so the click is forced.
  await page.getByRole('button', { name: /^Continue/ }).click({ force: true });
  await expect(
    page.getByRole('alert').filter({ hasText: 'Pick a service to continue' }),
  ).toBeAttached();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What are we tackling?');
});
