import { useEffect, useState } from "react";
import { getEvaluationReport, type EvaluationCategoryReport } from "../services/evaluationApi";
import "./EvaluationDashboard.css";

const methodLabels: Record<string, string> = {
  genre: "Genre baseline",
  item_item: "Item-item",
  embeddings: "Sentence embeddings",
};
const methodColors: Record<string, string> = {
  genre: "#9b83cc",
  item_item: "#6ab9b0",
  embeddings: "#efa96f",
};

function percentage(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function EvaluationDashboard() {
  const [category, setCategory] = useState("Movies");
  const [k, setK] = useState(12);
  const [loadState, setLoadState] = useState<{ key: string; report: EvaluationCategoryReport | null; error: string }>({ key: "", report: null, error: "" });
  const requestKey = `${category}:${k}`;

  useEffect(() => {
    const controller = new AbortController();
    void getEvaluationReport(category, k, controller.signal)
      .then((result) => setLoadState({ key: requestKey, report: result.reports[0] ?? null, error: "" }))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setLoadState({ key: requestKey, report: null, error: reason instanceof Error ? reason.message : "Evaluation report could not be loaded." });
      });
    return () => controller.abort();
  }, [category, k, requestKey]);

  const isCurrent = loadState.key === requestKey;
  const loading = !isCurrent;
  const error = isCurrent ? loadState.error : "";
  const report = isCurrent ? loadState.report : null;

  const methods = report?.method_results ?? {};
  const methodNames = Object.keys(methods);
  const chart = (metric: "precision_at_k" | "catalog_coverage", heading: string, caption: string) => (
    <section className="ml-chart-card" aria-label={heading}>
      <div className="ml-chart-heading"><div><span className="eyebrow">MODEL COMPARISON</span><h2>{heading}</h2></div><span>Higher is better</span></div>
      <p>{caption}</p>
      {methodNames.length ? <div className="ml-bars">
        {methodNames.map((name) => <div className="ml-bar-row" key={name}>
          <span className="ml-bar-label">{methodLabels[name] ?? name}</span>
          <div className="ml-bar-track" role="img" aria-label={`${methodLabels[name] ?? name}: ${percentage(methods[name][metric])}`}>
            <span className="ml-bar-fill" style={{ width: percentage(methods[name][metric]), background: methodColors[name] ?? "#9b83cc" }} />
          </div>
          <strong>{percentage(methods[name][metric])}</strong>
        </div>)}
      </div> : <div className="ml-chart-empty"><strong>Waiting for enough {category.toLowerCase()} activity</strong><span>To protect privacy, Tastera only shows these aggregate scores after at least five accounts have enough positive signals in this category. Try another category, or check back as the community grows.</span></div>}
    </section>
  );

  return (
    <section className="ml-lab-page" aria-labelledby="ml-lab-title">
      <header className="ml-lab-hero">
        <div><span className="eyebrow">TASTERA · MODEL EVALUATION</span><h1 id="ml-lab-title">The ML lab.</h1><p>Choose a media category to compare recommendation methods on that category’s catalog and account activity. These are offline experiments, not your personal recommendations.</p></div>
        <div className="ml-lab-controls">
          <label><span>1. Choose what to evaluate</span><select aria-label="Choose a media category to evaluate" value={category} onChange={(event) => setCategory(event.target.value)}><option>Movies</option><option>TV</option><option>Books</option><option>Music</option><option>Games</option><option>Podcasts</option></select></label>
          <label><span>2. Results per list (K)</span><select aria-label="Choose the number of recommendations evaluated" value={k} onChange={(event) => setK(Number(event.target.value))}><option value={5}>5</option><option value={10}>10</option><option value={12}>12</option><option value={20}>20</option></select></label>
        </div>
      </header>
      <p className="ml-lab-instructions"><strong>How to use this page:</strong> Choose a category above, then choose K. Tastera compares its available recommendation methods for that selection. A category with too little account activity will show a privacy-safe explanation instead of scores.</p>
      {loading ? <div className="ml-status" role="status">Loading aggregate evaluation…</div>
        : error ? <div className="ml-status ml-status-error" role="alert">{error}</div>
        : !report ? <div className="ml-status">No report is available for this category.</div>
        : <>
          <div className="ml-report-strip"><span><b>{report.catalog_items.toLocaleString()}</b> catalog items</span><span><b>{percentage(report.embedding_catalog_coverage)}</b> embedded</span><span><b>Top {report.k}</b> ranking</span></div>
          {!report.available && <div className="ml-status">{report.status} Results stay hidden until the minimum cohort is met.</div>}
          {report.available && report.embedding_catalog_coverage < 1 && <div className="ml-status">Embedding comparison is hidden until every item in this category has a current vector. Run the catalog embedding command after applying the pgvector migration.</div>}
          <div className="ml-charts-grid">
            {chart("precision_at_k", `Precision@${report.k}`, "Share of the top-ranked slots that match later positive user signals.")}
            {chart("catalog_coverage", "Catalog coverage", "Share of catalog items that appear in at least one account’s top-K list.")}
          </div>
          {methodNames.length > 0 && <section className="ml-metrics-card"><div className="ml-chart-heading"><div><span className="eyebrow">FULL SCORECARD</span><h2>More than one quality signal</h2></div></div>
            <div className="ml-table-scroll"><table><thead><tr><th>Method</th><th>Precision@K</th><th>Recall@K</th><th>NDCG@K</th><th>Coverage</th><th>Diversity</th></tr></thead><tbody>
              {methodNames.map((name) => <tr key={name}><th>{methodLabels[name] ?? name}</th><td>{percentage(methods[name].precision_at_k)}</td><td>{percentage(methods[name].recall_at_k)}</td><td>{percentage(methods[name].ndcg_at_k)}</td><td>{percentage(methods[name].catalog_coverage)}</td><td>{percentage(methods[name].mean_intra_list_diversity)}</td></tr>)}
            </tbody></table></div>
          </section>}
          <p className="ml-caveat">{report.status} These are offline, interaction-based proxy metrics. The app does not record recommendation impressions, so they are not online relevance measurements. Embedding similarity is metadata similarity, not proof that a person will like an item.</p>
        </>}
    </section>
  );
}
