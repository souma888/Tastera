import { useEffect, useMemo, useState } from "react";
import type { Media } from "../types/media";

type Shelf = { id: string; name: string; description: string; items: Media[] };
const STORAGE_KEY = "tastera_collections_v1";
const starterShelves = [
  { name: "Rainy day reads", description: "Books for a slower, quieter day." },
  { name: "Films to watch with friends", description: "A shared watchlist for movie night." },
  { name: "On repeat", description: "Albums worth coming back to." },
];

function loadShelves(): Shelf[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((shelf) => shelf && typeof shelf.id === "string" && typeof shelf.name === "string" && Array.isArray(shelf.items)) : [];
  } catch { return []; }
}

function loadSharedShelf(): Shelf | null {
  try {
    const raw = new URLSearchParams(window.location.search).get("sharedShelf");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Shelf;
    return typeof parsed.name === "string" && Array.isArray(parsed.items) ? parsed : null;
  } catch { return null; }
}

export default function CollectionsPage({ catalog }: { catalog: Media[] }) {
  const [shelves, setShelves] = useState<Shelf[]>(loadShelves);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [activeShelfId, setActiveShelfId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [sharedShelf, setSharedShelf] = useState<Shelf | null>(loadSharedShelf);
  const activeShelf = shelves.find((shelf) => shelf.id === activeShelfId) ?? shelves[0] ?? null;
  const filteredCatalog = useMemo(() => catalog.filter((item) => `${item.title} ${item.creator} ${item.genre}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 36), [catalog, query]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(shelves)); } catch { /* Keep the current page usable if browser storage is unavailable. */ }
  }, [shelves]);

  function createShelf(shelfName = name, shelfDescription = description) {
    const cleanName = shelfName.trim();
    if (!cleanName) { setNotice("Give your collection a name first."); return; }
    const shelf: Shelf = { id: crypto.randomUUID(), name: cleanName, description: shelfDescription.trim(), items: [] };
    setShelves((current) => [shelf, ...current]);
    setActiveShelfId(shelf.id);
    setName(""); setDescription(""); setNotice(`“${cleanName}” is ready. Add discoveries from the catalog below.`);
  }

  function addItem(item: Media) {
    if (!activeShelf) { setNotice("Create a collection first, then add items to it."); return; }
    if (activeShelf.items.some((entry) => entry.id === item.id)) { setNotice(`${item.title} is already in this collection.`); return; }
    setShelves((current) => current.map((shelf) => shelf.id === activeShelf.id ? { ...shelf, items: [...shelf.items, item] } : shelf));
    setNotice(`Added ${item.title} to “${activeShelf.name}”.`);
  }

  async function shareShelf(shelf: Shelf) {
    const url = new URL(window.location.href);
    url.searchParams.set("page", "Collections");
    url.searchParams.set("sharedShelf", JSON.stringify({ ...shelf, items: shelf.items.slice(0, 40) }));
    try { await navigator.clipboard.writeText(url.toString()); setNotice("Share link copied. It includes up to 40 items."); }
    catch { setNotice("Could not copy automatically. Your browser may block clipboard access."); }
  }

  function importSharedShelf() {
    if (!sharedShelf) return;
    const copy = { ...sharedShelf, id: crypto.randomUUID() };
    setShelves((current) => [copy, ...current]); setActiveShelfId(copy.id); setSharedShelf(null); setNotice("Shared collection saved in this browser.");
  }

  return <section className="collections-page" aria-labelledby="collections-heading">
    <div className="collections-hero">
      <span className="eyebrow">YOUR PERSONAL SHELVES</span>
      <h1 id="collections-heading">Collect the things <span>that connect.</span></h1>
      <p>Make themed lists across movies, books, and music, then share a read-only link with someone else.</p>
    </div>
    {notice && <p className="collection-notice" role="status">{notice}</p>}
    {sharedShelf && <div className="shared-shelf-banner"><div><span className="eyebrow">SHARED WITH YOU</span><h2>{sharedShelf.name}</h2><p>{sharedShelf.description} · {sharedShelf.items.length} items</p></div><button type="button" className="primary-button" onClick={importSharedShelf}>Save a copy</button></div>}
    <div className="collection-create-row">
      <div><span className="eyebrow">START A SHELF</span><h2>Create a collection</h2><p>Your collections are stored in this browser. Sharing sends a link with the collection’s item details.</p></div>
      <form onSubmit={(event) => { event.preventDefault(); createShelf(); }}><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Collection name" aria-label="Collection name" /><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Short description (optional)" aria-label="Collection description" /><button type="submit" className="primary-button">Create shelf <span>↗</span></button></form>
    </div>
    <div className="collection-templates" aria-label="Suggested collections">{starterShelves.map((template) => <button key={template.name} type="button" onClick={() => createShelf(template.name, template.description)}>＋ {template.name}</button>)}</div>
    <div className="collection-layout">
      <aside className="collection-list"><span className="eyebrow">YOUR SHELVES · {shelves.length}</span>{shelves.length ? shelves.map((shelf) => <button key={shelf.id} type="button" className={activeShelf?.id === shelf.id ? "selected" : ""} onClick={() => setActiveShelfId(shelf.id)}><strong>{shelf.name}</strong><small>{shelf.items.length} {shelf.items.length === 1 ? "item" : "items"}</small></button>) : <p>Create a shelf to get started.</p>}</aside>
      <div className="collection-detail">{activeShelf ? <><div className="collection-detail-heading"><div><h2>{activeShelf.name}</h2><p>{activeShelf.description || "A shelf for discoveries worth keeping."}</p></div><div><button type="button" className="secondary-button" onClick={() => void shareShelf(activeShelf)}>Share ↗</button><button type="button" className="text-button" onClick={() => { setShelves((current) => current.filter((shelf) => shelf.id !== activeShelf.id)); setActiveShelfId(null); }}>Delete</button></div></div>{activeShelf.items.length ? <div className="collection-item-grid">{activeShelf.items.map((item) => <article key={item.id}><img src={item.image ?? ""} alt="" /><div><span>{item.category} · {item.genre}</span><strong>{item.title}</strong><small>{item.creator}</small></div><button type="button" aria-label={`Remove ${item.title}`} onClick={() => setShelves((current) => current.map((shelf) => shelf.id === activeShelf.id ? { ...shelf, items: shelf.items.filter((entry) => entry.id !== item.id) } : shelf))}>×</button></article>)}</div> : <p className="collection-empty">This shelf is ready for its first discovery. Add items from the catalog below.</p>}</> : <div className="collection-empty"><h2>Your first shelf is waiting</h2><p>Create a collection or start with one of the suggested themes.</p></div>}</div>
    </div>
    <section className="collection-picker"><div className="collection-picker-heading"><div><span className="eyebrow">ADD A DISCOVERY</span><h2>Find something for your shelf</h2></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, creators, genres" aria-label="Search catalog for collection items" /></div>{filteredCatalog.length ? <div className="collection-catalog-grid">{filteredCatalog.map((item) => <article key={item.id}><img src={item.image ?? ""} alt="" /><div><span>{item.category}</span><strong>{item.title}</strong><small>{item.creator}</small></div><button type="button" onClick={() => addItem(item)} disabled={!activeShelf || Boolean(activeShelf.items.some((entry) => entry.id === item.id))}>{activeShelf?.items.some((entry) => entry.id === item.id) ? "Added" : "+ Add"}</button></article>)}</div> : <p>No catalog matches. Try a shorter search.</p>}</section>
    <p className="collection-storage-note">Collections currently live in this browser. A share link contains the selected collection contents; it does not sync edits back to the original owner.</p>
  </section>;
}
