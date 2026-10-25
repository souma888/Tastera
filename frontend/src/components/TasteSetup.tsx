import { useEffect, useMemo, useState } from "react";
import type { Media, MediaCategory } from "../types/media";
import { getCatalog } from "../services/catalogApi";
import { TASTE_MOODS } from "../data/tasteOptions";
import ThemedSelect from "./ThemedSelect";

export type TastePreferences = {
  favoriteIds: string[];
  favoriteItems: Media[];
  favoriteArtists: string[];
  genres: string[];
  moods: string[];
};

type TasteSetupProps = {
  catalog: Media[];
  initial: TastePreferences;
  required?: boolean;
  onSave: (preferences: TastePreferences) => void;
  onCancel: () => void;
};

const categories: MediaCategory[] = ["Movies", "Books", "Music"];
const favoriteLimits: Record<MediaCategory, number> = { Movies: 5, Books: 3, Music: 3 };
const genreLimit = 5;
const artistLimit = 3;
const moodLimit = 1;

export default function TasteSetup({ catalog, initial, required = false, onSave, onCancel }: TasteSetupProps) {
  const [favoriteIds, setFavoriteIds] = useState(initial.favoriteIds);
  const [favoriteItems, setFavoriteItems] = useState(initial.favoriteItems ?? []);
  const [favoriteArtists, setFavoriteArtists] = useState(initial.favoriteArtists);
  const [genres, setGenres] = useState(initial.genres);
  const [selectedMoods, setSelectedMoods] = useState(initial.moods);
  const [searchCategory, setSearchCategory] = useState<MediaCategory>("Movies");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Media[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [imageFailures, setImageFailures] = useState<string[]>([]);
  const allItems = useMemo(() => [...new Map([...catalog, ...favoriteItems].map((item) => [item.id, item])).values()], [catalog, favoriteItems]);
  const choices = useMemo(() => Object.fromEntries(categories.map((category) => [
    category,
    allItems.filter((item) => item.category === category).slice(0, 16),
  ])) as Record<MediaCategory, Media[]>, [allItems]);
  const artists = useMemo(() => [...new Set(catalog.filter((item) => item.category === "Music").map((item) => item.creator))].slice(0, 16), [catalog]);
  const genreOptions = useMemo(() => [...new Set(catalog.map((item) => item.genre).filter((genre) => genre && genre.toLowerCase() !== "genre not provided"))].slice(0, 18), [catalog]);
  const hasTasteChoices = favoriteIds.length + favoriteArtists.length + genres.length + selectedMoods.length > 0;

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      getCatalog({ category: searchCategory, q: query, page: 1, limit: 30 }, controller.signal)
        .then((page) => { setSearchResults(page.items); setSearchMessage(page.items.length ? `${page.total} matching ${searchCategory.toLowerCase()} found.` : "No matches yet. Try another title or creator."); })
        .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) { setSearchResults([]); setSearchMessage("Catalog search is unavailable right now. You can still choose from the suggestions below."); } })
        .finally(() => { if (!controller.signal.aborted) setSearchLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [searchCategory, searchQuery]);

  function toggle(values: string[], setter: (next: string[]) => void, value: string, limit = Number.POSITIVE_INFINITY, label = "choices") {
    if (values.includes(value)) { setter(values.filter((item) => item !== value)); setSearchMessage(""); return; }
    if (values.length >= limit) { setSearchMessage(`You can choose up to ${limit} ${label}. Remove one to make room.`); return; }
    setter([...values, value]); setSearchMessage("");
  }

  function toggleFavorite(item: Media) {
    if (favoriteIds.includes(item.id)) {
      setFavoriteIds((current) => current.filter((id) => id !== item.id));
      return;
    }
    const selectedCount = favoriteIds.filter((id) => allItems.find((entry) => entry.id === id)?.category === item.category).length;
    if (selectedCount >= favoriteLimits[item.category]) { setSearchMessage(`Choose up to ${favoriteLimits[item.category]} ${item.category.toLowerCase()} favorites.`); return; }
    setFavoriteIds((current) => [...current, item.id]);
    setFavoriteItems((current) => [...new Map([...current, item].map((entry) => [entry.id, entry])).values()]);
    setSearchMessage("");
  }

  function favoriteCard(item: Media) {
    const selected = favoriteIds.includes(item.id);
    const failed = imageFailures.includes(item.id) || !item.image;
    return <button type="button" key={item.id} className={`taste-choice-card ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={() => toggleFavorite(item)}>
      <span className={`taste-choice-card-art ${failed ? "fallback" : ""}`}>
        {item.image && !imageFailures.includes(item.id) && <img src={item.image.replace(/-M(?=\.jpg(?:\?|$))/i, "-L")} alt="" loading="lazy" onError={() => setImageFailures((current) => current.includes(item.id) ? current : [...current, item.id])} />}
        {failed && <span className="taste-choice-art-fallback" aria-hidden="true"><b>{item.title.slice(0, 1)}</b><small>{item.category} · TASTERA</small></span>}
        <span className="taste-choice-check" aria-hidden="true">{selected ? "✓" : "+"}</span>
      </span>
      <span className="taste-choice-title">{item.title}</span>
      <small>{item.creator}</small>
    </button>;
  }

  return (
    <div className="taste-setup-backdrop" onMouseDown={(event) => { if (!required && event.target === event.currentTarget) onCancel(); }}>
      <section className="taste-setup-dialog" role="dialog" aria-modal="true" aria-labelledby="taste-setup-title">
        {!required && <button className="taste-setup-close" type="button" onClick={onCancel} aria-label="Close taste setup">×</button>}
        <span className="eyebrow">YOUR TASTE, FROM THE START</span>
        <h2 id="taste-setup-title">What are you already into?</h2>
        <p className="taste-setup-intro">A focused starter profile is enough to make your first recommendations feel personal. Choose up to 5 movies, 3 books, 3 albums, 5 genres, 3 artists, and 1 mood. You can change these later.</p>
        {required && <p className="taste-setup-required-note" role="status">Choose at least one favorite, artist, genre, or mood to continue. You can refine everything later in Settings.</p>}

        <section className="taste-search-panel" aria-label="Search the catalog to add favorites">
          <div><strong>Looking for a specific title?</strong><span>Search the catalog and add it to your favorites.</span></div>
          <div className="taste-search-controls">
            <ThemedSelect ariaLabel="Search category" value={searchCategory} options={categories.map((category) => ({ value: category, label: category }))} onChange={(value) => setSearchCategory(value as MediaCategory)} />
            <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={`Search ${searchCategory.toLowerCase()} by title or creator`} aria-label={`Search ${searchCategory.toLowerCase()} by title or creator`} />
          </div>
          <p className="taste-search-status" role="status">{searchLoading ? "Searching the catalog…" : searchQuery.trim().length < 2 ? "Type at least two characters to search the live catalog." : searchMessage}</p>
          {searchQuery.trim().length >= 2 && searchResults.length > 0 && <div className="taste-search-results">{searchResults.map((item) => favoriteCard(item))}</div>}
        </section>

        {categories.map((category) => (
          <fieldset className="taste-choice-group" key={category}>
            <legend>Favorite {category === "Music" ? "albums" : category.toLowerCase()} <small>{favoriteIds.filter((id) => allItems.find((item) => item.id === id)?.category === category).length} / {favoriteLimits[category]} selected</small></legend>
            <div className="taste-choice-cards">
              {choices[category].map(favoriteCard)}
              {!choices[category].length && <p className="taste-setup-empty">Catalog choices will appear when the catalog is available. Use search above to look for a title.</p>}
            </div>
          </fieldset>
        ))}

        <fieldset className="taste-choice-group">
          <legend>Artists and creators <small>Pick the names you return to</small></legend>
          <div className="taste-chip-list">
            {artists.map((artist) => <button type="button" key={artist} className={`taste-chip ${favoriteArtists.includes(artist) ? "selected" : ""}`} aria-pressed={favoriteArtists.includes(artist)} onClick={() => toggle(favoriteArtists, setFavoriteArtists, artist, artistLimit, "artists")}>{artist}</button>)}
          </div>
        </fieldset>

        <fieldset className="taste-choice-group">
          <legend>Genres and themes <small>Choose what you seek out</small></legend>
          <div className="taste-chip-list">
            {genreOptions.map((genre) => <button type="button" key={genre} className={`taste-chip ${genres.includes(genre) ? "selected" : ""}`} aria-pressed={genres.includes(genre)} onClick={() => toggle(genres, setGenres, genre, genreLimit, "genres")}>{genre}</button>)}
          </div>
        </fieldset>

        <fieldset className="taste-choice-group">
          <legend>Moods <small>Choose how you want a discovery to feel</small></legend>
          <div className="taste-chip-list">
            {TASTE_MOODS.map((mood) => <button type="button" key={mood} className={`taste-chip ${selectedMoods.includes(mood) ? "selected" : ""}`} aria-pressed={selectedMoods.includes(mood)} onClick={() => toggle(selectedMoods, setSelectedMoods, mood, moodLimit, "mood")}>{mood}</button>)}
          </div>
        </fieldset>

        <div className="taste-setup-actions">
          {!required && <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>}
          <button type="button" className="primary-button" disabled={!hasTasteChoices} onClick={() => onSave({ favoriteIds, favoriteItems, favoriteArtists, genres, moods: selectedMoods })}>Use these tastes <span>↗</span></button>
        </div>
        <small className="taste-setup-privacy">These starter choices are stored in this browser. You can change them any time in Settings.</small>
      </section>
    </div>
  );
}
