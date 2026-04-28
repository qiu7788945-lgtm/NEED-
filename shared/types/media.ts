import type { MediaStatus } from '../constants/status';

export type MediaFileType = 'image' | 'video' | 'document';

export interface MediaFile {
  id?: number;
  fileName: string;
  originalName: string;
  fileType: MediaFileType;
  mimeType: string;
  url: string;
  thumbnailUrl?: string;
  alt?: string;
  description?: string;
  category?: string;
  status: MediaStatus;
}
