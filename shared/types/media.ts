import type { MediaStatus } from '../constants/status.js';

export type MediaFileType = 'image' | 'video' | 'document';
export type MediaCategory =
  | 'home_interactive'
  | 'case_image'
  | 'article_cover'
  | 'solution_image'
  | 'page_editor'
  | 'word_import'
  | 'temporary'
  | 'qrcode';

export interface MediaFile {
  id?: number;
  fileName: string;
  originalName: string;
  fileType: MediaFileType;
  mimeType: string;
  url: string;
  size?: number;
  thumbnailUrl?: string;
  alt?: string;
  description?: string;
  category?: MediaCategory;
  status: MediaStatus;
}
