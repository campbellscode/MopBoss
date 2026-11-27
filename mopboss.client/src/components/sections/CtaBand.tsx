import { ArrowRight, BossLink, Bubble, Magnetic, SectionHeading, Sparkle } from '@/components/ui';
import type { Headline } from '@/components/ui';
import { bossTreatment, ctaCall, nav, telHref } from '@/content';
import styles from './CtaBand.module.css';

type Props = {
  heading: Headline;
  /** One string, or desktop/mobile copy for the homepage. */
  body: string | { desktop: string; mobile: string };
  /** `home` uses the larger homepage band and its mobile composition. */
  variant?: 'home' | 'page';
};

/** Pink closing band with the outlined headline and the magnetic ink CTA. */
export function CtaBand({ heading, body, variant = 'page' }: Props) {
  const isHome = variant === 'home';
  return (
    <section className={`${styles.band} ${isHome ? styles.home : ''}`} aria-labelledby="cta-title">
      <div className={styles.decor} aria-hidden="true">
        {isHome ? (
          <>
            <Bubble
              onPink
              style={{ width: 150, height: 150, left: '5%', top: '14%' }}
              className={styles.desktopOnly}
            />
            <Bubble
              onPink
              style={{ width: 70, height: 70, left: '15%', bottom: '14%' }}
              delay="-3s"
              className={styles.desktopOnly}
            />
            <Bubble
              onPink
              style={{ width: 110, height: 110, right: '7%', bottom: '18%' }}
              delay="-5s"
              className={styles.desktopOnly}
            />
            <Sparkle
              style={{ width: 54, height: 54, right: '16%', top: '16%' }}
              className={styles.desktopOnly}
            />
            <Sparkle
              style={{ width: 30, height: 30, left: '26%', top: '20%' }}
              delay="-1.5s"
              className={styles.desktopOnly}
            />
            <Bubble
              onPink
              style={{ width: 90, height: 90, right: -18, top: 20 }}
              className={styles.mobileOnly}
            />
            <Sparkle
              style={{ width: 34, height: 34, left: 20, bottom: 26 }}
              className={styles.mobileOnly}
            />
          </>
        ) : (
          <>
            <Bubble onPink style={{ width: 130, height: 130, left: '6%', top: '16%' }} />
            <Bubble
              onPink
              style={{ width: 84, height: 84, right: '8%', bottom: '16%' }}
              delay="-4s"
            />
            <Sparkle style={{ width: 46, height: 46, right: '17%', top: '18%' }} />
          </>
        )}
      </div>
      <div className={`container rv ${styles.inner}`}>
        <SectionHeading id="cta-title" parts={heading} className={styles.title} />
        <p className={styles.body}>
          {typeof body === 'string' ? (
            body
          ) : (
            <>
              <span className={styles.desktopOnly}>{body.desktop}</span>
              <span className={styles.mobileOnly}>{body.mobile}</span>
            </>
          )}
        </p>
        <div className={styles.actions}>
          <Magnetic sparkles="band">
            <BossLink
              href={nav.quote.href}
              variant="ink"
              size={isHome ? 'xl' : 'lg'}
              className={styles.cta}
            >
              {bossTreatment} <ArrowRight className={styles.arrow} />
            </BossLink>
          </Magnetic>
          <a href={telHref} className={styles.call}>
            {ctaCall}
          </a>
        </div>
      </div>
    </section>
  );
}
