import Image from 'next/image';
import Link from 'next/link';
import logo from '@/assets/brand/mopboss-logo.png';
import { AuditOnly } from '@/components/content/Placeholder';
import { ContactFacts } from '@/components/content/ContactFacts';
import { Eyebrow, Medallion } from '@/components/ui';
import { brand, business, footer, ownerLine, telHref } from '@/content';
import styles from './SiteFooter.module.css';

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

/** Homepage footer: medallion, link column, contact column and the outlined wordmark. */
export function FullFooter() {
  return (
    <footer className={cx('on-ink', styles.footer, styles.footerFull)}>
      <div className={cx('container', styles.stack)}>
        <div className={styles.columns}>
          <div className={styles.brandCol}>
            <Medallion ring="pink" className={styles.medallionLg}>
              <Image
                src={logo}
                alt={brand.logoAlt}
                width={129}
                height={90}
                className={styles.medallionLogo}
              />
            </Medallion>
            <div className={cx('accent', styles.tagline)}>{brand.tagline}</div>
          </div>
          <nav aria-label="Footer" className={styles.navCol}>
            <Eyebrow tone="onInk" className={styles.colHeading}>
              {footer.exploreHeading}
            </Eyebrow>
            {footer.links.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
          <div className={styles.talkCol}>
            <Eyebrow tone="onInk" className={styles.colHeading}>
              {footer.talkHeading}
            </Eyebrow>
            <a href={telHref} className={cx('display', styles.bigPhone)}>
              {business.phone.display}
            </a>
            <div className={styles.owner}>{ownerLine}</div>
            <ContactFacts className={styles.chips} lineClassName={styles.factLine} />
          </div>
        </div>
        <div className={cx('display', styles.wordmark)} aria-hidden="true">
          {business.name}
        </div>
        <div className={styles.legal}>
          <span>
            {footer.copyrightHome}
            <span className={styles.desktopOnly}> {footer.rightsReserved}</span>
          </span>
          <AuditOnly>
            <span>{footer.prototypeNote}</span>
          </AuditOnly>
        </div>
      </div>
    </footer>
  );
}

/** Inner-page footer: medallion and tagline, inline links, phone. */
export function CompactFooter() {
  return (
    <footer className={cx('on-ink', styles.footer)}>
      <div className={cx('container', styles.stack)}>
        <div className={styles.row}>
          <div className={styles.brandRow}>
            <Medallion ring="pinkSm" className={styles.medallionSm}>
              <Image
                src={logo}
                alt={brand.logoAlt}
                width={83}
                height={58}
                className={styles.medallionLogo}
              />
            </Medallion>
            <div className={cx('accent', styles.tagline)}>{brand.tagline}</div>
          </div>
          <nav aria-label="Footer" className={styles.inlineNav}>
            {footer.compactLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
          <a href={telHref} className={cx('display', styles.bigPhone, styles.compactPhone)}>
            {business.phone.display}
          </a>
        </div>
        <div className={styles.legal}>
          <span>{footer.copyright}</span>
          <AuditOnly>
            <span>{footer.prototypeNote}</span>
          </AuditOnly>
        </div>
      </div>
    </footer>
  );
}
