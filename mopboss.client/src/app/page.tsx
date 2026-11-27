import { Hero } from '@/components/home/Hero';
import { Marquee } from '@/components/home/Marquee';
import { ServicesMenu } from '@/components/home/ServicesMenu';
import { Value } from '@/components/home/Value';
import { Why } from '@/components/home/Why';
import homeStyles from '@/components/home/Home.module.css';
import { PageShell } from '@/components/layout/PageShell';

export default function HomePage() {
  return (
    <PageShell page="home">
      <div className={homeStyles.home}>
        <Hero />
        <Marquee />
        <Value />
        <ServicesMenu />
        <Why />
      </div>
    </PageShell>
  );
}
