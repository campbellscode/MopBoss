import { Hero } from '@/components/home/Hero';
import { Marquee } from '@/components/home/Marquee';
import { PageShell } from '@/components/layout/PageShell';

export default function HomePage() {
  return (
    <PageShell page="home">
      <Hero />
      <Marquee />
    </PageShell>
  );
}
