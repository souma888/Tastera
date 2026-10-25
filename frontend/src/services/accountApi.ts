import type { LibraryActivity, MediaCategory, RecommendationPage, SavedMedia, SavedMediaUpdate } from "../types/media";

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
  const response = await request<{ items: SavedMedia[] }>(
    "/me/saved",
    authorized(token),
  );
  return response.items;
}

export async function getLibraryActivity(token: string, limit = 20) {
  const response = await request<{ items: LibraryActivity[] }>(
    `/me/saved/activity?limit=${limit}`,
    authorized(token),
  );
  return response.items;
}

export function getRecommendations(
  token: string,
  signal?: AbortSignal,
  offset = 0,
  excludeIds: string[] = [],
  category?: MediaCategory,
  strategy: "auto" | "genre" | "item_item" = "auto",
  limit = 20,
) {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset), strategy });
  if (category) query.set("category", category);
  excludeIds.forEach((id) => query.append("exclude_ids", id));
  return request<RecommendationPage>(`/me/recommendations?${query.toString()}`, {
    ...authorized(token),
    signal,
  });
}

export function setRecommendationFeedback(
  token: string,
  mediaId: string,
  feedback: "more" | "less",
) {
  return request<{ media_id: string; feedback: "more" | "less" }>(
    `/me/recommendations/feedback/${encodeURIComponent(mediaId)}`,
    {
      ...authorized(token, "PUT"),
      body: JSON.stringify({ feedback }),
    },
  );
}

export function clearRecommendationFeedback(token: string, mediaId: string) {
  return request<void>(
    `/me/recommendations/feedback/${encodeURIComponent(mediaId)}`,
    authorized(token, "DELETE"),
  );
}

export function saveMedia(token: string, mediaId: string) {
  return request<SavedMedia>(`/me/saved/${encodeURIComponent(mediaId)}`, {
    ...authorized(token, "PUT"),
  });
}

export function updateSavedMedia(token: string, mediaId: string, update: SavedMediaUpdate) {
  return request<SavedMedia>(`/me/saved/${encodeURIComponent(mediaId)}`, {
    ...authorized(token, "PATCH"),
    body: JSON.stringify(update),
  });
}

export function removeSavedMedia(token: string, mediaId: string) {
  return request<void>(`/me/saved/${encodeURIComponent(mediaId)}`, {
    ...authorized(token, "DELETE"),
  });
}
