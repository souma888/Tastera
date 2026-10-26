import type { Media, MediaCategory, MediaPage } from "../types/media";
import { apiBaseUrl } from "./apiBaseUrl";

export interface CatalogQuery {
  category?: MediaCategory;
  q?: string;
  page?: number;
  limit?: number;
}

export interface SemanticSearchPage {
  query: string;
  model: string;
  items: { item: MediaPage["items"][number]; similarity: number }[];
  total: number;
}

export interface MediaRelationship { type: string; provenance: string; source_url: string | null; confidence: number; item: Media }

export async function getMediaRelationships(mediaId: string, signal?: AbortSignal): Promise<MediaRelationship[]> {
  const response = await fetch(`${apiBaseUrl}/media/${encodeURIComponent(mediaId)}/relationships`, { signal });
  if (!response.ok) throw new Error(`Relationship request failed with status ${response.status}.`);
  return response.json() as Promise<MediaRelationship[]>;
}

export async function getCanonicalCreator(query: string, signal?: AbortSignal): Promise<string> {
  const parameters = new URLSearchParams({ query });
  const response = await fetch(`${apiBaseUrl}/media/creators/aliases?${parameters}`, { signal });
  if (!response.ok) return query;
  const result = await response.json() as { canonical_name?: string };
  return result.canonical_name || query;
}

export async function getCatalog(
  query: CatalogQuery,
  signal?: AbortSignal,
): Promise<MediaPage> {
  const parameters = new URLSearchParams();

  if (query.category) parameters.set("category", query.category);
  if (query.q) parameters.set("q", query.q);
  if (query.page) parameters.set("page", String(query.page));
  if (query.limit) parameters.set("limit", String(query.limit));

  const response = await fetch(`${apiBaseUrl}/media?${parameters}`, { signal });
  if (!response.ok) {
    throw new Error(`Catalog request failed with status ${response.status}.`);
  }

  return response.json() as Promise<MediaPage>;
}

export async function getSemanticCatalog(
  query: string,
  options: { category?: MediaCategory; limit?: number; signal?: AbortSignal; excludeIds?: string[] } = {},
): Promise<SemanticSearchPage> {
  const parameters = new URLSearchParams({ q: query, limit: String(options.limit ?? 50) });
  if (options.category) parameters.set("category", options.category);
  options.excludeIds?.forEach((id) => parameters.append("exclude_ids", id));
  const response = await fetch(`${apiBaseUrl}/media/semantic?${parameters}`, { signal: options.signal });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Semantic search failed (${response.status}).`);
  }
  return response.json() as Promise<SemanticSearchPage>;
}
