/**
 * Content-audit mode.
 *
 * Build or run with NEXT_PUBLIC_CONTENT_AUDIT=1 to show the gold placeholder chips
 * from the prototype wherever a fact is still missing. Without it (every normal
 * production build) missing facts render nothing and empty sections are omitted.
 *
 * The value is inlined at build time, so audit mode never ships by accident.
 */
export const contentAudit = process.env.NEXT_PUBLIC_CONTENT_AUDIT === '1';
