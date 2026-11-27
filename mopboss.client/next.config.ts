import type { NextConfig } from 'next';
import { deployProblems, securityHeaders } from './src/lib/deployGuard';

// A production build (NEXT_PUBLIC_DEPLOY_ENV=production) refuses to build if it would
// ship the demo quote form, audit chips or non-https URLs.
const problems = deployProblems(process.env);
if (problems.length > 0) {
  throw new Error(`Refusing to build for production:\n - ${problems.join('\n - ')}`);
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  images: {
    // AVIF first (smaller than WebP for the logo and badge artwork), WebP as fallback.
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    // The CSP blocks the eval that the development server's hot reload needs, so the
    // security headers apply to production builds (`next build` + `next start`) only.
    if (process.env.NODE_ENV !== 'production') return [];
    return [{ source: '/:path*', headers: securityHeaders(process.env) }];
  },
};

export default nextConfig;
