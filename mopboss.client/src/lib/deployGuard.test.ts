import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, deployProblems, securityHeaders } from './deployGuard';

const production = {
  NEXT_PUBLIC_DEPLOY_ENV: 'production',
  NEXT_PUBLIC_QUOTE_API_URL: 'https://api.example.test',
  NEXT_PUBLIC_SITE_URL: 'https://www.example.test',
};

describe('production launch guard', () => {
  it('accepts a complete production configuration', () => {
    expect(deployProblems(production)).toEqual([]);
  });

  it('refuses a production build that would fall back to the demo form', () => {
    expect(deployProblems({ ...production, NEXT_PUBLIC_QUOTE_API_URL: undefined })).toHaveLength(1);
    expect(
      deployProblems({ ...production, NEXT_PUBLIC_QUOTE_API_URL: 'http://api.example.test' }),
    ).toHaveLength(1);
  });

  it('refuses localhost-style site URLs and audit mode in production', () => {
    expect(
      deployProblems({ ...production, NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }),
    ).toHaveLength(1);
    expect(deployProblems({ ...production, NEXT_PUBLIC_CONTENT_AUDIT: '1' })).toHaveLength(1);
  });

  it('leaves development and preview builds alone', () => {
    expect(deployProblems({})).toEqual([]);
    expect(deployProblems({ NEXT_PUBLIC_DEPLOY_ENV: 'preview' })).toEqual([]);
  });
});

describe('security headers', () => {
  it('allows the quote API in connect-src and blocks framing and plugins', () => {
    const csp = contentSecurityPolicy(production);
    expect(csp).toContain("connect-src 'self' https://api.example.test");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('adds HSTS only for production', () => {
    expect(securityHeaders(production).map((h) => h.key)).toContain('Strict-Transport-Security');
    expect(securityHeaders({}).map((h) => h.key)).not.toContain('Strict-Transport-Security');
  });
});
