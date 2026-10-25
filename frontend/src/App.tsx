import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import MediaCard from "./components/MediaCard";
import TasteMap from "./components/TasteMap";
import TasteSetup, { type TastePreferences } from "./components/TasteSetup";
import { TASTE_MOODS } from "./data/tasteOptions";
import CollectionsPage from "./components/CollectionsPage";
import CommunityPage from "./components/CommunityPage";
import ConnectionExplorer from "./components/ConnectionExplorer";
import { mediaItems } from "./data/media";
import {
  getCurrentAccount,
  exportAccountData,
  getLibraryActivity,
  getRecommendations,
  getSavedMedia,
  clearRecommendationFeedback,
  registerAccount,
  removeSavedMedia,
  deleteAccount,
  saveMedia,
  updateSavedMedia,
  setRecommendationFeedback,
  signIn,
} from "./services/accountApi";
import { getCatalog } from "./services/catalogApi";
import type { Account } from "./services/accountApi";
import type { LibraryActivity, Media, MediaCategory, MediaFilter, Recommendation, RecommendationPage, SavedMedia, SavedMediaUpdate } from "./types/media";
import "./App.css";

const categories: MediaFilter[] = ["All", "Movies", "Books", "Music"];

const navigationItems = [
  ["Discover", "⌂"],
  ["Taste Map", "◎"],
  ["Library", "▤"],
  ["Collections", "▧"],
  ["Community", "♧"],
  ["Your Profile", "◉"],
  ["Settings", "⚙"],
  ["Guide", "?"],
  ["About", "✦"],
  ["Contact", "✉"],
] as const;

type Page = (typeof navigationItems)[number][0];
type RecommendationStrategy = "auto" | "genre" | "item_item";
type SocialPrivacy = "private" | "friends" | "community";
type CategoryMix = Record<MediaCategory, number>;
type RecommendationTuning = { popularity: number; novelty: number; familiarity: number };
const defaultRecommendationTuning: RecommendationTuning = { popularity: 20, novelty: 15, familiarity: 65 };
type HeroSlide = {
  eyebrow: string;
  headline: string;
  highlight: string;
  description: string;
  action: string;
  destination: Page;
  category?: MediaFilter;
  artwork: Media[];
  landscapeImage?: string;
  landscapeAlt?: string;
};

const mediaCategories: MediaCategory[] = ["Movies", "Books", "Music"];
const recommendationBatchSize = 12;
const advancedTasteLimits = { genres: 12, favoriteArtists: 8, moods: 3 } as const;
const moodWords: Record<string, string[]> = {
  "thought-provoking": ["sci-fi", "science fiction", "drama", "philosophy", "art rock"],
  hopeful: ["adventure", "family", "comedy", "pop", "coming-of-age"],
  dreamy: ["fantasy", "electronic", "ambient", "romance", "surreal"],
  tense: ["thriller", "mystery", "horror", "crime", "dark"],
  comforting: ["comedy", "romance", "family", "slice of life", "acoustic"],
  adventurous: ["adventure", "fantasy", "action", "travel", "epic"],
  melancholic: ["drama", "indie", "folk", "r&b", "tragedy"],
  playful: ["comedy", "animation", "pop", "quirky", "adventure"],
  epic: ["sci-fi", "science fiction", "fantasy", "adventure", "orchestral"],
  intimate: ["romance", "drama", "indie", "acoustic", "memoir"],
};

function getHeroArtworkUrl(image: string | null) {
  if (!image) return "";
  return image
    .replace(/\/t\/p\/w\d+\//, "/t/p/original/")
    .replace(/-M(?=\.jpg(?:\?|$))/i, "-L");
}

function ContactLogo({ kind }: { kind: "email" | "instagram" | "whatsapp" | "github" }) {
  if (kind === "email") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h17v11h-17z" /><path d="m4 7 8 6 8-6" /></svg>;
  if (kind === "instagram") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" /><circle cx="12" cy="12" r="4.1" /><circle className="logo-fill" cx="17.7" cy="6.6" r="1.1" /></svg>;
  if (kind === "whatsapp") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.1 11.8a8.1 8.1 0 0 1-12 7.1L3.5 20l1.2-4.4a8.1 8.1 0 1 1 15.4-3.8Z" /><path d="M9.1 8.2c.2-.5.5-.5.8-.5h.4c.2 0 .4.1.5.4l.7 1.7c.1.3.1.5-.1.7l-.5.6c-.2.2-.2.4 0 .6.4.7 1.1 1.3 1.8 1.7.3.2.5.2.7-.1l.7-.8c.2-.2.4-.2.7-.1l1.6.8c.3.1.4.3.4.5 0 .3-.2 1.1-.7 1.5-.5.5-1.2.7-1.9.6-1-.2-2.2-.7-3.5-1.8-1.1-1-1.9-2.2-2.2-3.2-.3-.8-.1-1.7.2-2.3.1-.2.3-.4.5-.4Z" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path className="logo-fill" d="M12 .8a11.2 11.2 0 0 0-3.5 21.8c.6.1.8-.2.8-.6v-2.1c-3.1.7-3.8-1.3-3.8-1.3-.5-1.3-1.2-1.6-1.2-1.6-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 .1.7 1.8 3.1 1.4.1-.7.4-1.2.7-1.5-2.5-.3-5.1-1.2-5.1-5.5 0-1.2.4-2.1 1.1-2.9-.1-.3-.5-1.4.1-2.8 0 0 .9-.3 2.9 1.1a10 10 0 0 1 5.3 0c2-1.4 2.9-1.1 2.9-1.1.6 1.4.2 2.5.1 2.8.7.8 1.1 1.7 1.1 2.9 0 4.3-2.6 5.2-5.1 5.5.4.3.8 1 .8 2v2.7c0 .4.2.7.8.6A11.2 11.2 0 0 0 12 .8Z" /></svg>;
}

const discoveryPrompts: { label: string; category: MediaFilter; terms: string[] }[] = [
  { label: "Thoughtful sci-fi", category: "All", terms: ["sci-fi", "science fiction", "thought", "philosoph", "space"] },
  { label: "A book for a quiet weekend", category: "Books", terms: ["fiction", "novel", "quiet", "literary", "fantasy", "drama"] },
  { label: "Films to watch with friends", category: "Movies", terms: ["comedy", "adventure", "animation", "action", "friend"] },
  { label: "Music for a commute", category: "Music", terms: ["pop", "rock", "soul", "jazz", "indie", "electronic"] },
];

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

function readRecommendationTuning(): RecommendationTuning {
  try {
    const value = JSON.parse(localStorage.getItem("tastera_recommendation_tuning") ?? "null") as Partial<RecommendationTuning> | null;
    if (value && [value.popularity, value.novelty, value.familiarity].every((part) => typeof part === "number" && part >= 0 && part <= 100)) return value as RecommendationTuning;
  } catch { /* Use the balanced defaults. */ }
  return defaultRecommendationTuning;
}

function readSocialPrivacy(): SocialPrivacy {
  try {
    const value = localStorage.getItem("tastera_social_privacy");
    return value === "friends" || value === "community" ? value : "private";
  } catch { return "private"; }
}

function readTastePreferences(): TastePreferences {
  try {
    const value = JSON.parse(localStorage.getItem("tastera_taste_setup") ?? "null") as Partial<TastePreferences> | null;
    return {
      favoriteIds: Array.isArray(value?.favoriteIds) ? value.favoriteIds.filter((item): item is string => typeof item === "string") : [],
      favoriteItems: Array.isArray(value?.favoriteItems) ? value.favoriteItems.filter((item): item is Media => Boolean(item && typeof item.id === "string" && typeof item.title === "string" && ["Movies", "Books", "Music"].includes(item.category))) : [],
      favoriteArtists: Array.isArray(value?.favoriteArtists) ? value.favoriteArtists.filter((item): item is string => typeof item === "string") : [],
      genres: Array.isArray(value?.genres) ? value.genres.filter((item): item is string => typeof item === "string") : [],
      moods: Array.isArray(value?.moods) ? value.moods.filter((item): item is string => typeof item === "string") : [],
    };
  } catch {
    return { favoriteIds: [], favoriteItems: [], favoriteArtists: [], genres: [], moods: [] };
  }
}

function scoreTaste(item: Media, preferences: TastePreferences, catalog: Media[], feedbackItems: { item: Media; feedback: "more" | "less" }[] = []) {
  const favoriteItems = [...new Map([...catalog, ...preferences.favoriteItems].map((candidate) => [candidate.id, candidate])).values()].filter((candidate) => preferences.favoriteIds.includes(candidate.id));
  const genre = item.genre.toLowerCase();
  const creator = item.creator.toLowerCase();
  let score = preferences.genres.some((choice) => genre === choice.toLowerCase()) ? 10 : 0;
  if (preferences.favoriteArtists.some((artist) => creator === artist.toLowerCase())) score += 12;
  for (const favorite of favoriteItems) {
    if (favorite.id === item.id) { score -= 100; continue; }
    if (favorite.genre.toLowerCase() === genre) score += 6;
    if (favorite.category === item.category) score += 2;
    if (favorite.creator.toLowerCase() === creator) score += 8;
  }
  for (const signal of feedbackItems) {
    if (signal.item.id !== item.id && signal.item.genre.toLowerCase() === genre) score += signal.feedback === "more" ? 7 : -9;
  }
  const searchable = `${item.genre} ${item.title} ${item.connection}`.toLowerCase();
  for (const mood of preferences.moods) {
    if ((moodWords[mood.toLowerCase()] ?? []).some((word) => searchable.includes(word))) score += 2;
  }
  return score;
}

function tasteExplanation(item: Media, preferences: TastePreferences, catalog: Media[]) {
  const selected = [...new Map([...catalog, ...preferences.favoriteItems].map((candidate) => [candidate.id, candidate])).values()].filter((candidate) => preferences.favoriteIds.includes(candidate.id));
  const source = selected.find((candidate) => candidate.genre.toLowerCase() === item.genre.toLowerCase() && candidate.id !== item.id);
  if (source) return `Because you picked ${source.title}: both share ${item.genre}.`;
  const sameCreator = selected.find((candidate) => candidate.creator.toLowerCase() === item.creator.toLowerCase() && candidate.id !== item.id);
  if (sameCreator) return `Because you picked ${sameCreator.title} by ${item.creator}.`;
  const artist = preferences.favoriteArtists.find((name) => name.toLowerCase() === item.creator.toLowerCase());
  if (artist) return `You chose ${artist}; this album is by the artist you picked.`;
  const genre = preferences.genres.find((choice) => choice.toLowerCase() === item.genre.toLowerCase());
  if (genre) return `You selected ${genre} as a favorite genre.`;
  const searchable = `${item.genre} ${item.title} ${item.connection}`.toLowerCase();
  const mood = preferences.moods.find((choice) => (moodWords[choice.toLowerCase()] ?? []).some((word) => searchable.includes(word)));
  if (mood) return `You chose the ${mood.toLowerCase()} mood; this ${item.genre} pick shares those qualities.`;
  return `A ${item.genre} discovery from the catalog.`;
}

function explainRecommendation(
  recommendation: Recommendation,
  savedItems: Media[],
  feedbackItems: { item: Media; feedback: "more" | "less" }[],
  preferences: TastePreferences,
  catalog: Media[],
) {
  const qualities = recommendation.matched_genres.length ? recommendation.matched_genres : [recommendation.item.genre];
  const matches = (source: Media) => qualities.some((genre) => genre.toLowerCase() === source.genre.toLowerCase());
  const reason = recommendation.reason.toLowerCase();
  const mentionedFeedback = feedbackItems.find((entry) => entry.feedback === "more" && reason.includes(entry.item.title.toLowerCase()));
  if (mentionedFeedback) return `Because you asked for more like ${mentionedFeedback.item.title}; both share ${qualities.join(", ")}.`;
  const mentionedSaved = savedItems.find((source) => reason.includes(source.title.toLowerCase()));
  if (mentionedSaved) return `Because you saved ${mentionedSaved.title}; both share ${qualities.join(", ")}.`;
  const positiveFeedback = feedbackItems.find((entry) => entry.feedback === "more" && matches(entry.item));
  if (positiveFeedback) return `Because you asked for more like ${positiveFeedback.item.title}; both share ${qualities.join(", ")}.`;
  const savedSource = savedItems.find(matches);
  if (savedSource) return `Because you saved ${savedSource.title}; both share ${qualities.join(", ")}.`;
  if (preferences.favoriteIds.length || preferences.favoriteArtists.length || preferences.genres.length || preferences.moods.length) {
    return tasteExplanation(recommendation.item, preferences, catalog);
  }
  return recommendation.reason;
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
  preferences: TastePreferences = { favoriteIds: [], favoriteItems: [], favoriteArtists: [], genres: [], moods: [] },
  catalog: Media[] = [],
  savedItems: Media[] = [],
  feedbackItems: { item: Media; feedback: "more" | "less" }[] = [],
  tuning: RecommendationTuning = defaultRecommendationTuning,
): Promise<RecommendationPage> {
  const rawPages = await Promise.all(mediaCategories.map((category) =>
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
  const feedbackById = new Map<string, { item: Media; feedback: "more" | "less" }>();
  [...feedbackItems, ...rawPages.flatMap((page) => page.feedback_items)].forEach((entry) => feedbackById.set(entry.item.id, entry));
  const feedbackContext = [...feedbackById.values()];
  const pages = rawPages.map((page) => {
    const withScores = [...page.items].map((recommendation) => ({
      recommendation: { ...recommendation, reason: explainRecommendation(recommendation, savedItems, feedbackContext, preferences, catalog) },
      affinity: scoreTaste(recommendation.item, preferences, catalog, feedbackContext),
      popularity: recommendation.item.popularity_score ?? 0,
    }));
    const range = (value: number, values: number[]) => {
      const min = Math.min(...values);
      const max = Math.max(...values);
      return max === min ? 0.5 : (value - min) / (max - min);
    };
    const affinities = withScores.map((entry) => entry.affinity);
    const popularities = withScores.map((entry) => entry.popularity);
    const totalWeight = Math.max(1, tuning.popularity + tuning.novelty + tuning.familiarity);
    return {
      ...page,
      items: withScores
        .map(({ recommendation, affinity, popularity }) => {
          const familiar = range(affinity, affinities);
          const popular = range(popularity, popularities);
          const score = (popular * tuning.popularity + (1 - familiar) * tuning.novelty + familiar * tuning.familiarity) / totalWeight;
          return { recommendation, score };
        })
        .sort((left, right) => right.score - left.score)
        .map(({ recommendation }) => recommendation),
    };
  });
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

function statusLabelsForActivity(category: MediaCategory, value: string | null) {
  const labels: Record<MediaCategory, Record<string, string>> = {
    Movies: { planned: "Want to watch", in_progress: "Watching", finished: "Finished" },
    Books: { planned: "Want to read", in_progress: "Reading", finished: "Finished" },
    Music: { planned: "Want to listen", in_progress: "Listening", finished: "Finished" },
  };
  return labels[category][value ?? ""] ?? "Updated";
}

function App() {
  const [category, setCategory] = useState<MediaFilter>("All");
  const [search, setSearch] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(mediaItems.length);
  const [pageSize, setPageSize] = useState(() => {
    const stored = Number(localStorage.getItem("tastera_catalog_page_size"));
    return [50, 100, 150].includes(stored) ? stored : 50;
  });
  const [unavailableMusicArtwork, setUnavailableMusicArtwork] = useState<string[]>([]);
  const [savedItems, setSavedItems] = useState<SavedMedia[]>([]);
  const [libraryActivity, setLibraryActivity] = useState<LibraryActivity[]>([]);
  const [libraryUpdateBusyIds, setLibraryUpdateBusyIds] = useState<string[]>([]);
  const [libraryUpdateErrors, setLibraryUpdateErrors] = useState<Record<string, string>>({});
  const saved = useMemo(() => savedItems.map((item) => item.id), [savedItems]);
  const [activePage, setActivePage] = useState<Page>(() =>
    new URLSearchParams(window.location.search).get("page") === "Collections" || new URLSearchParams(window.location.search).has("sharedShelf") ? "Collections" : "Discover",
  );
  const [recommendationMix, setRecommendationMix] = useState<CategoryMix>(readStoredMix);
  const [recommendationStrategy, setRecommendationStrategy] = useState<RecommendationStrategy>(readStoredStrategy);
  const [recommendationTuning, setRecommendationTuning] = useState<RecommendationTuning>(readRecommendationTuning);
  const [socialPrivacy, setSocialPrivacy] = useState<SocialPrivacy>(readSocialPrivacy);
  const [accountDataNotice, setAccountDataNotice] = useState("");
  const [tastePreferences, setTastePreferences] = useState<TastePreferences>(readTastePreferences);
  const [tasteGenreSearch, setTasteGenreSearch] = useState("");
  const [tasteCreatorSearch, setTasteCreatorSearch] = useState("");
  const [tasteEditorNotice, setTasteEditorNotice] = useState("");
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
  const recommendationCatalog = useMemo(() => [...new Map([...mediaItems, ...catalog, ...tastePreferences.favoriteItems].map((item) => [item.id, item])).values()], [catalog, tastePreferences.favoriteItems]);
  const recommendationContext = useRef({ catalog: recommendationCatalog, feedbackItems: recommendationFeedbackItems });
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
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false);
  const [isTasteSetupOpen, setIsTasteSetupOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedSearchItem, setSelectedSearchItem] = useState<Media | null>(null);
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [activeDiscoveryPrompt, setActiveDiscoveryPrompt] = useState<(typeof discoveryPrompts)[number] | null>(null);
  const [genreFilter, setGenreFilter] = useState("All genres");

  const heroSlides = useMemo<HeroSlide[]>(() => {
    const itemFor = (mediaCategory: MediaCategory) =>
      catalog.find((item) => item.category === mediaCategory && item.image) ??
      mediaItems.find((item) => item.category === mediaCategory && item.image)!;
    const findTitle = (category: MediaCategory, titles: string[]) =>
      titles.map((title) => [...catalog, ...mediaItems].find((item) => item.category === category && item.image && item.title.toLowerCase() === title.toLowerCase()))
        .find((item): item is Media => Boolean(item)) ?? itemFor(category);
    const interstellar = findTitle("Movies", ["Interstellar"]);
    const arrival = findTitle("Movies", ["Arrival"]);
    const dune = findTitle("Movies", ["Dune"]);
    const bladeRunner = findTitle("Movies", ["Blade Runner 2049"]);
    const book = findTitle("Books", ["Annihilation", "The Midnight Library", "Dune"]);
    const music = findTitle("Music", ["Random Access Memories", "Blue Train", "After Hours"]);
    const otherBook = findTitle("Books", ["The Left Hand of Darkness", "The Midnight Library", "Project Hail Mary"]);
    const otherAlbum = findTitle("Music", ["After Hours", "Blue Train", "In Rainbows"]);
    const finalAlbum = findTitle("Music", ["Blue Train", "In Rainbows", "Moon Safari"]);

    return [
      {
        eyebrow: "INTERSTELLAR · A FILM BY CHRISTOPHER NOLAN",
        headline: "“Do not go gentle",
        highlight: "into that good night.”",
        description: "Some journeys across the universe still lead back to the people we love.",
        action: "Browse movies",
        destination: "Discover",
        category: "Movies",
        artwork: [interstellar],
        landscapeImage: "/images/hero-icy-world.png",
      },
      {
        eyebrow: "BOOKS · OPEN A NEW WORLD",
        headline: "Get lost in",
        highlight: "a good story.",
        description: "Explore books with the ideas, settings, and feelings you want more of.",
        action: "Explore books",
        destination: "Discover",
        category: "Books",
        artwork: [book],
        landscapeImage: "/images/hero-book-world.png",
        landscapeAlt: "A lone traveler looks across an otherworldly landscape at sunset.",
      },
      {
        eyebrow: "MUSIC · FIND YOUR SOUND",
        headline: "Set the mood.",
        highlight: "Press play.",
        description: "Discover albums that belong on the soundtrack to whatever comes next.",
        action: "Explore music",
        destination: "Discover",
        category: "Music",
        artwork: [music],
        landscapeImage: "/images/hero-music-studio.png",
        landscapeAlt: "A vintage microphone and analog mixing desk in a softly lit recording studio.",
      },
      {
        eyebrow: "TASTE MAP · FOLLOW THE THREADS",
        headline: "See what",
        highlight: "connects you.",
        description: "Trace the genres and shared interests that link the things you save and enjoy.",
        action: "Explore your Taste Map",
        destination: "Taste Map",
        artwork: [arrival, otherBook, otherAlbum],
        landscapeImage: "/images/hero-taste-map.png",
        landscapeAlt: "An observatory looks over a blue-hour valley dotted with warm lights.",
      },
      {
        eyebrow: "YOUR SETTINGS · MAKE IT YOURS",
        headline: "Shape your",
        highlight: "next discovery.",
        description: "Choose the balance of movies, books, and music you want in your For You picks.",
        action: "Tune your mix",
        destination: "Settings",
        artwork: [dune, bladeRunner, finalAlbum],
        landscapeImage: "/images/hero-personalization.png",
        landscapeAlt: "A cozy reading and listening nook lit by a warm desk lamp.",
      },
    ];
  }, [catalog]);

  useEffect(() => {
    if (activePage !== "Discover" || isHeroPaused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setHeroSlideIndex((index) => (index + 1) % heroSlides.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [activePage, heroSlides.length, isHeroPaused]);

  const activeHeroSlide = heroSlides[heroSlideIndex] ?? heroSlides[0];
  const guideArtwork = useMemo(() => {
    const pick = (mediaCategory: MediaCategory) =>
      catalog.find((item) => item.category === mediaCategory && item.image) ??
      mediaItems.find((item) => item.category === mediaCategory && item.image)!;
    return {
      movie: pick("Movies"),
      book: pick("Books"),
      music: pick("Music"),
    };
  }, [catalog]);

  function openGuideFeature(page: Page, mediaCategory?: MediaCategory) {
    setSearch("");
    setPageNumber(1);
    setCategory(mediaCategory ?? "All");
    navigate(page);
  }

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
        setLibraryActivity([]);
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
    if (!authToken || isCheckingAccount) {
      setLibraryActivity([]);
      return;
    }
    let cancelled = false;
    getLibraryActivity(authToken)
      .then((items) => { if (!cancelled) setLibraryActivity(items); })
      .catch(() => { if (!cancelled) setLibraryActivity([]); });
    return () => { cancelled = true; };
  }, [authToken, isCheckingAccount]);

  useEffect(() => {
    if (!authToken || isCheckingAccount) return;

    const controller = new AbortController();
    const loadRecommendations = window.setTimeout(() => {
      setIsRecommendationsLoading(true);
      getMixedRecommendationBatch(authToken, recommendationMix, recommendationStrategy, [], controller.signal, tastePreferences, recommendationContext.current.catalog, savedItems, recommendationContext.current.feedbackItems, recommendationTuning)
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
  }, [authToken, isCheckingAccount, savedItems, recommendationMix, recommendationStrategy, recommendationTuning, tastePreferences]);

  useEffect(() => {
    recommendationContext.current = { catalog: recommendationCatalog, feedbackItems: recommendationFeedbackItems };
  }, [recommendationCatalog, recommendationFeedbackItems]);

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
            limit: pageSize,
          },
          controller.signal,
        );

        setCatalog(page.items.filter((item) => item.category !== "Music" || (item.image && !unavailableMusicArtwork.includes(item.id))));
        setTotalPages(page.total_pages);
        setTotalItems(page.total);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;

        setCatalog(mediaItems.filter((item) => item.category !== "Music" || (item.image && !unavailableMusicArtwork.includes(item.id))));
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
  }, [activePage, category, search, pageNumber, pageSize, unavailableMusicArtwork]);

  const visibleMedia = useMemo(() => {
    const query = search.trim().toLowerCase();
    const source = activePage === "Library" ? savedItems : catalog;

    return source.filter((item) => {
      const matchesCategory =
        category === "All" || item.category === category;
      const matchesGenre = genreFilter === "All genres" || item.genre === genreFilter;
      const promptText = `${item.title} ${item.creator} ${item.genre} ${item.connection}`.toLowerCase();
      const matchesPrompt = !activeDiscoveryPrompt || activeDiscoveryPrompt.terms.some((term) => promptText.includes(term));

      const matchesSearch =
        query.length === 0 ||
        item.title.toLowerCase().includes(query) ||
        item.creator.toLowerCase().includes(query) ||
        item.genre.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query);

      return matchesCategory && matchesGenre && matchesPrompt && matchesSearch;
    });
  }, [activePage, activeDiscoveryPrompt, catalog, category, genreFilter, savedItems, search]);

  const availableGenres = useMemo(() => [...new Set(catalog
    .filter((item) => category === "All" || item.category === category)
    .map((item) => item.genre.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [catalog, category]);

  const tasteSetupComplete = tastePreferences.favoriteIds.length + tastePreferences.favoriteArtists.length + tastePreferences.genres.length + tastePreferences.moods.length > 0;
  const isTasteSetupRequired = !isCheckingAccount && !isAuthOpen && !tasteSetupComplete;
  const tasteGenreOptions = useMemo(() => [...new Set([...tastePreferences.genres, ...catalog.map((item) => item.genre.trim())].filter((genre) => genre && genre.toLowerCase() !== "genre not provided"))].sort((left, right) => left.localeCompare(right)), [catalog, tastePreferences.genres]);
  const tasteCreatorOptions = useMemo(() => [...new Set([...tastePreferences.favoriteArtists, ...catalog.filter((item) => item.category === "Music").map((item) => item.creator.trim())].filter(Boolean))].sort((left, right) => left.localeCompare(right)), [catalog, tastePreferences.favoriteArtists]);
  const filteredTasteGenres = tasteGenreOptions.filter((genre) => genre.toLowerCase().includes(tasteGenreSearch.trim().toLowerCase()));
  const filteredTasteCreators = tasteCreatorOptions.filter((creator) => creator.toLowerCase().includes(tasteCreatorSearch.trim().toLowerCase()));
  const guestRecommendations = useMemo(() => {
    if (!tasteSetupComplete || account) return [];
    const quotas = allocateMix(recommendationMix, recommendationBatchSize);
    const rankedByCategory = Object.fromEntries(mediaCategories.map((mediaCategory) => [mediaCategory, recommendationCatalog
      .filter((item) => item.category === mediaCategory && !tastePreferences.favoriteIds.includes(item.id))
      .map((item, index) => ({ item, score: scoreTaste(item, tastePreferences, recommendationCatalog), index }))
      .sort((left, right) => right.score - left.score || left.index - right.index)
    ])) as Record<MediaCategory, { item: Media; score: number; index: number }[]>;
    const selectedItems = mediaCategories.flatMap((mediaCategory) => rankedByCategory[mediaCategory].slice(0, quotas[mediaCategory]).map(({ item }) => item));
    const selectedIds = new Set(selectedItems.map((item) => item.id));
    for (const candidate of mediaCategories.flatMap((mediaCategory) => rankedByCategory[mediaCategory]).sort((left, right) => right.score - left.score)) {
      if (selectedItems.length >= recommendationBatchSize) break;
      if (!selectedIds.has(candidate.item.id)) {
        selectedItems.push(candidate.item);
        selectedIds.add(candidate.item.id);
      }
    }
    return selectedItems.map((item) => ({ item, reason: tasteExplanation(item, tastePreferences, recommendationCatalog), matched_genres: [item.genre] }));
  }, [account, recommendationCatalog, recommendationMix, tastePreferences, tasteSetupComplete]);

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

  function updateRecommendationTuning(key: keyof RecommendationTuning, value: number) {
    setRecommendationTuning((current) => {
      const next = { ...current, [key]: value };
      localStorage.setItem("tastera_recommendation_tuning", JSON.stringify(next));
      return next;
    });
    setSeenRecommendationIds([]);
  }

  function saveTasteSetup(preferences: TastePreferences) {
    localStorage.setItem("tastera_taste_setup", JSON.stringify(preferences));
    setTastePreferences(preferences);
    setIsTasteSetupOpen(false);
    setTasteEditorNotice("");
    setSeenRecommendationIds([]);
  }

  function toggleAdvancedTaste(field: "genres" | "favoriteArtists" | "moods", value: string) {
    const current = tastePreferences[field];
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : current.length < advancedTasteLimits[field]
        ? [...current, value]
        : null;
    if (!next) {
      setTasteEditorNotice(`Choose up to ${advancedTasteLimits[field]} ${field === "favoriteArtists" ? "artists" : field}. Remove one before adding another.`);
      return;
    }
    const preferences = { ...tastePreferences, [field]: next };
    localStorage.setItem("tastera_taste_setup", JSON.stringify(preferences));
    setTastePreferences(preferences);
    setTasteEditorNotice("");
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
            : [item, ...current],
        );
      }
      setLibraryActivity(await getLibraryActivity(authToken));
    } catch (error) {
      setSavedActionError(
        error instanceof Error ? error.message : "Could not update your Library.",
      );
    } finally {
      setSavingIds((current) => current.filter((savingId) => savingId !== id));
    }
  }

  async function updateLibraryItem(id: string, update: SavedMediaUpdate) {
    if (!authToken || libraryUpdateBusyIds.includes(id)) return;
    setLibraryUpdateBusyIds((current) => [...current, id]);
    setLibraryUpdateErrors((current) => ({ ...current, [id]: "" }));
    try {
      const updated = await updateSavedMedia(authToken, id, update);
      setSavedItems((current) => current.map((item) => item.id === id ? updated : item));
      setLibraryActivity(await getLibraryActivity(authToken));
    } catch (error) {
      setLibraryUpdateErrors((current) => ({
        ...current,
        [id]: error instanceof Error ? error.message : "Could not update this Library item.",
      }));
    } finally {
      setLibraryUpdateBusyIds((current) => current.filter((itemId) => itemId !== id));
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
      const page = await getMixedRecommendationBatch(authToken, recommendationMix, recommendationStrategy, [], undefined, tastePreferences, recommendationCatalog, savedItems, recommendationFeedbackItems, recommendationTuning);
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
        undefined,
        tastePreferences,
        recommendationCatalog,
        savedItems,
        recommendationFeedbackItems,
        recommendationTuning,
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
    setLibraryActivity([]);
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

  async function downloadAccountData() {
    if (!authToken) return;
    setAccountDataNotice("");
    try {
      const data = await exportAccountData(authToken);
      const browserData: Record<string, unknown> = {};
      ["tastera_taste_setup", "tastera_recommendation_mix", "tastera_recommendation_strategy", "tastera_recommendation_tuning", "tastera_collections_v1", "tastera_social_privacy", "tastera_demo_following_v1", "tastera_followed_community_shelves_v1"].forEach((key) => {
        const value = localStorage.getItem(key);
        if (value !== null) { try { browserData[key] = JSON.parse(value); } catch { browserData[key] = value; } }
      });
      const blob = new Blob([JSON.stringify({ ...data, browser_data: browserData }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "tastera-account-export.json";
      link.click();
      URL.revokeObjectURL(url);
      setAccountDataNotice("Your server-stored account data has been downloaded.");
    } catch (error) { setAccountDataNotice(error instanceof Error ? error.message : "Could not export your account data."); }
  }

  async function permanentlyDeleteAccount() {
    if (!authToken || !window.confirm("Permanently delete your Tastera account, Library, ratings, notes, progress, and feedback? This cannot be undone.")) return;
    try {
      await deleteAccount(authToken);
      signOut();
      ["tastera_taste_setup", "tastera_recommendation_mix", "tastera_recommendation_strategy", "tastera_recommendation_tuning", "tastera_collections_v1", "tastera_social_privacy", "tastera_demo_following_v1", "tastera_followed_community_shelves_v1"].forEach((key) => localStorage.removeItem(key));
      setAccountDataNotice("Your Tastera account and server-stored data were deleted.");
    } catch (error) { setAccountDataNotice(error instanceof Error ? error.message : "Could not delete your account."); }
  }

  function navigate(page: Page) {
    setActivePage(page);

    if (page !== "Discover" && page !== "Library") {
      setSearch("");
      setCategory("All");
      setActiveDiscoveryPrompt(null);
      setGenreFilter("All genres");
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
          <div className="sidebar-account-copy">
            <div className="profile-name" title={account?.email}>{account?.email ?? "Your taste profile"}</div>
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
            <div className="search-wrap" onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                window.setTimeout(() => setIsSearchFocused(false), 100);
              }
            }}>
              <form
                className="search-box"
                role="search"
                onSubmit={(event) => {
                  event.preventDefault();
                  setIsSearchFocused(true);
                  if (activePage !== "Library") navigate("Discover");
                }}
              >
              <span aria-hidden="true">⌕</span>
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setIsSearchFocused(true);
                  setPageNumber(1);
                  if (event.target.value.trim() && activePage !== "Discover" && activePage !== "Library") {
                    navigate("Discover");
                  }
                }}
                onFocus={() => setIsSearchFocused(true)}
                placeholder="Search titles, creators, or genres..."
                aria-label="Search media"
              />
              {search && (
                <button
                  type="button"
                  className="search-clear"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearch("");
                    setPageNumber(1);
                  }}
                >
                  ×
                </button>
              )}
              <button type="submit" className="search-submit" aria-label="Search">⌕</button>
              </form>
              {isSearchFocused && search.trim() && (
                <div className="search-suggestions" role="listbox" aria-label="Search results">
                  {activePage === "Discover" && isCatalogLoading ? (
                    <div className="search-suggestions-status">Searching Tastera’s catalog…</div>
                  ) : visibleMedia.length ? visibleMedia.slice(0, 7).map((item) => (
                    <button type="button" role="option" aria-selected="false" className="search-suggestion" key={item.id} onClick={() => {
                      setSelectedSearchItem(item);
                      setSearch("");
                      setIsSearchFocused(false);
                    }}>
                      <span className="search-suggestion-poster">{item.image ? <img src={item.image} alt="" /> : <span>{item.title.slice(0, 1)}</span>}</span>
                      <span className="search-suggestion-copy"><strong>{item.title}</strong><small>{item.category} · {item.creator}</small></span>
                      <span className="search-suggestion-arrow" aria-hidden="true">↗</span>
                    </button>
                  )) : <div className="search-suggestions-status">No catalog matches for “{search.trim()}”.</div>}
                  {visibleMedia.length > 7 && <div className="search-suggestions-foot">Showing 7 of {visibleMedia.length} matches</div>}
                </div>
              )}
            </div>
            {account ? (
              <div className="account-menu">
                <span className="account-identity"><span className="account-initial">{account.email[0]?.toUpperCase()}</span><span className="account-email">{account.email}</span></span>
                <button type="button" className="account-signout" onClick={signOut}>Sign out</button>
              </div>
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

        {activePage === "Collections" ? (
          <CollectionsPage catalog={catalog} />
        ) : activePage === "Community" ? (
          <CommunityPage catalog={recommendationCatalog} savedItems={savedItems} />
        ) : activePage === "Guide" ? (
          <section className="info-page guide-page" aria-labelledby="guide-heading">
            <div className="info-hero">
              <span className="eyebrow">TASTERA FIELD GUIDE · START HERE</span>
              <h1 id="guide-heading">A little map to <span>your next favorite.</span></h1>
              <p>Browse movies, books, and albums in one place. Search, save favorites, trace catalog-backed connections, and follow creators across the media they make. The panels below use real artwork from Tastera’s catalog.</p>
            </div>
            <div className="guide-grid guide-detailed-grid">
              <article className="guide-card">
                <div className="guide-real-visual guide-visual-discover">
                  <span className="guide-visual-label">TASTERA CATALOG · MOVIES</span>
                  <img src={getHeroArtworkUrl(guideArtwork.movie.image)} alt={`${guideArtwork.movie.title} artwork`} onError={(event) => event.currentTarget.remove()} />
                  <div className="guide-real-caption"><small>{guideArtwork.movie.genre} · {guideArtwork.movie.category}</small><strong>{guideArtwork.movie.title}</strong><span>{guideArtwork.movie.creator}</span></div>
                </div>
                <div className="guide-card-copy"><span className="guide-step">01 / DISCOVER</span><h2>Start with a world</h2><p>Use the Movies, Books, and Music filters to narrow the catalog. Search titles, creators, and genres, filter by genre, and choose 50, 100, or 150 items per page. Open a card to follow its creator or explore evidence-backed connections.</p><button type="button" className="text-button" onClick={() => openGuideFeature("Discover", "Movies")}>Browse movies →</button></div>
              </article>
              <article className="guide-card">
                <div className="guide-real-visual guide-visual-book">
                  <span className="guide-visual-label">TASTERA CATALOG · BOOKS</span>
                  <img src={getHeroArtworkUrl(guideArtwork.book.image)} alt={`${guideArtwork.book.title} cover`} onError={(event) => event.currentTarget.remove()} />
                  <div className="guide-real-caption"><small>{guideArtwork.book.genre} · {guideArtwork.book.category}</small><strong>{guideArtwork.book.title}</strong><span>{guideArtwork.book.creator}</span></div>
                </div>
                <div className="guide-card-copy"><span className="guide-step">02 / SEARCH & SAVE</span><h2>Keep the things that click</h2><p>Open a card to see its creator, genre, artwork, and “Why it connects” note. Save it to your account-backed Library, then choose a status, give it a 1–5 star rating, and add a private note. For books and albums, mark it as in progress and save a percentage as you go.</p><button type="button" className="text-button" onClick={() => openGuideFeature("Discover", "Books")}>Find a book →</button></div>
              </article>
              <article className="guide-card">
                <div className="guide-real-visual guide-visual-music">
                  <span className="guide-visual-label">TASTERA CATALOG · MUSIC</span>
                  <img src={getHeroArtworkUrl(guideArtwork.music.image)} alt={`${guideArtwork.music.title} album artwork`} onError={(event) => event.currentTarget.remove()} />
                  <div className="guide-real-caption"><small>{guideArtwork.music.genre} · {guideArtwork.music.category}</small><strong>{guideArtwork.music.title}</strong><span>{guideArtwork.music.creator}</span></div>
                </div>
                <div className="guide-card-copy"><span className="guide-step">03 / LIBRARY</span><h2>Build your own shelf</h2><p>Your Library brings saved films, books, and albums together. Track what you want to watch, read, or listen to; mark items finished; add private ratings and notes; and see recent changes in your activity history. Ratings influence future recommendation ranking.</p><button type="button" className="text-button" onClick={() => openGuideFeature("Library")}>Open your Library →</button></div>
              </article>
              <article className="guide-card">
                <div className="guide-real-visual guide-visual-map">
                  <span className="guide-visual-label">TASTERA · YOUR TASTE MAP</span>
                  <div className="guide-map-artwork">
                    {[guideArtwork.movie, guideArtwork.book, guideArtwork.music].map((item) => <img key={item.id} src={getHeroArtworkUrl(item.image)} alt="" onError={(event) => event.currentTarget.remove()} />)}
                  </div>
                  <div className="guide-map-visual-caption"><strong>Stories share more than a shelf.</strong><span>GENRE · MOOD · YOUR SIGNALS</span></div>
                </div>
                <div className="guide-card-copy"><span className="guide-step">04 / TASTE MAP</span><h2>Follow the lines</h2><p>Each node represents your taste, a saved or rated item, or a shared catalog genre. Drag to pan, scroll to zoom, and select a genre to browse matching catalog records. Item matches show the genre credit and your activity separately.</p><button type="button" className="text-button" onClick={() => openGuideFeature("Taste Map")}>Explore the Taste Map →</button></div>
              </article>
              <article className="guide-card">
                <div className="guide-real-visual guide-visual-settings">
                  <span className="guide-visual-label">TASTERA · PERSONALIZE</span>
                  <div className="guide-settings-preview"><b>FOR YOU</b><strong>Make your mix.</strong><span>60% MOVIES</span><i /><span>20% BOOKS</span><i /><span>20% MUSIC</span><i /></div>
                </div>
                <div className="guide-card-copy"><span className="guide-step">05 / FOR YOU & SETTINGS</span><h2>Tune the next batch</h2><p>Choose at least one favorite, artist, genre, or mood during first-run setup to unlock discovery. For You then uses your taste, saves, and feedback. Settings lets you expand to 12 genres, 8 artists, and 3 moods, adjust the category balance, and choose a movie ranking method.</p><button type="button" className="text-button" onClick={() => openGuideFeature("Settings")}>Adjust your settings →</button></div>
              </article>
              <article className="guide-card">
                <div className="guide-real-visual guide-visual-pathways">
                  <span className="guide-visual-label">TASTERA · FOLLOW A CONNECTION</span>
                  <div className="guide-pathway-preview"><span>FILM</span><i>→</i><span>BOOK</span><i>→</i><span>ALBUM</span><small>CREATOR · GENRE · EDITORIAL THEME</small></div>
                </div>
                <div className="guide-card-copy"><span className="guide-step">06 / PATHWAYS & CREATORS</span><h2>Follow a name or an idea</h2><p>From a title, explore related movies, books, and music. Each path explains whether it shares a catalog genre, creator credit, or a theme word in Tastera’s editorial notes. Open a creator page to see their catalog credits across media.</p><button type="button" className="text-button" onClick={() => openGuideFeature("Discover")}>Find a connection →</button></div>
              </article>
            </div>
            <div className="guide-tip"><span>✦</span><p><strong>Good first session:</strong> save two or three favorites from different categories, give a couple of recommendation picks feedback, then revisit your Profile and Taste Map. More signals make both views more useful.</p></div>
            <button type="button" className="primary-button guide-cta" onClick={() => openGuideFeature("Discover")}>Start exploring <span>↗</span></button>
          </section>
        ) : activePage === "About" ? (
          <section className="info-page about-page" aria-labelledby="about-heading">
            <div className="info-hero">
              <span className="eyebrow">WHY TASTERA EXISTS</span>
              <h1 id="about-heading">One curiosity can lead to <span>another world.</span></h1>
              <p>Tastera is a cross-media discovery project for people whose interests do not stay in one lane. A film can lead to a book; a book can lead to an album; a shared mood can connect all three.</p>
            </div>
            <div className="about-story-grid">
              <article className="about-story-card about-story-primary"><span className="eyebrow">THE IDEA</span><h2>Discovery should feel connected.</h2><p>Most catalogs stop at their own category. Tastera starts with movies, books, and music together, then gives people ways to move between them through genres, creators, shared themes, and their own taste signals.</p><p>The aim is not to tell you what you should like. It is to make the next interesting thing easier to find—and to make the path between discoveries visible.</p></article>
              <article className="about-story-card"><span className="eyebrow">WHAT YOU CAN DO</span><h2>One catalog, several ways in.</h2><ul><li>Search and filter movies, books, and music; choose 50, 100, or 150 results per page.</li><li>Complete the first-run taste setup by choosing at least one favorite, artist, genre, or mood before continuing.</li><li>Use Settings for expanded taste presets—up to 12 genres, 8 artists, and 3 moods—alongside category mix and movie ranking controls.</li><li>Save discoveries to an account-backed Library, track planned, in-progress, and finished items, rate them, and keep private notes.</li><li>Track book and album progress with a percentage and review recent Library activity. Your ratings contribute to your personal recommendation ranking.</li><li>Organize browser-based collections and share a collection link.</li><li>Refresh For You, tune its category mix, and give “More like this” or “Not for me” feedback.</li><li>Open cross-media pathways and creator pages, then explore saved and rated signals on the draggable Taste Map.</li></ul></article>
              <article className="about-story-card"><span className="eyebrow">CONNECTIONS, HONESTLY</span><h2>Every path shows its evidence.</h2><p>Creator pages group records with the same creator credit. Pathways can use an exact shared catalog genre, the same creator, or a shared word from Tastera editorial notes. Saved and feedback activity is called out separately, so it is not mistaken for catalog similarity.</p><p>Setting and influence credits are not consistently present in the catalog yet, so Tastera does not claim those links when the underlying data is missing. These pathways are explainable discovery links, not a trained cross-media ranking model.</p></article>
              <article className="about-story-card"><span className="eyebrow">BUILT IN PUBLIC</span><h2>An evolving independent project.</h2><p>Tastera is being developed by Soumadip Karan. The code, issues, and project progress are available in the public repository. Catalog information and artwork come from third-party sources; provider attribution and image rights remain with their respective owners.</p><div className="about-links"><a href="https://github.com/souma888/Tastera" target="_blank" rel="noreferrer">View the GitHub repository ↗</a><a href="https://github.com/souma888" target="_blank" rel="noreferrer">Meet the developer on GitHub ↗</a></div></article>
            </div>
            <div className="about-note"><span className="brand-mark">t.</span><p><strong>Discover beyond the obvious.</strong><br />The long-term direction is a transparent, evidence-led discovery experience across media—with better catalogs, clearer connections, and recommendations that earn your trust.</p></div>
          </section>
        ) : activePage === "Contact" ? (
          <section className="info-page contact-page" aria-labelledby="contact-heading">
            <div className="info-hero">
              <span className="eyebrow">CONTACT THE CREATOR</span>
              <h1 id="contact-heading">Help make the next version <span>better.</span></h1>
              <p>I’m Soumadip, the person building Tastera. Found a broken poster, a confusing connection, a book or album we should add, or a feature you wish existed? Send me the details directly.</p>
            </div>
            <div className="contact-intro"><span className="contact-avatar">S</span><div><strong>Soumadip Karan</strong><span>Creator & developer of Tastera</span><p>For bug reports, include the page name, what you expected, and what happened. For catalog suggestions, include the title and whether it is a movie, book, or album.</p></div></div>
            <div className="contact-grid contact-grid-detailed">
              <article className="contact-card"><span className="contact-icon"><ContactLogo kind="email" /></span><div><span className="eyebrow">EMAIL · BEST FOR FEEDBACK</span><a href="mailto:soumadipkaran8@gmail.com?subject=Tastera%20feedback">soumadipkaran8@gmail.com</a><a href="mailto:soumadipkaran88@gmail.com?subject=Tastera%20feedback">soumadipkaran88@gmail.com</a><small>Send an idea, bug report, or catalog correction.</small></div></article>
              <article className="contact-card"><span className="contact-icon contact-instagram"><ContactLogo kind="instagram" /></span><div><span className="eyebrow">INSTAGRAM</span><a href="https://www.instagram.com/soumadip1608?exln=b2xwZTRmdHNqdmlj" target="_blank" rel="noreferrer">@soumadip1608 ↗</a><small>Follow or send a direct message.</small></div></article>
              <article className="contact-card"><span className="contact-icon contact-whatsapp"><ContactLogo kind="whatsapp" /></span><div><span className="eyebrow">WHATSAPP</span><a href="https://wa.me/917074796529" target="_blank" rel="noreferrer">+91 70747 96529 ↗</a><small>Open a WhatsApp conversation.</small></div></article>
              <article className="contact-card"><span className="contact-icon contact-github"><ContactLogo kind="github" /></span><div><span className="eyebrow">TASTERA SOURCE CODE</span><a href="https://github.com/souma888/Tastera" target="_blank" rel="noreferrer">github.com/souma888/Tastera ↗</a><small>Browse the code and report project issues.</small></div></article>
              <article className="contact-card"><span className="contact-icon contact-github"><ContactLogo kind="github" /></span><div><span className="eyebrow">DEVELOPER PROFILE</span><a href="https://github.com/souma888" target="_blank" rel="noreferrer">github.com/souma888 ↗</a><small>See my other work on GitHub.</small></div></article>
            </div>
            <p className="contact-response-note">Please don’t send passwords or private account details. A page name and a short description are enough for me to investigate most issues.</p>
          </section>
        ) : activePage === "Settings" ? (
          <section className="settings-page" aria-labelledby="settings-heading">
            <div className="settings-hero">
              <span className="eyebrow">MAKE TASTERA YOURS</span>
              <h1 id="settings-heading">Discovery <span>settings.</span></h1>
              <p>Adjust how For You balances movies, books, and music. Your choices are saved in this browser.</p>
            </div>
            <section className="settings-panel taste-preferences-summary" aria-labelledby="taste-preferences-heading">
              <div className="settings-panel-heading">
                <div><span className="eyebrow">PERSONAL STARTING POINT</span><h2 id="taste-preferences-heading">Your taste setup</h2></div>
                <button type="button" className="taste-preferences-button" onClick={() => setIsTasteSetupOpen(true)}>{tasteSetupComplete ? "Edit choices" : "Choose favorites"}</button>
              </div>
              {tasteSetupComplete ? (
                <p>{tastePreferences.favoriteIds.length} favorite titles · {tastePreferences.favoriteArtists.length} artists · {tastePreferences.genres.length} genres · {tastePreferences.moods.length} moods. These starter preferences are stored in this browser and influence For You ranking.</p>
              ) : <p>Choose favorite films, books, music artists, genres, and moods to personalize For You before your Library has any saves.</p>}
            </section>
            <details className="settings-panel taste-advanced-panel">
              <summary>
                <span><span className="eyebrow">MORE CONTROL</span><strong>Advanced taste presets</strong><small>Choose a wider range of genres, creators, and moods for your recommendations.</small></span>
                <span className="taste-advanced-summary-count">{tastePreferences.genres.length} genres · {tastePreferences.favoriteArtists.length} artists · {tastePreferences.moods.length} moods</span>
              </summary>
              <div className="taste-advanced-content">
                <fieldset className="taste-choice-group">
                  <legend>Genre and theme presets <small>{tastePreferences.genres.length} / {advancedTasteLimits.genres} selected</small></legend>
                  <input className="taste-preset-search" type="search" value={tasteGenreSearch} onChange={(event) => setTasteGenreSearch(event.target.value)} placeholder="Find a genre or theme" aria-label="Find a genre or theme preset" />
                  <div className="taste-chip-list">
                    {filteredTasteGenres.slice(0, 32).map((genre) => <button type="button" key={genre} className={`taste-chip ${tastePreferences.genres.includes(genre) ? "selected" : ""}`} aria-pressed={tastePreferences.genres.includes(genre)} onClick={() => toggleAdvancedTaste("genres", genre)}>{genre}</button>)}
                    {!filteredTasteGenres.length && <p className="taste-setup-empty">No catalog genres match that search.</p>}
                  </div>
                  {filteredTasteGenres.length > 32 && <small className="taste-preset-hint">Showing 32 matches. Search to narrow the list.</small>}
                </fieldset>
                <fieldset className="taste-choice-group">
                  <legend>Artists and creators <small>{tastePreferences.favoriteArtists.length} / {advancedTasteLimits.favoriteArtists} selected</small></legend>
                  <input className="taste-preset-search" type="search" value={tasteCreatorSearch} onChange={(event) => setTasteCreatorSearch(event.target.value)} placeholder="Find a music artist" aria-label="Find a music artist preset" />
                  <div className="taste-chip-list">
                    {filteredTasteCreators.slice(0, 32).map((creator) => <button type="button" key={creator} className={`taste-chip ${tastePreferences.favoriteArtists.includes(creator) ? "selected" : ""}`} aria-pressed={tastePreferences.favoriteArtists.includes(creator)} onClick={() => toggleAdvancedTaste("favoriteArtists", creator)}>{creator}</button>)}
                    {!filteredTasteCreators.length && <p className="taste-setup-empty">No music creators match that search.</p>}
                  </div>
                  {filteredTasteCreators.length > 32 && <small className="taste-preset-hint">Showing 32 matches. Search to narrow the list.</small>}
                </fieldset>
                <fieldset className="taste-choice-group">
                  <legend>Mood presets <small>{tastePreferences.moods.length} / {advancedTasteLimits.moods} selected</small></legend>
                  <div className="taste-chip-list">
                    {TASTE_MOODS.map((mood) => <button type="button" key={mood} className={`taste-chip ${tastePreferences.moods.includes(mood) ? "selected" : ""}`} aria-pressed={tastePreferences.moods.includes(mood)} onClick={() => toggleAdvancedTaste("moods", mood)}>{mood}</button>)}
                  </div>
                </fieldset>
                {tasteEditorNotice && <p className="taste-editor-notice" role="status">{tasteEditorNotice}</p>}
                <p className="taste-preset-hint">These controls save automatically in this browser. The starter setup remains shorter; Settings lets you choose up to 12 genres, 8 artists, and 3 moods.</p>
              </div>
            </details>
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
              <div className="recommendation-tuning-grid" aria-label="Recommendation style controls">
                {([ ["popularity", "Popularity", "Favor catalog picks that more people know."], ["novelty", "Novelty", "Make room for less familiar genres and creators."], ["familiarity", "Familiarity", "Stay closer to themes already in your taste profile." ] ] as const).map(([key, label, description]) => (
                  <label className="recommendation-tuning-control" key={key}>
                    <span><strong>{label}</strong><b>{recommendationTuning[key]}%</b></span>
                    <input type="range" min="0" max="100" step="5" value={recommendationTuning[key]} onChange={(event) => updateRecommendationTuning(key, Number(event.target.value))} aria-label={`${label} recommendation preference`} />
                    <small>{description}</small>
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
            <section className="settings-panel social-privacy-panel" aria-labelledby="privacy-heading">
              <div className="settings-panel-heading"><div><span className="eyebrow">SOCIAL DISCOVERY</span><h2 id="privacy-heading">Your sharing preference</h2></div><span className="privacy-lock-mark">◈</span></div>
              <p>Choose how you would want your taste profile shared when real friend discovery launches. For now, the Community page uses fictional sample profiles only; no one else can see your Library.</p>
              <div className="settings-strategy-row"><label htmlFor="social-privacy">Profile visibility preference</label><select id="social-privacy" value={socialPrivacy} onChange={(event) => { const value = event.target.value as SocialPrivacy; setSocialPrivacy(value); localStorage.setItem("tastera_social_privacy", value); }}><option value="private">Private · only me</option><option value="friends">Friends · people I approve</option><option value="community">Community · public taste profile</option></select></div>
              <small className="settings-footnote">This preference is stored in this browser and does not publish data yet. Your account and Library remain private.</small>
            </section>
            <section className="settings-panel account-data-panel" aria-labelledby="account-data-heading">
              <div className="settings-panel-heading"><div><span className="eyebrow">YOUR DATA</span><h2 id="account-data-heading">Export or delete your account</h2></div></div>
              <p>Download a JSON copy of your account, Library, personal notes, progress, ratings, activity, and recommendation feedback. Or permanently remove server-stored account data.</p>
              <div className="account-data-actions"><button type="button" className="secondary-button" disabled={!account} onClick={() => void downloadAccountData()}>Download my data</button><button type="button" className="account-delete-button" disabled={!account} onClick={() => void permanentlyDeleteAccount()}>Delete account and data</button></div>
              {!account && <small className="settings-footnote">Sign in to export or delete an account.</small>}
              {accountDataNotice && <p className="account-data-notice" role="status">{accountDataNotice}</p>}
              <small className="settings-footnote">Collections and taste setup are stored in this browser; this export includes server-stored account data only.</small>
            </section>
          </section>
        ) : activePage === "Taste Map" ? (
          <TasteMap
            savedItems={savedItems}
            feedbackItems={recommendationFeedbackItems}
            catalog={recommendationCatalog}
            onExploreItem={setSelectedSearchItem}
            onExploreTheme={setSelectedTheme}
            onOpenCreator={setSelectedCreator}
          />
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
              <section className={`hero ${activeHeroSlide.landscapeImage ? "hero-has-landscape" : ""}`} aria-label="Featured discoveries" aria-roledescription="carousel" aria-live="off">
                <div className="hero-copy">
                  <span className="eyebrow">
                    <span className="status-dot" /> DISCOVERY, REIMAGINED
                  </span>

                  <h1>
                    {activeHeroSlide.headline}
                    <br />
                    <span>{activeHeroSlide.highlight}</span>
                  </h1>

                  <p>{activeHeroSlide.description}</p>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      setSearch("");
                      setPageNumber(1);
                      setCategory(activeHeroSlide.category ?? "All");
                      navigate(activeHeroSlide.destination);
                      if (activeHeroSlide.destination === "Discover") {
                        window.setTimeout(() => document.getElementById("discovery")?.scrollIntoView({ behavior: "smooth" }), 0);
                      }
                    }}
                  >
                    {activeHeroSlide.action} <span>↗</span>
                  </button>
                  <div className="hero-controls" aria-label="Featured slide controls">
                    <button
                      type="button"
                      className="hero-arrow"
                      aria-label="Previous featured item"
                      onClick={() => setHeroSlideIndex((index) => (index - 1 + heroSlides.length) % heroSlides.length)}
                    >←</button>
                    <div className="hero-dots" aria-label="Choose featured item">
                      {heroSlides.map((slide, index) => (
                        <button
                          type="button"
                          key={slide.eyebrow}
                          className={index === heroSlideIndex ? "active" : ""}
                          aria-label={`Show ${slide.eyebrow.toLowerCase()}`}
                          aria-pressed={index === heroSlideIndex}
                          onClick={() => setHeroSlideIndex(index)}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      className="hero-arrow"
                      aria-label="Next featured item"
                      onClick={() => setHeroSlideIndex((index) => (index + 1) % heroSlides.length)}
                    >→</button>
                    <button
                      type="button"
                      className="hero-pause"
                      aria-label={isHeroPaused ? "Resume featured rotation" : "Pause featured rotation"}
                      onClick={() => setIsHeroPaused((paused) => !paused)}
                    >{isHeroPaused ? "Play" : "Pause"}</button>
                  </div>
                </div>

                <div className="hero-art">
                  <span className="hero-slide-eyebrow">{activeHeroSlide.eyebrow}</span>
                  {activeHeroSlide.landscapeImage ? (
                    <div className="hero-single-art hero-landscape-art">
                      <img className="hero-landscape-image" src={activeHeroSlide.landscapeImage} alt={activeHeroSlide.landscapeAlt ?? "Featured landscape artwork"} fetchPriority="high" />
                    </div>
                  ) : activeHeroSlide.artwork.length === 1 ? (
                    <div className="hero-single-art">
                      <img className="hero-art-backdrop" src={getHeroArtworkUrl(activeHeroSlide.artwork[0].image)} alt="" aria-hidden="true" onError={(event) => { event.currentTarget.style.opacity = "0"; }} />
                      <img className="hero-art-poster" src={getHeroArtworkUrl(activeHeroSlide.artwork[0].image)} alt={`${activeHeroSlide.artwork[0].title} cover`} fetchPriority="high" onError={(event) => { event.currentTarget.style.opacity = "0"; }} />
                    </div>
                  ) : (
                    <div className="hero-collage">
                      {activeHeroSlide.artwork.map((item) => <img key={item.id} src={getHeroArtworkUrl(item.image)} alt={`${item.title} cover`} onError={(event) => { event.currentTarget.style.opacity = "0"; }} />)}
                    </div>
                  )}
                  <div className="hero-art-overlay" />
                  <div className="hero-glow" />
                </div>

                <div className="hero-index">{String(heroSlideIndex + 1).padStart(2, "0")} — {String(heroSlides.length).padStart(2, "0")}</div>
              </section>
            )}

            {activePage === "Discover" && (
              <section className="for-you-section" aria-labelledby="for-you-heading">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">{account ? "YOUR TASTE, YOUR NEXT PICKS" : "START PERSONALIZING BEFORE YOU SAVE"}</span>
                    <h2 id="for-you-heading">For you.</h2>
                  </div>
                  <div className="for-you-actions">
                    {account && (
                      <span className="result-count">
                        {recommendations.length > 0
                          ? `${recommendations.length} OF ${recommendationTotal} PICKS`
                          : "PERSONALIZED PICKS"}
                      </span>
                    )}
                    <button type="button" className="taste-preferences-button" onClick={() => setIsTasteSetupOpen(true)}>
                      {tasteSetupComplete ? "Edit my tastes" : "Set up my taste"}
                    </button>
                    {account && (
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
                    )}
                  </div>
                </div>
                {!account ? (
                  tasteSetupComplete ? (
                    <>
                      <p className="for-you-message">Your first picks are based on the favorites, artists, genres, and moods you chose. Sign in to save items and keep your taste across devices.</p>
                      <div className="media-grid recommendation-grid">
                        {guestRecommendations.map((recommendation) => <MediaCard key={recommendation.item.id} item={recommendation.item} isSaved={false} onToggleSaved={toggleSaved} recommendationReason={recommendation.reason} onExplore={setSelectedSearchItem} onOpenCreator={setSelectedCreator} />)}
                      </div>
                    </>
                  ) : (
                    <div className="for-you-empty taste-onboarding-cta">
                      <div><strong>Start with what you already love.</strong><p>Pick favorite films, books, artists, genres, and moods to get a first recommendation batch before you save anything.</p></div>
                      <button type="button" className="primary-button" onClick={() => setIsTasteSetupOpen(true)}>Choose my tastes <span>↗</span></button>
                    </div>
                  )
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
                          onExplore={setSelectedSearchItem}
                          onOpenCreator={setSelectedCreator}
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
                    <p>{recommendationMessage || "Save a few items or set up your taste to get personalized picks."}</p>
                    <button type="button" className="text-button" onClick={() => setIsTasteSetupOpen(true)}>Set up your taste →</button>
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

              {activePage === "Discover" && (
                <section className="discovery-prompts" aria-label="Mood and occasion discovery">
                  <div className="discovery-prompts-heading"><span className="eyebrow">WHAT ARE YOU IN THE MOOD FOR?</span><span>Browse by feeling or moment</span></div>
                  <div className="discovery-prompt-list">
                    {discoveryPrompts.map((prompt) => (
                      <button
                        type="button"
                        key={prompt.label}
                        className={activeDiscoveryPrompt?.label === prompt.label ? "selected" : ""}
                        aria-pressed={activeDiscoveryPrompt?.label === prompt.label}
                        onClick={() => {
                          const next = activeDiscoveryPrompt?.label === prompt.label ? null : prompt;
                          setActiveDiscoveryPrompt(next);
                          setCategory(next?.category ?? "All");
                          setGenreFilter("All genres");
                          setPageNumber(1);
                        }}
                      >{prompt.label}</button>
                    ))}
                  </div>
                </section>
              )}

              <div className="category-tabs" aria-label="Filter by category">
                {categories.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={category === item ? "selected" : ""}
                    aria-pressed={category === item}
                    onClick={() => {
                      setCategory(item);
                      setActiveDiscoveryPrompt(null);
                      setGenreFilter("All genres");
                      setPageNumber(1);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>

              {activePage === "Discover" && (
                <div className="catalog-filter-row">
                  <label htmlFor="catalog-page-size">Items per page</label>
                  <select id="catalog-page-size" value={pageSize} onChange={(event) => {
                    const next = Number(event.target.value);
                    setPageSize(next);
                    localStorage.setItem("tastera_catalog_page_size", String(next));
                    setPageNumber(1);
                  }}>
                    {[50, 100, 150].map((count) => <option key={count} value={count}>{count}</option>)}
                  </select>
                  <label htmlFor="catalog-genre-filter">Genre</label>
                  <select id="catalog-genre-filter" value={genreFilter} onChange={(event) => { setGenreFilter(event.target.value); setPageNumber(1); }}>
                    <option>All genres</option>
                    {availableGenres.map((genre) => <option key={genre}>{genre}</option>)}
                  </select>
                  <span>Catalog is ordered by popularity. More filters appear as reliable metadata becomes available.</span>
                </div>
              )}

              {activePage === "Library" && account && (
                <section className="library-activity-panel" aria-labelledby="library-activity-heading">
                  <div className="library-activity-heading">
                    <div><span className="eyebrow">YOUR RECENT ACTIVITY</span><h3 id="library-activity-heading">A little history</h3></div>
                    <span>{libraryActivity.length} recent updates</span>
                  </div>
                  {libraryActivity.length ? (
                    <ol className="library-activity-list">
                      {libraryActivity.slice(0, 8).map((event) => {
                        const descriptions: Record<string, string> = {
                          saved: "Added to your Library",
                          removed: "Removed from your Library",
                          status: `Status · ${statusLabelsForActivity(event.category, event.value)}`,
                          rating: event.value === "cleared" ? "Rating cleared" : `Rated ${event.value}/5`,
                          note: event.value === "cleared" ? "Private note cleared" : "Private note saved",
                          progress: event.value === "cleared" ? "Progress cleared" : `Progress · ${event.value}%`,
                        };
                        return <li key={event.id}><span className="library-activity-marker" aria-hidden="true">✦</span><div><strong>{event.title}</strong><p>{descriptions[event.event_type] ?? "Library updated"}</p></div><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time></li>;
                      })}
                    </ol>
                  ) : <p className="library-activity-empty">Save an item or add a rating to start your private activity history.</p>}
                </section>
              )}

              {search.trim() && (
                <p className="search-result-summary" role="status" aria-live="polite">
                  {activePage === "Discover" && isCatalogLoading
                    ? `Searching for “${search.trim()}”…`
                    : "Choose a result from the search panel above to preview it."}
                </p>
              )}

              {activePage === "Library" && isCheckingAccount ? (
                <div className="catalog-loading" role="status">
                  Loading your Library…
                </div>
              ) : search.trim() ? (
                <div className="search-inline-hint">Your matching titles appear in the search panel above. Select one to see its artwork and details.</div>
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
                      onExplore={setSelectedSearchItem}
                      onOpenCreator={setSelectedCreator}
                      onArtworkUnavailable={(id) => setUnavailableMusicArtwork((current) => current.includes(id) ? current : [...current, id])}
                      libraryItem={activePage === "Library" ? savedItems.find((savedItem) => savedItem.id === item.id) : undefined}
                      onUpdateLibraryItem={activePage === "Library" ? updateLibraryItem : undefined}
                      libraryUpdateBusy={libraryUpdateBusyIds.includes(item.id)}
                      libraryUpdateError={libraryUpdateErrors[item.id] || null}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <h3>
                    {search.trim()
                      ? `No matches for “${search.trim()}”`
                      : activePage === "Library"
                        ? "Your library is empty."
                        : "Nothing here just yet."}
                  </h3>
                  <p>
                    {search.trim()
                      ? "Try a different title, creator, genre, or category."
                      : activePage === "Library"
                        ? account
                          ? "Save a discovery with the heart button and it will appear here."
                          : "Sign in to save discoveries to your personal Library."
                        : "Try another search or select a different category."}
                  </p>
                  {activePage === "Library" && !account && !search.trim() && (
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

              {!search.trim() && !isCatalogLoading && activePage === "Discover" && totalPages > 1 && (
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

      {!isAuthOpen && (isTasteSetupOpen || isTasteSetupRequired) && <TasteSetup catalog={recommendationCatalog} initial={tastePreferences} required={isTasteSetupRequired} onSave={saveTasteSetup} onCancel={() => setIsTasteSetupOpen(false)} />}

      {(selectedSearchItem || selectedCreator || selectedTheme) && (
        <ConnectionExplorer
          key={selectedSearchItem?.id ?? selectedCreator ?? selectedTheme}
          item={selectedSearchItem}
          creator={selectedCreator}
          theme={selectedTheme}
          catalog={recommendationCatalog}
          savedItems={savedItems}
          feedbackItems={recommendationFeedbackItems}
          onToggleSaved={toggleSaved}
          onClose={() => { setSelectedSearchItem(null); setSelectedCreator(null); setSelectedTheme(null); }}
        />
      )}

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
