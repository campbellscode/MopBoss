import { ImageResponse } from 'next/og';
import { logoDataUrl } from '@/lib/brandImage';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** Home-screen icon: the logo on its near-white ground (iOS rounds the corners). */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#FCFCFC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={logoDataUrl} width={160} height={111} />
    </div>,
    size,
  );
}
