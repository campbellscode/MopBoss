import { PlaceholderChip } from '@/components/content/Placeholder';
import { Eyebrow, SectionHeading } from '@/components/ui';
import { MopFringe } from '@/components/ui/MopFringe';
import { home } from '@/content';
import shared from './Home.module.css';
import styles from './Why.module.css';

/** "Why Mop Boss?": the four draft brand promises on black, closed by the mop fringe. */
export function Why() {
  const { why } = home;
  return (
    <section className={`on-ink ${styles.section}`} aria-labelledby="why-title">
      <div className={`container ${styles.layout}`}>
        <div className={`rv ${styles.head}`}>
          <Eyebrow tone="onInk">{why.eyebrow}</Eyebrow>
          <SectionHeading id="why-title" parts={why.heading} className={styles.title} />
          <p className={`${styles.body} ${shared.desktopOnly}`}>{why.body}</p>
          <PlaceholderChip className={`${styles.chip} ${shared.desktopOnly}`}>
            {why.draftNote}
          </PlaceholderChip>
        </div>
        <ol className={styles.grid}>
          {why.promises.map((promise, i) => (
            <li key={promise.title} className={`rv ${styles.item}`}>
              <div className={`accent ${styles.num}`} aria-hidden="true">
                {i + 1}
              </div>
              <div>
                <div className={`display ${styles.itemTitle}`}>{promise.title}</div>
                <div className={styles.itemBody}>
                  <span className={shared.desktopOnly}>{promise.body.desktop}</span>
                  <span className={shared.mobileOnly}>{promise.body.mobile}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <MopFringe />
    </section>
  );
}
