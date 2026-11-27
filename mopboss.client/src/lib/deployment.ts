/**
 * Build-time deployment settings (inlined by Next.js). See .env.example.
 *
 * NEXT_PUBLIC_DEPLOY_ENV = development (default) | preview | production.
 * A production build is checked by next.config.ts and refuses to build without a
 * real https API URL and site URL, or with content-audit mode switched on.
 */
export type DeployEnv = 'development' | 'preview' | 'production';

const rawEnv = process.env.NEXT_PUBLIC_DEPLOY_ENV;

export const deployment = {
  env: (rawEnv === 'production' || rawEnv === 'preview' ? rawEnv : 'development') as DeployEnv,
  quoteApiUrl: process.env.NEXT_PUBLIC_QUOTE_API_URL?.trim().replace(/\/$/, '') || null,
};
