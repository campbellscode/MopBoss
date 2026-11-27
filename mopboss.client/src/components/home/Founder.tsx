import Image from 'next/image';
import badge from '@/assets/brand/linda-badge.png';
import { PlaceholderNote } from '@/components/content/Placeholder';
import { Bubble, Eyebrow, GhostLink, SectionHeading, Sparkle } from '@/components/ui';
import { SpinRing } from '@/components/ui/SpinRing';
import { brand, callLinda, home, linda, telHref } from '@/content';
import shared from './Home.module.css';
import styles from './Founder.module.css';

/** "Meet Linda." The badge medallion and, once she writes it, Linda's note. */
export function Founder() {
  const { founder } = home;
  return (
    <section id="linda" className={styles.section} aria-labelledby="founder-title">
      <div className={`container ${styles.layout}`}>
        <div className={`rv ${styles.visual}`}>
          <SpinRing
            id="ring-founder"
            text={founder.ring.desktop}
            radius={270}
            textLength={1680}
            fontSize={17}
            color="#D6006C"
            reverse
            className={`${styles.ring} ${shared.desktopOnly}`}
          />
          <SpinRing
            id="ring-founder-m"
            text={founder.ring.mobile}
            radius={276}
            textLength={1716}
            fontSize={22}
            color="#D6006C"
            reverse
            className={`${styles.ringMobile} ${shared.mobileOnly}`}
          />
          <Image
            src={badge}
            alt={brand.badgeAlt}
            sizes="(max-width: 767.98px) 272px, 450px"
            className={styles.badge}
          />
          <Sparkle
            style={{ width: 40, height: 40, left: '4%', top: '8%' }}
            className={shared.desktopOnly}
          />
          <Bubble
            style={{ width: 52, height: 52, right: '3%', bottom: '10%' }}
            className={shared.desktopOnly}
          />
        </div>
        <div className={`rv ${styles.copy}`}>
          <Eyebrow>{founder.eyebrow}</Eyebrow>
          <SectionHeading id="founder-title" parts={founder.heading} className={styles.title} />
          <p className={styles.body}>{founder.body}</p>
          {linda.note ? (
            <blockquote className={styles.note}>
              <p>{linda.note}</p>
            </blockquote>
          ) : (
            <PlaceholderNote title={founder.notePlaceholder.title} className={styles.placeholder}>
              <span className={shared.desktopOnly}>{founder.notePlaceholder.body.desktop}</span>
              <span className={shared.mobileOnly}>{founder.notePlaceholder.body.mobile}</span>
            </PlaceholderNote>
          )}
          <div className={`${styles.links} ${shared.desktopOnly}`}>
            <GhostLink href={founder.storyLink.href} size="tall">
              {founder.storyLink.label}
            </GhostLink>
            <GhostLink href={telHref} size="tall" tone="pink">
              {callLinda}
            </GhostLink>
          </div>
        </div>
      </div>
    </section>
  );
}
