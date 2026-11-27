'use client';

import { useRef, type MouseEvent, type ReactNode } from 'react';
import { ReplayIcon } from '@/components/ui';
import { prefersReducedMotion } from '@/lib/motion';
import styles from './Hero.module.css';

/**
 * The Clean Sweep. The `go` class is in the server HTML, so the film-and-mop wipe
 * plays from CSS on first paint even before (or without) JavaScript. This client
 * wrapper only adds the replay button and the gentle mouse parallax.
 * Reduced motion: CSS removes the film and the mop, and parallax is skipped.
 */
export function CleanSweep({
  replayLabel,
  className,
  children,
}: {
  replayLabel: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  const replay = () => {
    const hero = ref.current;
    if (!hero) return;
    hero.classList.remove(styles.go);
    void hero.offsetWidth; // restart the CSS animations
    hero.classList.add(styles.go);
  };

  const move = (event: MouseEvent<HTMLElement>) => {
    if (prefersReducedMotion()) return;
    const hero = event.currentTarget;
    const r = hero.getBoundingClientRect();
    hero.style.setProperty('--mx', ((event.clientX - r.left) / r.width - 0.5).toFixed(3));
    hero.style.setProperty('--my', ((event.clientY - r.top) / r.height - 0.5).toFixed(3));
  };

  return (
    <section
      ref={ref}
      id="hero"
      className={`${styles.hero} ${styles.go} ${className ?? ''}`}
      onMouseMove={move}
    >
      {children}
      <button type="button" className={styles.replay} onClick={replay}>
        <ReplayIcon />
        {replayLabel}
      </button>
    </section>
  );
}
