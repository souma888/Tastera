import { useEffect, useMemo, useState } from "react";
import { getCatalog } from "../services/catalogApi";
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

export default function ConnectionExplorer({ item, creator, theme, catalog, savedItems, feedbackItems, onToggleSaved, onClose }: Props) {
  const [activeItem, setActiveItem] = useState<Media | null>(item ?? null);
  const [creatorPage, setCreatorPage] = useState(creator ?? null);
  const [themePage, setThemePage] = useState(theme ?? null);
  const [lookup, setLookup] = useState<CatalogLookup>({ key: "", items: [] });

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
              </article>)}
            </div>
            {!isLoading && !pathways.length && <p className="connection-empty">No matching creator, genre, or reviewed editorial theme is available in the current catalog. The explorer does not invent setting or influence links when that metadata is missing.</p>}
            <p className="connection-evidence-note">Catalog genres and creator credits are metadata evidence. Editorial-theme links are interpretive, and are shown only when both Tastera notes use the same theme word. Your saves and feedback are labeled separately.</p>
          </>
        ) : null}
      </section>
    </div>
  );
}
