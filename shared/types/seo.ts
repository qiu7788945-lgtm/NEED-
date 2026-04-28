export type StructuredDataType =
  | 'Organization'
  | 'WebSite'
  | 'Article'
  | 'CreativeWork'
  | 'Service'
  | 'FAQPage'
  | 'LocalBusiness';

export interface SeoSettings {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  robots: string;
  structuredDataType?: StructuredDataType;
  sitemapPriority?: number;
  sitemapChangefreq?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageMediaId?: number;
}
