import { describe, expect, it } from 'vitest';
import {
  contentSecurityPolicy,
  deployProblems,
  resolveDeployment,
  securityHeaders,
} from './deployGuard';

const production = {
  NEXT_PUBLIC_DEPLOY_ENV: 'production',
  NEXT_PUBLIC_QUOTE_API_URL: 'https://api.example.test',
  NEXT_PUBLIC_SITE_URL: 'https://www.example.test',
};
const preview = {
  NEXT_PUBLIC_DEPLOY_ENV: 'preview',
  NEXT_PUBLIC_QUOTE_API_URL: 'http://127.0.0.1:5999',
  NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3100',
};
const demo = { NEXT_PUBLIC_DEPLOY_ENV: 'development', NEXT_PUBLIC_QUOTE_MODE: 'demo' };

describe('build guard', () => {
  it('accepts complete production, preview, development and explicit demo builds', () => {
    expect(deployProblems(production)).toEqual([]);
    expect(deployProblems(preview)).toEqual([]);
    expect(deployProblems({ ...preview, NEXT_PUBLIC_DEPLOY_ENV: 'development' })).toEqual([]);
    expect(deployProblems(demo)).toEqual([]);
    expect(deployProblems({ ...demo, NEXT_PUBLIC_DEPLOY_ENV: 'preview' })).toEqual([]);
  });

  it('fails closed when the deployment is missing or misspelt', () => {
    expect(deployProblems({})).toEqual([expect.stringContaining('must be set')]);
    expect(deployProblems({ ...production, NEXT_PUBLIC_DEPLOY_ENV: 'prod' })).toEqual([
      expect.stringContaining('got "prod"'),
    ]);
    expect(deployProblems({ ...production, NEXT_PUBLIC_DEPLOY_ENV: 'Production' })).toHaveLength(1);
  });

  it('never silently becomes a demo', () => {
    // No API URL and no explicit demo: refused in every environment.
    for (const env of ['development', 'preview', 'production'])
      expect(
        deployProblems({ NEXT_PUBLIC_DEPLOY_ENV: env, NEXT_PUBLIC_SITE_URL: 'https://a.test' }),
      ).toEqual([expect.stringContaining('NEXT_PUBLIC_QUOTE_API_URL is not set')]);
    expect(
      deployProblems({
        ...production,
        NEXT_PUBLIC_QUOTE_MODE: 'demo',
        NEXT_PUBLIC_QUOTE_API_URL: '',
      }),
    ).toEqual([expect.stringContaining('not allowed in production')]);
    expect(deployProblems({ ...demo, NEXT_PUBLIC_QUOTE_API_URL: 'http://localhost:5000' })).toEqual(
      [expect.stringContaining('must not be combined')],
    );
    expect(deployProblems({ ...preview, NEXT_PUBLIC_QUOTE_MODE: 'offline' })).toEqual([
      expect.stringContaining('must be live or demo'),
    ]);
  });

  it('refuses unsafe production URLs and audit mode', () => {
    const bad = (patch: Record<string, string>) => deployProblems({ ...production, ...patch });
    expect(bad({ NEXT_PUBLIC_QUOTE_API_URL: 'http://api.example.test' })).toHaveLength(1);
    expect(bad({ NEXT_PUBLIC_QUOTE_API_URL: 'https://localhost:7001' })).toHaveLength(1);
    expect(bad({ NEXT_PUBLIC_QUOTE_API_URL: 'https://127.0.0.1' })).toHaveLength(1);
    expect(bad({ NEXT_PUBLIC_QUOTE_API_URL: 'https://api.localhost' })).toHaveLength(1);
    expect(bad({ NEXT_PUBLIC_QUOTE_API_URL: 'https://user:pw@api.example.test' })).toHaveLength(1);
    expect(bad({ NEXT_PUBLIC_QUOTE_API_URL: 'not a url' })).toHaveLength(1);
    expect(bad({ NEXT_PUBLIC_QUOTE_API_URL: 'ftp://api.example.test' })).toHaveLength(1);
    expect(bad({ NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' })).toHaveLength(1);
    expect(bad({ NEXT_PUBLIC_SITE_URL: '' })).toHaveLength(1);
    expect(bad({ NEXT_PUBLIC_CONTENT_AUDIT: '1' })).toHaveLength(1);
  });

  it('allows plain http in preview only for a loopback test API', () => {
    expect(
      deployProblems({ ...preview, NEXT_PUBLIC_QUOTE_API_URL: 'http://api.example.test' }),
    ).toEqual([expect.stringContaining('https in preview')]);
    expect(
      deployProblems({ ...preview, NEXT_PUBLIC_QUOTE_API_URL: 'https://api.example.test' }),
    ).toEqual([]);
  });
});

describe('runtime resolution', () => {
  it('uses the API origin when the settings are valid', () => {
    expect(
      resolveDeployment({ ...production, NEXT_PUBLIC_QUOTE_API_URL: 'https://api.example.test/' }),
    ).toEqual({ env: 'production', mode: 'live', quoteApiUrl: 'https://api.example.test' });
  });

  it('is demo only when asked for explicitly, outside production', () => {
    expect(resolveDeployment(demo).mode).toBe('demo');
    expect(resolveDeployment({ ...demo, NEXT_PUBLIC_DEPLOY_ENV: 'production' }).mode).toBe(
      'unavailable',
    );
  });

  it('fails closed on anything missing, misspelt or unsafe', () => {
    expect(resolveDeployment({})).toEqual({ env: null, mode: 'unavailable', quoteApiUrl: null });
    expect(resolveDeployment({ ...production, NEXT_PUBLIC_DEPLOY_ENV: undefined }).mode).toBe(
      'unavailable',
    );
    expect(resolveDeployment({ NEXT_PUBLIC_DEPLOY_ENV: 'development' }).mode).toBe('unavailable');
    expect(
      resolveDeployment({ ...production, NEXT_PUBLIC_QUOTE_API_URL: 'http://localhost:5000' }).mode,
    ).toBe('unavailable');
    expect(resolveDeployment({ ...preview, NEXT_PUBLIC_QUOTE_MODE: 'offline' }).mode).toBe(
      'unavailable',
    );
  });
});

describe('security headers', () => {
  it('allows the quote API in connect-src and blocks framing and plugins', () => {
    const csp = contentSecurityPolicy(production);
    expect(csp).toContain("connect-src 'self' https://api.example.test;");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('allows the loopback test API in a preview build, and nothing extra in demo', () => {
    expect(contentSecurityPolicy(preview)).toContain("connect-src 'self' http://127.0.0.1:5999;");
    expect(contentSecurityPolicy(demo)).toContain("connect-src 'self';");
  });

  it('adds HSTS only for production', () => {
    expect(securityHeaders(production).map((h) => h.key)).toContain('Strict-Transport-Security');
    expect(securityHeaders({}).map((h) => h.key)).not.toContain('Strict-Transport-Security');
  });
});
