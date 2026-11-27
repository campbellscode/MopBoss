import { ImageResponse } from 'next/og';
import { logoDataUrl } from '@/lib/brandImage';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

/** Favicon: the logo, unaltered, inside a small white medallion with a pink ring. */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 9999,
        background: '#FCFCFC',
        border: '4px solid #FC1D8A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={logoDataUrl} width={52} height={36} />
    </div>,
    size,
  );
}
