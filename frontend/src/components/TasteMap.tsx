import type { CSSProperties } from "react";
import { useState } from "react";
import "./TasteMap.css";

type NodeKind = "you" | "movie" | "book" | "music" | "theme";

type TasteNode = {
  id: string;
  label: string;
  kind: NodeKind;
  x: number;
  y: number;
  size: number;
  description: string;
  connection: string;
};

const nodes: TasteNode[] = [
  {
    id: "you",
    label: "YOUR TASTE",
    kind: "you",
    x: 49,
    y: 51,
    size: 100,
    description: "Your personal universe of interests.",
    connection: "Explore the connections between your favorite media.",
  },
  {
    id: "interstellar",
    label: "Interstellar",
    kind: "movie",
    x: 22,
    y: 23,
    size: 82,
    description: "A journey through space, time, and human connection.",
    connection: "Connected through cosmic wonder and the unknown.",
  },
  {
    id: "arrival",
    label: "Arrival",
    kind: "movie",
    x: 18,
    y: 69,
    size: 70,
    description: "A science-fiction story about language and humanity.",
    connection: "Shares thoughtful science fiction themes with Interstellar.",
  },
  {
    id: "dune",
    label: "Dune",
    kind: "book",
    x: 77,
    y: 20,
    size: 78,
    description: "Frank Herbert's epic of politics, ecology, and destiny.",
    connection: "Connected through expansive worlds and complex systems.",
  },
  {
    id: "midnight",
    label: "The Midnight Library",
    kind: "book",
    x: 83,
    y: 65,
    size: 66,
    description: "A story about alternate lives and the choices we make.",
    connection: "Connected through philosophical questions and possibility.",
  },
  {
    id: "ram",
    label: "Random Access Memories",
    kind: "music",
    x: 60,
    y: 84,
    size: 74,
    description: "Daft Punk's electronic album with a cinematic atmosphere.",
    connection: "Connects through immersive sound and futuristic moods.",
  },
  {
    id: "after-hours",
    label: "After Hours",
    kind: "music",
    x: 37,
    y: 86,
    size: 62,
    description: "The Weeknd's moody, nocturnal album.",
    connection: "Connected through atmospheric sound and introspection.",
  },
  {
    id: "cosmos",
    label: "Cosmic wonder",
    kind: "theme",
    x: 39,
    y: 14,
    size: 58,
    description: "Stories that explore space, time, and our place in the universe.",
    connection: "A shared theme linking science fiction and atmospheric music.",
  },
  {
    id: "possibility",
    label: "Possibility",
    kind: "theme",
    x: 68,
    y: 43,
    size: 56,
    description: "Stories about choices, alternate realities, and what could be.",
    connection: "Connects Dune and The Midnight Library through big ideas.",
  },
];

const links: [string, string][] = [
  ["you", "interstellar"],
  ["you", "arrival"],
  ["you", "dune"],
  ["you", "midnight"],
  ["you", "ram"],
  ["you", "after-hours"],
  ["interstellar", "cosmos"],
  ["arrival", "interstellar"],
  ["dune", "possibility"],
  ["possibility", "midnight"],
  ["arrival", "after-hours"],
];

const filters = [
  { label: "All", value: "all" },
  { label: "Movies", value: "movie" },
  { label: "Books", value: "book" },
  { label: "Music", value: "music" },
  { label: "Themes", value: "theme" },
] as const;

type Filter = (typeof filters)[number]["value"];

export default function TasteMap() {
  const [selectedId, setSelectedId] = useState("interstellar");
  const [filter, setFilter] = useState<Filter>("all");

  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0];

  const visibleNodes = nodes.filter(
    (node) =>
      node.kind === "you" || filter === "all" || node.kind === filter,
  );

  const visibleIds = new Set(visibleNodes.map((node) => node.id));

  const kindLabel: Record<NodeKind, string> = {
    you: "YOUR PROFILE",
    movie: "MOVIE",
    book: "BOOK",
    music: "MUSIC",
    theme: "SHARED THEME",
  };

  return (
    <section className="taste-page">
      <header className="taste-heading">
        <div>
          <span className="eyebrow">YOUR PERSONAL UNIVERSE</span>
          <h1>
            Your taste is <span>connected.</span>
          </h1>
          <p>
            Explore the stories, sounds, and ideas that bring your interests
            together.
          </p>
        </div>
        <div className="taste-stat">
          <strong>{nodes.length - 1}</strong>
          <span>DISCOVERIES</span>
        </div>
      </header>

      <div className="taste-filters" aria-label="Filter taste map">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            className={filter === item.value ? "selected" : ""}
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="taste-layout">
        <div className="taste-canvas">
          <div className="constellation-label">
            <span className="constellation-dot" />
            YOUR INTEREST CONSTELLATION
          </div>

          <svg
            className="taste-connections"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {links.map(([fromId, toId]) => {
              const from = nodes.find((node) => node.id === fromId)!;
              const to = nodes.find((node) => node.id === toId)!;
              const isVisible =
                visibleIds.has(fromId) && visibleIds.has(toId);
              const isSelected =
                selectedId === fromId || selectedId === toId;

              if (!isVisible) return null;

              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;
              const bend = from.y < to.y ? -4 : 4;

              return (
                <path
                  key={`${fromId}-${toId}`}
                  d={`M ${from.x} ${from.y} Q ${midX + bend} ${midY - bend} ${to.x} ${to.y}`}
                  className={isSelected ? "taste-link active" : "taste-link"}
                />
              );
            })}
          </svg>

          {nodes.map((node) => {
            const isVisible = visibleIds.has(node.id);
            const isSelected = selectedId === node.id;

            return (
              <button
                key={node.id}
                type="button"
                className={[
                  "taste-node",
                  `node-${node.kind}`,
                  isSelected ? "is-selected" : "",
                  !isVisible ? "is-filtered-out" : "",
                ].join(" ")}
                style={{
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  "--node-size": `${node.size}px`,
                } as CSSProperties}
                onClick={() => setSelectedId(node.id)}
                aria-pressed={isSelected}
                aria-label={`Explore ${node.label}`}
                title={node.label}
              >
                <span className="taste-node-dot" />
                <span className="taste-node-label">{node.label}</span>
              </button>
            );
          })}

          <div className="constellation-legend">
            <span><i className="legend-movie" /> Movies</span>
            <span><i className="legend-book" /> Books</span>
            <span><i className="legend-music" /> Music</span>
            <span><i className="legend-theme" /> Themes</span>
          </div>
        </div>

        <aside className="taste-detail">
          <span className="eyebrow">SELECTED DISCOVERY</span>
          <div className={`detail-symbol detail-${selected.kind}`}>
            {selected.kind === "movie"
              ? "▶"
              : selected.kind === "book"
                ? "▤"
                : selected.kind === "music"
                  ? "♫"
                  : selected.kind === "theme"
                    ? "✳"
                    : "✦"}
          </div>

          <span className="detail-kind">{kindLabel[selected.kind]}</span>
          <h2>{selected.label}</h2>
          <p>{selected.description}</p>

          <div className="connection-note">
            <span>WHY IT CONNECTS</span>
            <p>{selected.connection}</p>
          </div>

          <div className="detail-footer">
            <span className="connection-pulse" />
            Sample relationship data
          </div>
        </aside>
      </div>

      <p className="taste-disclaimer">
        A prototype of your taste graph. Connections are illustrative until
        TASTERA's recommendation engine supplies real relationships.
      </p>
    </section>
  );
}
