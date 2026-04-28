import type { ContentStatus } from '../constants/status';

export type BlockType =
  | 'hero'
  | 'dark_visual'
  | 'text_image'
  | 'image_collage'
  | 'case_list'
  | 'article_list'
  | 'solution_list'
  | 'faq'
  | 'cta'
  | 'video'
  | 'process'
  | 'capability';

export interface ContentBlock<TData = Record<string, unknown>> {
  id?: number;
  blockType: BlockType;
  enabled: boolean;
  sortOrder: number;
  data: TData;
}

export interface EditableContent {
  id?: number;
  title: string;
  slug: string;
  summary?: string;
  status: ContentStatus;
}
