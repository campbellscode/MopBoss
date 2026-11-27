import Image from 'next/image';
import logo from '@/assets/brand/mopboss-logo.png';
import {
  ArrowRight,
  BossLink,
  Bubble,
  Eyebrow,
  GhostLink,
  Magnetic,
  Sparkle,
} from '@/components/ui';
import { SpinRing } from '@/components/ui/SpinRing';
import { bossTreatment, brand, business, home, nav, ownerLine, telHref } from '@/content';
import { CleanSweep } from './CleanSweep';
import styles from './Hero.module.css';

const SQUIGGLE = 'M4 40c20-40 30 40 50 0s30 40 50 0 30 40 50 0 30 40 50 0 30 40 50 0 30 30 40 0';

/** Dusty film wiped away by the mop. Purely decorative. */
function Grime() {
  return (
    <div className={styles.grime} aria-hidden="true">
      <div className={styles.desktopOnly}>
        <i
          className={styles.blob}
          style={{
            left: '3%',
            top: '16%',
            width: '36%',
            height: '34%',
            background: 'radial-gradient(closest-side, #8C7F6A66, #8C7F6A00)',
          }}
        />
        <i
          className={styles.blob}
          style={{
            left: '30%',
            top: '52%',
            width: '30%',
            height: '40%',
            background: 'radial-gradient(closest-side, #8C7F6A55, #8C7F6A00)',
          }}
        />
        <i
          className={styles.blob}
          style={{
            right: '4%',
            top: '8%',
            width: '34%',
            height: '46%',
            background: 'radial-gradient(closest-side, #8C7F6A5c, #8C7F6A00)',
          }}
        />
        <i
          className={styles.blob}
          style={{
            right: '18%',
            bottom: 0,
            width: '28%',
            height: '30%',
            background: 'radial-gradient(closest-side, #8C7F6A4d, #8C7F6A00)',
          }}
        />
        <i className={`${styles.blob} ${styles.specks}`} />
        <svg
          viewBox="0 0 300 80"
          fill="none"
          stroke="#8C7F6A"
          strokeWidth="3"
          strokeLinecap="round"
          className={styles.squiggle}
          style={{ left: '44%', top: '20%', width: 220, opacity: 0.7 }}
        >
          <path d={SQUIGGLE} />
        </svg>
        <svg
          viewBox="0 0 300 80"
          fill="none"
          stroke="#8C7F6A"
          strokeWidth="3"
          strokeLinecap="round"
          className={styles.squiggle}
          style={{ left: '8%', bottom: '12%', width: 180, opacity: 0.6 }}
        >
          <path d={SQUIGGLE} />
        </svg>
      </div>
      <div className={styles.mobileOnly}>
        <i
          className={styles.blob}
          style={{
            left: 0,
            top: '6%',
            width: '80%',
            height: '30%',
            background: 'radial-gradient(closest-side, #8C7F6A66, #8C7F6A00)',
          }}
        />
        <i
          className={styles.blob}
          style={{
            right: 0,
            top: '42%',
            width: '70%',
            height: '36%',
            background: 'radial-gradient(closest-side, #8C7F6A55, #8C7F6A00)',
          }}
        />
        <i className={`${styles.blob} ${styles.specks} ${styles.specksMobile}`} />
      </div>
    </div>
  );
}

function Mop() {
  return (
    <svg className={styles.mop} viewBox="0 0 220 700" aria-hidden="true" focusable="false">
      <line
        x1="172"
        y1="22"
        x2="98"
        y2="556"
        stroke="#0B0B0C"
        strokeWidth="17"
        strokeLinecap="round"
      />
      <line
        x1="172"
        y1="22"
        x2="163"
        y2="88"
        stroke="#FC1D8A"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        d="M68 548h62l9 36H60z"
        fill="#FC1D8A"
        stroke="#0B0B0C"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M54 582C22 602 6 650 10 688c20 10 38-8 50 4 14 8 26-8 40 2 14 6 28-10 42-2 18 6 34-2 50-6 4-36-12-86-44-106z"
        fill="#FF7DB8"
        stroke="#0B0B0C"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M72 592c-14 30-20 60-18 92M100 590v100M130 592c14 30 20 60 18 92"
        stroke="#0B0B0C"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Hero() {
  const { hero } = home;
  return (
    <CleanSweep replayLabel={hero.replay}>
      <Grime />
      <Mop />
      <div className={`container ${styles.layout}`}>
        <div className={styles.copy}>
          <Eyebrow tone="ink" rule className={styles.eyebrow}>
            {ownerLine}
          </Eyebrow>
          <h1 className={`display ${styles.title}`}>
            {hero.headingLines.map((line) => (
              <span key={line} className={styles.line}>
                {line}
              </span>
            ))}
            <span className={styles.line}>
              <span className={`accent ${styles.titleAccent}`}>{hero.accentLine.accent}</span>
              {hero.accentLine.rest}
            </span>
            <span className={styles.mess}>
              <span className={styles.dirty}>{hero.mess}</span>
              <span className={styles.clean} aria-hidden="true">
                {hero.mess}
              </span>
            </span>
          </h1>
          <p className={styles.lead}>
            <span className={styles.desktopOnly}>{hero.lead.desktop}</span>
            <span className={styles.mobileOnly}>{hero.lead.mobile}</span>
          </p>
          <div className={styles.ctas}>
            <Magnetic sparkles="hero">
              <BossLink href={nav.quote.href} className={styles.primaryCta}>
                {bossTreatment} <ArrowRight />
              </BossLink>
            </Magnetic>
            <GhostLink href="/services" size="tall" className={styles.desktopOnly}>
              {hero.secondaryCta}
            </GhostLink>
            <a href="#services" className={`${styles.underline} ${styles.mobileOnly}`}>
              {hero.secondaryCta}
            </a>
          </div>
          <div className={`${styles.call} ${styles.desktopOnly}`}>
            {hero.callPrompt} <a href={telHref}>{business.phone.display}</a>
          </div>
        </div>

        <div className={`${styles.visual} ${styles.px2}`}>
          <div className={styles.orb} aria-hidden="true" />
          <SpinRing
            id="ring-hero"
            text={hero.ring.desktop}
            radius={262}
            textLength={1630}
            fontSize={17}
            className={`${styles.ring} ${styles.desktopOnly}`}
          />
          <SpinRing
            id="ring-hero-m"
            text={hero.ring.mobile}
            radius={262}
            textLength={1630}
            fontSize={22}
            className={`${styles.ringMobile} ${styles.mobileOnly}`}
          />
          <div className={styles.medallion}>
            <Image
              src={logo}
              alt={brand.heroLogoAlt}
              sizes="(max-width: 767.98px) 231px, 378px"
              className={styles.logo}
              loading="eager"
              fetchPriority="high"
            />
          </div>
          <div
            className={`${styles.decor} ${styles.late} ${styles.px1} ${styles.desktopOnly}`}
            aria-hidden="true"
          >
            <Bubble style={{ width: 86, height: 86, left: 0, top: '10%' }} />
            <Bubble style={{ width: 40, height: 40, left: '15%', top: '2%' }} delay="-2s" />
            <Bubble style={{ width: 58, height: 58, right: '4%', bottom: '8%' }} delay="-4s" />
            <Bubble style={{ width: 26, height: 26, right: '17%', bottom: '2%' }} delay="-1s" />
            <Sparkle style={{ width: 46, height: 46, left: '5%', bottom: '14%' }} />
            <Sparkle style={{ width: 28, height: 28, right: '30%', top: 0 }} delay="-1.2s" />
            <Sparkle style={{ width: 22, height: 22, left: '22%', bottom: '4%' }} delay="-2.2s" />
          </div>
          <div className={`${styles.decor} ${styles.mobileOnly}`} aria-hidden="true">
            <Bubble style={{ width: 54, height: 54, left: 8, top: 20 }} />
            <Bubble style={{ width: 28, height: 28, left: 60, bottom: 4 }} delay="-3s" />
            <Sparkle style={{ width: 34, height: 34, left: 22, bottom: 44 }} />
            <Sparkle style={{ width: 20, height: 20, right: 26, bottom: 30 }} delay="-1.4s" />
          </div>
        </div>
      </div>
    </CleanSweep>
  );
}
