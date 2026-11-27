import { ImageResponse } from 'next/og';
import { logoDataUrl } from '@/lib/brandImage';
import { business, ownerLine } from '@/content/facts';
import { seo } from '@/content/seo';

export const alt = seo.ogAlt;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Social preview: the logo in a medallion on Boss Pink, with the confirmed facts. */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 64,
        background: '#FC1D8A',
        color: '#0B0B0C',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          width: 440,
          height: 440,
          borderRadius: 9999,
          background: '#FCFCFC',
          border: '12px solid #0B0B0C',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={logoDataUrl} width={370} height={257} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 520 }}>
        <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.2 }}>{ownerLine}</div>
        <div style={{ fontSize: 56, fontWeight: 800 }}>{business.phone.display}</div>
      </div>
    </div>,
    size,
  );
}
