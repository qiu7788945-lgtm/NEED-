export interface HomeInteractiveImageSlot {
  slotNo: number;
  mediaUrl: string;
  mediaFileName: string;
  alt: string;
  sortOrder: number;
  enabled: boolean;
}

export interface HomeVideoConfig {
  videoUrl: string;
  videoFileName: string;
  videoDisplayName: string;
  posterUrl: string;
  posterFileName: string;
  posterDisplayName: string;
  title: string;
  description: string;
  enabled: boolean;
  updatedAt: string;
}
