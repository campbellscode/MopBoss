import type { Metadata, Viewport } from 'next';
import { RevealObserver } from '@/components/layout/RevealObserver';
import { seo, siteUrl } from '@/content/seo';
import { fontVariables } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: seo.home.title, template: seo.titleTemplate },
  description: seo.home.description,
  applicationName: seo.siteName,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: seo.siteName,
    locale: 'en_US',
    title: seo.home.title,
    description: seo.home.description,
    url: '/',
  },
  twitter: { card: 'summary_large_image' },
  formatDetection: { telephone: true },
};

export const viewport: Viewport = {
  themeColor: '#FC1D8A',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        {children}
        <RevealObserver />
      </body>
    </html>
  );
}
