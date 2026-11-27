import type { CSSProperties, ElementType, ReactNode } from 'react';
import styles from './Type.module.css';

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

type EyebrowProps = {
  tone?: 'deepPink' | 'ink' | 'onInk';
  /** Short pink rule before the label (hero). */
  rule?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

const eyebrowTone = {
  deepPink: styles.toneDeepPink,
  ink: styles.toneInk,
  onInk: styles.toneOnInk,
} as const;

/** Unbounded 700, 12px, tracked uppercase label above headings. */
export function Eyebrow({
  tone = 'deepPink',
  rule = false,
  className,
  style,
  children,
}: EyebrowProps) {
  return (
    <div
      className={cx(styles.eyebrow, eyebrowTone[tone], rule && styles.withRule, className)}
      style={style}
    >
      {rule ? <span className={styles.rule} aria-hidden="true" /> : null}
      {children}
    </div>
  );
}

/** One part of a headline: plain text, an italic accent phrase, or an outlined block. */
export type HeadlinePart =
  | string
  | {
      accent: string;
      /** Put the accent on its own line. */
      block?: boolean;
      tone?: 'deepPink' | 'boss' | 'ink' | 'onInk';
    }
  | { outline: string };

export type Headline = readonly HeadlinePart[];

const accentTone = {
  deepPink: undefined,
  boss: styles.toneBoss,
  ink: styles.toneInkAccent,
  onInk: styles.toneOnInkAccent,
} as const;

type AccentProps = {
  block?: boolean;
  tone?: keyof typeof accentTone;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/** Bodoni Moda italic phrase set 1.12× the display size (1.14× where the layout asks). */
export function Accent({ block, tone = 'deepPink', className, style, children }: AccentProps) {
  return (
    <span
      className={cx(
        'accent',
        styles.accentPhrase,
        block && styles.block,
        accentTone[tone],
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}

export function renderHeadline(parts: Headline): ReactNode {
  return parts.map((part, index) => {
    if (typeof part === 'string') return part;
    if ('outline' in part) {
      return (
        <span key={index} className={styles.outline}>
          {part.outline}
        </span>
      );
    }
    return (
      <Accent key={index} block={part.block} tone={part.tone}>
        {part.accent}
      </Accent>
    );
  });
}

type SectionHeadingProps = {
  as?: ElementType;
  parts: Headline;
  className?: string;
  style?: CSSProperties;
  id?: string;
  tabIndex?: number;
};

/** Unbounded display heading with an italic accent phrase. */
export function SectionHeading({
  as: Tag = 'h2',
  parts,
  className,
  style,
  id,
  tabIndex,
}: SectionHeadingProps) {
  return (
    <Tag className={cx('display', className)} style={style} id={id} tabIndex={tabIndex}>
      {renderHeadline(parts)}
    </Tag>
  );
}
