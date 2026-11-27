import { resolveDeployment } from './deployGuard';

/**
 * Build-time deployment settings (inlined by Next.js, so each variable is named in full).
 * See .env.example and deployGuard.ts. Missing or invalid settings fail closed: the quote
 * form reports "unavailable" and never pretends to send.
 */
export const deployment = resolveDeployment({
  NEXT_PUBLIC_DEPLOY_ENV: process.env.NEXT_PUBLIC_DEPLOY_ENV,
  NEXT_PUBLIC_QUOTE_MODE: process.env.NEXT_PUBLIC_QUOTE_MODE,
  NEXT_PUBLIC_QUOTE_API_URL: process.env.NEXT_PUBLIC_QUOTE_API_URL,
});

export type { DeployEnv, Deployment, SubmissionMode } from './deployGuard';
