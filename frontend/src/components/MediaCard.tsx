import { useState, type CSSProperties } from "react";
import type { MediaCardProps } from "../types/media";

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
}: MediaCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
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

        {item.image && !imageFailed && (
          <img
            src={item.image}
            alt={`${item.title} ${item.category === "Music" ? "album artwork" : "cover"}`}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = "none";
              setImageFailed(true);
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

      {item.image && !imageFailed && artworkCredit && (
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
      <p className="creator">{item.creator}</p>
      <p className="recommendation-reason">
        <span>WHY IT CONNECTS</span>
        {recommendationReason ?? item.connection}
      </p>
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
    </article>
  );
}
