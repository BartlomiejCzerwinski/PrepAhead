/**
 * Server-side theme cookie options, shared by the routes/middleware that seed
 * the `theme` cookie (sign-in reconcile, /app cross-device restore). Kept in
 * sync with the client-readable cookie written by `writeThemeCookie` in
 * `client.ts`: same name, ~1yr lifetime, SameSite=Lax, NOT HttpOnly so the
 * anti-FOUC inline script can read it before first paint.
 */
export const THEME_COOKIE_OPTIONS = {
	path: '/',
	maxAge: 60 * 60 * 24 * 365,
	sameSite: 'lax',
} as const;
