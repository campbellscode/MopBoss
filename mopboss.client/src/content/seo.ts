import { business, ownerLine } from './facts';

/**
 * Search and sharing metadata. Descriptions reuse approved prototype copy and the
 * three confirmed facts only; no new claims.
 */

/**
 * NEEDED (decision): the live domain. Set NEXT_PUBLIC_SITE_URL at build time, e.g.
 * https://www.example.com. Without it, canonical URLs, the sitemap and social
 * previews point at localhost.
 */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);

export const seo = {
  siteName: business.name,
  titleTemplate: `%s · ${business.name}`,
  home: {
    title: `${business.name} · ${ownerLine}`,
    description: `Mop Boss is Linda Tucker, Expert Housekeeper. Professional housekeeping with boss-level standards. Request a quote in six quick taps or call ${business.phone.display}.`,
  },
  services: {
    title: 'Services',
    description:
      'Pick the clean that fits your life: residential, deep, move-in / move-out, recurring and specialty cleaning. Not sure which one? Start a quote and Linda will point you the right way.',
  },
  about: {
    title: 'About Linda',
    description:
      "Mop Boss is Linda Tucker, Expert Housekeeper. A cleaning business with a name on it, a number you can call, and a standard that doesn't budge.",
  },
  gallery: {
    title: 'Before & After',
    description:
      'Before. After. Ahhh. Drag the mop yourself or let us sweep it for you in the Mop Boss before-and-after demo.',
  },
  quote: {
    title: 'Get a quote',
    description:
      'Request a Mop Boss cleaning quote in six quick taps. No account and no payment needed; Linda follows up with the details.',
  },
  ogAlt: `${business.name}: ${ownerLine}. Call ${business.phone.display}.`,
};
