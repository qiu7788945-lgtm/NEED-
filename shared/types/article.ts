export type ArticleCategory = 'how_to_choose' | 'choose_between_two' | 'method_judgment';

export type ArticleStatus = 'draft' | 'published' | 'offline';

export interface ArticleFaqItem {
  question: string;
  answer: string;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  category: ArticleCategory;
  summary: string;
  content: string;
  sortOrder: number;
  status: ArticleStatus;
  seoTitle: string;
  seoDescription: string;
  keywords: string;
  faqItems: ArticleFaqItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ArticleInput {
  title?: string;
  slug?: string;
  category?: ArticleCategory;
  summary?: string;
  content?: string;
  sortOrder?: number;
  status?: ArticleStatus;
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string;
  faqItems?: ArticleFaqItem[];
}
