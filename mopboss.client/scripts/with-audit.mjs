// Runs a Next.js command with content-audit mode on, on any OS:
//   node scripts/with-audit.mjs dev | build
import { spawn } from 'node:child_process';

const child = spawn('npx', ['next', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NEXT_PUBLIC_CONTENT_AUDIT: '1' },
});
child.on('exit', (code) => process.exit(code ?? 1));
