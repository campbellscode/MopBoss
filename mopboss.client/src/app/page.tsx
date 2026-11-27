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
import logo from '@/assets/brand/mopboss-logo.png';
import { siteUrl } from '@/content/seo';
import { jsonLdString, localBusinessJsonLd } from '@/lib/structuredData';

export default function HomePage() {
  return (
    <PageShell page="home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(localBusinessJsonLd(`${siteUrl}${logo.src}`)),
        }}
      />
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
