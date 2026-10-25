/**
 * Production calls stay on the Vercel origin and are rewritten to the Render
 * API by vercel.json. This prevents the browser from blocking authenticated
 * requests because of a cross-origin preflight.
 */
export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "/api/v1").replace(
  /\/$/,
  "",
);
