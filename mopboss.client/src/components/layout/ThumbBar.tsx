import Link from 'next/link';
import { HomeIcon, PersonIcon, RevealIcon, SparkleIcon } from '@/components/ui';
import { nav, thumbBar } from '@/content';
import styles from './ThumbBar.module.css';

/** Sticky bottom navigation for the mobile homepage, with the raised quote button in the middle. */
export function ThumbBar() {
  return (
    <nav aria-label={thumbBar.label} className={styles.bar}>
      <a className={styles.tab} href="#top">
        <HomeIcon />
        {thumbBar.home}
      </a>
      <a className={styles.tab} href="#services">
        <SparkleIcon />
        {thumbBar.services}
      </a>
      <Link href={nav.quote.href} aria-label={thumbBar.quoteLabel} className={styles.quote}>
        {thumbBar.quoteLines.map((line) => (
          <span key={line} aria-hidden="true">
            {line}
          </span>
        ))}
      </Link>
      <a className={styles.tab} href="#reveal">
        <RevealIcon />
        {thumbBar.reveal}
      </a>
      <a className={styles.tab} href="#linda">
        <PersonIcon />
        {thumbBar.linda}
      </a>
    </nav>
  );
}
