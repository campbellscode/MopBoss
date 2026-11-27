import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // AVIF first (smaller than WebP for the logo and badge artwork), WebP as fallback.
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
