const viteEnv = (import.meta as ImportMeta & {
  env?: {
    VITE_PUBLIC_API_BASE_URL?: string;
  };
}).env;

const API_BASE_URL = viteEnv?.VITE_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export interface PublicHomeVideo {
  videoUrl: string;
  enabled: boolean;
}

export interface PublicArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content?: string;
  category?: string;
  sortOrder?: number;
  seoTitle?: string;
  seoDescription?: string;
}

export interface PublicCase {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  excerpt: string;
  coverImg?: string;
  tags: string[];
  content?: string;
}

export interface PublicSolution {
  id: string;
  slug: string;
  title: string;
  desc: string;
  enabled: boolean;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toBooleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function toNumberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizeArrayPayload(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return [];
  }

  const directData = value.data;
  const directItems = value.items;

  if (Array.isArray(directData)) {
    return directData;
  }

  if (Array.isArray(directItems)) {
    return directItems;
  }

  if (isRecord(directData) && Array.isArray(directData.items)) {
    return directData.items;
  }

  return [];
}

function normalizeObjectPayload(value: unknown): UnknownRecord | null {
  if (isRecord(value) && isRecord(value.data)) {
    return value.data;
  }

  return isRecord(value) ? value : null;
}

async function safeFetchJson(path: string): Promise<unknown | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`);

    if (!response.ok) {
      return null;
    }

    try {
      return await response.json();
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

function isPublished(item: UnknownRecord): boolean {
  return item.status === 'published' || item.published === true;
}

function isEnabled(item: UnknownRecord): boolean {
  return item.enabled !== false;
}

function adaptArticle(value: unknown): PublicArticle | null {
  if (!isRecord(value) || !isPublished(value)) {
    return null;
  }

  const title = toStringValue(value.title);
  const slug = toStringValue(value.slug);

  if (!title || !slug) {
    return null;
  }

  return {
    id: toStringValue(value.id) || slug,
    slug,
    title,
    excerpt: toStringValue(value.summary) || toStringValue(value.excerpt) || toStringValue(value.seoDescription),
    content: toStringValue(value.content) || toStringValue(value.body) || toStringValue(value.contentText),
    category: toStringValue(value.category),
    sortOrder: toNumberValue(value.sortOrder),
    seoTitle: toStringValue(value.seoTitle),
    seoDescription: toStringValue(value.seoDescription),
  };
}

function adaptCase(value: unknown): PublicCase | null {
  if (!isRecord(value) || !isPublished(value)) {
    return null;
  }

  const title = toStringValue(value.title);
  const slug = toStringValue(value.slug);

  if (!title || !slug) {
    return null;
  }

  const clientType = toStringValue(value.clientType);
  const eventType = toStringValue(value.eventType);
  const location = toStringValue(value.location);
  const tags = [clientType, eventType, location].filter(Boolean);
  const coverUrl = toStringValue(value.coverUrl);

  return {
    id: toStringValue(value.id) || slug,
    slug,
    title,
    subtitle: eventType || clientType,
    excerpt: toStringValue(value.summary) || toStringValue(value.seoDescription),
    coverImg: resolvePublicAssetUrl(coverUrl),
    tags,
    content: toStringValue(value.contentText) || toStringValue(value.contentHtml),
  };
}

function adaptSolution(value: unknown): PublicSolution | null {
  if (!isRecord(value) || !isEnabled(value)) {
    return null;
  }

  const slug = toStringValue(value.slug);
  const title = toStringValue(value.name) || toStringValue(value.title);

  if (!slug || !title) {
    return null;
  }

  return {
    id: slug,
    slug,
    title,
    desc: toStringValue(value.description) || toStringValue(value.desc),
    enabled: true,
  };
}

export function resolvePublicAssetUrl(url: unknown): string {
  const value = toStringValue(url).trim();

  if (!value) {
    return '';
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith('/uploads/')) {
    return `${API_BASE_URL}${value}`;
  }

  if (value.startsWith('/')) {
    return value;
  }

  return value;
}

export async function fetchHomeVideo(): Promise<PublicHomeVideo | null> {
  const payload = await safeFetchJson('/api/home/video');
  const data = normalizeObjectPayload(payload);

  if (!data) {
    return null;
  }

  const videoUrl = resolvePublicAssetUrl(data.videoUrl);
  const enabled = toBooleanValue(data.enabled);

  if (!enabled || !videoUrl) {
    return null;
  }

  return {
    videoUrl,
    enabled,
  };
}

export async function fetchPublishedArticles(): Promise<PublicArticle[]> {
  const payload = await safeFetchJson('/api/articles');
  return normalizeArrayPayload(payload)
    .map(adaptArticle)
    .filter((item): item is PublicArticle => item !== null);
}

export async function fetchPublishedCases(): Promise<PublicCase[]> {
  const payload = await safeFetchJson('/api/cases');
  return normalizeArrayPayload(payload)
    .map(adaptCase)
    .filter((item): item is PublicCase => item !== null);
}

export async function fetchEnabledSolutions(): Promise<PublicSolution[]> {
  const payload = await safeFetchJson('/api/solutions');
  return normalizeArrayPayload(payload)
    .map(adaptSolution)
    .filter((item): item is PublicSolution => item !== null);
}
