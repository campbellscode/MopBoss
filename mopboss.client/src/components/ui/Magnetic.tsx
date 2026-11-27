'use client';

import type { MouseEvent, ReactNode } from 'react';
import { Sparkle } from './Decor';
import { prefersReducedMotion } from '@/lib/motion';
import styles from './Button.module.css';

type SparkleSpot = {
  size: number;
  left?: string;
  right?: string;
  top?: string;
  bottom?: string;
  delay?: string;
};

/** Sparkle positions copied from the prototype: hero CTA and CTA bands. */
const SPOTS: Record<'hero' | 'band', SparkleSpot[]> = {
  hero: [
    { size: 26, left: '2px', top: '-6px' },
    { size: 18, right: '8px', top: '-2px', delay: '.08s' },
    { size: 22, right: '26%', bottom: '-8px', delay: '.16s' },
  ],
  band: [
    { size: 28, left: '0', top: '-8px' },
    { size: 20, right: '6px', top: '-4px', delay: '.08s' },
    { size: 24, right: '28%', bottom: '-10px', delay: '.16s' },
  ],
};

/** Offset of the button from rest for a cursor at (x, y) inside the halo rect. */
export function magneticOffset(rect: DOMRect, x: number, y: number) {
  return {
    x: (x - rect.left - rect.width / 2) * 0.22,
    y: (y - rect.top - rect.height / 2) * 0.34,
  };
}

/**
 * The Boss Treatment: the wrapped button leans toward the cursor inside a 16px
 * halo (x offset × 0.22, y offset × 0.34) and three sparkles pop on hover.
 * Reduced motion: the button stays put and the sparkles stay hidden.
 */
export function Magnetic({
  sparkles = 'band',
  children,
}: {
  sparkles?: 'hero' | 'band';
  children: ReactNode;
}) {
  const move = (event: MouseEvent<HTMLSpanElement>) => {
    if (prefersReducedMotion()) return;
    const halo = event.currentTarget;
    const target = halo.firstElementChild as HTMLElement | null;
    if (!target) return;
    const offset = magneticOffset(halo.getBoundingClientRect(), event.clientX, event.clientY);
    target.style.transform = `translate(${offset.x.toFixed(1)}px,${offset.y.toFixed(1)}px)`;
  };

  const leave = (event: MouseEvent<HTMLSpanElement>) => {
    const target = event.currentTarget.firstElementChild as HTMLElement | null;
    if (target) target.style.transform = '';
  };

  return (
    <span className={styles.mag} onMouseMove={move} onMouseLeave={leave}>
      {children}
      {SPOTS[sparkles].map((s, i) => (
        <Sparkle
          key={i}
          className={styles.popSparkle}
          style={{
            width: s.size,
            height: s.size,
            left: s.left,
            right: s.right,
            top: s.top,
            bottom: s.bottom,
            animationDelay: s.delay,
          }}
        />
      ))}
    </span>
  );
}
