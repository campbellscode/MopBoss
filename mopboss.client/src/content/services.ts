import type { Unconfirmed } from './facts';

/**
 * DRAFT: the five service categories are suggestions awaiting Linda's approval.
 * Edit, add or remove services here; the homepage menu, mobile rail, services page,
 * jump navigation and quote form all read from this list.
 */

export type ServiceIcon = 'home' | 'bucket' | 'key' | 'repeat' | 'gem';
export type ServiceGround = 'white' | 'blush' | 'ink' | 'pink';

export type Service = {
  slug: string;
  name: string;
  /** Short label for the services page jump navigation. */
  jumpLabel: string;
  /** One-liner for the homepage menu and the mobile rail. */
  summary: string;
  /** Italic tagline on the services page. */
  tagline: string;
  /** Paragraph on the services page. */
  description: string;
  /** "Good for" pills on the services page. */
  goodFor: readonly string[];
  /** Sub-label on the quote form's service option. */
  quoteHint: string;
  icon: ServiceIcon;
  ground: ServiceGround;
  /** NEEDED: what is included, in Linda's words. */
  inclusions: Unconfirmed<readonly string[]>;
  /** NEEDED: pricing, set by Linda. */
  pricing: Unconfirmed<string>;
  /** Audit-mode label for the inclusions placeholder (the prototype words it per service). */
  inclusionsPlaceholder: string;
};

export const services: readonly Service[] = [
  {
    slug: 'residential',
    name: 'Residential Cleaning',
    jumpLabel: 'Residential',
    summary: 'The regular reset for kitchens, baths, floors and everything in between.',
    tagline: 'The regular reset.',
    description:
      'Kitchens, baths, floors and all the surfaces in between, brought back to that just-cleaned feeling.',
    goodFor: ['Busy households', 'Staying on top of it', 'A weekly exhale'],
    quoteHint: 'The regular reset',
    icon: 'home',
    ground: 'white',
    inclusions: null,
    pricing: null,
    inclusionsPlaceholder: "[What's included — confirm]",
  },
  {
    slug: 'deep',
    name: 'Deep Cleaning',
    jumpLabel: 'Deep',
    summary: 'Top-to-bottom detail for homes that need the full boss treatment.',
    tagline: 'The full boss treatment.',
    description: "A top-to-bottom, detail-first clean for when the regular routine isn't enough.",
    goodFor: ['Seasonal resets', 'Before guests arrive', 'A fresh start'],
    quoteHint: 'Top-to-bottom detail',
    icon: 'bucket',
    ground: 'blush',
    inclusions: null,
    pricing: null,
    inclusionsPlaceholder: "[What's included — confirm]",
  },
  {
    slug: 'move-in-move-out',
    name: 'Move-In / Move-Out',
    jumpLabel: 'Move-in / out',
    summary: 'Hand over the keys, or pick them up, with the place spotless.',
    tagline: 'Keys in, keys out, spotless.',
    description: "An empty-home clean that's ready for a walkthrough, a new chapter, or both.",
    goodFor: ['Renters and owners', 'Listing prep', 'New-home day one'],
    quoteHint: 'Keys in, keys out, spotless',
    icon: 'key',
    ground: 'ink',
    inclusions: null,
    pricing: null,
    inclusionsPlaceholder: "[What's included — confirm]",
  },
  {
    slug: 'recurring',
    name: 'Recurring Housekeeping',
    jumpLabel: 'Recurring',
    summary: 'A standing date with a clean house, on a schedule that suits you.',
    tagline: 'A standing date with a clean house.',
    description: 'Pick a rhythm that suits your life and let the mess stop piling up.',
    goodFor: ['Weekly', 'Every two weeks', 'Monthly'],
    quoteHint: 'A standing clean date',
    icon: 'repeat',
    ground: 'pink',
    inclusions: null,
    pricing: null,
    inclusionsPlaceholder: '[Frequency options — confirm]',
  },
  {
    slug: 'specialty',
    name: 'Specialty Cleaning',
    jumpLabel: 'Specialty',
    summary: 'Got something particular? Ask the boss.',
    tagline: 'Something particular? Ask the boss.',
    description:
      'A one-off job or a tricky space? Tell Linda what you need and she will tell you straight.',
    goodFor: ['One-off jobs', 'Tricky spaces', 'Special requests'],
    quoteHint: 'Something particular',
    icon: 'gem',
    ground: 'white',
    inclusions: null,
    pricing: null,
    inclusionsPlaceholder: '[Specialty list — confirm with Linda]',
  },
];

/** Two-digit number shown beside each service, e.g. "01". */
export const serviceNumber = (index: number) => String(index + 1).padStart(2, '0');
