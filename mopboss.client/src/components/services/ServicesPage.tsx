import { PlaceholderChip } from '@/components/content/Placeholder';
import { CtaBand } from '@/components/sections/CtaBand';
import { ArrowRight, Bubble, Eyebrow, GhostLink, SectionHeading, Sparkle } from '@/components/ui';
import { nav, serviceNumber, services, servicesPage, type Service } from '@/content';
import { ServiceIcon } from './ServiceIcon';
import styles from './ServicesPage.module.css';

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

const groundClass: Record<Service['ground'], string> = {
  white: styles.groundWhite,
  blush: styles.groundBlush,
  ink: `on-ink ${styles.groundInk}`,
  pink: styles.groundPink,
};

function ServiceSection({ service, index }: { service: Service; index: number }) {
  const n = serviceNumber(index);
  const flipped = index % 2 === 1;
  return (
    <section
      id={service.slug}
      className={cx(styles.service, groundClass[service.ground])}
      aria-labelledby={`${service.slug}-title`}
    >
      <div className={cx('container', styles.serviceLayout)}>
        <div className={cx('rv', styles.visual, flipped && styles.visualFlipped)}>
          <div className={cx('accent', styles.bigNum)} aria-hidden="true">
            {n}
          </div>
          <div className={styles.iconMedallion}>
            <ServiceIcon icon={service.icon} />
          </div>
        </div>
        <div className={cx('rv', styles.text)}>
          <Eyebrow className={styles.serviceEyebrow}>{servicesPage.serviceEyebrow(n)}</Eyebrow>
          <h2 id={`${service.slug}-title`} className={cx('display', styles.serviceTitle)}>
            {service.name}
          </h2>
          <div className={cx('accent', styles.tagline)}>{service.tagline}</div>
          <p className={styles.description}>{service.description}</p>
          <ul className={styles.goodFor} aria-label={`${service.name} is good for`}>
            {service.goodFor.map((g) => (
              <li key={g} className={styles.goodForPill}>
                {g}
              </li>
            ))}
          </ul>
          {service.inclusions ? (
            <ul className={styles.inclusions}>
              {service.inclusions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {service.pricing ? <p className={styles.pricing}>{service.pricing}</p> : null}
          {service.inclusions === null || service.pricing === null ? (
            <PlaceholderRow service={service} />
          ) : null}
          <GhostLink href={nav.quote.href} className={styles.quoteLink}>
            {servicesPage.quoteCta} <ArrowRight />
          </GhostLink>
        </div>
      </div>
    </section>
  );
}

function PlaceholderRow({ service }: { service: Service }) {
  const chips = [
    service.inclusions === null ? service.inclusionsPlaceholder : null,
    // The prototype's Specialty section has no pricing chip.
    service.pricing === null && service.slug !== 'specialty'
      ? servicesPage.pricingPlaceholder
      : null,
  ].filter((c): c is string => c !== null);
  if (chips.length === 0) return null;
  return (
    <div className={styles.chipRow}>
      {chips.map((c) => (
        <PlaceholderChip key={c}>{c}</PlaceholderChip>
      ))}
    </div>
  );
}

/** /services: hero, sticky jump navigation, one section per service, CTA band. */
export function ServicesPage() {
  return (
    <>
      <section className={styles.hero} aria-labelledby="services-hero-title">
        <Bubble style={{ width: 110, height: 110, right: '7%', top: 60 }} />
        <Bubble style={{ width: 46, height: 46, right: '16%', top: 210 }} delay="-3s" />
        <Sparkle style={{ width: 44, height: 44, right: '21%', top: 84 }} />
        <div className={cx('container', styles.heroInner)}>
          <Eyebrow>{servicesPage.eyebrow}</Eyebrow>
          <SectionHeading
            as="h1"
            id="services-hero-title"
            parts={servicesPage.heading}
            className={styles.heroTitle}
          />
          <p className={styles.lead}>{servicesPage.lead}</p>
          <PlaceholderChip>{servicesPage.draftNote}</PlaceholderChip>
        </div>
      </section>

      <div className={styles.jumpBar}>
        <nav className={cx('container', styles.jumpNav)} aria-label={servicesPage.jumpLabel}>
          {services.map((s, i) => (
            <a key={s.slug} href={`#${s.slug}`} className={styles.jump}>
              <span className="accent" aria-hidden="true">
                {serviceNumber(i)}
              </span>
              {s.jumpLabel}
            </a>
          ))}
        </nav>
      </div>

      {services.map((service, i) => (
        <ServiceSection key={service.slug} service={service} index={i} />
      ))}

      <CtaBand heading={servicesPage.cta.heading} body={servicesPage.cta.body} />
    </>
  );
}
