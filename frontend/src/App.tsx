import { useEffect, useMemo, useState, type FormEvent } from "react";
import MediaCard from "./components/MediaCard";
import TasteMap from "./components/TasteMap";
import { mediaItems } from "./data/media";
import {
  getCurrentAccount,
  getSavedMedia,
  registerAccount,
  removeSavedMedia,
  saveMedia,
  signIn,
} from "./services/accountApi";
import { getCatalog } from "./services/catalogApi";
import type { Account } from "./services/accountApi";
import type { Media, MediaFilter } from "./types/media";
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
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(mediaItems.length);
  const [savedItems, setSavedItems] = useState<Media[]>([]);
  const saved = useMemo(() => savedItems.map((item) => item.id), [savedItems]);
  const [activePage, setActivePage] = useState<Page>("Discover");
  const [catalog, setCatalog] = useState<Media[]>(mediaItems);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(() =>
    sessionStorage.getItem("tastera_access_token"),
  );
  const [isCheckingAccount, setIsCheckingAccount] = useState(() =>
    Boolean(sessionStorage.getItem("tastera_access_token")),
  );
  const [savedActionError, setSavedActionError] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthBusy, setIsAuthBusy] = useState(false);

  useEffect(() => {
    if (!authToken) {
      setAccount(null);
      setSavedItems([]);
      setIsCheckingAccount(false);
      return;
    }

    let cancelled = false;
    setIsCheckingAccount(true);
    Promise.all([getCurrentAccount(authToken), getSavedMedia(authToken)])
      .then(([currentAccount, items]) => {
        if (cancelled) return;
        setAccount(currentAccount);
        setSavedItems(items);
      })
      .catch(() => {
        if (cancelled) return;
        sessionStorage.removeItem("tastera_access_token");
        setAuthToken(null);
      })
      .finally(() => {
        if (!cancelled) setIsCheckingAccount(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    if (activePage !== "Discover") return;

    const controller = new AbortController();
    const searchQuery = search.trim();
    const loadCatalog = window.setTimeout(async () => {
      setIsCatalogLoading(true);
      setCatalogError(null);

      try {
        const page = await getCatalog(
          {
            category: category === "All" ? undefined : category,
            q: searchQuery || undefined,
            page: pageNumber,
            limit: 50,
          },
          controller.signal,
        );

        setCatalog(page.items);
        setTotalPages(page.total_pages);
        setTotalItems(page.total);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;

        setCatalog(mediaItems);
        setTotalPages(1);
        setTotalItems(mediaItems.length);
        setCatalogError(
          "The catalog API is unavailable, so you are viewing the local demo collection.",
        );
      } finally {
        if (!controller.signal.aborted) setIsCatalogLoading(false);
      }
    }, searchQuery ? 250 : 0);

    return () => {
      window.clearTimeout(loadCatalog);
      controller.abort();
    };
  }, [activePage, category, search, pageNumber]);

  const visibleMedia = useMemo(() => {
    const query = search.trim().toLowerCase();
    const source = activePage === "Library" ? savedItems : catalog;

    return source.filter((item) => {
      const matchesCategory =
        category === "All" || item.category === category;

      const matchesSearch =
        query.length === 0 ||
        item.title.toLowerCase().includes(query) ||
        item.creator.toLowerCase().includes(query) ||
        item.genre.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [activePage, catalog, category, savedItems, search]);

  async function toggleSaved(id: string) {
    if (!authToken) {
      setAuthMode("sign-in");
      setAuthError("Sign in or create an account to save items to your Library.");
      setIsAuthOpen(true);
      return;
    }
    if (savingIds.includes(id)) return;

    setSavedActionError(null);
    setSavingIds((current) => [...current, id]);
    try {
      if (saved.includes(id)) {
        await removeSavedMedia(authToken, id);
        setSavedItems((current) => current.filter((item) => item.id !== id));
      } else {
        const item = await saveMedia(authToken, id);
        setSavedItems((current) =>
          current.some((savedItem) => savedItem.id === id)
            ? current
            : [item, ...current],
        );
      }
    } catch (error) {
      setSavedActionError(
        error instanceof Error ? error.message : "Could not update your Library.",
      );
    } finally {
      setSavingIds((current) => current.filter((savingId) => savingId !== id));
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAuthBusy(true);
    setAuthError(null);
    try {
      const result =
        authMode === "sign-up"
          ? await registerAccount(authEmail, authPassword)
          : await signIn(authEmail, authPassword);
      sessionStorage.setItem("tastera_access_token", result.access_token);
      setAccount(result.account);
      setSavedItems([]);
      setAuthToken(result.access_token);
      setAuthPassword("");
      setIsAuthOpen(false);
      setSavedActionError(null);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setIsAuthBusy(false);
    }
  }

  function signOut() {
    sessionStorage.removeItem("tastera_access_token");
    setAuthToken(null);
    setAccount(null);
    setSavedItems([]);
    setSavedActionError(null);
    if (activePage === "Library") setActivePage("Discover");
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

          <div className="topbar-actions">
            <label className="search-box">
              <span aria-hidden="true">⌕</span>
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPageNumber(1);
                }}
                placeholder="Find your next obsession..."
                aria-label="Search media"
              />
              <span className="search-hint">TITLE · CREATOR · GENRE</span>
            </label>
            {account ? (
              <button type="button" className="account-button" onClick={signOut}>
                <span className="account-email">{account.email}</span>
                <span>Sign out</span>
              </button>
            ) : (
              <button
                type="button"
                className="account-button account-button-primary"
                onClick={() => {
                  setAuthMode("sign-in");
                  setAuthError(null);
                  setIsAuthOpen(true);
                }}
              >
                Sign in
              </button>
            )}
          </div>
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
                <strong>{savedItems.length}</strong> saved{" "}
                {saved.length === 1 ? "item" : "items"}
              </p>
              <p>
                <strong>
                  {
                    new Set(
                      savedItems
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
              <div
                className={`demo-notice ${catalogError ? "catalog-warning" : ""}`}
                role="status"
              >
                <span className="demo-notice-mark" aria-hidden="true">✦</span>
                <span>
                  <strong>{catalogError ? "Catalog offline" : "Catalog connected"}</strong>
                  {catalogError
                    ? ` ${catalogError}`
                    : activePage === "Library"
                    ? account
                      ? " Your Library is saved to your account and syncs when you sign in elsewhere."
                      : " Sign in to save items and sync your Library across devices."
                    : " These catalog picks are not personalized yet."}
                </span>
              </div>
              {savedActionError && (
                <div className="account-feedback account-feedback-error" role="alert">
                  {savedActionError}
                </div>
              )}
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
                  {(activePage === "Library"
                    ? visibleMedia.length
                    : catalogError
                      ? visibleMedia.length
                      : totalItems)
                    .toString()
                    .padStart(2, "0")} ITEMS
                </span>
              </div>

              <div className="category-tabs" aria-label="Filter by category">
                {categories.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={category === item ? "selected" : ""}
                    aria-pressed={category === item}
                    onClick={() => {
                      setCategory(item);
                      setPageNumber(1);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>

              {activePage === "Library" && isCheckingAccount ? (
                <div className="catalog-loading" role="status">
                  Loading your Library…
                </div>
              ) : isCatalogLoading && activePage === "Discover" ? (
                <div className="catalog-loading" role="status">
                  Loading your discoveries…
                </div>
              ) : visibleMedia.length > 0 ? (
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
                      ? account
                        ? "Save a discovery with the heart button and it will appear here."
                        : "Sign in to save discoveries to your personal Library."
                      : "Try another search or select a different category."}
                  </p>
                  {activePage === "Library" && !account && (
                    <button
                      type="button"
                      className="primary-button library-signin-button"
                      onClick={() => {
                        setAuthMode("sign-in");
                        setAuthError(null);
                        setIsAuthOpen(true);
                      }}
                    >
                      Sign in or create an account <span>↗</span>
                    </button>
                  )}
                </div>
              )}

              {!isCatalogLoading && activePage === "Discover" && totalPages > 1 && (
                <nav className="catalog-pagination" aria-label="Catalog pages">
                  <button
                    type="button"
                    disabled={pageNumber <= 1}
                    onClick={() => setPageNumber((page) => Math.max(1, page - 1))}
                  >
                    Previous
                  </button>
                  <span>Page {pageNumber} of {totalPages}</span>
                  <button
                    type="button"
                    disabled={pageNumber >= totalPages}
                    onClick={() => setPageNumber((page) => Math.min(totalPages, page + 1))}
                  >
                    Next
                  </button>
                </nav>
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
          <small className="tmdb-attribution">
            This product uses the TMDB API but is not endorsed or certified by TMDB.
          </small>
        </footer>
      </main>

      {isAuthOpen && (
        <div
          className="auth-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isAuthBusy) {
              setIsAuthOpen(false);
            }
          }}
        >
          <section
            className="auth-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-heading"
          >
            <button
              type="button"
              className="auth-close"
              aria-label="Close sign-in dialog"
              onClick={() => setIsAuthOpen(false)}
              disabled={isAuthBusy}
            >
              ×
            </button>
            <span className="eyebrow">YOUR TASTERA ACCOUNT</span>
            <h2 id="auth-heading">
              {authMode === "sign-up" ? "Create your space." : "Welcome back."}
            </h2>
            <p className="auth-intro">
              Save discoveries to a Library that follows you across devices.
            </p>
            <form className="auth-form" onSubmit={submitAuth}>
              <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={320}
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete={authMode === "sign-up" ? "new-password" : "current-password"}
                  required
                  minLength={8}
                  maxLength={128}
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                />
                {authMode === "sign-up" && (
                  <small>Use at least 8 characters.</small>
                )}
              </label>
              {authError && <p className="auth-error" role="alert">{authError}</p>}
              <button type="submit" className="primary-button auth-submit" disabled={isAuthBusy}>
                {isAuthBusy
                  ? "Please wait…"
                  : authMode === "sign-up"
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>
            <p className="auth-switch">
              {authMode === "sign-up" ? "Already have an account?" : "New to Tastera?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === "sign-up" ? "sign-in" : "sign-up");
                  setAuthError(null);
                }}
              >
                {authMode === "sign-up" ? "Sign in" : "Create an account"}
              </button>
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
