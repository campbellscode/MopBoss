// Proves `next build` refuses unsafe or ambiguous deployments. Each case must fail at
// config load (fast, before compiling) with "Refusing to build". Successful builds are
// exercised by the real production and preview builds in CI.
import { spawnSync } from 'node:child_process';

const prodOk = {
  NEXT_PUBLIC_DEPLOY_ENV: 'production',
  NEXT_PUBLIC_QUOTE_API_URL: 'https://api.example.invalid',
  NEXT_PUBLIC_SITE_URL: 'https://www.example.invalid',
};

const cases = {
  'deploy env omitted': { ...prodOk, NEXT_PUBLIC_DEPLOY_ENV: undefined },
  'deploy env invalid': { ...prodOk, NEXT_PUBLIC_DEPLOY_ENV: 'prod' },
  'production without API URL': { ...prodOk, NEXT_PUBLIC_QUOTE_API_URL: undefined },
  'production with http API': {
    ...prodOk,
    NEXT_PUBLIC_QUOTE_API_URL: 'http://api.example.invalid',
  },
  'production with local API': { ...prodOk, NEXT_PUBLIC_QUOTE_API_URL: 'https://localhost:7001' },
  'production demo mode': {
    ...prodOk,
    NEXT_PUBLIC_QUOTE_API_URL: undefined,
    NEXT_PUBLIC_QUOTE_MODE: 'demo',
  },
  'production audit mode': { ...prodOk, NEXT_PUBLIC_CONTENT_AUDIT: '1' },
  'preview with http non-local API': {
    NEXT_PUBLIC_DEPLOY_ENV: 'preview',
    NEXT_PUBLIC_QUOTE_API_URL: 'http://api.example.invalid',
  },
  'development without API or demo': { NEXT_PUBLIC_DEPLOY_ENV: 'development' },
};

const managed = [
  'NEXT_PUBLIC_DEPLOY_ENV',
  'NEXT_PUBLIC_QUOTE_MODE',
  'NEXT_PUBLIC_QUOTE_API_URL',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_CONTENT_AUDIT',
];

let failed = false;
for (const [name, vars] of Object.entries(cases)) {
  const env = { ...process.env };
  for (const key of managed) delete env[key];
  for (const [key, value] of Object.entries(vars)) if (value !== undefined) env[key] = value;
  const run = spawnSync('npx', ['next', 'build'], { env, shell: true, encoding: 'utf8' });
  const output = `${run.stdout}${run.stderr}`;
  const refused = run.status !== 0 && output.includes('Refusing to build');
  console.log(`${refused ? 'refused' : 'NOT REFUSED'}  ${name}`);
  if (!refused) {
    failed = true;
    console.log(output.slice(-2000));
  }
}
process.exit(failed ? 1 : 0);
