import { AboutPage } from '@/components/about/AboutPage';
import { PageShell } from '@/components/layout/PageShell';

export default function Page() {
  return (
    <PageShell page="about">
      <AboutPage />
    </PageShell>
  );
}
