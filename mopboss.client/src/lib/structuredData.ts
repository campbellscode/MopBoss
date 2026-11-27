import { business, reviews } from '@/content/facts';
import { siteUrl } from '@/content/seo';

/**
 * LocalBusiness JSON-LD built from confirmed facts only. Address, hours, price
 * range, service area and email are added automatically once they are filled in
 * the content module; until then they are left out. No rating is ever emitted
 * here: aggregate ratings need real, verifiable reviews and a decision from Linda.
 */
export function localBusinessJsonLd(logoUrl: string) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${siteUrl}/#business`,
    name: business.name,
    url: `${siteUrl}/`,
    telephone: business.phone.e164,
    image: logoUrl,
    logo: logoUrl,
    founder: {
      '@type': 'Person',
      name: business.owner,
      jobTitle: business.ownerTitle,
    },
  };
  if (business.email) data.email = business.email;
  if (business.address) data.address = { '@type': 'PostalAddress', ...business.address };
  if (business.hours) data.openingHours = business.hours;
  if (business.priceRange) data.priceRange = business.priceRange;
  if (business.serviceArea) data.areaServed = business.serviceArea;
  // Reviews are listed individually only when real ones exist; still no aggregate rating.
  if (reviews && reviews.length > 0) {
    data.review = reviews.map((r) => ({
      '@type': 'Review',
      reviewBody: r.quote,
      author: { '@type': 'Person', name: r.firstName },
    }));
  }
  return data;
}

/** Serialise for a <script type="application/ld+json">, escaping "<" so it cannot end the tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
