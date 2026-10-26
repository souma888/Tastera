import { useEffect, useMemo, useState } from "react";
import { getCatalog, getSemanticCatalog } from "../services/catalogApi";
import { explainConnection, type ConnectionExplanation } from "../services/aiApi";
import type { Media } from "../types/media";
import "./ConnectionExplorer.css";

type Activity = { item: Media; feedback?: "more" | "less" };
type Props = {
  item?: Media | null;
  creator?: string | null;
  theme?: string | null;
  catalog: Media[];
  savedItems: Media[];
  feedbackItems: Activity[];
  authToken: string | null;
  onRequireSignIn: () => void;
  onToggleSaved: (id: string) => void;
  onClose: () => void;
};
type LinkEvidence = { label: string; detail: string; strength: number };
type CatalogLookup = { key: string; items: Media[] };

const editorialThemes = [
  "family", "time", "memory", "language", "identity", "human connection", "power", "change",
  "society", "freedom", "possibility", "technology", "loneliness", "choice", "belonging",
  "culture", "space", "atmosphere", "dreamy", "nocturnal", "cinematic", "adventure", "survival",
  "reality", "intelligence", "emotion", "intimacy", "wonder", "community", "music",
];

function normalizeGenre(value: string) {
  const cleaned = value.toLowerCase().replace(/\bsci[ -]?fi\b/g, "science fiction").trim();
  return cleaned.split(/[,;|/]/).map((part) => part.trim()).filter(Boolean);
}

function creatorKey(value: string) {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function editorialText(item: Media) {
  const source = `${item.source ?? ""} ${item.connection}`.toLowerCase();
  if (/imported from|not been reviewed|not reviewed|core metadata/.test(source)) return "";
  return `${item.connection} ${item.description ?? ""}`.toLowerCase();
}

function findEvidence(source: Media, candidate: Media, activeIds: Set<string>): LinkEvidence[] {
  const evidence: LinkEvidence[] = [];
  if (creatorKey(source.creator) && creatorKey(source.creator) === creatorKey(candidate.creator)) {
    evidence.push({ label: "Shared creator", detail: `Both are credited to ${candidate.creator}.`, strength: 5 });
  }
  const commonGenres = normalizeGenre(source.genre).filter((genre) => normalizeGenre(candidate.genre).includes(genre));
  commonGenres.forEach((genre) => evidence.push({ label: "Shared catalog genre", detail: `Both catalog records are tagged ${genre}.`, strength: 4 }));

  const sourceNotes = editorialText(source);
  const candidateNotes = editorialText(candidate);
  const themes = editorialThemes.filter((theme) => sourceNotes.includes(theme) && candidateNotes.includes(theme));
  themes.slice(0, 2).forEach((theme) => evidence.push({
    label: "Shared editorial theme",
    detail: `“${theme}” appears in both Tastera editorial notes.`,
    strength: 2,
  }));

  if (activeIds.has(candidate.id)) {
    evidence.push({ label: "Your activity", detail: "This item is already in your Library or recommendation feedback.", strength: 1 });
  }
  return evidence;
}

function mergeMedia(...groups: Media[][]) {
  return [...new Map(groups.flat().map((item) => [item.id, item])).values()];
}

export default function ConnectionExplorer({ item, creator, theme, catalog, savedItems, feedbackItems, authToken, onRequireSignIn, onToggleSaved, onClose }: Props) {
  const [activeItem, setActiveItem] = useState<Media | null>(item ?? null);
  const [creatorPage, setCreatorPage] = useState(creator ?? null);
  const [themePage, setThemePage] = useState(theme ?? null);
  const [lookup, setLookup] = useState<CatalogLookup>({ key: "", items: [] });
  const [explanations, setExplanations] = useState<Record<string, ConnectionExplanation>>({});
  const [explanationBusy, setExplanationBusy] = useState<string[]>([]);
  const [explanationErrors, setExplanationErrors] = useState<Record<string, string>>({});
  const [semanticLookup, setSemanticLookup] = useState<{ itemId: string; items: { item: Media; similarity: number }[] } | null>(null);
  const [semanticError, setSemanticError] = useState<string | null>(null);

  async function requestExplanation(targetId: string) {
    if (!authToken || !activeItem) return;
    setExplanationBusy((current) => [...new Set([...current, targetId])]);
    setExplanationErrors((current) => ({ ...current, [targetId]: "" }));
    try {
      const result = await explainConnection(authToken, activeItem.id, targetId);
      setExplanations((current) => ({ ...current, [targetId]: result }));
    } catch (error) {
      setExplanationErrors((current) => ({ ...current, [targetId]: error instanceof Error ? error.message : "Could not generate an explanation." }));
    } finally {
      setExplanationBusy((current) => current.filter((id) => id !== targetId));
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const terms = creatorPage
      ? [creatorPage]
      : themePage
        ? [themePage]
      : activeItem
        ? [activeItem.genre, activeItem.creator]
        : [];
    const queries = [...new Set(terms.map((term) => term.trim()).filter((term) => term.length > 1))];
    if (!queries.length) return () => controller.abort();
    const key = queries.join("|").toLocaleLowerCase();
    void Promise.all(queries.map((q) => getCatalog({ q, limit: 150 }, controller.signal)))
      .then((pages) => setLookup({ key, items: pages.flatMap((page) => page.items) }))
      .catch(() => { if (!controller.signal.aborted) setLookup({ key, items: [] }); });
    return () => controller.abort();
  }, [activeItem, creatorPage, themePage]);

  useEffect(() => {
    if (!activeItem || creatorPage || themePage) return;
    const controller = new AbortController();
    const query = [activeItem.title, activeItem.creator, activeItem.category, activeItem.genre, activeItem.description]
      .filter(Boolean).join(". ").slice(0, 480);
    setSemanticError(null);
    getSemanticCatalog(query, { limit: 12, signal: controller.signal, excludeIds: [activeItem.id] })
      .then((page) => {
        setSemanticLookup({ itemId: activeItem.id, items: page.items.map(({ item: result, similarity }) => ({ item: result, similarity })) });
        setSemanticError(null);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setSemanticLookup({ itemId: activeItem.id, items: [] });
          setSemanticError(error instanceof Error ? error.message : "Semantic matches are temporarily unavailable.");
        }
      });
    return () => controller.abort();
  }, [activeItem, creatorPage, themePage]);

  const activeTerms = creatorPage ? [creatorPage] : themePage ? [themePage] : activeItem ? [activeItem.genre, activeItem.creator] : [];
  const activeLookupKey = [...new Set(activeTerms.map((term) => term.trim()).filter((term) => term.length > 1))].join("|").toLocaleLowerCase();
  const lookupItems = useMemo(() => lookup.key === activeLookupKey ? lookup.items : [], [lookup.key, lookup.items, activeLookupKey]);
  const isLoading = Boolean(activeLookupKey && lookup.key !== activeLookupKey);
  const allItems = useMemo(() => mergeMedia(catalog, lookupItems, activeItem ? [activeItem] : []), [catalog, lookupItems, activeItem]);
  const activeIds = useMemo(() => new Set([
    ...savedItems.map((saved) => saved.id),
    ...feedbackItems.map((entry) => entry.item.id),
  ]), [savedItems, feedbackItems]);
  const pathways = useMemo(() => {
    if (!activeItem) return [];
    return allItems
      .filter((candidate) => candidate.id !== activeItem.id)
      .map((candidate) => ({ item: candidate, evidence: findEvidence(activeItem, candidate, activeIds) }))
      .filter((entry) => entry.evidence.length > 0)
      .map((entry) => ({ ...entry, crossMedia: entry.item.category !== activeItem.category }))
      .sort((left, right) => Number(right.crossMedia) - Number(left.crossMedia) ||
        right.evidence.reduce((sum, evidence) => sum + evidence.strength, 0) - left.evidence.reduce((sum, evidence) => sum + evidence.strength, 0) ||
        left.item.title.localeCompare(right.item.title))
      .slice(0, 12);
  }, [activeItem, allItems, activeIds]);
  const creatorItems = useMemo(() => {
    if (!creatorPage) return [];
    const key = creatorKey(creatorPage);
    return allItems.filter((candidate) => creatorKey(candidate.creator) === key).sort((left, right) =>
      left.category.localeCompare(right.category) || left.title.localeCompare(right.title));
  }, [allItems, creatorPage]);
  const themeItems = useMemo(() => {
    if (!themePage) return [];
    return allItems.filter((candidate) => normalizeGenre(candidate.genre).includes(normalizeGenre(themePage)[0] ?? ""))
      .sort((left, right) => Number(activeIds.has(right.id)) - Number(activeIds.has(left.id)) || left.title.localeCompare(right.title));
  }, [allItems, themePage, activeIds]);
  const semanticResults = activeItem && semanticLookup?.itemId === activeItem.id ? semanticLookup.items : [];
  const semanticLoading = Boolean(activeItem && !creatorPage && !themePage && semanticLookup?.itemId !== activeItem.id);
  const crossMediaSemanticResults = semanticResults.filter(({ item: result }) => result.category !== activeItem?.category);

  return (
    <div className="connection-explorer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="connection-explorer" role="dialog" aria-modal="true" aria-label={creatorPage ? `${creatorPage} creator page` : `${activeItem?.title ?? "Discovery"} connections`}>
        <button type="button" className="connection-explorer-close" onClick={onClose} aria-label="Close connections">×</button>
        {themePage ? (
          <>
            <header className="connection-explorer-heading">
              <span className="eyebrow">CATALOG THEME · EXACT GENRE TAG</span>
              <h2>{themePage}</h2>
              <p>Items below have an exact normalized catalog genre match. Your saved and rated items are surfaced first.</p>
              <button type="button" className="connection-back-link" onClick={onClose}>← Back to Taste Map</button>
            </header>
            {isLoading && <p className="connection-loading">Finding catalog items in this genre…</p>}
            <div className="connection-results-grid">
              {themeItems.map((entry) => <button type="button" className="connection-result" key={entry.id} onClick={() => { setThemePage(null); setActiveItem(entry); }}>
                {entry.image ? <img src={entry.image} alt="" loading="lazy" /> : <span className="connection-result-placeholder">{entry.category}</span>}
                <span><small>{entry.category} · {entry.genre}{activeIds.has(entry.id) ? " · IN YOUR TASTE" : ""}</small><strong>{entry.title}</strong><em>{entry.creator}</em></span>
              </button>)}
            </div>
            {!isLoading && !themeItems.length && <p className="connection-empty">No exact catalog genre matches were found. This view will not broaden to unrelated genres.</p>}
            <p className="connection-evidence-note">Evidence: the genre label attached to each catalog record. Taste activity is displayed as context, not as proof of similarity.</p>
          </>
        ) : creatorPage ? (
          <>
            <header className="connection-explorer-heading">
              <span className="eyebrow">CREATOR PAGE · CATALOG CREDIT</span>
              <h2>{creatorPage}</h2>
              <p>Titles grouped by the same creator credit in Tastera’s catalog.</p>
              <button type="button" className="connection-back-link" onClick={() => {
                if (activeItem || item) { setCreatorPage(null); if (!activeItem) setActiveItem(item ?? null); }
                else onClose();
              }}>{activeItem || item ? "← Back to item" : "← Close creator page"}</button>
            </header>
            {isLoading && <p className="connection-loading">Finding catalog credits…</p>}
            <div className="connection-results-grid">
              {creatorItems.map((entry) => <button type="button" className="connection-result" key={entry.id} onClick={() => { setCreatorPage(null); setActiveItem(entry); }}>
                {entry.image ? <img src={entry.image} alt="" loading="lazy" /> : <span className="connection-result-placeholder">{entry.category}</span>}
                <span><small>{entry.category} · {entry.genre}</small><strong>{entry.title}</strong><em>{entry.creator}</em></span>
              </button>)}
            </div>
            {!isLoading && !creatorItems.length && <p className="connection-empty">No exact matching creator credits are loaded for this account/catalog view.</p>}
          </>
        ) : activeItem ? (
          <>
            <div className="connection-item-heading">
              {activeItem.image ? <img src={activeItem.image} alt="" /> : <div className="connection-result-placeholder">{activeItem.category}</div>}
              <div>
                <span className="eyebrow">{activeItem.category} · {activeItem.genre}</span>
                <h2>{activeItem.title}</h2>
                <button type="button" className="connection-creator-button" onClick={() => setCreatorPage(activeItem.creator)}>{activeItem.creator} · View creator page ↗</button>
                <p>{activeItem.description || activeItem.connection}</p>
                <button type="button" className="connection-save-button" onClick={() => onToggleSaved(activeItem.id)}>{activeIds.has(activeItem.id) && savedItems.some((saved) => saved.id === activeItem.id) ? "Saved to Library ✓" : "Save to Library ♡"}</button>
              </div>
            </div>
            <div className="connection-results-heading"><div><span className="eyebrow">FOLLOW A PATHWAY</span><h3>Related across movies, books & music</h3></div><span>{pathways.length} links</span></div>
            {isLoading && <p className="connection-loading">Checking the catalog for shared creators and genres…</p>}
            <div className="connection-results-grid">
              {pathways.map(({ item: entry, evidence }) => <article className="connection-result-card" key={entry.id}>
                <button type="button" className="connection-result" onClick={() => { setCreatorPage(null); setActiveItem(entry); }}>
                  {entry.image ? <img src={entry.image} alt="" loading="lazy" /> : <span className="connection-result-placeholder">{entry.category}</span>}
                  <span><small>{entry.category} · {entry.genre}</small><strong>{entry.title}</strong><em>{entry.creator}</em></span>
                </button>
                <ul>{evidence.slice(0, 3).map((link) => <li key={`${entry.id}-${link.label}-${link.detail}`}><b>{link.label}</b><span>{link.detail}</span></li>)}</ul>
                <div className="connection-ai-explanation">
                  {authToken ? <button type="button" onClick={() => void requestExplanation(entry.id)} disabled={explanationBusy.includes(entry.id)}>{explanationBusy.includes(entry.id) ? "Writing…" : explanations[entry.id] ? "Refresh explanation" : "Explain with AI"}</button>
                    : <button type="button" onClick={onRequireSignIn}>Sign in for an AI explanation</button>}
                  {explanations[entry.id] && <div className="connection-ai-result"><span className="eyebrow">{explanations[entry.id].generated ? "AI WORDING · EVIDENCE BELOW IS THE SOURCE OF TRUTH" : "GROUNDED EXPLANATION · AI PROVIDER UNAVAILABLE"}</span><p>{explanations[entry.id].explanation}</p><small>Evidence: {explanations[entry.id].evidence.map((fact) => `${fact.label}: ${fact.value}`).join(" · ") || "No structured relationship evidence was found."}</small></div>}
                  {explanationErrors[entry.id] && <small className="connection-ai-error" role="alert">{explanationErrors[entry.id]}</small>}
                </div>
              </article>)}
            </div>
            <div className="connection-semantic-section">
              <div className="connection-results-heading"><div><span className="eyebrow">MODEL-INFERRED SIMILARITY</span><h3>Related by meaning</h3></div><span>{crossMediaSemanticResults.length} matches</span></div>
              <p className="connection-semantic-note">These matches come from Sentence Transformer embeddings of catalog metadata. They suggest semantic similarity; they are not verified factual links or predictions of personal preference.</p>
              {semanticLoading && <p className="connection-loading">Comparing item descriptions and metadata…</p>}
              {!semanticLoading && semanticError && <p className="connection-empty" role="alert">Semantic matches are temporarily unavailable: {semanticError}</p>}
              <div className="connection-results-grid">
                {crossMediaSemanticResults.slice(0, 8).map(({ item: result, similarity }) => <article className="connection-result-card" key={`semantic-${result.id}`}>
                  <button type="button" className="connection-result" onClick={() => setActiveItem(result)}>
                    {result.image ? <img src={result.image} alt="" loading="lazy" /> : <span className="connection-result-placeholder">{result.category}</span>}
                    <span><small>{result.category} · {result.genre}</small><strong>{result.title}</strong><em>{result.creator}</em><small className="semantic-score">Cosine similarity · {similarity.toFixed(2)}</small></span>
                  </button>
                  <div className="connection-ai-explanation">
                    {authToken ? <button type="button" onClick={() => void requestExplanation(result.id)} disabled={explanationBusy.includes(result.id)}>{explanationBusy.includes(result.id) ? "Writing…" : explanations[result.id] ? "Refresh explanation" : "Explain with AI"}</button> : <button type="button" onClick={onRequireSignIn}>Sign in for an AI explanation</button>}
                    {explanations[result.id] && <div className="connection-ai-result"><span className="eyebrow">{explanations[result.id].generated ? "AI WORDING · STRUCTURED EVIDENCE BELOW" : "GROUNDED EXPLANATION"}</span><p>{explanations[result.id].explanation}</p><small>Evidence: {explanations[result.id].evidence.map((fact) => `${fact.label}: ${fact.value}`).join(" · ") || "No shared creator or genre was found; the semantic match itself is model-inferred."}</small></div>}
                    {explanationErrors[result.id] && <small className="connection-ai-error" role="alert">{explanationErrors[result.id]}</small>}
                  </div>
                </article>)}
              </div>
              {!semanticLoading && !semanticError && !crossMediaSemanticResults.length && <p className="connection-empty">No cross-media semantic matches were found for this item.</p>}
            </div>
            {!isLoading && !pathways.length && <p className="connection-empty">No matching creator, genre, or reviewed editorial theme is available in the current catalog. The explorer does not invent setting or influence links when that metadata is missing.</p>}
            <p className="connection-evidence-note">Catalog genres and creator credits are metadata evidence. Editorial-theme links are interpretive, and are shown only when both Tastera notes use the same theme word. Your saves and feedback are labeled separately.</p>
          </>
        ) : null}
      </section>
    </div>
  );
}
