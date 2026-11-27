import type { Metadata } from 'next';
import { RevealObserver } from '@/components/layout/RevealObserver';
import { fontVariables } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mop Boss',
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
