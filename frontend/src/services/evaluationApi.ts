import { apiBaseUrl } from "./apiBaseUrl";

export type EvaluationMethod = {
  hit_rate_at_k: number;
  precision_at_k: number;
  recall_at_k: number;
  ndcg_at_k: number;
  catalog_coverage: number;
  mean_intra_list_diversity: number;
};

export type EvaluationCategoryReport = {
  category: string;
  k: number;
  catalog_items: number;
  embedding_catalog_coverage: number;
  method_results: Record<string, EvaluationMethod>;
  status: string;
  available: boolean;
};

export async function getEvaluationReport(category: string, k: number, signal?: AbortSignal) {
  const query = new URLSearchParams({ category, k: String(k) });
  const response = await fetch(`${apiBaseUrl}/evaluation/recommendations?${query}`, { signal });
  if (!response.ok) throw new Error(`Evaluation report could not be loaded (${response.status}).`);
  return (await response.json()) as { reports: EvaluationCategoryReport[] };
}
