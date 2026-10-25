export type MediaCategory = "Movies" | "Books" | "Music";
export type MediaFilter = "All" | MediaCategory;
export type LibraryStatus = "planned" | "in_progress" | "finished";

export interface Media {
  id: string;
  title: string;
  creator: string;
  category: MediaCategory;
  genre: string;
  image: string | null;
  connection: string;
  description?: string | null;
  source?: string;
  updated_at?: string | null;
  popularity_score?: number;
  saved_at?: string;
}

export interface MediaPage {
  items: Media[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface SavedMedia extends Media {
  saved_at: string;
  status: LibraryStatus;
  rating: number | null;
  note: string | null;
  progress_percent: number | null;
  updated_at: string;
}

export interface SavedMediaUpdate {
  status?: LibraryStatus;
  rating?: number | null;
  note?: string | null;
  progress_percent?: number | null;
}

export interface LibraryActivity {
  id: number;
  media_id: string;
  title: string;
  category: MediaCategory;
  event_type: string;
  value: string | null;
  created_at: string;
}

export interface Recommendation {
  item: Media;
  reason: string;
  matched_genres: string[];
  feedback?: "more" | "less" | null;
}

export interface RecommendationPage {
  items: Recommendation[];
  feedback_items: { item: Media; feedback: "more" | "less" }[];
  saved_count: number;
  method: "genre" | "item_item";
  total: number;
  next_offset: number | null;
  message: string;
}

export interface MediaCardProps {
  item: Media;
  isSaved: boolean;
  onToggleSaved: (id: string) => void;
  recommendationReason?: string;
  recommendationFeedback?: "more" | "less" | null;
  feedbackBusy?: boolean;
  onRecommendationFeedback?: (id: string, feedback: "more" | "less" | null) => void;
  onArtworkUnavailable?: (id: string) => void;
  onExplore?: (item: Media) => void;
  onOpenCreator?: (creator: string) => void;
  libraryItem?: SavedMedia;
  onUpdateLibraryItem?: (id: string, update: SavedMediaUpdate) => void;
  libraryUpdateBusy?: boolean;
  libraryUpdateError?: string | null;
}
