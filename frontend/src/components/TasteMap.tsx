import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { useMemo, useRef, useState } from "react";
import type { Media } from "../types/media";
import "./TasteMap.css";

type NodeKind = "you" | "movie" | "tv" | "book" | "music" | "game" | "podcast" | "theme";
type Filter = Exclude<NodeKind, "you"> | "all";
type TasteNode = {
  id: string;
  label: string;
  kind: NodeKind;
  x: number;
  y: number;
  size: number;
  description: string;
  connection: string;
  genre?: string;
};
type TasteLink = { from: string; to: string; id: string };
type PanGesture = { pointerId: number; startX: number; startY: number; originX: number; originY: number };
type TasteMapProps = {
  savedItems: Media[];
  feedbackItems: { item: Media; feedback: "more" | "less" }[];
  catalog: Media[];
  onExploreItem: (item: Media) => void;
  onExploreTheme: (genre: string) => void;
  onOpenCreator: (creator: string) => void;
};

const filterOptions: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Movies", value: "movie" },
  { label: "TV", value: "tv" },
  { label: "Books", value: "book" },
  { label: "Music", value: "music" },
  { label: "Games", value: "game" },
  { label: "Podcasts", value: "podcast" },
  { label: "Shared genres", value: "theme" },
];

function nodeKind(category: Media["category"]): NodeKind {
  return category === "Movies" ? "movie" : category === "TV" ? "tv" : category === "Books" ? "book" : category === "Games" ? "game" : category === "Podcasts" ? "podcast" : "music";
}

function genreKeys(value: string) {
  return value.toLowerCase().replace(/\bsci[ -]?fi\b/g, "science fiction").split(/[,;|/]/).map((part) => part.trim()).filter(Boolean);
}

function makeGraph(
  savedItems: Media[],
  feedbackItems: TasteMapProps["feedbackItems"],
): { nodes: TasteNode[]; links: TasteLink[]; trackedCount: number } {
  const entries = new Map<string, { item: Media; saved: boolean; feedback?: "more" | "less" }>();
  savedItems.forEach((item) => entries.set(item.id, { item, saved: true }));
  feedbackItems.forEach(({ item, feedback }) => {
    const existing = entries.get(item.id);
    entries.set(item.id, { item, saved: existing?.saved ?? false, feedback });
  });

  const tracked = [...entries.values()].sort((left, right) =>
    left.item.title.localeCompare(right.item.title),
  );
  const shown = tracked.slice(0, 8);
  const themes = new Map<string, { label: string; items: typeof shown }>();
  shown.forEach((entry) => {
    const key = entry.item.genre.trim().toLocaleLowerCase() || "uncategorized";
    const theme = themes.get(key) ?? { label: entry.item.genre || "Uncategorized", items: [] };
    theme.items.push(entry);
    themes.set(key, theme);
  });
  const rankedThemes = [...themes.entries()]
    .sort((left, right) => right[1].items.length - left[1].items.length || left[1].label.localeCompare(right[1].label))
    .slice(0, 6);

  const nodes: TasteNode[] = [{
    id: "you",
    label: "YOUR TASTE",
    kind: "you",
    x: 50,
    y: 51,
    size: 96,
    description: `${savedItems.length} saved items and ${feedbackItems.length} recommendation signals shape this map.`,
    connection: "Connections are built from genres attached to the items you saved or rated.",
  }];
  const links: TasteLink[] = [];
  const themeIdByGenre = new Map<string, string>();

  rankedThemes.forEach(([key, theme], index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / rankedThemes.length;
    const id = `theme-${encodeURIComponent(key)}`;
    themeIdByGenre.set(key, id);
    nodes.push({
      id,
      label: theme.label,
      kind: "theme",
      x: 50 + Math.cos(angle) * 26,
      y: 51 + Math.sin(angle) * 26,
      size: 64,
      description: `This genre appears on ${theme.items.length} item${theme.items.length === 1 ? "" : "s"} in your taste signals.`,
      connection: "Each line joins this genre to an item in your Library or recommendation feedback.",
      genre: theme.label,
    });
    links.push({ from: "you", to: id, id: `you-${id}` });
  });

  shown.forEach((entry, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(shown.length, 1) + 0.18;
    const kind = nodeKind(entry.item.category);
    const themeId = themeIdByGenre.get(entry.item.genre.trim().toLocaleLowerCase());
    const signal = entry.saved
      ? "Saved in your Library"
      : entry.feedback === "more"
        ? "You asked for more like this"
        : "You marked this not for you";
    nodes.push({
      id: entry.item.id,
      label: entry.item.title,
      kind,
      x: 50 + Math.cos(angle) * 43,
      y: 51 + Math.sin(angle) * 43,
      size: 78,
      description: `${entry.item.category} · ${entry.item.creator} · ${entry.item.genre}`,
      connection: `${signal}. Its catalog genre connects it to ${entry.item.genre || "Uncategorized"}.`,
    });
    if (themeId) links.push({ from: themeId, to: entry.item.id, id: `${themeId}-${entry.item.id}` });
  });

  return { nodes, links, trackedCount: tracked.length };
}

export default function TasteMap({ savedItems, feedbackItems, catalog, onExploreItem, onExploreTheme, onOpenCreator }: TasteMapProps) {
  const [selectedId, setSelectedId] = useState("you");
  const [filter, setFilter] = useState<Filter>("all");
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panGesture = useRef<PanGesture | null>(null);
  const graph = useMemo(() => makeGraph(savedItems, feedbackItems), [savedItems, feedbackItems]);
  const selected = graph.nodes.find((node) => node.id === selectedId) ?? graph.nodes[0];
  const categoryNodeIds = new Set(graph.nodes.filter((node) => node.kind === filter).map((node) => node.id));
  const relatedThemeIds = new Set(graph.links.flatMap((link) => {
    if (categoryNodeIds.has(link.from)) return [link.to];
    if (categoryNodeIds.has(link.to)) return [link.from];
    return [];
  }));
  const visibleNodes = graph.nodes.filter((node) =>
    node.kind === "you" || filter === "all" || node.kind === filter ||
    (filter !== "theme" && node.kind === "theme" && relatedThemeIds.has(node.id)),
  );
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const kindLabel: Record<NodeKind, string> = {
    you: "YOUR PROFILE",
    movie: "MOVIE",
    tv: "TV SHOW",
    book: "BOOK",
    music: "MUSIC",
    game: "GAME",
    podcast: "PODCAST",
    theme: "SHARED GENRE",
  };
  const selectedEntry = [...savedItems, ...feedbackItems.map((entry) => entry.item)].find((item) => item.id === selected.id);
  const relatedCatalogItems = catalog.filter((item) => {
    if (item.id === selected.id) return false;
    if (selected.kind === "theme") return genreKeys(item.genre).includes(genreKeys(selected.genre ?? "")[0] ?? "");
    if (selectedEntry) return genreKeys(item.genre).some((genre) => genreKeys(selectedEntry.genre).includes(genre)) || item.creator.toLowerCase() === selectedEntry.creator.toLowerCase();
    const tasteGenres = [...savedItems, ...feedbackItems.map((entry) => entry.item)].flatMap((entry) => genreKeys(entry.genre));
    return genreKeys(item.genre).some((genre) => tasteGenres.includes(genre));
  }).slice(0, 6);
  const relatedTitle = selected.kind === "theme" ? `Catalog items tagged ${selected.genre}` : selectedEntry ? `Related to ${selectedEntry.title}` : "Items in your taste neighborhood";

  function beginPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest(".taste-node, .map-controls"))) return;
    panGesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
  }

  function movePan(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = panGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const maxX = bounds.width * (0.22 + Math.abs(viewport.zoom - 1) * 0.38);
    const maxY = bounds.height * (0.22 + Math.abs(viewport.zoom - 1) * 0.38);
    setViewport((current) => ({
      ...current,
      x: Math.max(-maxX, Math.min(maxX, gesture.originX + event.clientX - gesture.startX)),
      y: Math.max(-maxY, Math.min(maxY, gesture.originY + event.clientY - gesture.startY)),
    }));
  }

  function endPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (panGesture.current?.pointerId !== event.pointerId) return;
    panGesture.current = null;
    setIsPanning(false);
  }

  function zoomMap(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    setViewport((current) => ({
      ...current,
      zoom: Math.max(0.65, Math.min(1.8, current.zoom + (event.deltaY < 0 ? 0.1 : -0.1))),
    }));
  }

  return (
    <section className="taste-page">
      <header className="taste-heading">
        <div>
          <span className="eyebrow">YOUR PERSONAL UNIVERSE</span>
          <h1>Your taste is <span>connected.</span></h1>
          <p>Explore the genres that connect items you have saved and recommendation feedback you have given.</p>
        </div>
        <div className="taste-stat">
          <strong>{graph.trackedCount}</strong>
          <span>SAVED + RATED</span>
        </div>
      </header>

      <div className="taste-filters" aria-label="Filter taste map">
        {filterOptions.map((item) => (
          <button
            key={item.value}
            type="button"
            className={filter === item.value ? "selected" : ""}
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
          >{item.label}</button>
        ))}
      </div>

      <div className="taste-layout">
        <div
          className={`taste-canvas ${isPanning ? "is-panning" : ""}`}
          role="region"
          tabIndex={0}
          aria-describedby="taste-map-keyboard-hint"
          onKeyDown={(event) => {
            const step = event.shiftKey ? 64 : 28;
            if (event.key === "ArrowLeft") setViewport((current) => ({ ...current, x: current.x + step }));
            else if (event.key === "ArrowRight") setViewport((current) => ({ ...current, x: current.x - step }));
            else if (event.key === "ArrowUp") setViewport((current) => ({ ...current, y: current.y + step }));
            else if (event.key === "ArrowDown") setViewport((current) => ({ ...current, y: current.y - step }));
            else if (event.key === "+" || event.key === "=") setViewport((current) => ({ ...current, zoom: Math.min(1.8, current.zoom + 0.15) }));
            else if (event.key === "-") setViewport((current) => ({ ...current, zoom: Math.max(0.65, current.zoom - 0.15) }));
            else if (event.key === "Home") setViewport({ x: 0, y: 0, zoom: 1 });
            else return;
            event.preventDefault();
          }}
          onPointerDown={beginPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onWheel={zoomMap}
          aria-label="Interactive taste map. Drag to pan and scroll to zoom."
        >
          <div className="constellation-label"><span className="constellation-dot" />YOUR SAVED TASTE GRAPH</div>
          <div className="map-controls" aria-label="Taste Map controls">
            <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => setViewport((current) => ({ ...current, zoom: Math.min(1.8, current.zoom + 0.15) }))}>+</button>
            <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => setViewport((current) => ({ ...current, zoom: Math.max(0.65, current.zoom - 0.15) }))}>−</button>
            <button type="button" className="map-reset" onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}>Reset view</button>
          </div>
          <div
            className="taste-world"
            style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}
          >
            <svg className="taste-connections" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {graph.links.map((link) => {
                if (!visibleIds.has(link.from) || !visibleIds.has(link.to)) return null;
                const from = graph.nodes.find((node) => node.id === link.from);
                const to = graph.nodes.find((node) => node.id === link.to);
                if (!from || !to) return null;
                const isSelected = selectedId === link.from || selectedId === link.to;
                return (
                  <path
                    key={link.id}
                    d={`M ${from.x} ${from.y} Q ${(from.x + to.x) / 2 + 2} ${(from.y + to.y) / 2 - 2} ${to.x} ${to.y}`}
                    className={isSelected ? "taste-link active" : "taste-link"}
                  />
                );
              })}
            </svg>
            {graph.nodes.map((node) => {
              const isVisible = visibleIds.has(node.id);
              return (
                <button
                  key={node.id}
                  type="button"
                  className={["taste-node", `node-${node.kind}`, selectedId === node.id ? "is-selected" : "", !isVisible ? "is-filtered-out" : ""].join(" ")}
                  style={{ left: `${node.x}%`, top: `${node.y}%`, "--node-size": `${node.size}px` } as CSSProperties}
                  onClick={() => setSelectedId(node.id)}
                  onMouseEnter={() => setSelectedId(node.id)}
                  onFocus={() => setSelectedId(node.id)}
                  aria-pressed={selectedId === node.id}
                  aria-label={`Explore ${node.label}`}
                  title={`${node.label}. ${node.connection}`}
                >
                  <span className="taste-node-dot" />
                  <span className="taste-node-label">{node.label}</span>
                </button>
              );
            })}
          </div>
          <p className="map-interaction-hint" id="taste-map-keyboard-hint">Drag or use arrow keys to pan · Scroll or use + / − to zoom · Home resets · Hover or focus a node to trace its links</p>
          <div className="constellation-legend">
            <span><i className="legend-movie" /> Movies</span>
            <span><i className="legend-book" /> Books</span>
            <span><i className="legend-music" /> Music</span>
            <span><i className="legend-theme" /> Genres</span>
          </div>
        </div>

        <aside className="taste-detail">
          <span className="eyebrow">SELECTED CONNECTION</span>
          <div className={`detail-symbol detail-${selected.kind}`}>
            {selected.kind === "movie" ? "▶" : selected.kind === "book" ? "▤" : selected.kind === "music" ? "♫" : selected.kind === "theme" ? "✳" : "✦"}
          </div>
          <span className="detail-kind">{kindLabel[selected.kind]}</span>
          <h2>{selected.label}</h2>
          <p>{selected.description}</p>
          <div className="connection-note"><span>WHY IT CONNECTS</span><p>{selected.connection}</p></div>
          <section className="taste-related-items" aria-labelledby="taste-related-heading">
            <span className="detail-kind">EXPLORE THE CATALOG</span>
            <h3 id="taste-related-heading">{relatedTitle}</h3>
            {relatedCatalogItems.length ? relatedCatalogItems.map((item) => <article className="taste-related-item" key={item.id}>
              <button type="button" className="taste-related-open" onClick={() => onExploreItem(item)}>
                {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span className="taste-related-placeholder">{item.category}</span>}
                <span><b>{item.title}</b><small>{item.category} · {item.creator}</small></span>
              </button>
              {item.creator && <button type="button" className="taste-related-creator" onClick={() => onOpenCreator(item.creator)}>Creator page ↗</button>}
            </article>) : <p className="taste-related-empty">No matching item is on this catalog page yet. Change page size or browse Discover for more.</p>}
            {selected.kind === "theme" && <p className="taste-related-proof">Links here use the catalog genre tag and your own saved/feedback connections.</p>}
            {selected.kind === "theme" && selected.genre && <button type="button" className="taste-related-browse" onClick={() => onExploreTheme(selected.genre!)}>Browse all {selected.genre} items ↗</button>}
          </section>
          <div className="detail-footer"><span className="connection-pulse" />Built from your saved and rated items</div>
        </aside>
      </div>

      <p className="taste-disclaimer">
        {graph.trackedCount > 8
          ? `Showing 8 of ${graph.trackedCount} saved or rated items to keep the graph readable.`
          : graph.trackedCount
            ? "Each connection represents a shared catalog genre from your own saved items and recommendation feedback."
            : "Save discoveries or give recommendation feedback to build your personal Taste Map."}
      </p>
    </section>
  );
}
