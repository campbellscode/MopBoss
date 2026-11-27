import type { QuoteAnswers } from './machine';

/**
 * The single seam between the quote form and wherever requests end up.
 *
 * Requests go to MopBoss.Server (POST /api/quote), which stores them in SQL Server
 * and emails Linda. The API is used only when NEXT_PUBLIC_QUOTE_API_URL is set at
 * build time (for example https://api.yourdomain). Without it, the mock below is
 * used: it sends nothing, and the confirmation screen says
 * "Demo only · nothing was sent". Never deploy publicly without the API URL.
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

/** Posts the payload to MopBoss.Server. 202 means stored (and, if SMTP is set, emailed). */
export const httpAdapter =
  (baseUrl: string): QuoteAdapter =>
  async (payload) => {
    const response = await fetch(`${baseUrl}/api/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const data = (await response.json().catch(() => ({}))) as { reference?: string };
      return { ok: true, reference: data.reference };
    }
    return {
      ok: false,
      error: response.status === 429 ? 'rate-limited' : `http-${response.status}`,
    };
  };

const apiUrl = process.env.NEXT_PUBLIC_QUOTE_API_URL?.trim().replace(/\/$/, '') || null;

/** True while the mock is wired in; drives the "nothing was sent" notice. */
export const isMockSubmission = apiUrl === null;

const activeAdapter: QuoteAdapter = apiUrl ? httpAdapter(apiUrl) : mockAdapter;

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
