import { pageMetadata } from '@/lib/metadata';
import { AboutPage } from '@/components/about/AboutPage';
import { PageShell } from '@/components/layout/PageShell';

export const metadata = pageMetadata('about', '/about');

export default function Page() {
  return (
    <PageShell page="about">
      <AboutPage />
    </PageShell>
  );
}
