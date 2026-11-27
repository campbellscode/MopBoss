import { Bodoni_Moda, Poppins, Unbounded } from 'next/font/google';

/*
 * next/font self-hosts the files and generates size-adjusted fallbacks,
 * so text does not shift when the web fonts arrive.
 */

/** Display: Unbounded, used at 500, 700 and 900. Variable font, one file. */
export const unbounded = Unbounded({
  subsets: ['latin'],
  variable: '--font-unbounded',
  display: 'swap',
});

/** Accent: Bodoni Moda italic, used at 600 and 800. Variable font, italic only. */
export const bodoni = Bodoni_Moda({
  subsets: ['latin'],
  style: ['italic'],
  variable: '--font-bodoni',
  display: 'swap',
});

/** Body: Poppins 400, 500, 600, 700 (not a variable font). */
export const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

export const fontVariables = `${unbounded.variable} ${bodoni.variable} ${poppins.variable}`;
