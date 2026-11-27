import Link from 'next/link';
import { PlaceholderChip } from '@/components/content/Placeholder';
import { ArrowRight, Eyebrow, GhostLink, SectionHeading } from '@/components/ui';
import { home, nav, serviceNumber, services } from '@/content';
import shared from './Home.module.css';
import styles from './ServicesMenu.module.css';

/**
 * "Pick your kind of clean." Desktop: full-width service rows that flood pink on
 * hover. Phone widths: a swipeable rail of cards.
 */
export function ServicesMenu() {
  const copy = home.services;
  return (
    <section id="services" className={styles.section} aria-labelledby="services-title">
      <div className="container">
        <div className={`rv ${styles.head}`}>
          <div className={shared.sectionHead}>
            <Eyebrow>{copy.eyebrow}</Eyebrow>
            <SectionHeading id="services-title" parts={copy.heading} className={shared.h2} />
            <div className={`${styles.swipeHint} ${shared.mobileOnly}`}>
              {copy.swipeHint} <ArrowRight strokeWidth={2.6} />
            </div>
          </div>
          <PlaceholderChip className={shared.desktopOnly}>{copy.draftNote.desktop}</PlaceholderChip>
        </div>

        <ul className={`rv ${styles.rows} ${shared.desktopOnly}`}>
          {services.map((service, i) => (
            <li key={service.slug}>
              <Link href={`/services#${service.slug}`} className={styles.row}>
                <span className={`accent ${styles.rowNum}`} aria-hidden="true">
                  {serviceNumber(i)}
                </span>
                <span className={`display ${styles.rowTitle}`}>{service.name}</span>
                <span className={styles.rowDesc}>{service.summary}</span>
                <span className={styles.rowArrow} aria-hidden="true">
                  <ArrowRight size={22} strokeWidth={2.6} />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className={`rv ${styles.foot} ${shared.desktopOnly}`}>
          <p>{copy.footer}</p>
          <GhostLink href={nav.quote.href} size="tall">
            {copy.footerCta}
          </GhostLink>
        </div>
      </div>

      <div
        className={`${styles.rail} ${shared.mobileOnly}`}
        tabIndex={0}
        role="group"
        aria-label={copy.railLabel}
      >
        {services.map((service, i) => (
          <Link
            key={service.slug}
            href={nav.quote.href}
            className={`${styles.card} ${i === 2 ? styles.cardPink : ''}`}
            aria-label={`${service.name}: ${copy.cardCta}`}
          >
            <span className={`accent ${styles.cardNum}`} aria-hidden="true">
              {serviceNumber(i)}
            </span>
            <span className={`display ${styles.cardTitle}`}>{service.name}</span>
            <span className={styles.cardDesc}>{service.summary}</span>
            <span className={styles.cardCta} aria-hidden="true">
              {copy.cardCta}
            </span>
          </Link>
        ))}
      </div>
      <div className={`${styles.railNote} ${shared.mobileOnly}`}>
        <PlaceholderChip>{copy.draftNote.mobile}</PlaceholderChip>
      </div>
    </section>
  );
}
