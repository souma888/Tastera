export type MediaCategory = "Movies" | "Books" | "Music";
export type MediaFilter = "All" | MediaCategory;

export interface Media {
  id: string;
  title: string;
  creator: string;
  category: MediaCategory;
  genre: string;
  image: string;
  connection: string;
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
}

export interface RecommendationPage {
  items: Recommendation[];
  saved_count: number;
  message: string;
}

export interface MediaCardProps {
  item: Media;
  isSaved: boolean;
  onToggleSaved: (id: string) => void;
  recommendationReason?: string;
}
