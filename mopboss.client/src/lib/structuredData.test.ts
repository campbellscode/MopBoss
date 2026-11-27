import { describe, expect, it } from 'vitest';
import { jsonLdString, localBusinessJsonLd } from './structuredData';

describe('LocalBusiness structured data', () => {
  const data = localBusinessJsonLd('http://localhost:3000/logo.png');

  it('uses the confirmed facts', () => {
    expect(data).toMatchObject({
      '@type': 'LocalBusiness',
      name: 'Mop Boss',
      telephone: '+15133194988',
      founder: { name: 'Linda Tucker', jobTitle: 'Expert Housekeeper' },
    });
  });

  it('leaves out every unconfirmed field and never claims a rating', () => {
    for (const key of [
      'address',
      'openingHours',
      'priceRange',
      'areaServed',
      'email',
      'aggregateRating',
      'review',
    ]) {
      expect(data).not.toHaveProperty(key);
    }
  });

  it('escapes "<" so the JSON cannot close its script tag', () => {
    expect(jsonLdString({ a: '</script>' })).toBe('{"a":"\\u003c/script>"}');
  });
});
