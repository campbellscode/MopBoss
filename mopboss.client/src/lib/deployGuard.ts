/**
 * Launch guard and response headers, used by next.config.ts. Kept here so it is unit-tested.
 */

type Env = Record<string, string | undefined>;

const httpsOrigin = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
};

/**
 * A production build must never ship the demo quote form, audit chips or localhost URLs.
 * Returns the problems; next.config.ts refuses to build when there are any.
 */
export function deployProblems(env: Env): string[] {
  if (env.NEXT_PUBLIC_DEPLOY_ENV !== 'production') return [];
  const problems: string[] = [];
  if (!httpsOrigin(env.NEXT_PUBLIC_QUOTE_API_URL))
    problems.push(
      'NEXT_PUBLIC_QUOTE_API_URL must be the https address of MopBoss.Server (otherwise quote requests go nowhere).',
    );
  if (!httpsOrigin(env.NEXT_PUBLIC_SITE_URL))
    problems.push('NEXT_PUBLIC_SITE_URL must be the https address of the live site.');
  if (env.NEXT_PUBLIC_CONTENT_AUDIT === '1')
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
  const api =
    httpsOrigin(env.NEXT_PUBLIC_QUOTE_API_URL) ?? safeOrigin(env.NEXT_PUBLIC_QUOTE_API_URL);
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

function safeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}
