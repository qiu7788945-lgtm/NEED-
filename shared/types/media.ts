export type MediaFileType = 'image' | 'video' | 'document';
export type MediaStatus = 'active' | 'archived';
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

export interface MediaUsage {
  type: 'home_interactive' | 'home_video';
  label: string;
  detail: string;
}

export interface MediaDuplicateWarning {
  type:
    | 'same_original_name'
    | 'same_display_name'
    | 'same_file_name'
    | 'same_size'
    | 'same_original_name_and_size'
    | 'storage_name_renamed';
  message: string;
  fileName?: string;
}

export interface MediaFile {
  id?: number;
  fileName: string;
  originalName: string;
  displayName: string;
  fileType: MediaFileType;
  mimeType: string;
  url: string;
  size?: number;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
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
  usageCount?: number;
  usages?: MediaUsage[];
  suggestedCategory?: MediaCategory;
  categoryWarning?: string;
  duplicateWarnings?: MediaDuplicateWarning[];
  isLargeFile?: boolean;
  isLargeDimension?: boolean;
}
