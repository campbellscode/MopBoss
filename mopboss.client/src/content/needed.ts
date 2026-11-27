import { business, linda, photoPairs, reviews } from './facts';
import { services } from './services';

/**
 * The single list of everything still waiting on Linda.
 * `filled` is computed from the content itself, so CONTENT_NEEDED.md (generated
 * from this list by `npm run content:needed`) can never claim something is done
 * when the field is still empty.
 */

export type NeededItem = {
  id: string;
  /** What to ask Linda, in plain words. */
  ask: string;
  /** Where it shows on the site. */
  where: string;
  filled: boolean;
};

export type NeededGroup = { title: string; intro: string; items: NeededItem[] };

const has = (value: unknown) =>
  value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0);

export const neededGroups: NeededGroup[] = [
  {
    title: 'Contact details',
    intro: 'These appear in the footer, on the About page and in search results.',
    items: [
      {
        id: 'email',
        ask: 'What email address should customers use?',
        where: 'Footer, About page',
        filled: has(business.email),
      },
      {
        id: 'hours',
        ask: 'What are your working hours? (for example "Mon–Fri, 8am–5pm")',
        where: 'Footer, About page, search results',
        filled: has(business.hours),
      },
      {
        id: 'serviceArea',
        ask: 'Which towns or neighborhoods do you serve?',
        where: 'Footer, About page, homepage trust section, search results',
        filled: has(business.serviceArea),
      },
      {
        id: 'address',
        ask: 'Do you want a business address listed in search results? If yes, which one?',
        where: 'Search results only (never shown unless you say so)',
        filled: has(business.address),
      },
    ],
  },
  {
    title: 'Credentials and promises',
    intro:
      'Only list what is true and that you can show proof of. Leave anything blank that does not apply.',
    items: [
      {
        id: 'insuredStatus',
        ask: 'Are you insured and/or bonded? If yes, the exact wording you want to use.',
        where: 'Homepage trust section',
        filled: has(business.insuredStatus),
      },
      {
        id: 'yearsInBusiness',
        ask: 'How many years have you been in business?',
        where: 'Homepage trust section',
        filled: has(business.yearsInBusiness),
      },
      {
        id: 'satisfactionPolicy',
        ask: 'Do you offer a satisfaction policy? If yes, what exactly does it promise?',
        where: 'Homepage trust section',
        filled: has(business.satisfactionPolicy),
      },
      {
        id: 'quoteResponseTime',
        ask: 'How quickly do you usually reply to a quote request?',
        where: 'Homepage "How booking works"',
        filled: has(business.quoteResponseTime),
      },
      {
        id: 'privacyNote',
        ask: 'A one-line note on how you use customer contact details (for the quote form).',
        where: 'Quote form, contact step',
        filled: has(business.privacyNote),
      },
    ],
  },
  {
    title: 'Pricing',
    intro: 'Prices are not shown anywhere until you set them.',
    items: [
      ...services.map((s) => ({
        id: `pricing-${s.slug}`,
        ask: `Pricing for ${s.name} (or say if it is quote-only).`,
        where: 'Services page',
        filled: has(s.pricing),
      })),
      {
        id: 'priceRange',
        ask: 'A rough price level for search results ("$", "$$" or "$$$"), once prices are set.',
        where: 'Search results only',
        filled: has(business.priceRange),
      },
    ],
  },
  {
    title: 'What each service includes',
    intro: 'A short list of what is included in each service, in your words.',
    items: services.map((s) => ({
      id: `inclusions-${s.slug}`,
      ask: `What is included in ${s.name}?`,
      where: 'Services page',
      filled: has(s.inclusions),
    })),
  },
  {
    title: 'Your story',
    intro: 'Written with you, in your own words. Nothing here will be made up.',
    items: [
      {
        id: 'lindaNote',
        ask: 'A few sentences: why you started Mop Boss and what a job well done means to you.',
        where: 'Homepage founder section',
        filled: has(linda.note),
      },
      {
        id: 'pullQuote',
        ask: 'One line on what a clean home means to you.',
        where: 'About page',
        filled: has(linda.pullQuote),
      },
      {
        id: 'howStarted',
        ask: 'How did Mop Boss start?',
        where: 'About page',
        filled: has(linda.howStarted),
      },
      {
        id: 'experience',
        ask: 'Your housekeeping experience and background.',
        where: 'About page',
        filled: has(linda.experience),
      },
      {
        id: 'whatSheLoves',
        ask: 'What part of the job still makes you proud?',
        where: 'About page',
        filled: has(linda.whatSheLoves),
      },
      {
        id: 'photo',
        ask: 'Optional: a photo of you at work that you are happy to have online.',
        where: 'About page',
        filled: has(linda.photo),
      },
    ],
  },
  {
    title: 'Reviews and photos',
    intro: 'Only real ones, each with the client’s permission to publish.',
    items: [
      {
        id: 'reviews',
        ask: 'Real client reviews: the words, the client’s first name, neighborhood and date.',
        where: 'Homepage trust section',
        filled: has(reviews),
      },
      {
        id: 'photoPairs',
        ask: 'Before and after photo pairs from real jobs, labelled by room.',
        where: 'Gallery page (the photo wall only appears once these exist)',
        filled: has(photoPairs),
      },
    ],
  },
];

/** Draft content that is live on the site but still needs Linda's sign-off. */
export const toApprove: { what: string; where: string }[] = [
  {
    what: `The service list: ${services.map((s) => s.name).join(', ')}`,
    where: 'Homepage, Services page, quote form',
  },
  {
    what: 'Quote form choices: property types, size ranges and how-often options',
    where: 'Quote form',
  },
  {
    what: 'Service descriptions and "good for" examples',
    where: 'Homepage, Services page',
  },
  {
    what: 'The four "Why Mop Boss?" promises',
    where: 'Homepage',
  },
  {
    what: 'The four "Boss Standard" values',
    where: 'About page',
  },
  {
    what: 'Marketing lines and headlines throughout the site',
    where: 'Every page',
  },
];

export function renderContentNeeded(): string {
  const open = neededGroups.flatMap((g) => g.items).filter((i) => !i.filled).length;
  const lines: string[] = [
    '# Content needed from Linda',
    '',
    '<!-- Generated from mopboss.client/src/content/needed.ts by `npm run content:needed`. Do not edit by hand. -->',
    '',
    'The website only shows facts you have confirmed. Everything below is still missing,',
    'so the site leaves it out for now. Tick an item off by sending the answer; once it is',
    'added to the site it is checked automatically.',
    '',
    `**Still needed: ${open}**`,
    '',
    'Confirmed so far: business name (Mop Boss), owner (Linda Tucker, Expert Housekeeper)',
    'and phone number ((513) 319-4988).',
    '',
  ];
  for (const group of neededGroups) {
    lines.push(`## ${group.title}`, '', group.intro, '');
    for (const item of group.items) {
      lines.push(`- [${item.filled ? 'x' : ' '}] ${item.ask} _(${item.where})_`);
    }
    lines.push('');
  }
  lines.push(
    '## Please approve',
    '',
    'These are on the site as drafts. Tell us what to keep, change or remove.',
    '',
  );
  for (const item of toApprove) {
    lines.push(`- [ ] ${item.what} _(${item.where})_`);
  }
  lines.push('');
  return lines.join('\n');
}
