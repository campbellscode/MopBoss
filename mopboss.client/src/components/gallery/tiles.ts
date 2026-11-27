import type { PhotoPair } from '@/content';

/*
 * Tile data lives outside the 'use client' wall component: a server component that
 * imports values from a client module only receives client references, not data.
 */

export type Tile =
  | { kind: 'photo'; category: string; pair: PhotoPair }
  | { kind: 'placeholder'; category: string; n: string };

/** Audit-mode stand-ins, matching the prototype's six placeholder tiles. */
export const placeholderTiles: Tile[] = [
  ['Kitchens', '01'],
  ['Bathrooms', '02'],
  ['Living spaces', '03'],
  ['Kitchens', '04'],
  ['Move-outs', '05'],
  ['Bathrooms', '06'],
].map(([category, n]): Tile => ({ kind: 'placeholder', category, n }));

export const photoTiles = (pairs: readonly PhotoPair[]): Tile[] =>
  pairs.map((pair): Tile => ({ kind: 'photo', category: pair.category, pair }));
