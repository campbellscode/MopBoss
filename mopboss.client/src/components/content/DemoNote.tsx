import { contentAudit, revealDemo } from '@/content';
import { PlaceholderChip } from './Placeholder';
import styles from './DemoNote.module.css';

/**
 * Label under the illustrated before/after demo. Visitors always see that it is an
 * illustration, not a real job; audit mode shows the prototype's fuller gold chip.
 */
export function DemoNote({ auditText, className }: { auditText: string; className?: string }) {
  if (contentAudit) return <PlaceholderChip className={className}>{auditText}</PlaceholderChip>;
  return <p className={`${styles.caption} ${className ?? ''}`}>{revealDemo.caption}</p>;
}
