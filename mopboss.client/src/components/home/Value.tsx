import Link from 'next/link';
import { Eyebrow, SectionHeading } from '@/components/ui';
import { home } from '@/content';
import shared from './Home.module.css';
import styles from './Value.module.css';

/** "What we do": the one-standard promise and the three quick points. */
export function Value() {
  const { value } = home;
  return (
    <section className={styles.section} aria-labelledby="value-title">
      <div className={`container ${styles.top}`}>
        <div className={`rv ${styles.headCol}`}>
          <Eyebrow>{value.eyebrow}</Eyebrow>
          <SectionHeading id="value-title" parts={value.heading} className={styles.title} />
          <p className={`${styles.body} ${shared.mobileOnly}`}>{value.body.mobile}</p>
        </div>
        <div className={`rv ${styles.bodyCol} ${shared.desktopOnly}`}>
          <p className={styles.body}>{value.body.desktop}</p>
          <Link href={value.link.href} className={shared.underlineLink}>
            {value.link.label}
          </Link>
        </div>
      </div>
      <div className={`container ${styles.pointsWrap}`}>
        <ol className={`rv ${styles.points}`}>
          {value.points.map((point, i) => (
            <li key={point.title} className={styles.point}>
              <span className={`accent ${styles.num}`} aria-hidden="true">
                {i + 1}
              </span>
              <div className={styles.pointText}>
                <div
                  className={`display ${styles.pointTitle} ${point.highlight ? styles.pink : ''}`}
                >
                  {point.title}
                </div>
                <div className={styles.pointBody}>
                  <span className={shared.desktopOnly}>{point.body.desktop}</span>
                  <span className={shared.mobileOnly}>{point.body.mobile}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
