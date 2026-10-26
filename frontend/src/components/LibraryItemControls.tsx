import { useState, type FormEvent } from "react";
import type { SavedMedia, SavedMediaUpdate } from "../types/media";
import ThemedSelect from "./ThemedSelect";

const statusLabels: Record<SavedMedia["category"], Record<SavedMedia["status"], string>> = {
  Movies: { planned: "Want to watch", in_progress: "Watching", finished: "Finished" },
  Books: { planned: "Want to read", in_progress: "Reading", finished: "Finished" },
  Music: { planned: "Want to listen", in_progress: "Listening", finished: "Finished" },
  TV: { planned: "Want to watch", in_progress: "Watching", finished: "Finished" },
  Games: { planned: "Want to play", in_progress: "Playing", finished: "Finished" },
  Podcasts: { planned: "Want to listen", in_progress: "Listening", finished: "Finished" },
};

export default function LibraryItemControls({
  item,
  onUpdate,
  busy,
  error,
}: {
  item: SavedMedia;
  onUpdate: (update: SavedMediaUpdate) => void;
  busy: boolean;
  error?: string | null;
}) {
  const [note, setNote] = useState(item.note ?? "");
  const [progress, setProgress] = useState(item.progress_percent ?? 0);
  const canTrackProgress = item.category !== "Movies" && item.status === "in_progress";

  function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onUpdate({ note: note.trim() || null });
  }

  function saveProgress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onUpdate({ progress_percent: progress });
  }

  return (
    <section className="library-item-controls" aria-label={`Library details for ${item.title}`}>
      <label className="library-status-field">
        <span>YOUR STATUS</span>
        <ThemedSelect
          ariaLabel={`Status for ${item.title}`}
          value={item.status}
          options={Object.entries(statusLabels[item.category]).map(([value, label]) => ({ value, label }))}
          disabled={busy}
          onChange={(value) => onUpdate({ status: value as SavedMedia["status"] })}
        />
      </label>

      <div className="library-rating" role="group" aria-label={`Your rating for ${item.title}`}>
        <span>YOUR RATING</span>
        <div>
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              disabled={busy}
              aria-label={`${item.rating === rating ? "Clear" : "Rate"} ${item.title} ${rating} out of 5`}
              aria-pressed={item.rating === rating}
              className={item.rating !== null && rating <= item.rating ? "is-rated" : ""}
              onClick={() => onUpdate({ rating: item.rating === rating ? null : rating })}
            >★</button>
          ))}
          <small>{item.rating ? `${item.rating}/5` : "Not rated"}</small>
        </div>
      </div>

      {canTrackProgress && (
        <form className="library-progress-field" onSubmit={saveProgress}>
          <label htmlFor={`progress-${item.id}`}>PROGRESS · {progress}%</label>
          <input
            id={`progress-${item.id}`}
            type="range"
            min="0"
            max="100"
            step="5"
            value={progress}
            disabled={busy}
            onChange={(event) => setProgress(Number(event.target.value))}
          />
          <button type="submit" disabled={busy || progress === (item.progress_percent ?? 0)}>{busy ? "Saving…" : "Save progress"}</button>
        </form>
      )}

      <form className="library-note-form" onSubmit={saveNote}>
        <label htmlFor={`note-${item.id}`}>PRIVATE NOTE</label>
        <textarea
          id={`note-${item.id}`}
          maxLength={2000}
          rows={2}
          value={note}
          disabled={busy}
          placeholder="A thought to remember…"
          onChange={(event) => setNote(event.target.value)}
        />
        <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save note"}</button>
      </form>
      {error && <p className="library-control-error" role="alert">{error}</p>}
    </section>
  );
}
