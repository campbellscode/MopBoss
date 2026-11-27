/**
 * Business facts.
 *
 * CONFIRMED (and the only confirmed facts): business name, owner, owner title, phone.
 *
 * Everything typed `Unconfirmed<…>` is waiting on Linda. Leave it `null` until she
 * confirms it in writing. A `null` field renders nothing in production builds and a
 * gold placeholder chip in content-audit mode (NEXT_PUBLIC_CONTENT_AUDIT=1).
 * Never fill one of these with a guess: a wrong credential or a made-up review is a
 * legal and trust problem for a real person's business.
 */

/** A fact that is not confirmed yet. `null` means "still needed". */
export type Unconfirmed<T> = T | null;

export type Review = {
  /** The client's words, exactly as approved by the client. */
  quote: string;
  /** First name only, as the client agreed to be credited. */
  firstName: string;
  neighborhood?: string;
  /** Human-readable date, e.g. "March 2026". */
  date?: string;
};

export type PhotoPair = {
  category: string;
  before: { src: string; alt: string; width: number; height: number };
  after: { src: string; alt: string; width: number; height: number };
  /** e.g. "Deep Cleaning · March 2026" */
  caption?: string;
};

export type PostalAddress = {
  streetAddress?: string;
  addressLocality: string;
  addressRegion: string;
  postalCode?: string;
};

export const business = {
  name: 'Mop Boss',
  owner: 'Linda Tucker',
  ownerTitle: 'Expert Housekeeper',
  phone: {
    display: '(513) 319-4988',
    /** E.164 form for tel: links and structured data. */
    e164: '+15133194988',
  },

  /** NEEDED: the email address customers should write to. */
  email: null as Unconfirmed<string>,
  /** NEEDED: opening hours in plain words, e.g. "Mon–Fri, 8am–5pm". */
  hours: null as Unconfirmed<string>,
  /** NEEDED: towns or neighborhoods Mop Boss serves, in plain words. */
  serviceArea: null as Unconfirmed<string>,
  /** NEEDED: a public business address, only if Linda wants one listed (used in search data). */
  address: null as Unconfirmed<PostalAddress>,
  /** NEEDED: exact insured / bonded wording, only if true and documented. */
  insuredStatus: null as Unconfirmed<string>,
  /** NEEDED: years in business, as a number Linda can stand behind. */
  yearsInBusiness: null as Unconfirmed<number>,
  /** NEEDED: satisfaction policy wording, if Linda offers one. */
  satisfactionPolicy: null as Unconfirmed<string>,
  /** NEEDED: how quickly Linda replies to quote requests, e.g. "within one business day". */
  quoteResponseTime: null as Unconfirmed<string>,
  /** NEEDED: one-line privacy note shown under the quote form's contact fields. */
  privacyNote: null as Unconfirmed<string>,
  /** NEEDED: price range for search data, e.g. "$$", only once Linda sets pricing. */
  priceRange: null as Unconfirmed<string>,
};

export const linda = {
  /** NEEDED: a few sentences in Linda's own words for the homepage founder section. */
  note: null as Unconfirmed<string>,
  /** NEEDED: one line on what a clean home means to her (About page pull quote). */
  pullQuote: null as Unconfirmed<string>,
  /** NEEDED: how Mop Boss started, in her words. */
  howStarted: null as Unconfirmed<string>,
  /** NEEDED: her housekeeping experience and background. No numbers until confirmed. */
  experience: null as Unconfirmed<string>,
  /** NEEDED: the part of the job that still makes her proud. */
  whatSheLoves: null as Unconfirmed<string>,
  /** NEEDED (optional): a real photo of Linda at work, with her permission. */
  photo: null as Unconfirmed<{ src: string; alt: string; width: number; height: number }>,
};

/** NEEDED: real client reviews, each approved by the client for publication. */
export const reviews = null as Unconfirmed<readonly Review[]>;

/** NEEDED: real before/after photo pairs from Linda's jobs, with the client's permission. */
export const photoPairs = null as Unconfirmed<readonly PhotoPair[]>;

export const ownerLine = `${business.owner} · ${business.ownerTitle}`;
export const telHref = `tel:${business.phone.e164}`;
