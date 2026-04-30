export type CaseStatus = 'draft' | 'published' | 'offline';

export interface CaseExtractedImage {
  fileName: string;
  url: string;
  displayName: string;
  alt: string;
  sortOrder: number;
}

export interface CaseFaqItem {
  question: string;
  answer: string;
}

export interface CaseStudy {
  id: string;
  title: string;
  slug: string;
  summary: string;
  clientType: string;
  eventType: string;
  eventDate: string;
  location: string;
  coverUrl: string;
  coverFileName: string;
  coverDisplayName: string;
  wordFileName: string;
  wordOriginalName: string;
  contentHtml: string;
  contentText: string;
  extractedImages: CaseExtractedImage[];
  sortOrder: number;
  status: CaseStatus;
  seoTitle: string;
  seoDescription: string;
  keywords: string;
  faqItems: CaseFaqItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CaseInput {
  title?: string;
  slug?: string;
  summary?: string;
  clientType?: string;
  eventType?: string;
  eventDate?: string;
  location?: string;
  coverUrl?: string;
  coverFileName?: string;
  coverDisplayName?: string;
  wordFileName?: string;
  wordOriginalName?: string;
  contentHtml?: string;
  contentText?: string;
  extractedImages?: CaseExtractedImage[];
  sortOrder?: number;
  status?: CaseStatus;
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string;
  faqItems?: CaseFaqItem[];
}
