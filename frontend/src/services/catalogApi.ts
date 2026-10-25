import type { MediaCategory, MediaPage } from "../types/media";
import { apiBaseUrl } from "./apiBaseUrl";

export interface CatalogQuery {
  category?: MediaCategory;
  q?: string;
  page?: number;
  limit?: number;
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
