// Same switch as apps/frontend/src/components/layout/site.metadata.ts.
// Unset means on: the marketing site stays noindex. SITE_STEALTH=false
// turns indexing on. Do not set it in wrangler.jsonc.
export function siteStealth(env = process.env) {
  return String(env?.SITE_STEALTH ?? 'true').trim().toLowerCase() !== 'false';
}
