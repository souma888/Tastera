import { useMemo, useState } from "react";
import type { Media, MediaCategory } from "../types/media";

export type TastePreferences = {
  favoriteIds: string[];
  favoriteArtists: string[];
  genres: string[];
  moods: string[];
};

type TasteSetupProps = {
  catalog: Media[];
  initial: TastePreferences;
  onSave: (preferences: TastePreferences) => void;
  onCancel: () => void;
};

const moods = ["Thought-provoking", "Hopeful", "Dreamy", "Tense", "Comforting", "Adventurous", "Melancholic", "Playful", "Epic", "Intimate"];
const categories: MediaCategory[] = ["Movies", "Books", "Music"];

export default function TasteSetup({ catalog, initial, onSave, onCancel }: TasteSetupProps) {
  const [favoriteIds, setFavoriteIds] = useState(initial.favoriteIds);
  const [favoriteArtists, setFavoriteArtists] = useState(initial.favoriteArtists);
  const [genres, setGenres] = useState(initial.genres);
  const [selectedMoods, setSelectedMoods] = useState(initial.moods);
  const choices = useMemo(() => Object.fromEntries(categories.map((category) => [
    category,
    catalog.filter((item) => item.category === category && item.image).slice(0, 12),
  ])) as Record<MediaCategory, Media[]>, [catalog]);
  const artists = useMemo(() => [...new Set(catalog.filter((item) => item.category === "Music").map((item) => item.creator))].slice(0, 16), [catalog]);
  const genreOptions = useMemo(() => [...new Set(catalog.map((item) => item.genre).filter((genre) => genre && genre.toLowerCase() !== "genre not provided"))].slice(0, 18), [catalog]);

  function toggle(values: string[], setter: (next: string[]) => void, value: string) {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  return (
    <div className="taste-setup-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="taste-setup-dialog" role="dialog" aria-modal="true" aria-labelledby="taste-setup-title">
        <button className="taste-setup-close" type="button" onClick={onCancel} aria-label="Close taste setup">×</button>
        <span className="eyebrow">YOUR TASTE, FROM THE START</span>
        <h2 id="taste-setup-title">What are you already into?</h2>
        <p className="taste-setup-intro">Choose a few favorites, genres, artists, or moods. Tastera will use these to shape your first picks—even before you have saved anything.</p>

        {categories.map((category) => (
          <fieldset className="taste-choice-group" key={category}>
            <legend>Favorite {category === "Music" ? "albums" : category.toLowerCase()} <small>Select any that you love</small></legend>
            <div className="taste-choice-cards">
              {choices[category].map((item) => {
                const selected = favoriteIds.includes(item.id);
                return (
                  <button type="button" key={item.id} className={`taste-choice-card ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={() => toggle(favoriteIds, setFavoriteIds, item.id)}>
                    <img src={item.image ?? ""} alt="" loading="lazy" />
                    <span>{item.title}</span>
                    <small>{item.creator}</small>
                  </button>
                );
              })}
              {!choices[category].length && <p className="taste-setup-empty">Catalog choices will appear when the catalog is available.</p>}
            </div>
          </fieldset>
        ))}

        <fieldset className="taste-choice-group">
          <legend>Artists and creators <small>Pick the names you return to</small></legend>
          <div className="taste-chip-list">
            {artists.map((artist) => <button type="button" key={artist} className={`taste-chip ${favoriteArtists.includes(artist) ? "selected" : ""}`} aria-pressed={favoriteArtists.includes(artist)} onClick={() => toggle(favoriteArtists, setFavoriteArtists, artist)}>{artist}</button>)}
          </div>
        </fieldset>

        <fieldset className="taste-choice-group">
          <legend>Genres and themes <small>Choose what you seek out</small></legend>
          <div className="taste-chip-list">
            {genreOptions.map((genre) => <button type="button" key={genre} className={`taste-chip ${genres.includes(genre) ? "selected" : ""}`} aria-pressed={genres.includes(genre)} onClick={() => toggle(genres, setGenres, genre)}>{genre}</button>)}
          </div>
        </fieldset>

        <fieldset className="taste-choice-group">
          <legend>Moods <small>Choose how you want a discovery to feel</small></legend>
          <div className="taste-chip-list">
            {moods.map((mood) => <button type="button" key={mood} className={`taste-chip ${selectedMoods.includes(mood) ? "selected" : ""}`} aria-pressed={selectedMoods.includes(mood)} onClick={() => toggle(selectedMoods, setSelectedMoods, mood)}>{mood}</button>)}
          </div>
        </fieldset>

        <div className="taste-setup-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
          <button type="button" className="primary-button" onClick={() => onSave({ favoriteIds, favoriteArtists, genres, moods: selectedMoods })}>Use these tastes <span>↗</span></button>
        </div>
        <small className="taste-setup-privacy">These starter choices are stored in this browser. You can change them any time in Settings.</small>
      </section>
    </div>
  );
}
