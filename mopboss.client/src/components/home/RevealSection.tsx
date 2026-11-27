import Link from 'next/link';
import { DemoNote } from '@/components/content/DemoNote';
import { RevealSlider } from '@/components/reveal/RevealSlider';
import { Eyebrow, SectionHeading } from '@/components/ui';
import { home } from '@/content';
import shared from './Home.module.css';
import styles from './RevealSection.module.css';

/** "Go on. Drag the mop." The interactive demo, clearly labelled as an illustration. */
export function RevealSection() {
  const { reveal } = home;
  return (
    <section id="reveal" className={styles.section} aria-labelledby="reveal-title">
      <div className={`container ${styles.stack}`}>
        <div className={`rv ${styles.head}`}>
          <div className={shared.sectionHead}>
            <Eyebrow>{reveal.eyebrow}</Eyebrow>
            <SectionHeading id="reveal-title" parts={reveal.heading} className={shared.h2} />
          </div>
          <p className={`${styles.body} ${shared.desktopOnly}`}>{reveal.body}</p>
        </div>
        <div className="rv">
          <RevealSlider variant="home" initial={38} />
        </div>
        <div className={`rv ${styles.foot}`}>
          <DemoNote auditText={reveal.auditNote.desktop} className={shared.desktopOnly} />
          <DemoNote auditText={reveal.auditNote.mobile} className={shared.mobileOnly} />
          <Link href="/gallery" className={`${shared.underlineLink} ${shared.desktopOnly}`}>
            {reveal.galleryLink}
          </Link>
        </div>
      </div>
    </section>
  );
}
