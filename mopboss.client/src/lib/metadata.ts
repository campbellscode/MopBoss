import type { Metadata } from 'next';
import { seo } from '@/content/seo';

type PageKey = 'services' | 'about' | 'gallery' | 'quote';

/** Title, description, canonical URL and Open Graph text for an inner page. */
export function pageMetadata(page: PageKey, path: string): Metadata {
  const { title, description } = seo[page];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: seo.siteName,
      locale: 'en_US',
      title: `${title} · ${seo.siteName}`,
      description,
      url: path,
    },
  };
}
