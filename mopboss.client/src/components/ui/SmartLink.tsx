import Link from 'next/link';
import type { AnchorHTMLAttributes, ReactNode } from 'react';

export type SmartLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
};

/** Internal routes go through next/link; tel:, mailto: and in-page anchors stay plain. */
export function SmartLink({ href, children, ...rest }: SmartLinkProps) {
  if (href.startsWith('/')) {
    return (
      <Link href={href} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
