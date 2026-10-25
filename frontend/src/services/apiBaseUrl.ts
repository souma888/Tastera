/**
 * Production calls stay on the Vercel origin and are rewritten to the Render
 * API by vercel.json. This prevents the browser from blocking authenticated
 * requests because of a cross-origin preflight.
 *
 * Keep production same-origin even if VITE_API_BASE_URL is configured with an
 * absolute Render URL. That environment override bypasses the Vercel rewrite
 * and can cause browser fetch/CORS failures.
 */
const configuredApiBaseUrl = import.meta.env.PROD
  ? "/api/v1"
  : (import.meta.env.VITE_API_BASE_URL ?? "/api/v1");

export const apiBaseUrl = configuredApiBaseUrl.replace(/\/$/, "");
