import { Fragment } from 'react';
import { home } from '@/content';
import styles from './Marquee.module.css';

function Run({ items }: { items: readonly string[] }) {
  return (
    <span className={styles.run}>
      {items.map((item) => (
        <Fragment key={item}>
          {item} <span className={styles.star}>✦</span>{' '}
        </Fragment>
      ))}
    </span>
  );
}

/** Tilted black band of scrolling slogans. Decorative: the same words appear elsewhere. */
export function Marquee() {
  return (
    <div className={styles.band} aria-hidden="true">
      {(['desktop', 'mobile'] as const).map((size) => (
        <div key={size} className={`display ${styles.track} ${styles[size]}`}>
          <Run items={home.marquee[size]} />
          <Run items={home.marquee[size]} />
        </div>
      ))}
    </div>
  );
}
