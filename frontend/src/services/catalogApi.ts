import type { MediaCategory, MediaPage } from "../types/media";

export interface CatalogQuery {
  category?: MediaCategory;
  q?: string;
  page?: number;
  limit?: number;
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "/api/v1").replace(
  /\/$/,
  "",
);

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
