import type { LibraryActivity, MediaCategory, RecommendationPage, SavedMedia, SavedMediaUpdate } from "../types/media";
import { apiBaseUrl } from "./apiBaseUrl";

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

export class AccountApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AccountApiError";
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const retryable = ["GET", "PUT", "PATCH", "DELETE"].includes(method) || path === "/auth/login";
  let response: Response | undefined;
  for (let attempt = 0; attempt < (retryable ? 2 : 1); attempt += 1) {
    try {
      response = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers,
        },
      });
      if (attempt === 0 && retryable && [500, 502, 503, 504].includes(response.status)) {
        await new Promise((resolve) => window.setTimeout(resolve, 350));
        continue;
      }
      break;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      if (!retryable || attempt > 0) {
        throw new Error("Tastera could not reach the account service. Your saved items have not been removed; check your connection and retry.", { cause: error });
      }
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    }
  }

  if (!response) throw new Error("Tastera could not reach the account service. Your saved items have not been removed; check your connection and retry.");

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { detail?: string }
      | null;
    throw new AccountApiError(body?.detail ?? `Request failed (${response.status}).`, response.status);
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

export function exportAccountData(token: string) {
  return request<Record<string, unknown>>("/auth/me/export", authorized(token));
}

export function deleteAccount(token: string) {
  return request<void>("/auth/me", authorized(token, "DELETE"));
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
