import type { Headline } from '@/components/ui/Type';
import { business } from './facts';

/**
 * Page copy, taken word for word from the approved prototype.
 *
 * DRAFT: marketing lines, service descriptions, "Why Mop Boss" promises and the
 * "Boss Standard" values are draft copy awaiting Linda's sign-off. Change wording
 * here, not in components.
 *
 * Where the mobile homepage uses shorter copy than desktop, both are kept:
 * `{ desktop, mobile }`.
 */

export type Responsive<T> = { desktop: T; mobile: T };

const phone = business.phone.display;

export const nav = {
  main: [
    { href: '/services', label: 'Services' },
    { href: '/gallery', label: 'Before & After' },
    { href: '/about', label: 'About Linda' },
  ],
  /** Fourth header link: the homepage links to its own "How it works" section. */
  homeExtra: { href: '/#how', label: 'How it works' },
  homeLink: { href: '/', label: 'Home' },
  quote: { href: '/quote', label: 'Get a quote' },
  homeAriaLabel: 'Mop Boss home',
  skipLink: 'Skip to main content',
};

export const brand = {
  tagline: 'Cleaning has never looked this good.',
  logoAlt: 'Mop Boss',
  heroLogoAlt: 'Mop Boss logo: pink lettering with a pink mop, bucket and gold sparkles',
  badgeAlt:
    'Mop Boss badge with an illustration of Linda Tucker, Expert Housekeeper, in a black suit, and the phone number (513) 319-4988',
  badgeAltShort:
    'Mop Boss badge with an illustration of Linda Tucker, Expert Housekeeper, and the phone number (513) 319-4988',
};

export const footer = {
  exploreHeading: 'Explore',
  talkHeading: 'Talk to the boss',
  links: [
    { href: '/services', label: 'Services' },
    { href: '/gallery', label: 'Before & After' },
    { href: '/about', label: 'About Linda' },
    { href: '/quote', label: 'Get a quote' },
  ],
  compactLinks: [
    { href: '/', label: 'Home' },
    { href: '/services', label: 'Services' },
    { href: '/gallery', label: 'Before & After' },
    { href: '/about', label: 'About Linda' },
    { href: '/quote', label: 'Get a quote' },
  ],
  copyrightHome: '© 2026 Mop Boss. All rights reserved.',
  copyright: '© 2026 Mop Boss. Linda Tucker · Expert Housekeeper.',
  /** Audit mode only. */
  prototypeNote: 'Phase 1 design prototype. Items in [brackets] await confirmation.',
};

export const thumbBar = {
  label: 'Quick navigation',
  home: 'Home',
  services: 'Services',
  quoteLines: ['GET A', 'QUOTE'],
  quoteLabel: 'Get a quote',
  reveal: 'Reveal',
  linda: 'Linda',
};

export const ctaCall = `or call ${phone}`;
export const callLinda = `Call ${phone}`;
export const bossTreatment = 'Get the Boss Treatment';

export const revealDemo = {
  ariaLabel: 'Before and after reveal. Move the slider to wipe the room clean.',
  after: 'AFTER',
  before: 'BEFORE',
  /** Shown to visitors: the scenes are illustrations, not a real job. */
  caption: 'Illustrated demo, not a real job',
};

export const home = {
  hero: {
    headingLines: ["We don't", 'just clean.'],
    accentLine: { accent: 'We run', rest: ' this' },
    mess: 'mess.',
    lead: {
      desktop:
        'Professional housekeeping with boss-level standards. You book in minutes, we show up ready, and your home gets the kind of clean you can see from the doorway.',
      mobile:
        'Professional housekeeping with boss-level standards. Book in minutes. Come home to spotless.',
    } satisfies Responsive<string>,
    secondaryCta: 'Explore our services',
    callPrompt: 'Prefer to talk? Call Linda at',
    replay: 'Replay the Clean Sweep',
    ring: {
      desktop: 'CLEANING HAS NEVER LOOKED THIS GOOD ✦ CLEANING HAS NEVER LOOKED THIS GOOD ✦',
      mobile: 'CLEANING HAS NEVER LOOKED THIS GOOD ✦ THIS GOOD ✦',
    } satisfies Responsive<string>,
  },
  marquee: {
    desktop: [
      'Spotless homes',
      'Boss-level standards',
      'Booked in minutes',
      'We run this mess',
      'Cleaning has never looked this good',
    ],
    mobile: ['Spotless homes', 'Boss-level standards', 'Booked in minutes'],
  } satisfies Responsive<string[]>,
  value: {
    eyebrow: 'What we do',
    heading: ['A clean home, ', { accent: 'handled' }, ' like her own name is on it.'] as Headline,
    body: {
      desktop:
        'Because it is. Mop Boss is Linda Tucker, Expert Housekeeper. One business, one standard: you walk in, breathe out, and the place just feels handled.',
      mobile:
        'Because it is. Mop Boss is Linda Tucker, Expert Housekeeper. One business, one standard.',
    } satisfies Responsive<string>,
    link: { href: '/about', label: 'Meet the boss' },
    points: [
      {
        title: 'Book fast.',
        body: {
          desktop: 'Six quick taps to request a quote. No account, no phone tag.',
          mobile: 'Six quick taps. No account, no phone tag.',
        },
      },
      {
        title: 'Relax harder.',
        body: {
          desktop: 'We bring the plan and the elbow grease. You bring nothing.',
          mobile: 'We bring the plan and the elbow grease.',
        },
      },
      {
        title: 'Come home to wow.',
        highlight: true,
        body: {
          desktop: 'Floors, counters, corners. Done properly, every visit.',
          mobile: 'Floors, counters, corners. Done properly.',
        },
      },
    ],
  },
  services: {
    eyebrow: 'The service menu',
    heading: ['Pick your ', { accent: 'kind' }, ' of clean.'] as Headline,
    swipeHint: 'Swipe to browse',
    railLabel: 'Services, swipe to browse',
    cardCta: 'Request a quote',
    footer:
      'Not sure which one fits? Tell us about your place and Linda will point you the right way.',
    footerCta: 'Request a quote',
    draftNote: {
      desktop: "Draft list — service categories pending Linda's approval",
      mobile: "Draft list — pending Linda's approval",
    } satisfies Responsive<string>,
  },
  reveal: {
    eyebrow: 'The transformation reveal',
    heading: ['Go on. ', { accent: 'Drag' }, ' the mop.'] as Headline,
    body: "Slide left and right to wipe the grime away. It's oddly satisfying, and it's exactly how we like to leave a room.",
    galleryLink: 'See the full gallery',
    auditNote: {
      desktop: "Illustrated demo, not a real job — Linda's real before/after photos go here",
      mobile: 'Illustrated demo, not a real job — real photos go here',
    } satisfies Responsive<string>,
  },
  why: {
    eyebrow: 'Why Mop Boss?',
    heading: ['Because ', { accent: '“good enough”', tone: 'boss' }, " isn't."] as Headline,
    body: 'Anyone can push a mop around. Running a home like a boss takes standards. These are ours.',
    draftNote: 'Draft brand promises — confirm wording with Linda',
    promises: [
      {
        title: 'Details are the job.',
        body: {
          desktop:
            'Baseboards, corners, the spot behind the faucet. The little things are the whole thing.',
          mobile: 'Baseboards, corners, the spot behind the faucet.',
        },
      },
      {
        title: 'Your home, respected.',
        body: {
          desktop:
            'Your space, your things and your time are treated like they matter. Because they do.',
          mobile: 'Your space, your things and your time matter.',
        },
      },
      {
        title: 'Straight talk.',
        body: {
          desktop:
            'A clear quote, clear expectations, and a real person on the other end of the phone.',
          mobile: 'A clear quote and a real person on the phone.',
        },
      },
      {
        title: 'Finished means finished.',
        body: {
          desktop: "We're not done until it looks done, feels done and smells done.",
          mobile: 'Not done until it looks, feels and smells done.',
        },
      },
    ],
  },
  founder: {
    eyebrow: 'Founder spotlight',
    heading: ['Meet Linda. ', { accent: 'The boss behind the mop.', block: true }] as Headline,
    body: 'Linda Tucker is the Expert Housekeeper behind Mop Boss. Her name is on the badge and her standards are in every room.',
    ring: {
      desktop: 'MEET THE BOSS ✦ MEET THE BOSS ✦ MEET THE BOSS ✦ MEET THE BOSS ✦',
      mobile: 'MEET THE BOSS ✦ MEET THE BOSS ✦ MEET THE BOSS ✦',
    } satisfies Responsive<string>,
    storyLink: { href: '/about', label: "Linda's story" },
    notePlaceholder: {
      title: "[LINDA'S NOTE — TO BE WRITTEN WITH LINDA]",
      body: {
        desktop:
          "A few sentences in Linda's own words: why she started Mop Boss and what a job well done means to her.",
        mobile: "A few sentences in Linda's own words.",
      },
    },
  },
  how: {
    eyebrow: 'How booking works',
    heading: ['Three steps. ', { accent: 'Zero' }, ' fuss.'] as Headline,
    steps: [
      {
        title: 'Tell us about your place',
        body: {
          desktop: "Service, property, size, schedule. Six quick taps and you're done.",
          mobile: 'Service, property, size, schedule. Six quick taps.',
        },
      },
      {
        title: 'Get your quote',
        responseTime: true,
        body: {
          desktop: 'Linda reviews your request and gets back to you with a quote.',
          mobile: 'Linda reviews your request and gets back to you.',
        },
      },
      {
        title: 'Get the Boss Treatment',
        highlight: true,
        body: {
          desktop: 'Pick a day that works. We show up and run the mess.',
          mobile: 'Pick a day. We show up and run the mess.',
        },
      },
    ],
  },
  trust: {
    eyebrow: 'Trust, in the open',
    heading: ["We'd rather ", { accent: 'show' }, ' you than tell you.'] as Headline,
    recordEyebrow: 'On the record',
    ownerLed: { strong: 'Owner-led.', text: 'Linda Tucker, Expert Housekeeper.' },
    directLine: { strong: 'One direct line.' },
    /** Audit mode only: describes the empty shelf. */
    auditFootnote:
      "Everything else on this shelf waits for Linda's real reviews and credentials. Nothing here is invented.",
  },
  cta: {
    heading: ['Ready for the ', { outline: 'Boss Treatment?' }] as Headline,
    body: {
      desktop:
        'Tell us about your place. It takes about two minutes, and the mess stops being your problem.',
      mobile: 'Two minutes now. A spotless home soon.',
    } satisfies Responsive<string>,
  },
};

export const servicesPage = {
  eyebrow: 'Services',
  heading: ['Five ways to get ', { accent: 'the Boss Treatment.', block: true }] as Headline,
  lead: 'Pick the clean that fits your life. Not sure which one? Start a quote and Linda will point you the right way.',
  draftNote: "Draft menu — categories, inclusions and pricing pending Linda's approval",
  jumpLabel: 'Jump to a service',
  serviceEyebrow: (n: string) => `Service ${n}`,
  quoteCta: 'Quote this service',
  pricingPlaceholder: '[Pricing — set by Linda]',
  cta: {
    heading: ['Found your ', { outline: 'kind of clean?' }] as Headline,
    body: 'Six quick taps and your request is with Linda.',
  },
};

export const aboutPage = {
  eyebrow: 'About Mop Boss',
  heading: ['The boss ', { accent: 'behind' }, ' the mop.'] as Headline,
  lead: "Mop Boss is Linda Tucker, Expert Housekeeper. A cleaning business with a name on it, a number you can call, and a standard that doesn't budge.",
  ring: 'LINDA TUCKER ✦ EXPERT HOUSEKEEPER ✦ LINDA TUCKER ✦ EXPERT HOUSEKEEPER ✦',
  story: {
    eyebrow: "Linda's story",
    heading: ['Told in ', { accent: 'her' }, ' words.'] as Headline,
    /** Audit mode only: explains the gold boxes. */
    auditIntro:
      "This page is built to hold Linda's real story. Nothing here is made up, so the gold boxes are waiting on her.",
    auditNote: 'Content needed from Linda before launch',
    pullQuotePlaceholder: "[Linda's pull quote: one line on what a clean home means to her]",
    tiles: {
      howStarted: {
        title: '[HOW MOP BOSS STARTED]',
        body: 'The moment Linda decided to run the mess for a living.',
      },
      experience: {
        title: '[EXPERIENCE — CONFIRM]',
        body: 'Years in housekeeping and background. No numbers shown until Linda confirms them.',
      },
      whatSheLoves: {
        title: '[WHAT SHE LOVES ABOUT IT]',
        body: 'The part of the job that still makes her proud.',
      },
    },
    /** Headings used once Linda's answers are in. */
    tileHeadings: {
      howStarted: 'How Mop Boss started',
      experience: 'Experience',
      whatSheLoves: 'What she loves about it',
    },
  },
  standard: {
    eyebrow: 'The Boss Standard',
    heading: ['Four things that ', { accent: 'never', tone: 'boss' }, ' slide.'] as Headline,
    draftNote: 'Draft brand values — confirm wording with Linda',
    values: [
      { title: 'Care', body: 'Your home is treated the way Linda would want hers treated.' },
      {
        title: 'Attention to detail',
        body: 'The corners, the edges and the bits most people skip.',
      },
      {
        title: 'Pride in the work',
        body: 'A job is only finished when she would sign her name to it.',
      },
      {
        title: 'Professionalism',
        body: 'Clear communication, respect for your time and your space.',
      },
    ],
  },
  contact: {
    photoPlaceholder: '[Optional: a real photo of Linda at work]',
    eyebrow: 'One call, one boss',
    heading: ['Talk to the person whose ', { accent: 'name' }, ' is on the badge.'] as Headline,
    body: "Questions about your home, your schedule or a tricky job? Linda's line is the Mop Boss line.",
  },
  cta: {
    heading: ['Let Linda ', { outline: 'run the mess.' }] as Headline,
    body: 'Tell her about your place. It takes about two minutes.',
  },
};

export const galleryPage = {
  eyebrow: 'Before & After',
  heading: ['Before. After. ', { accent: 'Ahhh.' }] as Headline,
  lead: 'The most satisfying part of the job, on repeat. Drag the mop yourself or let us sweep it for you.',
  sweep: 'Sweep it for me',
  cleanLabel: (pct: number) => `${pct}% spotless`,
  auditNote: "Illustrated demo, not a real job — Linda's real photos replace this",
  wall: {
    eyebrow: 'The transformation wall',
    heading: ['Room by ', { accent: 'room.' }] as Headline,
    filterLabel: 'Filter by room',
    all: 'All',
    categories: ['Kitchens', 'Bathrooms', 'Living spaces', 'Move-outs'],
    tilePlaceholder: (n: string) => `[Real photo pair ${n}]`,
    captionPlaceholder: '[Service · date]',
    auditFootnote: 'Photo placeholders only — no real customer results are shown in this prototype',
  },
  cta: {
    heading: ['Want your own ', { outline: 'before & after?' }] as Headline,
    body: 'Tell us about your place and we will make it the next transformation.',
  },
};
