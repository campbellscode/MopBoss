// Production build for the Playwright suite: the quote form points at a fake local API
// that the tests intercept. Never deploy this build.
import { spawn } from 'node:child_process';

const child = spawn('npx', ['next', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NEXT_PUBLIC_DEPLOY_ENV: 'preview',
    NEXT_PUBLIC_QUOTE_MODE: 'live',
    NEXT_PUBLIC_QUOTE_API_URL: 'http://127.0.0.1:5999',
    NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3100',
    NEXT_PUBLIC_CONTENT_AUDIT: '0',
  },
});
child.on('exit', (code) => process.exit(code ?? 1));
