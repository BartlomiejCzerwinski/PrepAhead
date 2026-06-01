/** Public site origin for canonical URLs (no trailing slash). */
export function getSiteOrigin(): string {
  const raw = import.meta.env.PUBLIC_SITE_URL?.trim();
  if (raw) {
    return raw.replace(/\/$/, '');
  }
  return 'http://localhost:4321';
}
