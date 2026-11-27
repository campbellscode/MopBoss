'use client';

import Image from 'next/image';
import { useState, type ReactNode } from 'react';
import { Sparkle } from '@/components/ui';
import { galleryPage, type PhotoPair } from '@/content';
import styles from './GalleryPage.module.css';

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

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

/** Filterable before/after wall. Chips are toggle buttons with aria-pressed. */
export function GalleryWall({
  tiles,
  chipRowLabel,
  heading,
}: {
  tiles: Tile[];
  chipRowLabel: string;
  /** Section heading, laid out beside the filter chips. */
  heading: ReactNode;
}) {
  const { wall } = galleryPage;
  const [category, setCategory] = useState<string>(wall.all);
  const categories = [wall.all, ...wall.categories];
  const shown = tiles.filter((t) => category === wall.all || t.category === category);

  return (
    <>
      <div className={styles.wallHead}>
        {heading}
        <div role="group" aria-label={chipRowLabel} className={styles.chips}>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              className={cx(styles.chip, category === c && styles.chipOn)}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <ul className={styles.grid}>
        {shown.map((tile) => (
          <li
            key={tile.kind === 'photo' ? tile.pair.after.src : tile.n}
            className={styles.tileItem}
          >
            <figure className={styles.tile}>
              <div className={styles.tileFrame}>
                {tile.kind === 'photo' ? (
                  <>
                    <Image
                      src={tile.pair.before.src}
                      alt={tile.pair.before.alt}
                      fill
                      sizes="(max-width: 767.98px) 100vw, 420px"
                      className={styles.tileImg}
                    />
                    <div className={styles.tileAfter}>
                      <Image
                        src={tile.pair.after.src}
                        alt={tile.pair.after.alt}
                        fill
                        sizes="(max-width: 767.98px) 100vw, 420px"
                        className={styles.tileImg}
                      />
                    </div>
                  </>
                ) : (
                  <div className={styles.tileAfter} />
                )}
                <div className={styles.tileSplit} aria-hidden="true" />
                <Sparkle style={{ width: 34, height: 34, left: '12%', top: '14%' }} />
                <span className={cx(styles.tileTag, styles.tileTagAfter)} aria-hidden="true">
                  AFTER
                </span>
                <span className={cx(styles.tileTag, styles.tileTagBefore)} aria-hidden="true">
                  BEFORE
                </span>
                {tile.kind === 'placeholder' ? (
                  <span className={styles.tilePlaceholder} data-placeholder="">
                    {wall.tilePlaceholder(tile.n)}
                  </span>
                ) : null}
              </div>
              <figcaption className={styles.caption}>
                <span className={cx('display', styles.captionCat)}>{tile.category}</span>
                <span className={styles.captionMeta}>
                  {tile.kind === 'photo' ? (tile.pair.caption ?? '') : wall.captionPlaceholder}
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </>
  );
}
