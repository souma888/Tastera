import type { MediaCardProps } from "../types/media";

export default function MediaCard({
  item,
  isSaved,
  onToggleSaved,
}: MediaCardProps) {
  return (
    <article className="media-card">
      <div className="poster-wrap">
        <div className="poster-fallback" aria-hidden="true">
          <span>{item.category}</span>
          <strong>{item.title}</strong>
          <small>{item.creator}</small>
        </div>

        <img
          src={item.image}
          alt={`${item.title} cover`}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />

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

      <div className="card-meta">{item.genre.toUpperCase()}</div>
      <h3>{item.title}</h3>
      <p className="creator">{item.creator}</p>
      <p className="recommendation-reason">{item.reason}</p>
    </article>
  );
}
