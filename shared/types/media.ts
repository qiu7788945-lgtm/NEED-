import type { MediaStatus } from '../constants/status.js';

export type MediaFileType = 'image' | 'video' | 'document';
export type MediaCategory =
  | 'home_interactive'
  | 'home_video'
  | 'case_image'
  | 'article_cover'
  | 'solution_image'
  | 'solution_video'
  | 'page_editor'
  | 'word_import'
  | 'qrcode'
  | 'temporary';

export type MediaOwnerType =
  | 'home'
  | 'case'
  | 'article'
  | 'solution'
  | 'page'
  | 'word_import'
  | 'system'
  | 'temporary';

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
  ownerType?: MediaOwnerType | '';
  ownerId?: number | null;
  ownerSlug?: string;
  groupKey?: string;
  slotNo?: number | null;
  caption?: string;
  enabled?: boolean;
  sortOrder?: number;
  status: MediaStatus;
}
