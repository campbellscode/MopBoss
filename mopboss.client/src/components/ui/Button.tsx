import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ArrowRight } from './icons';
import { SmartLink } from './SmartLink';
import styles from './Button.module.css';

export { styles as buttonStyles };

type BossVariant = 'pink' | 'ink';
type BossSize = 'sm' | 'md' | 'lg' | 'xl';

type BossCommon = {
  variant?: BossVariant;
  size?: BossSize;
  /** Quote-flow behaviour: lift on hover instead of the gloss sweep. */
  lift?: boolean;
  /** Append the arrow icon the prototype uses on primary CTAs. */
  arrow?: boolean;
  className?: string;
  children: ReactNode;
};

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

export function bossClassName({
  variant = 'pink',
  size = 'md',
  lift = false,
  className,
}: Omit<BossCommon, 'children' | 'arrow'>) {
  return cx(
    styles.boss,
    variant === 'ink' && styles.ink,
    size !== 'md' && styles[size],
    lift && styles.lift,
    className,
  );
}

type BossLinkProps = BossCommon & { href: string; 'aria-label'?: string };

/** Primary pill CTA rendered as a link. */
export function BossLink({ href, arrow, children, ...rest }: BossLinkProps) {
  return (
    <SmartLink href={href} className={bossClassName(rest)} aria-label={rest['aria-label']}>
      {children}
      {arrow ? <ArrowRight /> : null}
    </SmartLink>
  );
}

type BossButtonProps = BossCommon & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>;

/** Primary pill CTA rendered as a button. */
export function BossButton({
  variant,
  size,
  lift,
  arrow,
  className,
  children,
  type = 'button',
  ...rest
}: BossButtonProps) {
  return (
    <button type={type} className={bossClassName({ variant, size, lift, className })} {...rest}>
      {children}
      {arrow ? <ArrowRight /> : null}
    </button>
  );
}

type GhostSize = 'md' | 'tall' | 'flow';

type GhostCommon = {
  size?: GhostSize;
  tone?: 'ink' | 'pink';
  className?: string;
  children: ReactNode;
};

export function ghostClassName({
  size = 'md',
  tone = 'ink',
  className,
}: Omit<GhostCommon, 'children'>) {
  return cx(
    styles.ghost,
    size === 'tall' && styles.ghostTall,
    size === 'flow' && styles.ghostFlow,
    tone === 'pink' && styles.ghostPink,
    className,
  );
}

/** White pill with ink outline that inverts on hover. */
export function GhostLink({ href, children, ...rest }: GhostCommon & { href: string }) {
  return (
    <SmartLink href={href} className={ghostClassName(rest)}>
      {children}
    </SmartLink>
  );
}

export function GhostButton({
  size,
  tone,
  className,
  children,
  type = 'button',
  ...rest
}: GhostCommon & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>) {
  return (
    <button type={type} className={ghostClassName({ size, tone, className })} {...rest}>
      {children}
    </button>
  );
}
