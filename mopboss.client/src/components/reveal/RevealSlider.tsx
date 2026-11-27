'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BossButton, DoubleChevron } from '@/components/ui';
import { revealDemo } from '@/content';
import { prefersReducedMotion } from '@/lib/motion';
import { Scene } from './Scene';
import styles from './RevealSlider.module.css';

export const SWEEP_MS = 1800;
const SWEEP_FROM = 2;

/** Ease-out cubic, as in the prototype's "Sweep it for me". */
export const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);

type SweepOptions = {
  buttonLabel: string;
  /** Status label, e.g. "38% spotless". Announced when a sweep finishes. */
  statusLabel: (pct: number) => string;
};

type Props = {
  /** `home` swaps to the tall mobile scene below 768px; `gallery` stays wide. */
  variant?: 'home' | 'gallery';
  initial?: number;
  sweep?: SweepOptions;
  /** Rendered at the right of the controls row (e.g. the demo caption). */
  aside?: ReactNode;
};

/**
 * The Transformation Reveal. A native <input type="range"> sits invisibly over the
 * scene, so drag, touch, tap and arrow keys all work without custom pointer code.
 * The value drives the CSS variable --p, which clips the clean layer, so dragging
 * only writes one style property and never re-renders the illustration.
 * Reduced motion: "Sweep it for me" jumps straight to 100%.
 */
export function RevealSlider({ variant = 'home', initial = 38, sweep, aside }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number | null>(null);
  const [pct, setPct] = useState(initial);
  // Announced once when a sweep finishes, not on every animation frame.
  const [announcement, setAnnouncement] = useState('');

  const apply = useCallback(
    (value: number) => {
      frameRef.current?.style.setProperty('--p', `${value}%`);
      if (inputRef.current) inputRef.current.value = String(Math.round(value));
      if (sweep) setPct(Math.round(value));
    },
    [sweep],
  );

  const cancelSweep = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  useEffect(() => cancelSweep, []);

  const runSweep = () => {
    cancelSweep();
    const finish = () => {
      if (sweep) setAnnouncement(sweep.statusLabel(100));
    };
    if (prefersReducedMotion()) {
      apply(100);
      finish();
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / SWEEP_MS);
      apply(SWEEP_FROM + (100 - SWEEP_FROM) * easeOutCubic(k));
      rafRef.current = k < 1 ? requestAnimationFrame(tick) : null;
      if (k >= 1) finish();
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  return (
    <>
      <div
        ref={frameRef}
        className={`${styles.frame} ${variant === 'gallery' ? styles.gallery : styles.home}`}
        style={{ ['--p' as string]: `${initial}%` }}
      >
        <div className={styles.wide}>
          <Scene layout="wide" side="before" />
          <Scene layout="wide" side="after" />
        </div>
        {variant === 'home' ? (
          <div className={styles.tall}>
            <Scene layout="tall" side="before" />
            <Scene layout="tall" side="after" />
          </div>
        ) : null}
        <span className={`${styles.tag} ${styles.tagAfter}`} aria-hidden="true">
          {revealDemo.after}
        </span>
        <span className={`${styles.tag} ${styles.tagBefore}`} aria-hidden="true">
          {revealDemo.before}
        </span>
        <div className={styles.handle} aria-hidden="true">
          <span className={styles.knob}>
            <DoubleChevron />
          </span>
        </div>
        <input
          ref={inputRef}
          className={styles.range}
          type="range"
          min={0}
          max={100}
          step={1}
          defaultValue={initial}
          aria-label={revealDemo.ariaLabel}
          aria-valuetext={sweep ? sweep.statusLabel(pct) : undefined}
          onChange={(event) => {
            cancelSweep();
            apply(Number(event.currentTarget.value));
          }}
        />
      </div>
      {sweep || aside ? (
        <div className={styles.controls}>
          {sweep ? (
            <div className={styles.sweepRow}>
              <BossButton className={styles.sweepButton} onClick={runSweep}>
                {sweep.buttonLabel}
              </BossButton>
              <span className={`display ${styles.status}`} aria-hidden="true">
                {sweep.statusLabel(pct)}
              </span>
              <span className="visually-hidden" role="status">
                {announcement}
              </span>
            </div>
          ) : null}
          {aside}
        </div>
      ) : null}
    </>
  );
}
