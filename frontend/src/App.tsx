import { useEffect, useMemo, useState, type FormEvent } from "react";
import MediaCard from "./components/MediaCard";
import TasteMap from "./components/TasteMap";
import { mediaItems } from "./data/media";
import {
  getCurrentAccount,
  getRecommendations,
  getSavedMedia,
  clearRecommendationFeedback,
  registerAccount,
  removeSavedMedia,
  saveMedia,
  setRecommendationFeedback,
  signIn,
} from "./services/accountApi";
import { getCatalog } from "./services/catalogApi";
import type { Account } from "./services/accountApi";
import type { Media, MediaCategory, MediaFilter, Recommendation, RecommendationPage } from "./types/media";
import "./App.css";

const categories: MediaFilter[] = ["All", "Movies", "Books", "Music"];

const navigationItems = [
  ["Discover", "⌂"],
  ["Taste Map", "◎"],
  ["Library", "▤"],
  ["Your Profile", "◉"],
  ["Settings", "⚙"],
  ["Guide", "?"],
  ["About", "✦"],
  ["Contact", "✉"],
] as const;

type Page = (typeof navigationItems)[number][0];
type RecommendationStrategy = "auto" | "genre" | "item_item";
type CategoryMix = Record<MediaCategory, number>;

const mediaCategories: MediaCategory[] = ["Movies", "Books", "Music"];
const recommendationBatchSize = 12;

function readStoredMix(): CategoryMix {
  try {
    const parsed = JSON.parse(localStorage.getItem("tastera_recommendation_mix") ?? "null") as Partial<CategoryMix> | null;
    if (
      parsed && mediaCategories.every((category) => typeof parsed[category] === "number") &&
      mediaCategories.reduce((total, category) => total + (parsed[category] ?? 0), 0) === 100
    ) {
      return parsed as CategoryMix;
    }
  } catch {
    // Ignore malformed or unavailable local preferences and use the defaults.
  }
  return { Movies: 60, Books: 20, Music: 20 };
}

function readStoredStrategy(): RecommendationStrategy {
  try {
    const value = localStorage.getItem("tastera_recommendation_strategy");
    return value === "genre" || value === "item_item" ? value : "auto";
  } catch {
    return "auto";
  }
}

function allocateMix(mix: CategoryMix, count: number): CategoryMix {
  const exact = Object.fromEntries(mediaCategories.map((category) => [category, (mix[category] * count) / 100])) as CategoryMix;
  const result = Object.fromEntries(mediaCategories.map((category) => [category, Math.floor(exact[category])])) as CategoryMix;
  let remaining = count - mediaCategories.reduce((sum, category) => sum + result[category], 0);
  const order = [...mediaCategories].sort((left, right) =>
    (exact[right] - result[right]) - (exact[left] - result[left]) ||
    ["Movies", "Music", "Books"].indexOf(left) - ["Movies", "Music", "Books"].indexOf(right),
  );
  for (let index = 0; index < order.length && remaining > 0; index += 1, remaining -= 1) {
    result[order[index]] += 1;
  }
  return result;
}

function adjustMix(mix: CategoryMix, changed: MediaCategory, value: number): CategoryMix {
  const nextValue = Math.max(0, Math.min(100, Math.round(value / 5) * 5));
  const others = mediaCategories.filter((category) => category !== changed);
  const otherTotal = 100 - nextValue;
  const previousTotal = others.reduce((sum, category) => sum + mix[category], 0);
  const firstShare = previousTotal
    ? Math.round((otherTotal * mix[others[0]]) / previousTotal / 5) * 5
    : Math.round(otherTotal / 10) * 5;
  return {
    ...mix,
    [changed]: nextValue,
    [others[0]]: Math.max(0, Math.min(otherTotal, firstShare)),
    [others[1]]: otherTotal - Math.max(0, Math.min(otherTotal, firstShare)),
  };
}

async function getMixedRecommendationBatch(
  token: string,
  mix: CategoryMix,
  strategy: RecommendationStrategy,
  excludeIds: string[] = [],
  signal?: AbortSignal,
): Promise<RecommendationPage> {
  const pages = await Promise.all(mediaCategories.map((category) =>
    getRecommendations(
      token,
      signal,
      0,
      excludeIds,
      category,
      category === "Movies" ? strategy : "genre",
      20,
    ),
  ));
  const quotas = allocateMix(mix, recommendationBatchSize);
  const selected = new Map<MediaCategory, Recommendation[]>(
    mediaCategories.map((category, index) => [category, pages[index].items.slice(0, quotas[category])]),
  );
  let selectedCount = [...selected.values()].reduce((total, items) => total + items.length, 0);
  const fillOrder = [...mediaCategories].sort((left, right) => mix[right] - mix[left]);
  while (selectedCount < recommendationBatchSize) {
    let added = false;
    for (const category of fillOrder) {
      if (selectedCount >= recommendationBatchSize) break;
      const pageIndex = mediaCategories.indexOf(category);
      const current = selected.get(category) ?? [];
      const next = pages[pageIndex].items[current.length];
      if (next) {
        current.push(next);
        selected.set(category, current);
        selectedCount += 1;
        added = true;
      }
    }
    if (!added) break;
  }
  const items = fillOrder.flatMap((category) => selected.get(category) ?? []);
  const feedbackById = new Map<string, RecommendationPage["feedback_items"][number]>();
  pages.forEach((page) => page.feedback_items.forEach((entry) => feedbackById.set(entry.item.id, entry)));
  const total = pages.reduce((sum, page) => sum + page.total, 0);
  const methods = pages.map((page) => page.method);
  const percentLabel = mediaCategories.map((category) => `${mix[category]}% ${category}`).join(" · ");
  return {
    items,
    feedback_items: [...feedbackById.values()],
    saved_count: Math.max(...pages.map((page) => page.saved_count)),
    method: methods.includes("item_item") ? "item_item" : "genre",
    total,
    next_offset: total > items.length ? 0 : null,
    message: `Balanced to your mix (${percentLabel}); recommendations use your saved items and feedback.`,
  };
}

function formatSavedDate(value?: string) {
  if (!value) return "Recently saved";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Recently saved"
    : `Saved ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function App() {
  const [category, setCategory] = useState<MediaFilter>("All");
  const [search, setSearch] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(mediaItems.length);
  const [savedItems, setSavedItems] = useState<Media[]>([]);
  const saved = useMemo(() => savedItems.map((item) => item.id), [savedItems]);
  const [activePage, setActivePage] = useState<Page>("Discover");
  const [recommendationMix, setRecommendationMix] = useState<CategoryMix>(readStoredMix);
  const [recommendationStrategy, setRecommendationStrategy] = useState<RecommendationStrategy>(readStoredStrategy);
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
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationFeedbackItems, setRecommendationFeedbackItems] = useState<
    { item: Media; feedback: "more" | "less" }[]
  >([]);
  const [recommendationMessage, setRecommendationMessage] = useState("");
  const [recommendationTotal, setRecommendationTotal] = useState(0);
  const [recommendationNextOffset, setRecommendationNextOffset] = useState<number | null>(null);
  const [seenRecommendationIds, setSeenRecommendationIds] = useState<string[]>([]);
  const [isRecommendationsLoading, setIsRecommendationsLoading] = useState(false);
  const [feedbackBusyIds, setFeedbackBusyIds] = useState<string[]>([]);
  const [feedbackActionError, setFeedbackActionError] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthBusy, setIsAuthBusy] = useState(false);

  function applyRecommendationPage(page: RecommendationPage, resetSeen = false) {
    setRecommendations(page.items);
    setRecommendationFeedbackItems(page.feedback_items);
    setRecommendationMessage(page.message);
    setRecommendationTotal(page.total);
    setRecommendationNextOffset(page.next_offset);
    setSeenRecommendationIds((current) =>
      resetSeen
        ? page.items.map(({ item }) => item.id)
        : [...new Set([...current, ...page.items.map(({ item }) => item.id)])],
    );
  }

  useEffect(() => {
    if (!authToken) return;

    let cancelled = false;
    Promise.all([getCurrentAccount(authToken), getSavedMedia(authToken)])
      .then(([currentAccount, items]) => {
        if (cancelled) return;
        setAccount(currentAccount);
        setSavedItems(items);
      })
      .catch(() => {
        if (cancelled) return;
        sessionStorage.removeItem("tastera_access_token");
        setAccount(null);
        setSavedItems([]);
        setRecommendations([]);
        setRecommendationFeedbackItems([]);
        setIsCheckingAccount(false);
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
    if (!authToken || isCheckingAccount) return;

    const controller = new AbortController();
    const loadRecommendations = window.setTimeout(() => {
      setIsRecommendationsLoading(true);
      getMixedRecommendationBatch(authToken, recommendationMix, recommendationStrategy, [], controller.signal)
        .then((page) => applyRecommendationPage(page, true))
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setRecommendations([]);
          setRecommendationFeedbackItems([]);
          setRecommendationTotal(0);
          setRecommendationNextOffset(null);
          setSeenRecommendationIds([]);
          setRecommendationMessage("Recommendations could not be loaded right now.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsRecommendationsLoading(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(loadRecommendations);
      controller.abort();
    };
  }, [authToken, isCheckingAccount, savedItems, recommendationMix, recommendationStrategy]);

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

  const profileStats = useMemo(() => {
    const categoryCounts = savedItems.reduce<Record<string, number>>((counts, item) => {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
      return counts;
    }, {});
    const genreCounts = savedItems.reduce<Record<string, number>>((counts, item) => {
      counts[item.genre] = (counts[item.genre] ?? 0) + 1;
      return counts;
    }, {});

    return {
      categoryCounts,
      topCategory: Object.entries(categoryCounts)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] ?? null,
      topGenres: Object.entries(genreCounts)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 5),
      moreFeedback: recommendationFeedbackItems.filter((entry) => entry.feedback === "more").length,
      lessFeedback: recommendationFeedbackItems.filter((entry) => entry.feedback === "less").length,
    };
  }, [recommendationFeedbackItems, savedItems]);

  const visiblePageNumbers = useMemo(() => {
    const size = Math.min(5, totalPages);
    const start = Math.max(1, Math.min(pageNumber - 2, totalPages - size + 1));
    return Array.from({ length: size }, (_, index) => start + index);
  }, [pageNumber, totalPages]);

  function updateRecommendationMix(category: MediaCategory, value: number) {
    setRecommendationMix((current) => {
      const next = adjustMix(current, category, value);
      localStorage.setItem("tastera_recommendation_mix", JSON.stringify(next));
      return next;
    });
    setSeenRecommendationIds([]);
  }

  function updateRecommendationStrategy(strategy: RecommendationStrategy) {
    localStorage.setItem("tastera_recommendation_strategy", strategy);
    setRecommendationStrategy(strategy);
    setSeenRecommendationIds([]);
  }

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
            : [{ ...item, saved_at: new Date().toISOString() }, ...current],
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

  async function updateRecommendationFeedback(
    id: string,
    feedback: "more" | "less" | null,
  ) {
    if (!authToken || feedbackBusyIds.includes(id)) return;
    setFeedbackActionError(null);
    setFeedbackBusyIds((current) => [...current, id]);
    try {
      if (feedback) {
        await setRecommendationFeedback(authToken, id, feedback);
      } else {
        await clearRecommendationFeedback(authToken, id);
      }
      const page = await getMixedRecommendationBatch(authToken, recommendationMix, recommendationStrategy);
      applyRecommendationPage(page, true);
    } catch (error) {
      setFeedbackActionError(
        error instanceof Error ? error.message : "Could not save your recommendation feedback.",
      );
    } finally {
      setFeedbackBusyIds((current) => current.filter((feedbackId) => feedbackId !== id));
    }
  }

  async function refreshRecommendations() {
    if (!authToken || recommendationNextOffset === null || isRecommendationsLoading) return;
    setIsRecommendationsLoading(true);
    setFeedbackActionError(null);
    try {
      const page = await getMixedRecommendationBatch(
        authToken,
        recommendationMix,
        recommendationStrategy,
        seenRecommendationIds,
      );
      applyRecommendationPage(page);
    } catch (error) {
      setFeedbackActionError(
        error instanceof Error ? error.message : "Could not load another recommendation batch.",
      );
    } finally {
      setIsRecommendationsLoading(false);
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
      setIsCheckingAccount(true);
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
    setRecommendations([]);
    setRecommendationFeedbackItems([]);
    setRecommendationMessage("");
    setRecommendationTotal(0);
    setRecommendationNextOffset(null);
    setSeenRecommendationIds([]);
    setIsRecommendationsLoading(false);
    if (activePage === "Library") setActivePage("Discover");
  }

  function navigate(page: Page) {
    setActivePage(page);

    if (page === "Taste Map" || page === "Your Profile" || page === "Settings" || page === "Guide" || page === "About" || page === "Contact") {
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
          <div className="avatar">{(account?.email?.[0] ?? "T").toUpperCase()}</div>
          <div>
            <div className="profile-name">{account?.email ?? "Your taste profile"}</div>
            <div className="profile-subtitle">
              {account ? `${saved.length} saved ${saved.length === 1 ? "item" : "items"}` : "Sign in to personalize"}
            </div>
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

        {activePage === "Guide" ? (
          <section className="info-page guide-page" aria-labelledby="guide-heading">
            <div className="info-hero">
              <span className="eyebrow">A QUICK TOUR</span>
              <h1 id="guide-heading">Find your next <span>favorite thing.</span></h1>
              <p>Tastera connects movies, books, and music through the moods, themes, and creators they share.</p>
            </div>
            <div className="guide-grid">
              <article className="guide-card">
                <div className="guide-visual guide-visual-discover" aria-label="Illustration of the Discover screen">
                  <div className="guide-window-bar"><i /><i /><i /><span>DISCOVER</span></div>
                  <div className="guide-window-hero"><small>CURATED FOR THE CURIOUS</small><strong>Your universe.</strong><span>Explore beyond the obvious.</span></div>
                  <div className="guide-mini-posters"><i>FILM</i><i>BOOK</i><i>MUSIC</i></div>
                </div>
                <div className="guide-card-copy"><span className="guide-step">01 / DISCOVER</span><h2>Browse across worlds</h2><p>Explore the catalog, filter by movies, books, or music, and search by title, creator, or genre. Open a card to see why it connects.</p></div>
              </article>
              <article className="guide-card">
                <div className="guide-visual guide-visual-map" aria-label="Illustration of the Taste Map">
                  <div className="guide-map-center">YOUR<br />TASTE</div><i className="guide-map-node node-a">FILM</i><i className="guide-map-node node-b">BOOK</i><i className="guide-map-node node-c">SOUND</i><i className="guide-map-node node-d">THEME</i><span className="guide-map-line line-a" /><span className="guide-map-line line-b" /><span className="guide-map-line line-c" /><span className="guide-map-line line-d" />
                </div>
                <div className="guide-card-copy"><span className="guide-step">02 / CONNECT</span><h2>Follow the connections</h2><p>The Taste Map visualizes shared themes and interests between discoveries, helping you move from one kind of story to another.</p></div>
              </article>
              <article className="guide-card">
                <div className="guide-visual guide-visual-library" aria-label="Illustration of a saved Library">
                  <div className="guide-library-heading"><span>YOUR LIBRARY</span><b>3 SAVED</b></div>
                  <div className="guide-library-row"><i>01</i><span><b>Arrival</b><small>FILM · SCI-FI</small></span><em>♥</em></div>
                  <div className="guide-library-row"><i>02</i><span><b>Annihilation</b><small>BOOK · SCIENCE FICTION</small></span><em>♥</em></div>
                  <div className="guide-library-row"><i>03</i><span><b>Blue Train</b><small>MUSIC · JAZZ</small></span><em>♥</em></div>
                </div>
                <div className="guide-card-copy"><span className="guide-step">03 / MAKE IT YOURS</span><h2>Save and shape your taste</h2><p>Create an account to keep a Library across devices. Save items you love and use recommendation feedback to tune future picks.</p></div>
              </article>
            </div>
            <div className="guide-tip"><span>✦</span><p><strong>Tip:</strong> Start by saving a few favorites from different categories. A broader Library gives your profile and recommendations more to work with.</p></div>
            <button type="button" className="primary-button guide-cta" onClick={() => navigate("Discover")}>Start exploring <span>↗</span></button>
          </section>
        ) : activePage === "About" ? (
          <section className="info-page about-page" aria-labelledby="about-heading">
            <div className="info-hero">
              <span className="eyebrow">ABOUT TASTERA</span>
              <h1 id="about-heading">Curiosity has <span>no category.</span></h1>
              <p>Tastera is a cross-media discovery app for people who love finding unexpected connections between the things they enjoy.</p>
            </div>
            <div className="about-feature-grid">
              <article><span>01</span><h2>One place for many passions</h2><p>Discover movies, books, and music in a single catalog, then keep the finds that matter in your personal Library.</p></article>
              <article><span>02</span><h2>Connections that travel</h2><p>Explore shared genres, moods, and themes across media with the Taste Map and recommendations shaped by your saved items.</p></article>
              <article><span>03</span><h2>Built to grow with your taste</h2><p>Your feedback helps guide future recommendations. Tastera is an evolving project, with more ways to personalize discovery ahead.</p></article>
            </div>
            <div className="about-note"><span className="brand-mark">t.</span><p><strong>Discover beyond the obvious.</strong><br />Tastera brings catalog data and your own signals together to make the next great discovery easier to find.</p></div>
          </section>
        ) : activePage === "Contact" ? (
          <section className="info-page contact-page" aria-labelledby="contact-heading">
            <div className="info-hero">
              <span className="eyebrow">GET IN TOUCH</span>
              <h1 id="contact-heading">Questions, ideas, <span>hello?</span></h1>
              <p>Reach out about Tastera, share feedback, or report something that needs attention. I’d be glad to hear from you.</p>
            </div>
            <div className="contact-grid">
              <article className="contact-card"><span className="contact-icon">@</span><div><span className="eyebrow">EMAIL</span><a href="mailto:soumadipkaran8@gmail.com">soumadipkaran8@gmail.com</a><a href="mailto:soumadipkaran88@gmail.com">soumadipkaran88@gmail.com</a></div></article>
              <article className="contact-card"><span className="contact-icon">↗</span><div><span className="eyebrow">WHATSAPP</span><a href="https://wa.me/917074796529" target="_blank" rel="noreferrer">+91 70747 96529</a><small>Open a WhatsApp conversation</small></div></article>
            </div>
            <p className="contact-response-note">For the quickest response, include “Tastera” in your message subject.</p>
          </section>
        ) : activePage === "Settings" ? (
          <section className="settings-page" aria-labelledby="settings-heading">
            <div className="settings-hero">
              <span className="eyebrow">MAKE TASTERA YOURS</span>
              <h1 id="settings-heading">Discovery <span>settings.</span></h1>
              <p>Adjust how For You balances movies, books, and music. Your choices are saved in this browser.</p>
            </div>
            <section className="settings-panel" aria-labelledby="mix-heading">
              <div className="settings-panel-heading">
                <div><span className="eyebrow">FOR YOU</span><h2 id="mix-heading">Your category mix</h2></div>
                <span className="settings-mix-summary">{mediaCategories.map((item) => `${recommendationMix[item]}% ${item}`).join(" · ")}</span>
              </div>
              <p>Each batch aims for 12 picks. At 60 / 20 / 20, that is about 7 movies, 2 books, and 3 albums; unavailable categories are filled by the others.</p>
              <div className="settings-mix-controls">
                {mediaCategories.map((item) => (
                  <label className="settings-range" key={item}>
                    <span><strong>{item}</strong><b>{recommendationMix[item]}%</b></span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={recommendationMix[item]}
                      onChange={(event) => updateRecommendationMix(item, Number(event.target.value))}
                      aria-label={`${item} share of recommendations`}
                    />
                  </label>
                ))}
              </div>
              <div className="settings-strategy-row">
                <label htmlFor="recommendation-strategy">Movie ranking method</label>
                <select
                  id="recommendation-strategy"
                  value={recommendationStrategy}
                  onChange={(event) => updateRecommendationStrategy(event.target.value as RecommendationStrategy)}
                >
                  <option value="auto">Automatic (co-save, with genre fallback)</option>
                  <option value="genre">Genre baseline</option>
                  <option value="item_item">Co-save similarity</option>
                </select>
              </div>
              <small className="settings-footnote">Book and music picks currently use genre matching. Settings only affect this browser and can be changed any time.</small>
            </section>
            <section className="settings-panel settings-evaluation" aria-labelledby="evaluation-heading">
              <span className="eyebrow">HELP US EVALUATE</span>
              <h2 id="evaluation-heading">Your feedback improves the comparison</h2>
              <p>On For You, use “More like this” and “Not for me.” The evaluation compares the genre baseline with movie co-save recommendations for relevance (Hit Rate, Recall, NDCG), variety, and catalog coverage.</p>
              <div className="settings-feedback-counts">
                <span><b>{profileStats.moreFeedback}</b> more like this</span>
                <span><b>{profileStats.lessFeedback}</b> not for me</span>
              </div>
              <small className="settings-footnote">The current evaluation uses a time-ordered holdout of saves and positive feedback; it reports “insufficient data” until at least five eligible accounts have enough history. It does not claim a measured winner before that threshold.</small>
            </section>
          </section>
        ) : activePage === "Taste Map" ? (
          <TasteMap savedItems={savedItems} feedbackItems={recommendationFeedbackItems} />
        ) : activePage === "Your Profile" ? (
          <section className="profile-page" aria-labelledby="profile-heading">
            <div className="profile-header">
              <div className="profile-avatar" aria-hidden="true">
                {(account?.email?.[0] ?? "T").toUpperCase()}
              </div>
              <div>
                <span className="eyebrow">YOUR TASTERA PROFILE</span>
                <h1 id="profile-heading">
                  Your taste. <span>Your universe.</span>
                </h1>
                <p>{account ? account.email : "A snapshot of what you have saved and explored."}</p>
              </div>
            </div>

            {!account ? (
              <div className="profile-callout">
                <div>
                  <strong>Your taste profile starts with your Library.</strong>
                  <p>Sign in and save a few movies, books, or albums. Your profile will summarize those choices here.</p>
                </div>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setAuthMode("sign-in");
                    setAuthError(null);
                    setIsAuthOpen(true);
                  }}
                >
                  Sign in <span>↗</span>
                </button>
              </div>
            ) : isCheckingAccount ? (
              <div className="catalog-loading" role="status">Loading your taste profile…</div>
            ) : (
              <>
                <div className="profile-stat-grid" aria-label="Your activity summary">
                  <article className="profile-stat-card">
                    <span>SAVED TO LIBRARY</span>
                    <strong>{savedItems.length}</strong>
                    <small>{savedItems.length === 1 ? "discovery" : "discoveries"}</small>
                  </article>
                  <article className="profile-stat-card">
                    <span>MEDIA TYPES</span>
                    <strong>{Object.values(profileStats.categoryCounts).filter(Boolean).length}</strong>
                    <small>of 3 in your Library</small>
                  </article>
                  <article className="profile-stat-card">
                    <span>MORE LIKE THIS</span>
                    <strong>{profileStats.moreFeedback}</strong>
                    <small>positive signals</small>
                  </article>
                  <article className="profile-stat-card">
                    <span>NOT FOR ME</span>
                    <strong>{profileStats.lessFeedback}</strong>
                    <small>to tune future picks</small>
                  </article>
                </div>

                <section className="profile-insight" aria-labelledby="profile-insight-heading">
                  <span className="eyebrow">TASTE SNAPSHOT</span>
                  <h2 id="profile-insight-heading">
                    {profileStats.topGenres.length
                      ? `You save ${profileStats.topGenres[0][0]} most often.`
                      : "Your taste profile is taking shape."}
                  </h2>
                  <p>
                    {savedItems.length
                      ? `Your largest shelf is ${profileStats.topCategory?.[0] ?? "still growing"} (${profileStats.topCategory?.[1] ?? 0} saved). `
                      : "Save a few favorites and your strongest genres and categories will appear here. "}
                    {profileStats.moreFeedback + profileStats.lessFeedback
                      ? `You have ${profileStats.moreFeedback} positive and ${profileStats.lessFeedback} negative recommendation signals, which help tune your next picks.`
                      : "Use More like this or Not for me to add recommendation signals."}
                  </p>
                  <div className="profile-insight-tags">
                    {profileStats.topGenres.slice(0, 3).map(([genre, count]) => (
                      <span key={genre}>{genre}<b>{count}</b></span>
                    ))}
                  </div>
                </section>

                <section className="profile-panel profile-signals-panel" aria-labelledby="profile-signals-heading">
                  <div className="profile-panel-heading">
                    <span className="eyebrow">KEEP EXPLORING</span>
                    <h2 id="profile-signals-heading">Grow your taste signals</h2>
                    <p className="profile-empty-copy">Your picks start with what you save. Add a few favorites in each category to build a broader profile.</p>
                  </div>
                  <div className="profile-signal-grid">
                    {(["Movies", "Books", "Music"] as const).map((mediaCategory) => {
                      const count = profileStats.categoryCounts[mediaCategory] ?? 0;
                      const progress = Math.min(count, 3);
                      return (
                        <article className="profile-signal-card" key={mediaCategory}>
                          <div className="profile-signal-title">
                            <strong>{mediaCategory}</strong>
                            <span>{count} saved</span>
                          </div>
                          <progress
                            max={3}
                            value={progress}
                            aria-label={`${mediaCategory}: ${progress} of 3 starter saves`}
                          />
                          <small>{progress} / 3 starter saves</small>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => {
                              setSearch("");
                              setCategory(mediaCategory);
                              navigate("Discover");
                            }}
                          >
                            Explore {mediaCategory} →
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <div className="profile-content-grid">
                  <section className="profile-panel" aria-labelledby="profile-genres-heading">
                    <div className="profile-panel-heading">
                      <span className="eyebrow">FROM YOUR SAVED ITEMS</span>
                      <h2 id="profile-genres-heading">Your current themes</h2>
                    </div>
                    {profileStats.topGenres.length ? (
                      <div className="profile-genre-list">
                        {profileStats.topGenres.map(([genre, count]) => (
                          <div className="profile-genre-row" key={genre}>
                            <span>{genre}</span>
                            <div className="profile-genre-track" aria-hidden="true">
                              <span style={{ width: `${(count / profileStats.topGenres[0][1]) * 100}%` }} />
                            </div>
                            <small>{count}</small>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="profile-empty-copy">Save something you love and your genres will begin to appear here.</p>
                    )}
                    <div className="profile-category-tags">
                      {(["Movies", "Books", "Music"] as const).map((mediaCategory) => (
                        <span key={mediaCategory} className={profileStats.categoryCounts[mediaCategory] ? "has-items" : ""}>
                          {mediaCategory}<b>{profileStats.categoryCounts[mediaCategory] ?? 0}</b>
                        </span>
                      ))}
                    </div>
                  </section>

                  <section className="profile-panel" aria-labelledby="profile-recent-heading">
                    <div className="profile-panel-heading">
                      <span className="eyebrow">YOUR LIBRARY</span>
                      <h2 id="profile-recent-heading">Recently saved</h2>
                    </div>
                    {savedItems.length ? (
                      <ul className="profile-recent-list">
                        {savedItems.slice(0, 5).map((item) => (
                          <li key={item.id}>
                            <span className="profile-recent-category">
                              {item.category === "Movies" ? "FILM" : item.category === "Books" ? "BOOK" : "MUSIC"}
                            </span>
                            <span className="profile-recent-title"><strong>{item.title}</strong><small>{formatSavedDate(item.saved_at)} · {item.creator}</small></span>
                            <span className="profile-recent-genre">{item.genre}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="profile-empty-copy">Your saved discoveries will show up here.</p>
                    )}
                    <button type="button" className="text-button profile-library-link" onClick={() => navigate("Library")}>
                      Open your Library →
                    </button>
                  </section>
                </div>
                <section className="profile-panel profile-feedback-panel" aria-labelledby="profile-feedback-heading">
                  <div className="profile-panel-heading">
                    <span className="eyebrow">YOUR RECOMMENDATION SIGNALS</span>
                    <h2 id="profile-feedback-heading">What you respond to</h2>
                  </div>
                  {recommendationFeedbackItems.length ? (
                    <ul className="profile-feedback-list">
                      {recommendationFeedbackItems.slice(0, 4).map(({ item, feedback }) => (
                        <li key={item.id}>
                          <span className={`profile-feedback-mark ${feedback}`} aria-hidden="true">
                            {feedback === "more" ? "+" : "−"}
                          </span>
                          <span className="profile-feedback-title">
                            <strong>{item.title}</strong>
                            <small>{item.category} · {item.genre}</small>
                          </span>
                          <span className="profile-feedback-value">
                            {feedback === "more" ? "More like this" : "Not for me"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="profile-empty-copy">Use “More like this” or “Not for me” on a For You pick to shape future recommendations. Your latest signals will appear here.</p>
                  )}
                </section>
                <p className="profile-note">This snapshot reflects your saved items and recommendation feedback. It is not a trained personality or recommendation model.</p>
              </>
            )}
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

            {activePage === "Discover" && (
              <section className="for-you-section" aria-labelledby="for-you-heading">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">BUILT FROM YOUR LIBRARY</span>
                    <h2 id="for-you-heading">For you.</h2>
                  </div>
                  {account && (
                    <div className="for-you-actions">
                      <span className="result-count">
                        {recommendations.length > 0
                          ? `${recommendations.length} OF ${recommendationTotal} PICKS`
                          : "PERSONALIZED PICKS"}
                      </span>
                      <button
                        type="button"
                        className="refresh-button"
                        onClick={refreshRecommendations}
                        disabled={isRecommendationsLoading || recommendationNextOffset === null}
                        title={recommendationNextOffset === null ? "You’ve seen all current picks." : "Load the next batch of recommendations"}
                      >
                        <span aria-hidden="true">↻</span>
                        {isRecommendationsLoading ? "Loading…" : "Refresh picks"}
                      </button>
                    </div>
                  )}
                </div>
                {!account ? (
                  <div className="for-you-empty">
                    <p>Sign in and save a few favorites to get recommendations shaped by your genres.</p>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => {
                        setAuthMode("sign-in");
                        setAuthError(null);
                        setIsAuthOpen(true);
                      }}
                    >
                      Sign in to personalize <span>↗</span>
                    </button>
                  </div>
                ) : isCheckingAccount || isRecommendationsLoading ? (
                  <div className="catalog-loading" role="status">Finding your next favorites…</div>
                ) : recommendations.length > 0 ? (
                  <>
                    <p className="for-you-message">{recommendationMessage}</p>
                    {feedbackActionError && (
                      <p className="feedback-error" role="alert">{feedbackActionError}</p>
                    )}
                    <div className="media-grid recommendation-grid">
                      {recommendations.map(({ item, reason, feedback }) => (
                        <MediaCard
                          key={item.id}
                          item={item}
                          isSaved={saved.includes(item.id)}
                          onToggleSaved={toggleSaved}
                          recommendationReason={reason}
                          recommendationFeedback={feedback}
                          feedbackBusy={feedbackBusyIds.includes(item.id)}
                          onRecommendationFeedback={updateRecommendationFeedback}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="for-you-empty">
                    {feedbackActionError && (
                      <p className="feedback-error" role="alert">{feedbackActionError}</p>
                    )}
                    <p>{recommendationMessage || "Save a few items to your Library to get personalized picks."}</p>
                    <button type="button" className="text-button" onClick={() => navigate("Library")}>
                      Go to your Library →
                    </button>
                  </div>
                )}
                {recommendationFeedbackItems.length > 0 && (
                  <div className="feedback-history">
                    <span className="eyebrow">YOUR FEEDBACK</span>
                    <ul>
                      {recommendationFeedbackItems.map(({ item, feedback }) => (
                        <li key={item.id}>
                          <span>
                            <strong>{item.title}</strong>
                            <small>{feedback === "more" ? "More like this" : "Not for me"}</small>
                          </span>
                          <button
                            type="button"
                            disabled={feedbackBusyIds.includes(item.id)}
                            onClick={() => updateRecommendationFeedback(item.id, null)}
                          >
                            Undo
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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

                <div className="discovery-heading-actions">
                  {activePage === "Discover" && totalPages > 1 && (
                    <div className="pagination-quick-controls" aria-label="Quick catalog page controls">
                      <button
                        type="button"
                        aria-label="Previous catalog page"
                        disabled={pageNumber <= 1 || isCatalogLoading}
                        onClick={() => setPageNumber((page) => Math.max(1, page - 1))}
                      >←</button>
                      <button
                        type="button"
                        aria-label="Next catalog page"
                        disabled={pageNumber >= totalPages || isCatalogLoading}
                        onClick={() => setPageNumber((page) => Math.min(totalPages, page + 1))}
                      >→</button>
                    </div>
                  )}
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
                    <span aria-hidden="true">←</span> Previous
                  </button>
                  <div className="catalog-page-numbers" aria-label="Page number">
                    {visiblePageNumbers.map((page) => (
                      <button
                        type="button"
                        key={page}
                        className={page === pageNumber ? "current" : ""}
                        aria-current={page === pageNumber ? "page" : undefined}
                        aria-label={`Page ${page}`}
                        onClick={() => setPageNumber(page)}
                      >{page}</button>
                    ))}
                  </div>
                  <span className="catalog-page-total">of {totalPages}</span>
                  <button
                    type="button"
                    disabled={pageNumber >= totalPages}
                    onClick={() => setPageNumber((page) => Math.min(totalPages, page + 1))}
                  >
                    Next <span aria-hidden="true">→</span>
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
