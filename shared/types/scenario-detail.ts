export type ScenarioDetailPageStatus = 'draft' | 'published' | 'archived';

export type ScenarioDetailPageType =
  | 'scenarioShowcasePage'
  | 'mediaShowcasePage';

export type ScenarioMediaFileType = 'image' | 'video';

export type ScenarioMediaUsage =
  | 'hero'
  | 'cover'
  | 'gallery'
  | 'projectGallery'
  | 'caseCard'
  | 'poster'
  | 'thumbnail'
  | 'caseFilm'
  | 'recap'
  | 'promo'
  | 'screenshot'
  | 'finalAsset'
  | 'other';

export type ScenarioCaseRelationType =
  | 'featured'
  | 'related'
  | 'sourceCase'
  | 'similarScene';

export type ScenarioSectionType =
  | 'intro'
  | 'strategy'
  | 'execution'
  | 'audience'
  | 'goal'
  | 'caseGrid'
  | 'mediaShowcase'
  | 'projectGallery'
  | 'cta'
  | 'other';

export type VideoAssetType =
  | 'recap'
  | 'promo'
  | 'caseFilm'
  | 'shortClip'
  | 'screenshot'
  | 'finalAsset'
  | 'other';

export interface ScenarioValidationChecks {
  hasTitle: boolean;
  hasSeoTitle: boolean;
  hasSeoDescription: boolean;
  hasValidPath: boolean;
  hasMeaningfulIntro: boolean;
  hasProjectOrMediaContent: boolean;
  hasNoPlaceholder: boolean;
  canPublish: boolean;
}

export interface ScenarioMediaItem {
  id: string;
  mediaId: string;
  url: string;
  fileType: ScenarioMediaFileType;
  usage: ScenarioMediaUsage;
  alt: string;
  caption: string;
  posterMediaId: string;
  posterUrl: string;
  thumbnailUrl: string;
  duration: number | null;
  projectId: string;
  blockId: string;
  sortOrder: number;
  enabled: boolean;
}

export interface ScenarioProjectItem {
  id: string;
  title: string;
  slogan: string;
  summary: string;
  tags: string[];
  location: string;
  clientType: string;
  eventType: string;
  dateText: string;
  coverMediaId: string;
  mediaItems: ScenarioMediaItem[];
  caseRefId: string;
  sortOrder: number;
  enabled: boolean;
}

export interface ScenarioCaseRef {
  id: string;
  title: string;
  path: string;
  summary: string;
  coverMediaId: string;
  relationType: ScenarioCaseRelationType;
  sortOrder: number;
  enabled: boolean;
}

export interface ScenarioSection {
  id: string;
  type: ScenarioSectionType;
  title: string;
  subtitle: string;
  body: string;
  items: string[];
  mediaItems: ScenarioMediaItem[];
  sortOrder: number;
  enabled: boolean;
}

export interface ScenarioFaqItem {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  enabled: boolean;
}

export interface ScenarioCta {
  title: string;
  description: string;
  buttonText: string;
  href: string;
}

export interface VideoShowcaseBlock {
  id: string;
  title: string;
  description: string;
  videoMediaId: string;
  posterMediaId: string;
  thumbnailUrl: string;
  assetType: VideoAssetType;
  distributionChannels: string[];
  relatedProjectId: string;
  sortOrder: number;
  enabled: boolean;
}

export interface ScenarioDetailPage {
  id: string;
  path: string;
  slug: string;
  pageType: ScenarioDetailPageType;
  status: ScenarioDetailPageStatus;
  title: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string;
  heroTitle: string;
  heroSubtitle: string;
  heroMedia: ScenarioMediaItem | null;
  intro: string;
  audience: string[];
  goals: string[];
  projectItems: ScenarioProjectItem[];
  mediaGallery: ScenarioMediaItem[];
  caseRefs: ScenarioCaseRef[];
  strategySections: ScenarioSection[];
  executionPoints: ScenarioSection[];
  videoBlocks: VideoShowcaseBlock[];
  faqItems: ScenarioFaqItem[];
  cta: ScenarioCta | null;
  shouldIndex: boolean;
  sortOrder: number;
  validationChecks: ScenarioValidationChecks;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface ScenarioDetailPageInput {
  path?: string;
  slug?: string;
  pageType?: ScenarioDetailPageType;
  status?: ScenarioDetailPageStatus;
  title?: string;
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroMedia?: ScenarioMediaItem | null;
  intro?: string;
  audience?: string[];
  goals?: string[];
  projectItems?: ScenarioProjectItem[];
  mediaGallery?: ScenarioMediaItem[];
  caseRefs?: ScenarioCaseRef[];
  strategySections?: ScenarioSection[];
  executionPoints?: ScenarioSection[];
  videoBlocks?: VideoShowcaseBlock[];
  faqItems?: ScenarioFaqItem[];
  cta?: ScenarioCta | null;
  shouldIndex?: boolean;
  sortOrder?: number;
  validationChecks?: Partial<ScenarioValidationChecks>;
  publishedAt?: string;
}
