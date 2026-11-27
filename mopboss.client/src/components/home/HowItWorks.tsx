import { PlaceholderChip } from '@/components/content/Placeholder';
import { Eyebrow, SectionHeading } from '@/components/ui';
import { business, home, serviceNumber } from '@/content';
import shared from './Home.module.css';
import styles from './HowItWorks.module.css';

/** "Three steps. Zero fuss." Staggered sticker cards, or a timeline at phone widths. */
export function HowItWorks() {
  const { how } = home;
  return (
    <section id="how" className={styles.section} aria-labelledby="how-title">
      <div className={`container ${styles.stack}`}>
        <div className={`rv ${shared.sectionHead}`}>
          <Eyebrow>{how.eyebrow}</Eyebrow>
          <SectionHeading id="how-title" parts={how.heading} className={shared.h2} />
        </div>
        <ol className={styles.steps}>
          {how.steps.map((step, i) => (
            <li
              key={step.title}
              className={`rv ${styles.step} ${'highlight' in step && step.highlight ? styles.pink : ''}`}
            >
              <span className={styles.dot} aria-hidden="true" />
              <h3 className={styles.stepTitle}>
                <span className={`accent ${styles.num}`}>{serviceNumber(i)}</span>{' '}
                <span className={`display ${styles.titleText}`}>{step.title}</span>
              </h3>
              <p className={styles.stepBody}>
                <span className={shared.desktopOnly}>{step.body.desktop}</span>
                <span className={shared.mobileOnly}>{step.body.mobile}</span>
              </p>
              {'responseTime' in step && step.responseTime ? (
                business.quoteResponseTime ? (
                  <p className={styles.response}>{business.quoteResponseTime}</p>
                ) : (
                  <PlaceholderChip className={styles.chip}>
                    [Response time — confirm]
                  </PlaceholderChip>
                )
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
