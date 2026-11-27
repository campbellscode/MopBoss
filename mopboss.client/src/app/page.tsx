import { Founder } from '@/components/home/Founder';
import { Hero } from '@/components/home/Hero';
import homeStyles from '@/components/home/Home.module.css';
import { HowItWorks } from '@/components/home/HowItWorks';
import { Marquee } from '@/components/home/Marquee';
import { RevealSection } from '@/components/home/RevealSection';
import { ServicesMenu } from '@/components/home/ServicesMenu';
import { Trust } from '@/components/home/Trust';
import { Value } from '@/components/home/Value';
import { Why } from '@/components/home/Why';
import { PageShell } from '@/components/layout/PageShell';
import { CtaBand } from '@/components/sections/CtaBand';
import { home } from '@/content';

export default function HomePage() {
  return (
    <PageShell page="home">
      <div className={homeStyles.home}>
        <Hero />
        <Marquee />
        <Value />
        <ServicesMenu />
        <RevealSection />
        <Why />
        <Founder />
        <HowItWorks />
        <Trust />
        <CtaBand variant="home" heading={home.cta.heading} body={home.cta.body} />
      </div>
    </PageShell>
  );
}
