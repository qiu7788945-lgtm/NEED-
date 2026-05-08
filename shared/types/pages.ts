export type PageStatus = 'draft' | 'published' | 'archived';

export type PageType =
  | 'service'
  | 'scenario'
  | 'city'
  | 'faq'
  | 'topic'
  | 'budget'
  | 'vendor_selection'
  | 'family_day'
  | 'annual_meeting'
  | 'contact'
  | 'home_section';

export interface PageSection {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  body: string;
  items: string[];
  mediaRefs: PageMediaRef[];
  sortOrder: number;
  enabled: boolean;
}

export interface PageFaqItem {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  enabled: boolean;
}

export interface PageMediaRef {
  id: string;
  mediaId: string;
  url: string;
  alt: string;
  caption: string;
  usage: string;
  sortOrder: number;
}

export interface PageRequiredChecks {
  hasTitle: boolean;
  hasSeoTitle: boolean;
  hasSeoDescription: boolean;
  hasRenderablePath: boolean;
  hasMeaningfulContent: boolean;
  hasNoPlaceholder: boolean;
  canPrerender: boolean;
}

export interface PageValidationResult {
  ready: boolean;
  checks: PageRequiredChecks;
  errors: string[];
}

export interface Page {
  id: string;
  path: string;
  slug: string;
  pageType: PageType;
  title: string;
  status: PageStatus;
  seoTitle: string;
  seoDescription: string;
  keywords: string;
  heroTitle: string;
  heroSubtitle: string;
  summary: string;
  sections: PageSection[];
  faqItems: PageFaqItem[];
  mediaRefs: PageMediaRef[];
  requiredChecks: PageRequiredChecks;
  sortOrder: number;
  shouldIndex: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface PageInput {
  path?: string;
  slug?: string;
  pageType?: PageType;
  title?: string;
  status?: PageStatus;
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  summary?: string;
  sections?: PageSection[];
  faqItems?: PageFaqItem[];
  mediaRefs?: PageMediaRef[];
  requiredChecks?: Partial<PageRequiredChecks>;
  sortOrder?: number;
  shouldIndex?: boolean;
  publishedAt?: string;
}
