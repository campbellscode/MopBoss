import { DemoNote } from '@/components/content/DemoNote';
import { PlaceholderChip } from '@/components/content/Placeholder';
import { RevealSlider } from '@/components/reveal/RevealSlider';
import { CtaBand } from '@/components/sections/CtaBand';
import { Eyebrow, SectionHeading } from '@/components/ui';
import { contentAudit, galleryPage, photoPairs } from '@/content';
import { GalleryWall } from './GalleryWall';
import { photoTiles, placeholderTiles } from './tiles';
import styles from './GalleryPage.module.css';

/**
 * /gallery: the interactive demo with "Sweep it for me", then the transformation
 * wall. The wall appears only once real photo pairs exist in the content module
 * (audit mode shows the prototype's placeholder tiles).
 */
export function GalleryPage() {
  const { wall } = galleryPage;
  const pairs = photoPairs ?? [];
  const hasPhotos = pairs.length > 0;
  const tiles = hasPhotos ? photoTiles(pairs) : contentAudit ? placeholderTiles : [];

  return (
    <>
      <section className={styles.hero} aria-labelledby="gallery-title">
        <div className={`container ${styles.heroLayout}`}>
          <div className={styles.heroHead}>
            <Eyebrow>{galleryPage.eyebrow}</Eyebrow>
            <SectionHeading
              as="h1"
              id="gallery-title"
              parts={galleryPage.heading}
              className={styles.heroTitle}
            />
          </div>
          <p className={styles.lead}>{galleryPage.lead}</p>
        </div>
      </section>

      <section className={styles.demo} aria-label="Before and after demo">
        <div className={`container ${styles.demoStack}`}>
          <RevealSlider
            variant="gallery"
            initial={38}
            sweep={{ buttonLabel: galleryPage.sweep, statusFormat: galleryPage.cleanLabel }}
            aside={<DemoNote auditText={galleryPage.auditNote} />}
          />
        </div>
      </section>

      {tiles.length > 0 ? (
        <section className={styles.wall} aria-labelledby="wall-title">
          <div className={`container ${styles.wallStack}`}>
            <GalleryWall
              tiles={tiles}
              chipRowLabel={wall.filterLabel}
              heading={
                <div className={styles.wallHeadText}>
                  <Eyebrow>{wall.eyebrow}</Eyebrow>
                  <SectionHeading
                    id="wall-title"
                    parts={wall.heading}
                    className={styles.wallTitle}
                  />
                </div>
              }
            />
            {hasPhotos ? null : (
              <PlaceholderChip className={styles.selfStart}>{wall.auditFootnote}</PlaceholderChip>
            )}
          </div>
        </section>
      ) : null}

      <CtaBand heading={galleryPage.cta.heading} body={galleryPage.cta.body} />
    </>
  );
}
