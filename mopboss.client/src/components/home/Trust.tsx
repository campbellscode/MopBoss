import { AuditOnly, PlaceholderChip } from '@/components/content/Placeholder';
import { CheckIcon, Eyebrow, SectionHeading } from '@/components/ui';
import { business, contentAudit, home, reviews, telHref } from '@/content';
import styles from './Trust.module.css';

/** Confirmed credentials as plain pills; each is omitted until Linda confirms it. */
function credentials(): string[] {
  const list: string[] = [];
  if (business.insuredStatus) list.push(business.insuredStatus);
  if (business.yearsInBusiness !== null) list.push(`${business.yearsInBusiness} years in business`);
  if (business.serviceArea) list.push(business.serviceArea);
  if (business.satisfactionPolicy) list.push(business.satisfactionPolicy);
  return list;
}

const credentialPlaceholders = [
  { key: 'insuredStatus', label: '[Insured / bonded — confirm]' },
  { key: 'yearsInBusiness', label: '[Years in business — confirm]' },
  { key: 'serviceArea', label: '[Service area — confirm]' },
  { key: 'satisfactionPolicy', label: '[Satisfaction policy — confirm]' },
] as const;

/**
 * "Trust, in the open." Shows only what is on the record: owner-led and one direct
 * line. Reviews and credentials appear once they are real and confirmed.
 */
export function Trust() {
  const { trust } = home;
  const creds = credentials();
  const reviewList = reviews ?? [];
  const hasReviews = reviewList.length > 0;
  const showShelf = hasReviews || creds.length > 0 || contentAudit;

  return (
    <section className={styles.section} aria-labelledby="trust-title">
      <div className={`container ${styles.stack}`}>
        <div className={`rv ${styles.head}`}>
          <Eyebrow>{trust.eyebrow}</Eyebrow>
          <SectionHeading id="trust-title" parts={trust.heading} className={styles.title} />
        </div>
        <div className={styles.row}>
          <div className={`rv on-ink ${styles.record}`}>
            <Eyebrow tone="onInk">{trust.recordEyebrow}</Eyebrow>
            <div className={styles.fact}>
              <CheckIcon className={styles.check} />
              <div>
                <strong>{trust.ownerLed.strong}</strong> {trust.ownerLed.text}
              </div>
            </div>
            <div className={styles.fact}>
              <CheckIcon className={styles.check} />
              <div>
                <strong>{trust.directLine.strong}</strong>{' '}
                <a href={telHref}>{business.phone.display}</a>
              </div>
            </div>
            <AuditOnly>
              <div className={styles.footnote}>{trust.auditFootnote}</div>
            </AuditOnly>
          </div>

          {showShelf ? (
            <div className={`rv ${styles.shelf}`}>
              {hasReviews ? (
                <ul className={styles.reviews}>
                  {reviewList.map((review) => (
                    <li key={review.quote} className={styles.review}>
                      <div className={`accent ${styles.quoteMark}`} aria-hidden="true">
                        “
                      </div>
                      <blockquote className={styles.reviewText}>{review.quote}</blockquote>
                      <div className={styles.cite}>
                        {[review.firstName, review.neighborhood, review.date]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : contentAudit ? (
                <ul className={styles.reviews}>
                  {[1, 2].map((n) => (
                    <li key={n} className={`${styles.review} ${n === 2 ? styles.desktopOnly : ''}`}>
                      <div className={`accent ${styles.quoteMark}`} aria-hidden="true">
                        “
                      </div>
                      <PlaceholderChip>[Real client review goes here]</PlaceholderChip>
                      <div className={styles.cite}>[Client first name · neighborhood · date]</div>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className={styles.creds}>
                {creds.map((c) => (
                  <span key={c} className={styles.pill}>
                    {c}
                  </span>
                ))}
                {credentialPlaceholders.map((p) =>
                  business[p.key] === null ? (
                    <PlaceholderChip
                      key={p.key}
                      className={p.key === 'satisfactionPolicy' ? styles.desktopOnly : undefined}
                    >
                      {p.label}
                    </PlaceholderChip>
                  ) : null,
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
