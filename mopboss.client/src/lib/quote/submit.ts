import { deployment } from '@/lib/deployment';
import type { QuoteAnswers, SubmitFailure, SubmitResult } from './machine';

/**
 * The single seam between the quote form and wherever requests end up.
 *
 * - live: NEXT_PUBLIC_QUOTE_API_URL is set. Requests go to MopBoss.Server, which
 *   stores them and queues Linda's email.
 * - demo: no API URL outside production. Nothing is sent, and the confirmation says so.
 * - unavailable: a production build without an API URL (the build guard in
 *   next.config.ts normally stops this). The form tells visitors to phone Linda
 *   instead of pretending to send.
 */

export type QuoteRequestPayload = {
  service: string;
  property: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet: string;
  frequency: string;
  contact: {
    name: string;
    phone?: string;
    email?: string;
    zip?: string;
  };
  notes?: string;
  /** Honeypot value. The API silently drops requests where it is non-empty. */
  website: string;
  /** ISO timestamp of when the visitor pressed send (informational). */
  submittedAt: string;
};

export type SubmitOutcome =
  { ok: true; result: SubmitResult } | { ok: false; failure: SubmitFailure };

export type QuoteAdapter = (
  payload: QuoteRequestPayload,
  idempotencyKey: string,
) => Promise<SubmitOutcome>;

/** How long to wait for the API before treating the outcome as uncertain. */
export const SUBMIT_TIMEOUT_MS = 15_000;

const REFERENCE = /^MB-[0-9A-Z]{6,9}$/;

const optional = (v: string) => (v.trim() ? v.trim() : undefined);

export function toPayload(a: QuoteAnswers, now: Date = new Date()): QuoteRequestPayload {
  return {
    service: a.service,
    property: a.property,
    bedrooms: a.beds,
    bathrooms: a.baths,
    squareFeet: a.size,
    frequency: a.frequency,
    contact: {
      name: a.name.trim(),
      phone: optional(a.phone),
      email: optional(a.email),
      zip: optional(a.zip),
    },
    notes: optional(a.notes),
    website: a.website,
    submittedAt: now.toISOString(),
  };
}

/** Demo stand-in: waits briefly so the sending state is visible, then reports demo. Sends nothing. */
export const demoAdapter: QuoteAdapter = async () => {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { ok: true, result: { mode: 'demo' } };
};

/** Production build with no API configured: never pretend. */
export const unavailableAdapter: QuoteAdapter = async () => ({ ok: false, failure: 'unavailable' });

/**
 * Posts to MopBoss.Server. 202 (stored) and 200 (a replay of the same request) both
 * carry the reference. Anything that leaves the outcome unknown (network error,
 * timeout, 5xx, a malformed reply) is "uncertain": retrying with the same key is safe.
 */
export const httpAdapter =
  (baseUrl: string, timeoutMs = SUBMIT_TIMEOUT_MS): QuoteAdapter =>
  async (payload, idempotencyKey) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(payload),
        signal: controller.signal,
        credentials: 'omit',
      });
    } catch {
      return { ok: false, failure: 'uncertain' };
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 200 || response.status === 202) {
      const data = (await response.json().catch(() => null)) as { reference?: unknown } | null;
      return typeof data?.reference === 'string' && REFERENCE.test(data.reference)
        ? { ok: true, result: { mode: 'live', reference: data.reference } }
        : { ok: false, failure: 'uncertain' };
    }
    if (response.status === 429) return { ok: false, failure: 'rate-limited' };
    if (response.status === 422) return { ok: false, failure: 'conflict' };
    if (response.status >= 500) return { ok: false, failure: 'uncertain' };
    return { ok: false, failure: 'invalid' };
  };

export type SubmissionMode = 'live' | 'demo' | 'unavailable';

export function submissionMode(
  apiUrl = deployment.quoteApiUrl,
  env = deployment.env,
): SubmissionMode {
  if (apiUrl) return 'live';
  return env === 'production' ? 'unavailable' : 'demo';
}

/** True while requests go nowhere; drives the demo wording on the confirmation. */
export const isDemoSubmission = submissionMode() === 'demo';

function activeAdapter(): QuoteAdapter {
  const mode = submissionMode();
  if (mode === 'live') return httpAdapter(deployment.quoteApiUrl!);
  return mode === 'demo' ? demoAdapter : unavailableAdapter;
}

/**
 * Submit a quote request. The honeypot value travels with the payload; the API drops
 * bot submissions while answering like a success. Adapter exceptions become "uncertain".
 */
export async function submitQuoteRequest(
  payload: QuoteRequestPayload,
  idempotencyKey: string,
  adapter: QuoteAdapter = activeAdapter(),
): Promise<SubmitOutcome> {
  try {
    return await adapter(payload, idempotencyKey);
  } catch {
    return { ok: false, failure: 'uncertain' };
  }
}
