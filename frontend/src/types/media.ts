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

export interface MediaCardProps {
  item: Media;
  isSaved: boolean;
  onToggleSaved: (id: string) => void;
}
