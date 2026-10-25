import { useState, type CSSProperties } from "react";
import type { MediaCardProps } from "../types/media";
import LibraryItemControls from "./LibraryItemControls";

const alternateAlbumArtwork: Record<string, string> = {
  "mezzanine": "https://coverartarchive.org/release/1698a8a8-903a-39af-8df3-a1c5b8c1d20f/front-500",
  "jagged little pill": "https://coverartarchive.org/release/5ff897e7-a2d1-35bc-95da-b3a54714ffd6/front-500",
  "kid a": "https://coverartarchive.org/release/9f30f080-dc44-3d82-8995-2345f87600f9/front-500",
};

function getPosterHue(id: string) {
  return [...id].reduce((total, character) => total + character.charCodeAt(0), 0) % 360;
}

function getArtworkCredit(item: MediaCardProps["item"]) {
  if (item.category === "Books" && item.id.startsWith("openlibrary-work-")) {
    const workId = item.id.slice("openlibrary-work-".length);
    return {
      href: `https://openlibrary.org/works/${encodeURIComponent(workId)}`,
      label: "Cover: Open Library",
    };
  }
  if (item.category === "Music" && item.id.startsWith("musicbrainz-rg-")) {
    const releaseGroupId = item.id.slice("musicbrainz-rg-".length);
    return {
      href: `https://musicbrainz.org/release-group/${encodeURIComponent(releaseGroupId)}`,
      label: "Artwork: Cover Art Archive",
    };
  }
  return null;
}

export default function MediaCard({
  item,
  isSaved,
  onToggleSaved,
  recommendationReason,
  recommendationFeedback,
  feedbackBusy = false,
  onRecommendationFeedback,
  onArtworkUnavailable,
  onExplore,
  onOpenCreator,
  libraryItem,
  onUpdateLibraryItem,
  libraryUpdateBusy = false,
  libraryUpdateError,
}: MediaCardProps) {
  const [artworkAttempt, setArtworkAttempt] = useState(0);
  const alternateArtwork = item.category === "Music" ? alternateAlbumArtwork[item.title.trim().toLowerCase()] : undefined;
  const artworkSources = [...new Set([item.image, alternateArtwork].filter((source): source is string => Boolean(source)))];
  const imageFailed = artworkAttempt >= artworkSources.length;
  const artworkCredit = getArtworkCredit(item);
  const genreLabel =
    item.category === "Music" &&
    ["album", "unclassified", "unknown"].includes(item.genre.trim().toLowerCase())
      ? "Genre not provided"
      : item.genre;

  return (
    <article className="media-card">
      <div className="poster-wrap" style={{ "--poster-hue": getPosterHue(item.id) } as CSSProperties}>
        <div className={`poster-fallback poster-${item.category.toLowerCase()}`} aria-hidden="true">
          <div className="poster-art-mark">{item.title.slice(0, 1)}</div>
          <div className="poster-copy">
            <span>{item.category} · TASTERA SELECTION</span>
            <strong>{item.title}</strong>
            <small>{item.creator}</small>
          </div>
        </div>

        {!imageFailed && artworkSources.length > 0 && (
          <img
            src={artworkSources[artworkAttempt]}
            alt={`${item.title} ${item.category === "Music" ? "album artwork" : "cover"}`}
            loading="lazy"
            onError={(event) => {
              if (artworkAttempt + 1 < artworkSources.length) {
                event.currentTarget.removeAttribute("style");
                setArtworkAttempt((attempt) => attempt + 1);
              }
              else {
                event.currentTarget.style.display = "none";
                setArtworkAttempt((attempt) => attempt + 1);
                if (item.category === "Music") onArtworkUnavailable?.(item.id);
              }
            }}
          />
        )}

        <span className="media-type">{item.category}</span>

        <button
          type="button"
          className={`save-button ${isSaved ? "is-saved" : ""}`}
          aria-label={
            isSaved
              ? `Remove ${item.title} from library`
              : `Save ${item.title} to library`
          }
          aria-pressed={isSaved}
          onClick={() => onToggleSaved(item.id)}
        >
          {isSaved ? "♥" : "♡"}
        </button>
      </div>

      {!imageFailed && artworkSources.length > 0 && artworkCredit && (
        <a
          className="artwork-credit"
          href={artworkCredit.href}
          target="_blank"
          rel="noreferrer"
        >
          {artworkCredit.label} ↗
        </a>
      )}

      <div className="card-meta">{genreLabel.toUpperCase()}</div>
      <h3>{item.title}</h3>
      <p className="creator">
        {onOpenCreator ? <button type="button" className="creator-link" onClick={() => onOpenCreator(item.creator)}>{item.creator} · View creator</button> : item.creator}
      </p>
      {item.source && item.updated_at && <p className="media-data-freshness">{item.source} · Metadata updated {new Date(item.updated_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</p>}
      <p className="recommendation-reason">
        <span>WHY IT CONNECTS</span>
        {recommendationReason ?? item.connection}
      </p>
      {onExplore && <button type="button" className="media-explore-link" onClick={() => onExplore(item)}>Explore connections <span aria-hidden="true">↗</span></button>}
      {onRecommendationFeedback && (
        <div
          className="recommendation-feedback"
          role="group"
          aria-label={`Feedback for ${item.title}`}
        >
          <button
            type="button"
            className={recommendationFeedback === "more" ? "selected" : ""}
            aria-pressed={recommendationFeedback === "more"}
            disabled={feedbackBusy}
            onClick={() =>
              onRecommendationFeedback(
                item.id,
                recommendationFeedback === "more" ? null : "more",
              )
            }
          >
            {recommendationFeedback === "more" ? "✓ More like this" : "More like this"}
          </button>
          <button
            type="button"
            className={recommendationFeedback === "less" ? "selected" : ""}
            aria-pressed={recommendationFeedback === "less"}
            disabled={feedbackBusy}
            onClick={() =>
              onRecommendationFeedback(
                item.id,
                recommendationFeedback === "less" ? null : "less",
              )
            }
          >
            {recommendationFeedback === "less" ? "✓ Not for me" : "Not for me"}
          </button>
        </div>
      )}
      {libraryItem && onUpdateLibraryItem && (
        <LibraryItemControls
          key={`${libraryItem.id}-${libraryItem.status}-${libraryItem.rating ?? "none"}-${libraryItem.progress_percent ?? "none"}`}
          item={libraryItem}
          onUpdate={(update) => onUpdateLibraryItem(libraryItem.id, update)}
          busy={libraryUpdateBusy}
          error={libraryUpdateError}
        />
      )}
    </article>
  );
}
