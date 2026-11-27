import type { QuoteAnswers } from './machine';

/**
 * The single seam between the quote form and wherever requests end up.
 *
 * HOW REQUESTS REACH LINDA IS NOT DECIDED YET. Until it is, `submitQuoteRequest`
 * uses the mock below, which sends nothing anywhere and resolves locally. The
 * confirmation screen shows "Demo only · nothing was sent" while
 * `isMockSubmission` is true. Do not deploy publicly with the mock active.
 *
 * To go live, add a real implementation (for example a POST to the MopBoss.Server
 * API), point `activeAdapter` at it and set `isMockSubmission` to false.
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
  /** Honeypot value. A real backend should silently drop requests where it is non-empty. */
  website: string;
  /** ISO timestamp of when the visitor pressed send. */
  submittedAt: string;
};

export type SubmitResult = { ok: true; reference?: string } | { ok: false; error: string };

export type QuoteAdapter = (payload: QuoteRequestPayload) => Promise<SubmitResult>;

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

/** Local stand-in: waits briefly so the sending state is visible, then succeeds. Sends nothing. */
export const mockAdapter: QuoteAdapter = async () => {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { ok: true, reference: 'demo' };
};

/** True while the mock is wired in; drives the "nothing was sent" notice. */
export const isMockSubmission = true;

const activeAdapter: QuoteAdapter = mockAdapter;

/**
 * Submit a quote request. Bot submissions caught by the honeypot are reported as
 * successful (so bots learn nothing) but never forwarded.
 */
export async function submitQuoteRequest(
  payload: QuoteRequestPayload,
  adapter: QuoteAdapter = activeAdapter,
): Promise<SubmitResult> {
  if (payload.website.trim() !== '') return { ok: true };
  try {
    return await adapter(payload);
  } catch {
    return { ok: false, error: 'network' };
  }
}
