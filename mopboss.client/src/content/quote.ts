import type { Headline } from '@/components/ui/Type';
import options from './quote-options.json';
import { services } from './services';

/**
 * DRAFT: every option list in the quote form is a suggestion awaiting Linda's approval.
 * The allowed values live in ./quote-options.json, which MopBoss.Server also embeds, so
 * the form and the API always agree. Hints are display copy and stay here.
 */

export type QuoteOption = { value: string; hint?: string };

const hints: Record<string, string> = {
  House: 'Single-family home',
  'Apartment or condo': 'One level, shared building',
  Townhome: 'Multi-level, attached',
  'Something else': 'Tell Linda in the notes',
  'One-time': 'Just this once',
  Weekly: 'Every week',
  'Every two weeks': 'Twice a month',
  Monthly: 'Once a month',
};

const withHints = (values: readonly string[]): QuoteOption[] =>
  values.map((value) => (hints[value] ? { value, hint: hints[value] } : { value }));

export const quoteOptions = {
  services: services.map((s): QuoteOption => ({ value: s.name, hint: s.quoteHint })),
  properties: withHints(options.properties),
  sizes: withHints(options.sizes),
  frequencies: withHints(options.frequencies),
  bedrooms: options.bedrooms,
  bathrooms: options.bathrooms,
} as const;

/** Allowed service names as the API sees them (checked against services.ts by a test). */
export const allowedServices: readonly string[] = options.services;

type StepCopy = { eyebrow: string; heading: Headline; hint: string; lead?: string };

export const quoteCopy = {
  pageTitle: 'Get a quote',
  exit: 'Exit',
  stepLabel: (step: number, total: number) => `Step ${step} of ${total}`,
  doneLabel: 'All done',
  progressLabel: 'Quote request progress',
  steps: [
    {
      eyebrow: 'Step 1 · Service',
      heading: ['What are we ', { accent: 'tackling?' }],
      hint: 'Pick a service to continue',
    },
    {
      eyebrow: 'Step 2 · Property',
      heading: ['What kind of ', { accent: 'place' }, ' is it?'],
      hint: 'Pick a property type to continue',
    },
    {
      eyebrow: 'Step 3 · Size',
      heading: ['Roughly how ', { accent: 'big?' }],
      lead: 'A ballpark is perfect. Linda confirms the details with you later.',
      hint: 'Choose a size range to continue',
    },
    {
      eyebrow: 'Step 4 · Frequency',
      heading: ['How ', { accent: 'often' }, ' should we come by?'],
      hint: 'Pick a schedule to continue',
    },
    {
      eyebrow: 'Step 5 · Contact',
      heading: ['Where should Linda ', { accent: 'send' }, ' your quote?'],
      hint: 'Add your name and a phone or email',
    },
    {
      eyebrow: 'Step 6 · Review',
      heading: ['Give it a ', { accent: 'once-over.' }],
      hint: '',
    },
  ] satisfies StepCopy[],
  size: {
    bedrooms: 'Bedrooms',
    bathrooms: 'Bathrooms',
    fewerBedrooms: 'Fewer bedrooms',
    moreBedrooms: 'More bedrooms',
    fewerBathrooms: 'Fewer bathrooms',
    moreBathrooms: 'More bathrooms',
    squareFeet: 'Approximate square feet',
  },
  contact: {
    name: 'Your name',
    phone: 'Phone',
    email: 'Email',
    zip: 'ZIP code',
    notes: 'Anything we should know? (optional)',
    requirement: 'We need your name plus a phone number or an email.',
  },
  errors: {
    email: 'Check the email address, it looks incomplete.',
    phone: 'Check the phone number, it needs at least 10 digits.',
    zip: 'ZIP codes are 5 digits.',
  },
  review: {
    paymentNote: 'No payment needed to request a quote. Linda follows up with the details.',
    edit: 'Edit',
    labels: {
      service: 'Service',
      property: 'Property',
      size: 'Size',
      frequency: 'Frequency',
      contact: 'Contact',
    },
  },
  sheet: {
    title: 'The Boss Sheet',
    accent: 'your request',
    label: 'Your request so far',
    questions: 'Questions? Call Linda at',
  },
  nav: { back: 'Back', next: 'Continue', send: 'Send my request', sending: 'Sending…' },
  /**
   * Confirmation wording. NEW COPY (needs Linda's approval): the live body and the
   * whole demo variant replace the prototype's "Linda has your details", which was
   * untrue in demo mode and promised more than "stored" on a real send.
   */
  done: {
    eyebrow: 'Request received',
    heading: (firstName: string): Headline => [
      'Consider it ',
      { accent: `handled, ${firstName}.`, block: true },
    ],
    fallbackName: 'boss',
    referenceLabel: 'Your reference',
    body: 'Your request is saved. Keep your reference handy: Linda will follow up with your quote. Need her sooner? Call',
    home: 'Back to home',
    restart: 'Start over',
  },
  demo: {
    eyebrow: 'Demo only',
    heading: (firstName: string): Headline => [
      'Nothing was sent, ',
      { accent: `${firstName}.`, block: true },
    ],
    body: 'This site is in demo mode, so your request was not sent and Linda has not received it. To get a quote, call Linda at',
    stamp: 'Demo only · nothing was sent',
  },
  /** Shown only when JavaScript is off: the form cannot work without it. */
  noScript: 'This quote form needs JavaScript. You can also call Linda at',
  /**
   * Send failures. NEW COPY (needs Linda's approval). Each ends with the phone number,
   * and the visitor's answers are always kept.
   */
  failures: {
    invalid:
      "Some of these details weren't accepted. Please check them and send again, or call Linda at",
    'rate-limited':
      'Too many requests came from this connection in the last few minutes. Please try again in about 10 minutes, or call Linda at',
    uncertain:
      "We couldn't confirm your request reached us. Your details are still here: sending again is safe and won't create a duplicate. Or call Linda at",
    conflict: 'Something got out of step. Please send again, or call Linda at',
    unavailable: "Online quote requests aren't available right now. Please call Linda at",
  },
} as const;
