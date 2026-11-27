import type { ReactNode } from 'react';
import { nav } from '@/content';
import { CompactFooter, FullFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { ThumbBar } from './ThumbBar';

export type PageKey = 'home' | 'services' | 'about' | 'gallery';

/**
 * Skip link, header, main landmark and footer for the marketing pages.
 * The homepage gets the full footer and, at phone widths, the thumb bar.
 */
export function PageShell({ page, children }: { page: PageKey; children: ReactNode }) {
  const isHome = page === 'home';
  return (
    <div id="top" style={{ overflowX: 'clip' }}>
      <a className="skip-link" href="#main">
        {nav.skipLink}
      </a>
      <SiteHeader page={page} />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      {isHome ? <FullFooter /> : <CompactFooter />}
      {isHome ? <ThumbBar /> : null}
    </div>
  );
}
