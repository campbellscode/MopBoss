import type { CSSProperties, ElementType, ReactNode } from 'react';
import styles from './Decor.module.css';

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

type DecorProps = {
  style?: CSSProperties;
  className?: string;
  /** Animation delay, e.g. "-1.2s". */
  delay?: string;
};

/** Four-point gold star. Decorative only. */
export function Sparkle({
  style,
  className,
  delay,
  motion = 'twinkle',
}: DecorProps & { motion?: 'twinkle' | 'pop' | 'still' }) {
  return (
    <i
      aria-hidden="true"
      className={cx(
        styles.sparkle,
        motion === 'pop' && styles.pop,
        motion === 'still' && styles.still,
        className,
      )}
      style={delay ? { ...style, animationDelay: delay } : style}
    />
  );
}

/** Outlined soap bubble with a highlight. Decorative only. */
export function Bubble({
  style,
  className,
  delay,
  onPink = false,
}: DecorProps & { onPink?: boolean }) {
  return (
    <i
      aria-hidden="true"
      className={cx(styles.bubble, onPink && styles.bubbleOnPink, className)}
      style={delay ? { ...style, animationDelay: delay } : style}
    />
  );
}

type MedallionProps = {
  ring?: 'lg' | 'md' | 'pink' | 'pinkSm';
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

const ringClass = {
  lg: styles.ringLg,
  md: styles.ringMd,
  pink: styles.ringPink,
  pinkSm: styles.ringPinkSm,
} as const;

/** White disc with a pink ring then an ink ring; holds the logo, icons and badge. */
export function Medallion({ ring = 'lg', className, style, children }: MedallionProps) {
  return (
    <div className={cx(styles.medallion, ringClass[ring], className)} style={style}>
      {children}
    </div>
  );
}

type StickerCardProps = {
  as?: ElementType;
  tone?: 'white' | 'pink';
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/** White card with a 2.5px ink outline and a hard shadow. */
export function StickerCard({
  as: Tag = 'div',
  tone = 'white',
  className,
  style,
  children,
}: StickerCardProps) {
  return (
    <Tag
      className={cx(styles.sticker, tone === 'pink' && styles.stickerPink, className)}
      style={style}
    >
      {children}
    </Tag>
  );
}
