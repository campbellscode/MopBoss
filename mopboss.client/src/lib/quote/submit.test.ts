import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState } from './machine';
import { mockAdapter, submitQuoteRequest, toPayload, type QuoteAdapter } from './submit';

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
