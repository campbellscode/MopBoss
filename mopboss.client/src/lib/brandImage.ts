import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** The logo as a data URL for next/og images. Read once, at build time. */
export const logoDataUrl = `data:image/png;base64,${(
  await readFile(join(process.cwd(), 'src/assets/brand/mopboss-logo.png'))
).toString('base64')}`;
