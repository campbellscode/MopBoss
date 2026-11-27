import type { Headline } from '@/components/ui/Type';
import { services } from './services';

/**
 * DRAFT: every option list in the quote form is a suggestion awaiting Linda's approval.
 * The service options come from ./services so the menu and the form never drift apart.
 */

export type QuoteOption = { value: string; hint?: string };

export const quoteOptions = {
  services: services.map((s): QuoteOption => ({ value: s.name, hint: s.quoteHint })),
  properties: [
    { value: 'House', hint: 'Single-family home' },
    { value: 'Apartment or condo', hint: 'One level, shared building' },
    { value: 'Townhome', hint: 'Multi-level, attached' },
    { value: 'Something else', hint: 'Tell Linda in the notes' },
  ] satisfies QuoteOption[],
  sizes: [
    { value: 'Under 1,000 sq ft' },
    { value: '1,000 to 2,000' },
    { value: '2,000 to 3,000' },
    { value: '3,000+' },
    { value: 'Not sure' },
  ] satisfies QuoteOption[],
  frequencies: [
    { value: 'One-time', hint: 'Just this once' },
    { value: 'Weekly', hint: 'Every week' },
    { value: 'Every two weeks', hint: 'Twice a month' },
    { value: 'Monthly', hint: 'Once a month' },
  ] satisfies QuoteOption[],
  bedrooms: { min: 0, max: 9, initial: 2 },
  bathrooms: { min: 1, max: 9, initial: 1 },
} as const;

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
  done: {
    eyebrow: 'Request received',
    heading: (firstName: string): Headline => [
      'Consider it ',
      { accent: `handled, ${firstName}.`, block: true },
    ],
    fallbackName: 'boss',
    body: 'Linda has your details and will follow up with your quote. Need her sooner? Call',
    demoStamp: 'Demo only · nothing was sent',
    home: 'Back to home',
    restart: 'Start over',
  },
  submitError:
    'Something went wrong sending your request. Please try again, or call Linda instead.',
} as const;
