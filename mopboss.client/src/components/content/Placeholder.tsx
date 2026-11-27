import type { CSSProperties, ElementType, ReactNode } from 'react';
import { contentAudit } from '@/content/audit';
import styles from './Placeholder.module.css';

type Props = {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

const cx = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(' ');

/**
 * Dashed gold chip marking content that is still unconfirmed.
 * Renders only in content-audit mode; production visitors never see it.
 */
export function PlaceholderChip({ className, style, children }: Props) {
  if (!contentAudit) return null;
  return (
    <span className={cx(styles.chip, className)} style={style} data-placeholder="">
      {children}
    </span>
  );
}

/** Dashed gold box with a bracketed title, for paragraphs still to be written. Audit mode only. */
export function PlaceholderNote({
  title,
  as: Tag = 'div',
  className,
  style,
  children,
}: Props & { title: string; as?: ElementType }) {
  if (!contentAudit) return null;
  return (
    <Tag className={cx(styles.note, className)} style={style} data-placeholder="">
      <strong className={styles.noteTitle}>{title}</strong>
      {children}
    </Tag>
  );
}

/** Renders children only in audit mode (for prototype notes that describe missing content). */
export function AuditOnly({ children }: { children: ReactNode }) {
  return contentAudit ? <>{children}</> : null;
}

export { styles as placeholderStyles };
