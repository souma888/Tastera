import { useEffect, useMemo, useState } from "react";
import type { Media } from "../types/media";
import { getCollections, getSharedCollection, removeCollection, saveCollection } from "../services/accountApi";

type Shelf = { id: string; name: string; description: string; items: Media[]; visibility?: "private" | "unlisted" | "public"; share_slug?: string };
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
    if (!raw || raw.length > 16000) return null;
    const parsed = JSON.parse(raw) as Shelf;
    return typeof parsed.name === "string" && Array.isArray(parsed.items) ? parsed : null;
  } catch { return null; }
}

export default function CollectionsPage({ catalog, token }: { catalog: Media[]; token: string | null }) {
  const [shelves, setShelves] = useState<Shelf[]>(loadShelves);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [activeShelfId, setActiveShelfId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [sharedShelf, setSharedShelf] = useState<Shelf | null>(loadSharedShelf);
  const [loadedToken, setLoadedToken] = useState<string | null>(null);
  const serverReady = !token || loadedToken === token;
  const activeShelf = shelves.find((shelf) => shelf.id === activeShelfId) ?? shelves[0] ?? null;
  const filteredCatalog = useMemo(() => catalog.filter((item) => `${item.title} ${item.creator} ${item.genre}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 36), [catalog, query]);

  useEffect(() => {
    if (!token) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(shelves)); } catch { /* Keep the current page usable if browser storage is unavailable. */ } }
  }, [shelves, token]);

  useEffect(() => {
    let cancelled = false;
    const slug = new URLSearchParams(window.location.search).get("shared");
    if (slug) void getSharedCollection(slug).then((collection) => {
      if (!cancelled) setSharedShelf(collection);
    }).catch(() => { if (!cancelled) setNotice("This shared collection is unavailable or has been made private."); });
    if (!token) return () => { cancelled = true; };
    void getCollections(token).then((collections) => {
      if (!cancelled) { setShelves(collections); setLoadedToken(token); }
    }).catch((error: unknown) => {
      if (!cancelled) { setNotice(error instanceof Error ? `Could not load your account collections: ${error.message}` : "Could not load account collections."); setLoadedToken(token); }
    });
    return () => { cancelled = true; };
  }, [token]);

  async function syncShelf(shelf: Shelf, visibility: "private" | "public" | "unlisted" = shelf.visibility ?? "private") {
    if (!token) { setNotice("Sign in to save this collection to your account."); return shelf; }
    const isRemote = Boolean(shelf.share_slug);
    const saved = await saveCollection(token, { ...(isRemote ? { id: shelf.id } : {}), name: shelf.name, description: shelf.description, items: shelf.items, visibility });
    const result: Shelf = { ...saved, visibility: saved.visibility };
    setShelves((current) => current.map((item) => item.id === shelf.id ? result : item));
    return result;
  }

  function createShelf(shelfName = name, shelfDescription = description) {
    const cleanName = shelfName.trim();
    if (!cleanName) { setNotice("Give your collection a name first."); return; }
    if (token && !serverReady) { setNotice("Wait for your account collections to finish loading."); return; }
    setName(""); setDescription("");
    if (token) {
      void saveCollection(token, { name: cleanName, description: shelfDescription.trim(), items: [], visibility: "private" })
        .then((shelf) => { setShelves((current) => [shelf, ...current]); setActiveShelfId(shelf.id); setNotice(`“${cleanName}” is saved to your account.`); })
        .catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Could not create this collection."));
      return;
    }
    const shelf: Shelf = { id: crypto.randomUUID(), name: cleanName, description: shelfDescription.trim(), items: [] };
    setShelves((current) => [shelf, ...current]); setActiveShelfId(shelf.id); setNotice(`“${cleanName}” is ready. Add discoveries from the catalog below.`);
  }

  function addItem(item: Media) {
    if (!activeShelf) { setNotice("Create a collection first, then add items to it."); return; }
    if (activeShelf.items.some((entry) => entry.id === item.id)) { setNotice(`${item.title} is already in this collection.`); return; }
    const updated = { ...activeShelf, items: [...activeShelf.items, item] };
    if (token && activeShelf.share_slug) void syncShelf(updated).then(() => setNotice(`Added ${item.title} to “${activeShelf.name}”.`)).catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Could not update this collection."));
    else { setShelves((current) => current.map((shelf) => shelf.id === activeShelf.id ? updated : shelf)); setNotice(`Added ${item.title} to “${activeShelf.name}”.`); }
  }

  async function shareShelf(shelf: Shelf) {
    if (token) {
      try {
        const saved = await syncShelf(shelf, "public");
        if (!saved.share_slug) throw new Error("The collection did not return a public share link.");
        const url = new URL(window.location.href);
        url.searchParams.set("page", "Collections");
        url.searchParams.delete("sharedShelf");
        url.searchParams.set("shared", saved.share_slug);
        await navigator.clipboard.writeText(url.toString());
        setNotice("Public collection link copied. Changes to this collection will appear at the same link.");
      } catch (error) { setNotice(error instanceof Error ? error.message : "Could not create a share link."); }
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("page", "Collections");
    url.searchParams.set("sharedShelf", JSON.stringify({ ...shelf, items: shelf.items.slice(0, 40) }));
    try { await navigator.clipboard.writeText(url.toString()); setNotice("Share link copied. It includes up to 40 items."); }
    catch { setNotice("Could not copy automatically. Your browser may block clipboard access."); }
  }

  function importSharedShelf() {
    if (!sharedShelf) return;
    if (token) {
      const shared = sharedShelf;
      void saveCollection(token, { name: shared.name, description: shared.description, visibility: "private", items: shared.items })
        .then((copy) => { setShelves((current) => [copy, ...current]); setActiveShelfId(copy.id); setSharedShelf(null); setNotice("A private copy was saved to your account."); })
        .catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Could not save a private copy."));
      return;
    }
    const copy = { ...sharedShelf, id: crypto.randomUUID() };
    setShelves((current) => [copy, ...current]); setActiveShelfId(copy.id); setSharedShelf(null); setNotice("Shared collection saved in this browser.");
  }

  return <section className="collections-page" aria-labelledby="collections-heading">
    <div className="collections-hero">
      <span className="eyebrow">YOUR PERSONAL SHELVES</span>
      <h1 id="collections-heading">Collect the things <span>that connect.</span></h1>
      <p>Make themed lists across media. Sign in to sync them to your account and create a live public share page.</p>
    </div>
    {notice && <p className="collection-notice" role="status">{notice}</p>}
    {sharedShelf && <div className="shared-shelf-banner"><div><span className="eyebrow">SHARED WITH YOU</span><h2>{sharedShelf.name}</h2><p>{sharedShelf.description} · {sharedShelf.items.length} items</p></div><button type="button" className="primary-button" onClick={importSharedShelf}>Save a copy</button></div>}
    <div className="collection-create-row">
      <div><span className="eyebrow">START A SHELF</span><h2>Create a collection</h2><p>{token ? "Your account collections are stored on Tastera and sync across devices." : "Sign in to sync collections across devices and create live share pages. Guest collections stay in this browser."}</p></div>
      <form onSubmit={(event) => { event.preventDefault(); createShelf(); }}><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Collection name" aria-label="Collection name" /><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Short description (optional)" aria-label="Collection description" /><button type="submit" className="primary-button">Create shelf <span>↗</span></button></form>
    </div>
    <div className="collection-templates" aria-label="Suggested collections">{starterShelves.map((template) => <button key={template.name} type="button" onClick={() => createShelf(template.name, template.description)}>＋ {template.name}</button>)}</div>
    <div className="collection-layout">
      <aside className="collection-list"><span className="eyebrow">YOUR SHELVES · {shelves.length}</span>{shelves.length ? shelves.map((shelf) => <button key={shelf.id} type="button" className={activeShelf?.id === shelf.id ? "selected" : ""} onClick={() => setActiveShelfId(shelf.id)}><strong>{shelf.name}</strong><small>{shelf.items.length} {shelf.items.length === 1 ? "item" : "items"}</small></button>) : <p>Create a shelf to get started.</p>}</aside>
      <div className="collection-detail">{activeShelf ? <><div className="collection-detail-heading"><div><h2>{activeShelf.name}</h2><p>{activeShelf.description || "A shelf for discoveries worth keeping."}</p></div><div>{token && !activeShelf.share_slug && <button type="button" className="secondary-button" disabled={!serverReady} onClick={() => void syncShelf(activeShelf).then(() => setNotice("Collection synced to your account."))}>Save to account</button>}{token && activeShelf.visibility === "public" && <button type="button" className="secondary-button" onClick={() => void syncShelf(activeShelf, "private").then(() => setNotice("Collection made private. Its share link is now disabled."))}>Make private</button>}<button type="button" className="secondary-button" onClick={() => void shareShelf(activeShelf)}>Share ↗</button><button type="button" className="text-button" onClick={() => { if (token && activeShelf.share_slug) void removeCollection(token, activeShelf.id); setShelves((current) => current.filter((shelf) => shelf.id !== activeShelf.id)); setActiveShelfId(null); }}>Delete</button></div></div>{activeShelf.items.length ? <div className="collection-item-grid">{activeShelf.items.map((item) => <article key={item.id}><img src={item.image ?? ""} alt="" /><div><span>{item.category} · {item.genre}</span><strong>{item.title}</strong><small>{item.creator}</small></div><button type="button" aria-label={`Remove ${item.title}`} onClick={() => { const updated = { ...activeShelf, items: activeShelf.items.filter((entry) => entry.id !== item.id) }; if (token && activeShelf.share_slug) void syncShelf(updated); else setShelves((current) => current.map((shelf) => shelf.id === activeShelf.id ? updated : shelf)); }}>×</button></article>)}</div> : <p className="collection-empty">This shelf is ready for its first discovery. Add items from the catalog below.</p>}</> : <div className="collection-empty"><h2>Your first shelf is waiting</h2><p>Create a collection or start with one of the suggested themes.</p></div>}</div>
    </div>
    <section className="collection-picker"><div className="collection-picker-heading"><div><span className="eyebrow">ADD A DISCOVERY</span><h2>Find something for your shelf</h2></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, creators, genres" aria-label="Search catalog for collection items" /></div>{filteredCatalog.length ? <div className="collection-catalog-grid">{filteredCatalog.map((item) => <article key={item.id}><img src={item.image ?? ""} alt="" /><div><span>{item.category}</span><strong>{item.title}</strong><small>{item.creator}</small></div><button type="button" onClick={() => addItem(item)} disabled={!activeShelf || Boolean(activeShelf.items.some((entry) => entry.id === item.id))}>{activeShelf?.items.some((entry) => entry.id === item.id) ? "Added" : "+ Add"}</button></article>)}</div> : <p>No catalog matches. Try a shorter search.</p>}</section>
    <p className="collection-storage-note">{token ? "Private collections are only visible to their owner. Public share pages show only the items in that collection." : "Guest collections currently live in this browser. Sign in to sync and share a live server collection."}</p>
  </section>;
}
