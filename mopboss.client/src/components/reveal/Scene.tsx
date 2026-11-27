import { memo, type CSSProperties } from 'react';
import { Bubble, Sparkle } from '@/components/ui';
import styles from './RevealSlider.module.css';

/**
 * Illustrated bathroom used by the Transformation Reveal demo: a round mirror,
 * striped curtain, tub and bottles. `wide` follows Main/Gallery, `tall` follows
 * Mobile-Home. `dirty` adds the grime layers; `clean` adds sparkles.
 */
type Layout = 'wide' | 'tall';

const abs = (style: CSSProperties): CSSProperties => ({ position: 'absolute', ...style });

const geometry: Record<Layout, Record<string, CSSProperties>> = {
  wide: {
    tiles: { backgroundSize: '72px 72px' },
    mirror: { left: '9%', top: '9%', height: '56%', border: '7px solid #0B0B0C' },
    rail: { right: '9%', top: '16%', width: '24%', height: 9, borderRadius: 9 },
    curtain: {
      right: '13%',
      top: '17%',
      width: '15%',
      height: '42%',
      borderRadius: '0 0 14px 14px',
      background: 'repeating-linear-gradient(#FC1D8A 0 26px, #FFFFFF 26px 40px)',
    },
    floor: { height: '27%' },
    bottle: {
      left: '46%',
      bottom: '27%',
      width: '7%',
      height: '22%',
      borderRadius: '14px 14px 6px 6px',
    },
    tub: { left: '57%', bottom: '27%', width: '13%', height: '10%' },
    dirtGrid: { backgroundSize: '72px 72px', clipPath: 'inset(0 0 27% 0)' },
    specks: { backgroundSize: '61px 47px, 43px 67px' },
    smudge: {
      background:
        'radial-gradient(closest-side at 22% 36%, #5A4A3099, #0000), radial-gradient(closest-side at 70% 30%, #5A4A3066, #0000), radial-gradient(closest-side at 50% 88%, #5A4A3080, #0000), #6B5B4033',
    },
  },
  tall: {
    tiles: { backgroundSize: '58px 58px' },
    mirror: { left: '7%', top: '9%', height: '42%', border: '6px solid #0B0B0C' },
    rail: { right: '7%', top: '14%', width: '32%', height: 8, borderRadius: 8 },
    curtain: {
      right: '12%',
      top: '15%',
      width: '21%',
      height: '36%',
      borderRadius: '0 0 12px 12px',
      background: 'repeating-linear-gradient(#FC1D8A 0 22px, #FFFFFF 22px 34px)',
    },
    floor: { height: '26%' },
    bottle: {
      left: '14%',
      bottom: '26%',
      width: '13%',
      height: '17%',
      borderRadius: '12px 12px 6px 6px',
    },
    tub: { left: '42%', bottom: '26%', width: '32%', height: '9%' },
    dirtGrid: { backgroundSize: '58px 58px', clipPath: 'inset(0 0 26% 0)' },
    specks: { backgroundSize: '51px 43px, 37px 59px' },
    smudge: {
      background:
        'radial-gradient(closest-side at 28% 30%, #5A4A3099, #0000), radial-gradient(closest-side at 72% 34%, #5A4A3066, #0000), radial-gradient(closest-side at 50% 88%, #5A4A3080, #0000), #6B5B4033',
    },
  },
};

const SQUIGGLE = 'M4 40c20-40 30 40 50 0s30 40 50 0 30 40 50 0 30 40 50 0 30 40 50 0 30 30 40 0';

function SceneBase({ layout, side }: { layout: Layout; side: 'before' | 'after' }) {
  const g = geometry[layout];
  return (
    <div
      className={`${styles.side} ${side === 'before' ? styles.before : styles.after}`}
      aria-hidden="true"
    >
      <div className={styles.tiles} style={g.tiles} />
      <div className={styles.mirror} style={abs(g.mirror)} />
      <div style={abs({ ...g.rail, background: '#0B0B0C' })} />
      <div style={abs({ ...g.curtain, border: '5px solid #0B0B0C', borderTop: 0 })} />
      <div
        style={abs({
          left: 0,
          right: 0,
          bottom: 0,
          ...g.floor,
          background: '#FFFFFF',
          borderTop: '6px solid #0B0B0C',
        })}
      />
      <div style={abs({ ...g.bottle, border: '5px solid #0B0B0C', background: '#FC1D8A' })} />
      {layout === 'wide' ? (
        <div
          style={abs({
            left: '48.4%',
            bottom: '49%',
            width: '2.2%',
            height: '6%',
            background: '#0B0B0C',
            borderRadius: '4px 4px 0 0',
          })}
        />
      ) : null}
      <div
        style={abs({
          ...g.tub,
          borderRadius: '0 0 80px 80px',
          border: '5px solid #0B0B0C',
          background: '#FFFFFF',
        })}
      />

      {side === 'before' ? (
        <>
          <div style={abs({ inset: 0, ...g.smudge })} />
          <div className={styles.dirtGrid} style={g.dirtGrid} />
          <div className={styles.dirtSpecks} style={g.specks} />
          {layout === 'wide' ? (
            <svg
              viewBox="0 0 300 80"
              fill="none"
              stroke="#3D3222"
              strokeWidth="4"
              strokeLinecap="round"
              style={abs({ left: '13%', top: '30%', width: '22%', opacity: 0.6 })}
            >
              <path d={SQUIGGLE} />
            </svg>
          ) : null}
        </>
      ) : layout === 'wide' ? (
        <>
          <Sparkle style={{ width: '7%', aspectRatio: '1', left: '31%', top: '10%' }} />
          <Sparkle style={{ width: '4%', aspectRatio: '1', left: '5%', top: '52%' }} delay="-1s" />
          <Sparkle
            style={{ width: '5%', aspectRatio: '1', left: '71%', bottom: '31%' }}
            delay="-2s"
          />
          <Bubble style={{ width: '5%', aspectRatio: '1', left: '40%', top: '22%' }} />
          <Bubble style={{ width: '3%', aspectRatio: '1', left: '44%', top: '12%' }} delay="-3s" />
        </>
      ) : (
        <>
          <Sparkle style={{ width: 34, height: 34, left: '44%', top: '8%' }} />
          <Sparkle style={{ width: 20, height: 20, left: '6%', top: '58%' }} delay="-1s" />
          <Bubble style={{ width: 24, height: 24, left: '30%', bottom: '46%' }} />
        </>
      )}
    </div>
  );
}

/** Memoised so dragging the slider never re-renders the illustration. */
export const Scene = memo(SceneBase);
