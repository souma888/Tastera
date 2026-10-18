import type { Media } from "../types/media";

export interface Account {
  id: string;
  email: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  account: Account;
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "/api/v1").replace(
  /\/$/,
  "",
);

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { detail?: string }
      | null;
    throw new Error(body?.detail ?? `Request failed (${response.status}).`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function authorized(token: string, method = "GET"): RequestInit {
  return {
    method,
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  };
}

export function registerAccount(email: string, password: string) {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function signIn(email: string, password: string) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getCurrentAccount(token: string) {
  return request<Account>("/auth/me", authorized(token));
}

export async function getSavedMedia(token: string) {
  const response = await request<{ items: Media[] }>(
    "/me/saved",
    authorized(token),
  );
  return response.items;
}

export function saveMedia(token: string, mediaId: string) {
  return request<Media>(`/me/saved/${encodeURIComponent(mediaId)}`, {
    ...authorized(token, "PUT"),
  });
}

export function removeSavedMedia(token: string, mediaId: string) {
  return request<void>(`/me/saved/${encodeURIComponent(mediaId)}`, {
    ...authorized(token, "DELETE"),
  });
}
