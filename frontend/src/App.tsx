import { useMemo, useState } from "react";
import MediaCard from "./components/MediaCard";
import TasteMap from "./components/TasteMap";
import { mediaItems } from "./data/media";
import type { MediaFilter } from "./types/media";
import "./App.css";

const categories: MediaFilter[] = ["All", "Movies", "Books", "Music"];

const navigationItems = [
  ["Discover", "⌂"],
  ["Taste Map", "◎"],
  ["Library", "▤"],
  ["Your Profile", "◉"],
] as const;

type Page = (typeof navigationItems)[number][0];

function App() {
  const [category, setCategory] = useState<MediaFilter>("All");
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [activePage, setActivePage] = useState<Page>("Discover");

  const visibleMedia = useMemo(() => {
    const query = search.trim().toLowerCase();

    return mediaItems.filter((item) => {
      const matchesCategory =
        category === "All" || item.category === category;

      const matchesSearch =
        query.length === 0 ||
        item.title.toLowerCase().includes(query) ||
        item.creator.toLowerCase().includes(query) ||
        item.genre.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query);

      const matchesLibrary =
        activePage !== "Library" || saved.includes(item.id);

      return matchesCategory && matchesSearch && matchesLibrary;
    });
  }, [category, search, activePage, saved]);

  function toggleSaved(id: string) {
    setSaved((current) =>
      current.includes(id)
        ? current.filter((savedId) => savedId !== id)
        : [...current, id],
    );
  }

  function navigate(page: Page) {
    setActivePage(page);

    if (page === "Taste Map" || page === "Your Profile") {
      setSearch("");
      setCategory("All");
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            navigate("Discover");
          }}
        >
          <span className="brand-mark">t.</span>
          <span>
            TASTERA<span className="brand-dot">.</span>
          </span>
        </a>

        <div className="side-label">YOUR SPACE</div>

        <nav className="navigation" aria-label="Main navigation">
          {navigationItems.map(([label, symbol]) => (
            <button
              type="button"
              key={label}
              className={`nav-item ${activePage === label ? "active" : ""}`}
              aria-current={activePage === label ? "page" : undefined}
              onClick={() => navigate(label)}
            >
              <span className="nav-symbol">{symbol}</span>
              {label}
              {label === "Library" && saved.length > 0 && (
                <span className="saved-count">{saved.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="avatar">T</div>
          <div>
            <div className="profile-name">Your taste profile</div>
            <div className="profile-subtitle">A work in progress</div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            YOUR WORLD <span>/</span> {activePage.toUpperCase()}
          </div>

          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find your next obsession..."
              aria-label="Search media"
            />
            <kbd>SEARCH</kbd>
          </label>
        </header>

        {activePage === "Taste Map" ? (
          <TasteMap />
        ) : activePage === "Your Profile" ? (
          <section className="map-placeholder profile-page">
            <span className="eyebrow">YOUR TASTERA PROFILE</span>
            <h1>
              Your taste. <span>Your universe.</span>
            </h1>
            <p>
              Your profile will eventually summarize your favorite genres,
              themes, creators, and cross-media interests.
            </p>

            <div className="profile-summary">
              <p>
                <strong>{saved.length}</strong> saved{" "}
                {saved.length === 1 ? "item" : "items"}
              </p>
              <p>
                <strong>
                  {
                    new Set(
                      mediaItems
                        .filter((item) => saved.includes(item.id))
                        .map((item) => item.category),
                    ).size
                  }
                </strong>{" "}
                media categories represented in your saved items
              </p>
            </div>
          </section>
        ) : (
          <>
            {activePage === "Discover" && (
              <section className="hero">
                <div className="hero-copy">
                  <span className="eyebrow">
                    <span className="status-dot" /> DISCOVERY, REIMAGINED
                  </span>

                  <h1>
                    Your taste.
                    <br />
                    <span>Your universe.</span>
                  </h1>

                  <p>
                    More than recommendations. Discover the stories, sounds
                    and ideas you didn&apos;t know you&apos;d love.
                  </p>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={() =>
                      document
                        .getElementById("discovery")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    Explore your world <span>↗</span>
                  </button>
                </div>

                <div className="hero-art">
                  <img
                    src="https://image.tmdb.org/t/p/w1280/xJHokMbljvjADYdit5fK5VQsXEG.jpg"
                    alt="Interstellar cinematic landscape"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                  <div className="hero-art-overlay" />
                  <div className="hero-glow" />
                  <div className="hero-caption">
                    <span>FEATURED DISCOVERY</span>
                    <strong>Explore beyond the obvious.</strong>
                  </div>
                </div>

                <div className="hero-index">01 — 04</div>
              </section>
            )}

            <section className="discovery-section" id="discovery">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    {activePage === "Library"
                      ? "SAVED FOR LATER"
                      : "CURATED FOR THE CURIOUS"}
                  </span>
                  <h2>
                    {activePage === "Library"
                      ? "Your collection"
                      : "A good place to start."}
                  </h2>
                </div>

                <span className="result-count">
                  {visibleMedia.length.toString().padStart(2, "0")} ITEMS
                </span>
              </div>

              <div className="category-tabs" aria-label="Filter by category">
                {categories.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={category === item ? "selected" : ""}
                    aria-pressed={category === item}
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              {visibleMedia.length > 0 ? (
                <div className="media-grid">
                  {visibleMedia.map((item) => (
                    <MediaCard
                      key={item.id}
                      item={item}
                      isSaved={saved.includes(item.id)}
                      onToggleSaved={toggleSaved}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <h3>
                    {activePage === "Library"
                      ? "Your library is empty."
                      : "Nothing here just yet."}
                  </h3>
                  <p>
                    {activePage === "Library"
                      ? "Save a discovery with the heart button and it will appear here."
                      : "Try another search or select a different category."}
                  </p>
                </div>
              )}
            </section>
          </>
        )}

        <footer className="footer">
          <span>
            TASTERA<span className="brand-dot">.</span>
          </span>
          <span>MADE FOR THE CURIOUS.</span>
          <span>DISCOVER BEYOND THE OBVIOUS ↗</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
