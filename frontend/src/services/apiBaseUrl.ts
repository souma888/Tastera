const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

// Production calls stay same-origin; Vercel proxies /api/v1 to Render.
// Local development can still use VITE_API_BASE_URL or Vite's /api proxy.
export const apiBaseUrl = (
  import.meta.env.PROD ? "/api/v1" : configuredApiBaseUrl
).replace(/\/$/, "");
