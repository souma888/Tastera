import { useMemo, useState, type ChangeEvent } from "react";
import type { Media, MediaCategory } from "../types/media";

type ImportRow = { title: string; creator: string; category: MediaCategory; matched: Media | null };
const normalize = (value: string) => value.toLocaleLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}

function field(record: Record<string, unknown>, candidates: string[]) {
  const keys = new Map(Object.keys(record).map((key) => [key.toLowerCase().replace(/[^a-z]/g, ""), key]));
  for (const candidate of candidates) {
    const key = keys.get(candidate.toLowerCase().replace(/[^a-z]/g, ""));
    if (key && typeof record[key] === "string") return record[key] as string;
  }
  return "";
}

function parseFile(text: string, filename: string, provider: "Letterboxd" | "Goodreads" | "Spotify"): Omit<ImportRow, "matched">[] {
  let data: Record<string, unknown>[] = [];
  if (filename.toLowerCase().endsWith(".json")) {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) data = parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
    else if (parsed && typeof parsed === "object") {
      const values = Object.values(parsed as Record<string, unknown>);
      data = values.flatMap((value) => Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : []);
    }
  } else {
    const [headers = [], ...rows] = csvRows(text);
    data = rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
  }
  return data.map((record) => {
    const nested = record.track && typeof record.track === "object" ? record.track as Record<string, unknown> : {};
    const source = { ...record, ...nested };
    const title = field(source, provider === "Spotify" ? ["Album Name", "albumName", "collectionName", "Title", "Name", "Track Name", "trackName"] : ["Name", "Title", "Track Name", "trackName", "track_name"]);
    const creator = field(source, ["Author", "Artist", "Artist Name", "artistName", "artist_name"]);
    const category: MediaCategory = provider === "Spotify" ? "Music" : provider === "Goodreads" ? "Books" : "Movies";
    return { title: title.trim(), creator: creator.trim(), category };
  }).filter((row) => row.title).slice(0, 200);
}

export default function ImportLibrary({ catalog, onSave, onComplete }: { catalog: Media[]; onSave: (id: string) => Promise<void>; onComplete: () => Promise<void> }) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<"Letterboxd" | "Goodreads" | "Spotify">("Letterboxd");
  const matchedRows = useMemo(() => rows.filter((row) => row.matched), [rows]);
  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) { setStatus("Choose an export under 5 MB."); return; }
    try {
      const parsed = parseFile(await file.text(), file.name, provider);
      const matches: ImportRow[] = parsed.map((row) => {
        const title = normalize(row.title);
        const creator = normalize(row.creator);
        const match = catalog.find((item) => item.category === row.category && normalize(item.title) === title && (!creator || normalize(item.creator).includes(creator) || creator.includes(normalize(item.creator))))
          ?? catalog.find((item) => item.category === row.category && normalize(item.title) === title);
        return { ...row, matched: match ?? null };
      });
      setRows(matches);
      setStatus(`${matches.length} export entries checked. ${matches.filter((row) => row.matched).length} matched this catalog.`);
    } catch { setRows([]); setStatus("Could not read this export. Choose a Letterboxd, Goodreads, or Spotify CSV/JSON export."); }
    event.target.value = "";
  }
  async function importMatches() {
    setBusy(true);
    let saved = 0;
    try {
      for (const row of matchedRows) if (row.matched) { await onSave(row.matched.id); saved += 1; }
      await onComplete();
      setStatus(`${saved} matched items added to your Library. Duplicate saves are safe.`);
    } catch (error) { setStatus(error instanceof Error ? `Imported ${saved}; stopped because ${error.message}` : `Imported ${saved}; some items could not be saved.`); }
    finally { setBusy(false); }
  }
  return <section className="library-import-panel" aria-labelledby="library-import-title"><div><span className="eyebrow">START WITH WHAT YOU ALREADY LIKE</span><h3 id="library-import-title">Import a private export</h3><p>Choose a Letterboxd, Goodreads, or Spotify export. The file is read in this browser, matched to Tastera’s catalog, and never uploaded as a raw export.</p></div><label>Export source<select value={provider} onChange={(event) => setProvider(event.target.value as typeof provider)}><option>Letterboxd</option><option>Goodreads</option><option>Spotify</option></select></label><label className="library-import-file">Choose export file<input type="file" accept=".csv,.json,text/csv,application/json" onChange={(event) => void readFile(event)} /></label>{rows.length > 0 && <><p role="status">{status}</p><ul>{rows.slice(0, 12).map((row, index) => <li key={`${row.title}-${index}`}>{row.matched ? "Matched" : "Not in catalog"} · {row.title} — {row.creator || row.category}</li>)}</ul><button type="button" disabled={busy || !matchedRows.length} onClick={() => void importMatches()}>{busy ? "Importing…" : `Add ${matchedRows.length} matched items to Library`}</button></>}{!rows.length && status && <p role="status">{status}</p>}</section>;
}
