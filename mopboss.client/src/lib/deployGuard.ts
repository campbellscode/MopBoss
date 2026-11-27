/**
 * Deployment rules, response headers and the build guard used by next.config.ts.
 * Kept here, free of Next.js imports, so it is unit-tested.
 *
 * Every build must say what it is for:
 *   NEXT_PUBLIC_DEPLOY_ENV  = development | preview | production   (required)
 *   NEXT_PUBLIC_QUOTE_MODE  = live (default) | demo                 (demo never in production)
 *   NEXT_PUBLIC_QUOTE_API_URL                                       (required for live)
 * Anything missing, misspelt or unsafe fails the build. At runtime the same rules fail
 * closed: the form reports "unavailable" rather than pretending to send.
 */

type Env = Record<string, string | undefined>;

export const DEPLOY_ENVS = ['development', 'preview', 'production'] as const;
export type DeployEnv = (typeof DEPLOY_ENVS)[number];
export type SubmissionMode = 'live' | 'demo' | 'unavailable';

export type Deployment = {
  /** null when NEXT_PUBLIC_DEPLOY_ENV is missing or invalid. */
  env: DeployEnv | null;
  mode: SubmissionMode;
  /** Origin-normalised API URL, only when mode is live. */
  quoteApiUrl: string | null;
};

const LOOPBACK = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\]|0\.0\.0\.0)$|\.localhost$/i;

/** Reasons a URL may not be used in this environment, or none. */
function urlProblem(value: string | undefined, env: DeployEnv | null): string | null {
  if (!value?.trim()) return 'is not set';
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return 'is not a valid URL';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'must be http(s)';
  if (url.username || url.password) return 'must not contain credentials';
  const local = LOOPBACK.test(url.hostname);
  if (env === 'production') {
    if (url.protocol !== 'https:') return 'must use https in production';
    if (local) return 'must not be a local address in production';
  }
  if (env === 'preview' && url.protocol !== 'https:' && !local)
    return 'must use https in preview (http only for a loopback test API)';
  return null;
}

const parseEnv = (value: string | undefined): DeployEnv | null =>
  (DEPLOY_ENVS as readonly string[]).includes(value ?? '') ? (value as DeployEnv) : null;

/** What the quote form does with these settings. Missing or unsafe settings fail closed. */
export function resolveDeployment(e: Env): Deployment {
  const env = parseEnv(e.NEXT_PUBLIC_DEPLOY_ENV);
  const quoteMode = e.NEXT_PUBLIC_QUOTE_MODE?.trim() || 'live';
  const apiUrl = e.NEXT_PUBLIC_QUOTE_API_URL?.trim();
  const unavailable: Deployment = { env, mode: 'unavailable', quoteApiUrl: null };
  if (!env) return unavailable;
  if (quoteMode === 'demo')
    return env !== 'production' && !apiUrl ? { env, mode: 'demo', quoteApiUrl: null } : unavailable;
  if (quoteMode !== 'live' || urlProblem(apiUrl, env)) return unavailable;
  return { env, mode: 'live', quoteApiUrl: new URL(apiUrl!).origin };
}

/**
 * Problems that stop `next build`. A build never silently becomes a demo, never ships a
 * production site that cannot send, and never points production at a local address.
 */
export function deployProblems(e: Env): string[] {
  const problems: string[] = [];
  const raw = e.NEXT_PUBLIC_DEPLOY_ENV;
  const env = parseEnv(raw);
  if (!env) {
    problems.push(
      raw
        ? `NEXT_PUBLIC_DEPLOY_ENV must be development, preview or production (got "${raw}").`
        : 'NEXT_PUBLIC_DEPLOY_ENV must be set to development, preview or production.',
    );
    return problems;
  }

  const quoteMode = e.NEXT_PUBLIC_QUOTE_MODE?.trim() || 'live';
  if (quoteMode === 'demo') {
    if (env === 'production')
      problems.push('NEXT_PUBLIC_QUOTE_MODE=demo is not allowed in production.');
    if (e.NEXT_PUBLIC_QUOTE_API_URL?.trim())
      problems.push(
        'NEXT_PUBLIC_QUOTE_MODE=demo must not be combined with NEXT_PUBLIC_QUOTE_API_URL.',
      );
  } else if (quoteMode !== 'live') {
    problems.push(`NEXT_PUBLIC_QUOTE_MODE must be live or demo (got "${quoteMode}").`);
  } else {
    const p = urlProblem(e.NEXT_PUBLIC_QUOTE_API_URL, env);
    if (p)
      problems.push(
        `NEXT_PUBLIC_QUOTE_API_URL ${p}. Set the MopBoss.Server address` +
          (env === 'production' ? '.' : ', or NEXT_PUBLIC_QUOTE_MODE=demo to send nothing.'),
      );
  }

  if (env === 'production' || e.NEXT_PUBLIC_SITE_URL?.trim()) {
    const p = urlProblem(e.NEXT_PUBLIC_SITE_URL, env);
    if (p) problems.push(`NEXT_PUBLIC_SITE_URL ${p}.`);
  }
  if (env === 'production' && e.NEXT_PUBLIC_CONTENT_AUDIT === '1')
    problems.push(
      'NEXT_PUBLIC_CONTENT_AUDIT must be off in production (it shows placeholder chips).',
    );
  return problems;
}

/**
 * Content Security Policy for the prerendered site. Next.js inlines small bootstrap
 * scripts, and nonce-based CSP would force every page to render dynamically, so
 * scripts and styles allow 'unsafe-inline'; everything else is locked to this origin
 * plus the quote API.
 */
export function contentSecurityPolicy(env: Env): string {
  const api = resolveDeployment(env).quoteApiUrl;
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${api ? ` ${api}` : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(env.NEXT_PUBLIC_DEPLOY_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

export function securityHeaders(env: Env): Array<{ key: string; value: string }> {
  const headers = [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(env) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    },
  ];
  if (env.NEXT_PUBLIC_DEPLOY_ENV === 'production')
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains',
    });
  return headers;
}
