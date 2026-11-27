import { describe, expect, it } from 'vitest';
import options from './quote-options.json';
import { quoteOptions } from './quote';
import { services } from './services';

describe('quote options shared with the API', () => {
  it('lists exactly the services shown on the site, in order', () => {
    expect(options.services).toEqual(services.map((s) => s.name));
  });

  it('drives every choice the form offers', () => {
    expect(quoteOptions.properties.map((o) => o.value)).toEqual(options.properties);
    expect(quoteOptions.sizes.map((o) => o.value)).toEqual(options.sizes);
    expect(quoteOptions.frequencies.map((o) => o.value)).toEqual(options.frequencies);
  });
});
