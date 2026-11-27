// Runs a Next.js command with content-audit mode on, on any OS:
//   node scripts/with-audit.mjs dev | build
import { spawn } from 'node:child_process';

const child = spawn('npx', ['next', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  // An audit build is a local review build: explicitly development + demo unless the
  // caller says otherwise. The build guard still refuses audit mode in production.
  env: {
    NEXT_PUBLIC_DEPLOY_ENV: 'development',
    NEXT_PUBLIC_QUOTE_MODE: 'demo',
    ...process.env,
    NEXT_PUBLIC_CONTENT_AUDIT: '1',
  },
});
child.on('exit', (code) => process.exit(code ?? 1));
