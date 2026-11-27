import Image from 'next/image';
import Link from 'next/link';
import logo from '@/assets/brand/mopboss-logo.png';
import { BossLink, PhoneIcon } from '@/components/ui';
import { brand, business, nav, telHref } from '@/content';
import type { PageKey } from './PageShell';
import styles from './SiteHeader.module.css';

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

/** Sticky site header. On the homepage at phone widths it becomes the compact bar with a phone pill. */
export function SiteHeader({ page }: { page: PageKey }) {
  const isHome = page === 'home';
  const links = [...nav.main, isHome ? nav.homeExtra : nav.homeLink];

  return (
    <header className={cx(styles.header, isHome && styles.home)}>
      <div className={cx('container', styles.inner)}>
        <Link href="/" aria-label={nav.homeAriaLabel} className={styles.logoLink}>
          <Image
            src={logo}
            alt={brand.logoAlt}
            width={95}
            height={66}
            className={styles.logo}
            loading="eager"
          />
        </Link>
        <nav aria-label="Main" className={styles.nav}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={styles.navLink}
              aria-current={link.href === `/${page}` ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className={styles.actions}>
          <a href={telHref} className={styles.phone}>
            {isHome ? <PhoneIcon /> : null}
            {business.phone.display}
          </a>
          <BossLink href={nav.quote.href} size="sm" className={styles.quoteCta}>
            {nav.quote.label}
          </BossLink>
        </div>
      </div>
    </header>
  );
}
