import type { CSSProperties } from 'react';
import styles from './SpinRing.module.css';

type SpinRingProps = {
  /** Unique id for the text path (several rings can share a page). */
  id: string;
  text: string;
  radius: number;
  textLength: number;
  fontSize: number;
  color?: string;
  reverse?: boolean;
  className?: string;
  style?: CSSProperties;
};

/** Slowly rotating ring of uppercase text around a medallion. Decorative only. */
export function SpinRing({
  id,
  text,
  radius,
  textLength,
  fontSize,
  color = 'var(--color-ink)',
  reverse = false,
  className,
  style,
}: SpinRingProps) {
  const d = `M300,300 m-${radius},0 a${radius},${radius} 0 1,1 ${radius * 2},0 a${radius},${radius} 0 1,1 -${radius * 2},0`;
  return (
    <svg
      viewBox="0 0 600 600"
      aria-hidden="true"
      focusable="false"
      className={[styles.ring, reverse ? styles.reverse : '', className].filter(Boolean).join(' ')}
      style={style}
    >
      <defs>
        <path id={id} d={d} />
      </defs>
      <text fill={color} className={styles.text} style={{ fontSize }}>
        <textPath href={`#${id}`} textLength={textLength}>
          {text}
        </textPath>
      </text>
    </svg>
  );
}
