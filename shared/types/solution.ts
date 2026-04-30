export type SolutionSceneSlug =
  | 'family-day'
  | 'client-appreciation'
  | 'annual-meeting'
  | 'commercial-display'
  | 'video-digital-assets'
  | 'academic-forum'
  | 'other';

export type SolutionItemFileType = 'image' | 'video';

export interface SolutionItem {
  id: string;
  fileType: SolutionItemFileType;
  mediaUrl: string;
  mediaFileName: string;
  mediaDisplayName: string;
  alt: string;
  caption: string;
  sortOrder: number;
  enabled: boolean;
  createdAt: string;
}

export interface SolutionGroup {
  id: string;
  title: string;
  slug: string;
  summary: string;
  sceneSlug: SolutionSceneSlug;
  sortOrder: number;
  enabled: boolean;
  items: SolutionItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SolutionScene {
  slug: SolutionSceneSlug;
  name: string;
  description: string;
  sortOrder: number;
  enabled: boolean;
  groups: SolutionGroup[];
}

export interface SolutionGroupInput {
  title?: string;
  slug?: string;
  summary?: string;
  sortOrder?: number;
  enabled?: boolean;
}

export interface SolutionItemInput {
  fileType?: SolutionItemFileType;
  mediaUrl?: string;
  mediaFileName?: string;
  mediaDisplayName?: string;
  alt?: string;
  caption?: string;
  sortOrder?: number;
  enabled?: boolean;
}
