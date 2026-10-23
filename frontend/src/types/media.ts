export type MediaCategory = "Movies" | "Books" | "Music";
export type MediaFilter = "All" | MediaCategory;

export interface Media {
  id: string;
  title: string;
  creator: string;
  category: MediaCategory;
  genre: string;
  image: string | null;
  connection: string;
  saved_at?: string;
}

export interface MediaPage {
  items: Media[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
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
}
