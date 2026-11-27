import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState } from './machine';
import {
  demoAdapter,
  httpAdapter,
  adapterFor,
  submitQuoteRequest,
  toPayload,
  unavailableAdapter,
  type QuoteAdapter,
} from './submit';
import { newIdempotencyKey } from './idempotency';

const answers = {
  ...initialState().answers,
  service: 'Deep Cleaning',
  property: 'House',
  size: '1,000 to 2,000',
  frequency: 'Weekly',
  name: '  Dana Smith ',
  phone: '',
  email: 'dana@example.com',
  zip: '45202',
  notes: '',
};

const KEY = '6f1c2b0e-3d4a-4b5c-8d9e-0f1a2b3c4d5e';
const API = 'https://api.mopboss.test';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('toPayload', () => {
  it('builds a typed payload, trimming values and dropping empty optional fields', () => {
    expect(toPayload(answers, new Date('2026-11-27T12:00:00Z'))).toEqual({
      service: 'Deep Cleaning',
      property: 'House',
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: '1,000 to 2,000',
      frequency: 'Weekly',
      contact: { name: 'Dana Smith', phone: undefined, email: 'dana@example.com', zip: '45202' },
      notes: undefined,
      website: '',
      submittedAt: '2026-11-27T12:00:00.000Z',
    });
  });
});

describe('httpAdapter', () => {
  const reply = (status: number, body: unknown = {}) =>
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

  it('posts JSON with the Idempotency-Key and returns the reference on 202', async () => {
    const fetchMock = reply(202, { reference: 'MB-7K3Q9X' });
    vi.stubGlobal('fetch', fetchMock);
    const payload = toPayload(answers);

    const outcome = await httpAdapter(API)(payload, KEY);

    expect(outcome).toEqual({ ok: true, result: { mode: 'live', reference: 'MB-7K3Q9X' } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/api/quote`);
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': KEY },
    });
    expect(JSON.parse(init.body)).toEqual(JSON.parse(JSON.stringify(payload)));
  });

  it('treats a 200 replay of the same request as success with the original reference', async () => {
    vi.stubGlobal('fetch', reply(200, { reference: 'MB-7K3Q9X' }));
    await expect(httpAdapter(API)(toPayload(answers), KEY)).resolves.toEqual({
      ok: true,
      result: { mode: 'live', reference: 'MB-7K3Q9X' },
    });
  });

  it.each([
    [400, 'invalid'],
    [413, 'invalid'],
    [422, 'conflict'],
    [429, 'rate-limited'],
    [500, 'uncertain'],
    [503, 'uncertain'],
  ])('maps HTTP %i to %s', async (status, failure) => {
    vi.stubGlobal('fetch', reply(status));
    await expect(httpAdapter(API)(toPayload(answers), KEY)).resolves.toEqual({
      ok: false,
      failure,
    });
  });

  it('reports a network failure as uncertain', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(httpAdapter(API)(toPayload(answers), KEY)).resolves.toEqual({
      ok: false,
      failure: 'uncertain',
    });
  });

  it('reports a success without a valid reference as uncertain, never as received', async () => {
    vi.stubGlobal('fetch', reply(202, { reference: '<script>' }));
    await expect(httpAdapter(API)(toPayload(answers), KEY)).resolves.toEqual({
      ok: false,
      failure: 'uncertain',
    });
  });

  it('gives up after the timeout and reports the outcome as uncertain', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) =>
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            ),
          ),
      ),
    );
    const pending = httpAdapter(API, 1000)(toPayload(answers), KEY);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toEqual({ ok: false, failure: 'uncertain' });
  });
});

describe('httpAdapter deadline', () => {
  it('times out a reply whose body never finishes, and releases the request', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const stalled = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('{"reference":"MB-7K')); // never closes
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        signal = init.signal ?? undefined;
        return new Response(stalled, { status: 202 });
      }),
    );
    const pending = httpAdapter(API, 1000)(toPayload(answers), KEY);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toEqual({ ok: false, failure: 'uncertain' });
    expect(signal?.aborted).toBe(true);
  });

  it('still succeeds when the body arrives before the deadline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"reference":"MB-7K3Q9X"}', { status: 202 })),
    );
    await expect(httpAdapter(API, 1000)(toPayload(answers), KEY)).resolves.toEqual({
      ok: true,
      result: { mode: 'live', reference: 'MB-7K3Q9X' },
    });
  });
});

describe('modes', () => {
  it('picks the adapter from the resolved deployment and fails closed', () => {
    expect(adapterFor({ env: 'development', mode: 'demo', quoteApiUrl: null })).toBe(demoAdapter);
    expect(adapterFor({ env: null, mode: 'unavailable', quoteApiUrl: null })).toBe(
      unavailableAdapter,
    );
    expect(adapterFor({ env: 'production', mode: 'live', quoteApiUrl: null })).toBe(
      unavailableAdapter,
    );
  });

  it('demo reports demo, and unavailable reports a failure instead of success', async () => {
    vi.useFakeTimers();
    const demo = demoAdapter(toPayload(answers), KEY);
    await vi.advanceTimersByTimeAsync(600);
    await expect(demo).resolves.toEqual({ ok: true, result: { mode: 'demo' } });
    await expect(unavailableAdapter(toPayload(answers), KEY)).resolves.toEqual({
      ok: false,
      failure: 'unavailable',
    });
  });

  it('turns an adapter exception into an uncertain failure', async () => {
    const adapter = vi.fn<QuoteAdapter>().mockRejectedValue(new Error('boom'));
    await expect(submitQuoteRequest(toPayload(answers), KEY, adapter)).resolves.toEqual({
      ok: false,
      failure: 'uncertain',
    });
  });
});

describe('newIdempotencyKey', () => {
  it('produces distinct v4 UUIDs', () => {
    const a = newIdempotencyKey();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newIdempotencyKey()).not.toBe(a);
  });
});
