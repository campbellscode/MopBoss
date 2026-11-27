import Image from 'next/image';
import badge from '@/assets/brand/linda-badge.png';
import { ContactFacts } from '@/components/content/ContactFacts';
import { AuditOnly, PlaceholderChip, PlaceholderNote } from '@/components/content/Placeholder';
import { CtaBand } from '@/components/sections/CtaBand';
import {
  ArrowRight,
  BossLink,
  Bubble,
  Eyebrow,
  GhostLink,
  SectionHeading,
  Sparkle,
} from '@/components/ui';
import { MopFringe } from '@/components/ui/MopFringe';
import { SpinRing } from '@/components/ui/SpinRing';
import {
  aboutPage,
  bossTreatment,
  brand,
  business,
  callLinda,
  contentAudit,
  linda,
  nav,
  ownerLine,
  telHref,
} from '@/content';
import styles from './AboutPage.module.css';

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

type StoryKey = 'howStarted' | 'experience' | 'whatSheLoves';
const storyKeys: StoryKey[] = ['howStarted', 'experience', 'whatSheLoves'];

/** "Told in her words." Omitted entirely until Linda's story exists (shown in audit mode). */
function Story() {
  const { story } = aboutPage;
  const anyStory = !!linda.pullQuote || storyKeys.some((k) => !!linda[k]);
  if (!anyStory && !contentAudit) return null;

  return (
    <section className={styles.story} aria-labelledby="story-title">
      <div className={cx('container', styles.storyLayout)}>
        <div className={cx('rv', styles.storyHead)}>
          <Eyebrow>{story.eyebrow}</Eyebrow>
          <SectionHeading id="story-title" parts={story.heading} className={styles.storyTitle} />
          <AuditOnly>
            <p className={styles.storyIntro}>{story.auditIntro}</p>
          </AuditOnly>
          <PlaceholderChip className={styles.selfStart}>{story.auditNote}</PlaceholderChip>
        </div>
        <div className={cx('rv', styles.storyBody)}>
          {linda.pullQuote || contentAudit ? (
            <figure className={styles.quoteCard}>
              <div className={cx('accent', styles.quoteMark)} aria-hidden="true">
                “
              </div>
              {linda.pullQuote ? (
                <blockquote className={cx('accent', styles.pullQuote)}>
                  {linda.pullQuote}
                </blockquote>
              ) : (
                <div className={cx('accent', styles.pullQuotePlaceholder)} data-placeholder="">
                  {story.pullQuotePlaceholder}
                </div>
              )}
              <figcaption className={styles.attribution}>{ownerLine}</figcaption>
            </figure>
          ) : null}
          <div className={styles.tiles}>
            {storyKeys.map((key) =>
              linda[key] ? (
                <div key={key} className={styles.tile}>
                  <h3 className={styles.tileTitle}>{story.tileHeadings[key]}</h3>
                  <p>{linda[key]}</p>
                </div>
              ) : (
                <PlaceholderNote
                  key={key}
                  title={story.tiles[key].title}
                  className={styles.tileNote}
                >
                  {story.tiles[key].body}
                </PlaceholderNote>
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** /about: Linda, the Boss Standard and one direct line. */
export function AboutPage() {
  const { standard, contact } = aboutPage;
  const hasPhoto = !!linda.photo;
  return (
    <>
      <section className={styles.hero} aria-labelledby="about-title">
        <div className={cx('container', styles.heroLayout)}>
          <div className={styles.heroText}>
            <Eyebrow>{aboutPage.eyebrow}</Eyebrow>
            <SectionHeading
              as="h1"
              id="about-title"
              parts={aboutPage.heading}
              className={styles.heroTitle}
            />
            <p className={styles.lead}>{aboutPage.lead}</p>
            <div className={styles.heroCtas}>
              <BossLink href={nav.quote.href}>
                {bossTreatment} <ArrowRight />
              </BossLink>
              <GhostLink href={telHref} size="tall">
                {callLinda}
              </GhostLink>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <SpinRing
              id="ring-about"
              text={aboutPage.ring}
              radius={270}
              textLength={1680}
              fontSize={17}
              color="#D6006C"
              className={styles.ring}
            />
            <Image
              src={badge}
              alt={brand.badgeAlt}
              sizes="(max-width: 767.98px) 82vw, 460px"
              className={styles.badge}
              loading="eager"
            />
            <Sparkle style={{ width: 44, height: 44, left: '2%', top: '10%' }} />
            <Bubble style={{ width: 60, height: 60, right: 0, bottom: '12%' }} />
            <Bubble style={{ width: 30, height: 30, left: '8%', bottom: '6%' }} delay="-3s" />
          </div>
        </div>
      </section>

      <Story />

      <section className={cx('on-ink', styles.standard)} aria-labelledby="standard-title">
        <div className={cx('container', styles.standardStack)}>
          <div className={cx('rv', styles.standardHead)}>
            <div className={styles.standardHeadText}>
              <Eyebrow tone="onInk">{standard.eyebrow}</Eyebrow>
              <SectionHeading
                id="standard-title"
                parts={standard.heading}
                className={styles.standardTitle}
              />
            </div>
            <PlaceholderChip>{standard.draftNote}</PlaceholderChip>
          </div>
          <ol className={styles.values}>
            {standard.values.map((v, i) => (
              <li key={v.title} className={cx('rv', styles.value)}>
                <div className={cx('accent', styles.valueNum)} aria-hidden="true">
                  {i + 1}
                </div>
                <h3 className={cx('display', styles.valueTitle)}>{v.title}</h3>
                <p className={styles.valueBody}>{v.body}</p>
              </li>
            ))}
          </ol>
        </div>
        <MopFringe />
      </section>

      <section className={styles.contact} aria-labelledby="contact-title">
        <div className={cx('container', styles.contactLayout)}>
          {hasPhoto && linda.photo ? (
            <div className={cx('rv', styles.photo)}>
              <Image
                src={linda.photo.src}
                alt={linda.photo.alt}
                width={linda.photo.width}
                height={linda.photo.height}
                sizes="(max-width: 767.98px) 100vw, 520px"
                className={styles.photoImg}
              />
            </div>
          ) : contentAudit ? (
            <div className={cx('rv', styles.photoSlot)}>
              <PlaceholderChip className={styles.photoChip}>
                {contact.photoPlaceholder}
              </PlaceholderChip>
            </div>
          ) : null}
          <div className={cx('rv', styles.contactText)}>
            <Eyebrow>{contact.eyebrow}</Eyebrow>
            <SectionHeading
              id="contact-title"
              parts={contact.heading}
              className={styles.contactTitle}
            />
            <p className={styles.contactBody}>{contact.body}</p>
            <a href={telHref} className={cx('display', styles.bigPhone)}>
              {business.phone.display}
            </a>
            <ContactFacts
              className={styles.factChips}
              lineClassName={styles.factLine}
              order={['hours', 'serviceArea', 'email']}
              labels={{
                hours: '[Hours — confirm]',
                serviceArea: '[Service area — confirm]',
                email: '[Email — confirm]',
              }}
            />
          </div>
        </div>
      </section>

      <CtaBand heading={aboutPage.cta.heading} body={aboutPage.cta.body} />
    </>
  );
}
