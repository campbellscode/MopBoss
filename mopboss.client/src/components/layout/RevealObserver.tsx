'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { prefersReducedMotion } from '@/lib/motion';

/**
 * Scroll reveals: elements with `.rv` fade up once when 10% visible.
 *
 * Content is visible by default. The `.js` class that hides `.rv` elements is added
 * only here, after hydration, and only when IntersectionObserver exists and motion is
 * allowed. If this script never runs, nothing is ever hidden.
 */
export function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;
    const root = document.documentElement;
    root.classList.add('js');
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1 },
    );
    document.querySelectorAll('.rv:not(.in)').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  return null;
}
