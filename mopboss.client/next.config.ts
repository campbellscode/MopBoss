import type { NextConfig } from 'next';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { deployProblems, securityHeaders } from './src/lib/deployGuard';

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

// `next build` refuses to run unless the deployment is stated explicitly and safely
// (see src/lib/deployGuard.ts). `next dev` reads .env.development instead. `next typegen`
// loads the config in the build phase too but builds nothing, so it is not checked.
export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD && !process.argv.includes('typegen')) {
    const problems = deployProblems(process.env);
    if (problems.length > 0) throw new Error(`Refusing to build:\n - ${problems.join('\n - ')}`);
  }
  return nextConfig;
}
