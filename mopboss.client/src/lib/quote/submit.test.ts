import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState } from './machine';
import {
  httpAdapter,
  isMockSubmission,
  mockAdapter,
  submitQuoteRequest,
  toPayload,
  type QuoteAdapter,
} from './submit';

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

afterEach(() => {
  vi.useRealTimers();
});

describe('toPayload', () => {
  it('builds a typed payload, trimming values and dropping empty optional fields', () => {
    const payload = toPayload(answers, new Date('2026-11-27T12:00:00Z'));
    expect(payload).toEqual({
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

describe('submitQuoteRequest', () => {
  it('passes the payload to the adapter and returns its result', async () => {
    const adapter = vi.fn<QuoteAdapter>().mockResolvedValue({ ok: true, reference: 'Q-1' });
    const payload = toPayload(answers);
    await expect(submitQuoteRequest(payload, adapter)).resolves.toEqual({
      ok: true,
      reference: 'Q-1',
    });
    expect(adapter).toHaveBeenCalledWith(payload);
  });

  it('drops honeypot submissions without calling the adapter, while appearing to succeed', async () => {
    const adapter = vi.fn<QuoteAdapter>();
    const result = await submitQuoteRequest(
      toPayload({ ...answers, website: 'spam.biz' }),
      adapter,
    );
    expect(result).toEqual({ ok: true });
    expect(adapter).not.toHaveBeenCalled();
  });

  it('turns an adapter exception into a failed result', async () => {
    const adapter = vi.fn<QuoteAdapter>().mockRejectedValue(new Error('offline'));
    await expect(submitQuoteRequest(toPayload(answers), adapter)).resolves.toEqual({
      ok: false,
      error: 'network',
    });
  });

  it('ships with a mock that resolves locally and sends nothing', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const pending = mockAdapter(toPayload(answers));
    await vi.advanceTimersByTimeAsync(600);
    await expect(pending).resolves.toEqual({ ok: true, reference: 'demo' });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('httpAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the JSON payload to MopBoss.Server and accepts a 202', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ reference: 'ab12cd34' }), { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    const payload = toPayload(answers);

    const result = await httpAdapter('https://api.mopboss.test')(payload);

    expect(result).toEqual({ ok: true, reference: 'ab12cd34' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.mopboss.test/api/quote');
    expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' } });
    expect(JSON.parse(init.body)).toEqual(JSON.parse(JSON.stringify(payload)));
  });

  it('reports validation and rate-limit refusals as failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 400 })));
    await expect(httpAdapter('https://api.mopboss.test')(toPayload(answers))).resolves.toEqual({
      ok: false,
      error: 'http-400',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })));
    await expect(httpAdapter('https://api.mopboss.test')(toPayload(answers))).resolves.toEqual({
      ok: false,
      error: 'rate-limited',
    });
  });

  it('keeps the mock (and its demo notice) when no API URL is configured', () => {
    expect(process.env.NEXT_PUBLIC_QUOTE_API_URL).toBeUndefined();
    expect(isMockSubmission).toBe(true);
  });
});
