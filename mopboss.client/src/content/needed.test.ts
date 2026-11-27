import { describe, expect, it } from 'vitest';
import { business, linda } from './facts';
import { neededGroups, renderContentNeeded } from './needed';

describe('content needed checklist', () => {
  it('matches the committed CONTENT_NEEDED.md (run `npm run content:needed` to refresh)', async () => {
    await expect(renderContentNeeded()).toMatchFileSnapshot('../../../CONTENT_NEEDED.md');
  });

  it('lists every unconfirmed business fact', () => {
    const ids = new Set(neededGroups.flatMap((g) => g.items.map((i) => i.id)));
    const confirmed = new Set(['name', 'owner', 'ownerTitle', 'phone']);
    const businessFields = Object.keys(business).filter((k) => !confirmed.has(k));
    const lindaFields = Object.keys(linda).map((k) => (k === 'note' ? 'lindaNote' : k));
    for (const field of [...businessFields, ...lindaFields, 'reviews', 'photoPairs']) {
      expect(ids, `missing checklist entry for "${field}"`).toContain(field);
    }
  });
});
