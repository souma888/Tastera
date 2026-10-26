import { useMemo, useState } from "react";
import type { Media, MediaCategory } from "../types/media";

type CommunityShelf = { name: string; description: string; genres: string[]; category: MediaCategory | "All" };
type SampleProfile = { id: string; name: string; initials: string; label: string; bio: string; genres: string[]; activity: string[]; favoriteTitles: string[]; playlists: { name: string; description: string; genres: string[] }[] };
const shelves: CommunityShelf[] = [
  { name: "After the credits", description: "Films that linger, with books and music for the walk home.", genres: ["science fiction", "drama", "sci-fi"], category: "All" },
  { name: "Rainy day reads", description: "Quietly absorbing books for an unhurried afternoon.", genres: ["fiction", "fantasy", "science fiction", "romance"], category: "Books" },
  { name: "Late-night listening", description: "Albums for the softer hours after midnight.", genres: ["jazz", "electronic", "indie", "ambient", "r&b"], category: "Music" },
];
const profiles: SampleProfile[] = [
  { id: "sample-ira", name: "Ira Sen", initials: "IS", label: "SAMPLE EXPLORER", bio: "Follows stories about memory, distant worlds, and the people who find their way home.", genres: ["Science Fiction", "Drama", "Jazz"], activity: ["saved a thoughtful sci-fi story", "added an album for a quiet evening"], favoriteTitles: ["Interstellar", "Arrival", "Annihilation", "Dune", "Blue Train", "Random Access Memories"], playlists: [{ name: "Between stars and home", description: "Big questions, distant worlds, and the people waiting at the end.", genres: ["science fiction", "sci-fi", "adventure", "drama"] }, { name: "Blue hour in orbit", description: "A quieter set for looking out the window after dark.", genres: ["jazz", "ambient", "electronic"] }] },
  { id: "sample-dev", name: "Dev Kapoor", initials: "DK", label: "SAMPLE EXPLORER", bio: "Collects strange mysteries, patient character studies, and music with room to breathe.", genres: ["Mystery", "Indie", "Literary Fiction"], activity: ["made a weekend watchlist", "found a new favorite author"], favoriteTitles: ["The Midnight Library", "Project Hail Mary", "Blade Runner 2049", "After Hours", "Kid A", "Dune: Part Two"], playlists: [{ name: "After the last page", description: "Books and films that keep unfolding once the story ends.", genres: ["fiction", "fantasy", "mystery", "drama"] }, { name: "Night drive · side A", description: "Indie and alternative sounds for the long way home.", genres: ["indie", "alternative", "rock", "electronic"] }] },
];
const FOLLOW_KEY = "tastera_demo_following_v1";
const FOLLOWED_SHELVES_KEY = "tastera_followed_community_shelves_v1";

function loadFollowing(): string[] {
  try { const value = JSON.parse(localStorage.getItem(FOLLOW_KEY) ?? "[]"); return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []; }
  catch { return []; }
}

function loadFollowedShelves(): string[] {
  try { const value = JSON.parse(localStorage.getItem(FOLLOWED_SHELVES_KEY) ?? "[]"); return Array.isArray(value) ? value.filter((name): name is string => typeof name === "string") : []; }
  catch { return []; }
}

export default function CommunityPage({ catalog, savedItems }: { catalog: Media[]; savedItems: Media[] }) {
  const [following, setFollowing] = useState<string[]>(loadFollowing);
  const [followedShelves, setFollowedShelves] = useState<string[]>(loadFollowedShelves);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<{ profileId: string; name: string; description: string; genres: string[] } | null>(null);
  const [quickProfileId, setQuickProfileId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const profileInterests = useMemo(() => [...new Set(savedItems.map((item) => item.genre.toLowerCase()).filter(Boolean))], [savedItems]);
  const sampleProfileItems = (profile: SampleProfile) => {
    const preferred = catalog.filter((item) => profile.favoriteTitles.some((title) => item.title.toLowerCase() === title.toLowerCase()));
    const themed = catalog.filter((item) => profile.genres.some((genre) => item.genre.toLowerCase().includes(genre.toLowerCase())));
    return [...new Map([...preferred, ...themed].map((item) => [item.id, item])).values()].slice(0, 8);
  };
  const samplePlaylistItems = (genres: string[]) => catalog.filter((item) => genres.some((genre) => item.genre.toLowerCase().includes(genre.toLowerCase()))).slice(0, 8);
  const saveCommunityShelf = (shelf: CommunityShelf) => {
    const matchingItems = catalog.filter((item) => (shelf.category === "All" || item.category === shelf.category) && shelf.genres.some((genre) => item.genre.toLowerCase().includes(genre)));
    const shelfItems = matchingItems.slice(0, 12);
    try {
      const key = "tastera_collections_v1";
      const existing = JSON.parse(localStorage.getItem(key) ?? "[]");
      const copy = { id: crypto.randomUUID(), name: shelf.name, description: shelf.description, items: shelfItems };
      localStorage.setItem(key, JSON.stringify([copy, ...(Array.isArray(existing) ? existing : [])]));
      window.dispatchEvent(new CustomEvent("tastera:collections-updated"));
      setNotice(`Saved “${shelf.name}” to Collections with ${shelfItems.length} catalog picks.`);
    } catch { setNotice("Could not save this community shelf in this browser."); }
  };
  const toggleFollow = (id: string) => {
    const next = following.includes(id) ? following.filter((value) => value !== id) : [...following, id];
    setFollowing(next);
    localStorage.setItem(FOLLOW_KEY, JSON.stringify(next));
  };
  const toggleFollowShelf = (name: string) => {
    const next = followedShelves.includes(name) ? followedShelves.filter((value) => value !== name) : [...followedShelves, name];
    setFollowedShelves(next);
    localStorage.setItem(FOLLOWED_SHELVES_KEY, JSON.stringify(next));
  };
  const sharedGenres = profileInterests.filter((genre) => profiles.some((profile) => profile.genres.some((interest) => interest.toLowerCase() === genre)));
  const sharedItems = catalog.filter((item) => sharedGenres.some((genre) => item.genre.toLowerCase() === genre) && !savedItems.some((saved) => saved.id === item.id)).slice(0, 8);

  return <section className="community-page">
    {notice && <p className="community-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}>×</button></p>}
    <header className="community-hero"><span className="eyebrow">SOCIAL DISCOVERY · PREVIEW</span><h1>Find a little <span>common ground.</span></h1><p>Compare taste, browse sample activity, and collect shelves from fellow explorers. Sample profiles are fictional previews; your personal Library stays private.</p><div className="community-preview-badge"><span aria-hidden="true">✦</span> SAMPLE COMMUNITY · NO REAL USER ACTIVITY SHARED</div></header>
    <section className="community-section"><div className="community-section-heading"><div><span className="eyebrow">SHARED TASTE</span><h2>A thread you might both follow</h2></div><span>{savedItems.length ? `${sharedGenres.length} shared themes` : "Save items to compare"}</span></div>
      {sharedItems.length ? <div className="community-shared-grid">{sharedItems.map((item) => <article key={item.id}><img src={item.image ?? ""} alt={`${item.title} cover`} loading="lazy"/><div><span>{item.category} · {item.genre}</span><strong>{item.title}</strong><small>{item.creator}</small></div></article>)}</div> : <p className="community-empty">Save a few items to your Library and Tastera will surface shared genres with the sample explorers here.</p>}
    </section>
    <section className="community-section"><div className="community-section-heading"><div><span className="eyebrow">PEOPLE TO EXPLORE WITH</span><h2>Meet the sample explorers</h2></div><span>2 preview profiles</span></div><div className="community-profile-grid">{profiles.map((profile) => { const matches = profile.genres.filter((genre) => profileInterests.includes(genre.toLowerCase())); return <article className="community-profile-card" key={profile.id}><div className="community-profile-top"><button type="button" className="community-avatar-button" aria-label={`Quick info for ${profile.name}`} aria-expanded={quickProfileId === profile.id} onClick={() => setQuickProfileId(quickProfileId === profile.id ? null : profile.id)} title={`About ${profile.name}`}><span className="community-avatar">{profile.initials}</span></button><span className="community-sample-tag">{profile.label}</span></div>{quickProfileId === profile.id && <div className="community-quick-profile"><strong>{profile.name}</strong><span>{profile.label === "SAMPLE EXPLORER" ? "Community preview profile" : profile.label}</span><p>{profile.bio}</p><small>{profile.genres.join(" · ")}</small></div>}<h3>{profile.name}</h3><p>{profile.bio}</p><div className="community-genre-tags">{profile.genres.map((genre) => <span key={genre}>{genre}</span>)}</div><div className="community-match-note">{matches.length ? `You both explore ${matches.join(", ")}.` : "Save items to reveal shared taste."}</div><div className="community-profile-actions"><button type="button" className={following.includes(profile.id) ? "community-follow is-following" : "community-follow"} onClick={() => toggleFollow(profile.id)}>{following.includes(profile.id) ? "Following sample" : "Follow sample"}</button><button type="button" className="community-view-profile" onClick={() => setSelectedProfileId(selectedProfileId === profile.id ? null : profile.id)}>{selectedProfileId === profile.id ? "Close profile" : "View profile"}</button></div>{selectedProfileId === profile.id && <div className="community-inline-profile" aria-label={`${profile.name} profile details`}><div className="community-sample-user-heading"><div className="community-avatar">{profile.initials}</div><div><span className="eyebrow">{profile.label} · PROFILE</span><h4>{profile.name}’s shelf</h4><p>{profile.bio}</p></div><button type="button" aria-label="Close sample profile" onClick={() => setSelectedProfileId(null)}>×</button></div><div className="community-sample-user-columns"><section><span className="eyebrow">RECENT SAVES</span><div className="community-saved-items">{sampleProfileItems(profile).map((item) => <article key={item.id}><img src={item.image ?? ""} alt="" loading="lazy"/><div><strong>{item.title}</strong><small>{item.category} · {item.creator}</small></div></article>)}{!sampleProfileItems(profile).length && <p className="community-empty">No matching titles in this catalog yet.</p>}</div></section><section><span className="eyebrow">PLAYLISTS & LISTS</span><div className="community-playlists">{profile.playlists.map((playlist) => { const items = samplePlaylistItems(playlist.genres); return <button type="button" className="community-playlist-button" key={playlist.name} onClick={() => setSelectedPlaylist({profileId:profile.id,...playlist})}><span className="community-playlist-art">{items.slice(0,3).map((item) => <img key={item.id} src={item.image ?? ""} alt="" loading="lazy"/> )}</span><span className="community-playlist-copy"><strong>{playlist.name}</strong><span>{playlist.description}</span><small>{items.length} catalog picks · Open list ↗</small></span></button>; })}</div></section></div>{selectedPlaylist?.profileId === profile.id && <div className="community-playlist-detail"><div><span className="eyebrow">PLAYLIST · {profile.name}</span><h4>{selectedPlaylist.name}</h4><p>{selectedPlaylist.description}</p></div><button type="button" aria-label="Close playlist" onClick={() => setSelectedPlaylist(null)}>×</button><div className="community-saved-items">{samplePlaylistItems(selectedPlaylist.genres).map((item) => <article key={item.id}><img src={item.image ?? ""} alt="" loading="lazy"/><div><strong>{item.title}</strong><small>{item.category} · {item.creator}</small></div></article>)}</div></div>}</div>}</article>; })}</div></section>
    <section className="community-section"><div className="community-section-heading"><div><span className="eyebrow">FRIEND ACTIVITY · SAMPLE</span><h2>What fellow explorers are saving</h2></div><span>Fictional preview activity</span></div><div className="community-activity-grid">{profiles.map((profile, index) => { const item = catalog[index * 2] ?? catalog[index]; return <article key={profile.id}><button type="button" className="community-avatar-button" aria-label={`Quick info for ${profile.name}`} aria-expanded={quickProfileId === profile.id} onClick={() => setQuickProfileId(quickProfileId === profile.id ? null : profile.id)} title={`About ${profile.name}`}><span className="community-avatar">{profile.initials}</span></button><div><strong>{profile.name}</strong><p>{profile.activity[0]}{item ? ` · ${item.title}` : ""}</p><small>Sample activity · no real account data</small>{quickProfileId === profile.id && <div className="community-quick-profile"><strong>{profile.name}</strong><span>Community preview profile</span><p>{profile.bio}</p><small>{profile.genres.join(" · ")}</small></div>}</div></article>; })}</div></section>
    <section className="community-section"><div className="community-section-heading"><div><span className="eyebrow">COMMUNITY LISTS</span><h2>Curated shelves to start with</h2></div><span>Follow or save a copy</span></div><div className="community-shelf-grid">{shelves.map((shelf) => { const items = catalog.filter((item) => (shelf.category === "All" || item.category === shelf.category) && shelf.genres.some((genre) => item.genre.toLowerCase().includes(genre))).slice(0, 4); return <article className="community-shelf-card" key={shelf.name}><div className="community-shelf-art">{items.slice(0, 3).map((item) => <img key={item.id} src={item.image ?? ""} alt="" loading="lazy"/>)}{!items.length && <span>✦</span>}</div><span className="eyebrow">SAMPLE COMMUNITY LIST</span><h3>{shelf.name}</h3><p>{shelf.description}</p><small>{items.length} picks from the live catalog</small><div className="community-shelf-actions"><button type="button" className="community-list-follow" onClick={() => toggleFollowShelf(shelf.name)}>{followedShelves.includes(shelf.name) ? "Following list ✓" : "Follow list"}</button><button type="button" onClick={() => saveCommunityShelf(shelf)}>Save a copy to Collections ↗</button></div></article>; })}</div></section>
    <section className="community-privacy-note"><span aria-hidden="true">◈</span><div><strong>Privacy stays in your hands.</strong><p>Real Library activity is private by default. These demo profiles and activity examples are sample content and do not expose your saves to anyone.</p></div></section>
  </section>;
}
