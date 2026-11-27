import type { MetadataRoute } from 'next';
import { siteUrl } from '@/content/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: Array<{ path: string; priority: number }> = [
    { path: '/', priority: 1 },
    { path: '/services', priority: 0.8 },
    { path: '/quote', priority: 0.8 },
    { path: '/about', priority: 0.6 },
    { path: '/gallery', priority: 0.5 },
  ];
  return routes.map(({ path, priority }) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: 'monthly',
    priority,
  }));
}
