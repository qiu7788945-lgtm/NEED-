import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  Page,
  PageFaqItem,
  PageInput,
  PageMediaRef,
  PageRequiredChecks,
  PageSection,
  PageStatus,
  PageType,
  PageValidationResult,
} from '../../../../shared/types/pages.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dataDir = path.join(serverRoot, 'data');
const pagesPath = path.join(dataDir, 'pages.json');

const allowedPageTypes = new Set<PageType>([
  'service',
  'scenario',
  'city',
  'faq',
  'topic',
  'budget',
  'vendor_selection',
  'family_day',
  'annual_meeting',
  'contact',
  'home_section',
]);
const allowedStatuses = new Set<PageStatus>(['draft', 'published', 'archived']);
const placeholderPatterns = [
  /测试/,
  /占位/,
  /待补充/,
  /待完善/,
  /示例/,
  /TODO/i,
  /placeholder/i,
  /lorem ipsum/i,
  /test page/i,
  /\btest\b/i,
];
const reservedStaticRoutePaths = new Set([
  '/',
  '/solutions',
  '/solutions/family-day',
  '/solutions/salon',
  '/solutions/annual',
  '/solutions/exhibition',
  '/solutions/video',
  '/solutions/forum',
  '/solutions/other',
  '/contact',
  '/how-to-choose',
  '/how-to-choose/01',
  '/how-to-choose/02',
  '/how-to-choose/03',
  '/how-to-choose/04',
  '/choose-between-two',
  '/cases/hyundai-family-day',
]);

export interface PageListFilters {
  pageType?: string;
  status?: string;
  keyword?: string;
}

export interface PageReorderItem {
  id: string;
  sortOrder: number;
}

function createPageError(message: string, statusCode: number, code: string) {
  return Object.assign(new Error(message), {
    statusCode,
    code,
  });
}

async function readPages(): Promise<Page[]> {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    const raw = await fs.readFile(pagesPath, 'utf8');
    const parsed = JSON.parse(raw) as Page[];
    return Array.isArray(parsed) ? parsed.map(normalizePage) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await writePages([]);
      return [];
    }

    throw error;
  }
}

async function writePages(pages: Page[]) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(pagesPath, `${JSON.stringify(pages, null, 2)}\n`, 'utf8');
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value: unknown, fallback: number) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeStatus(value: unknown): PageStatus {
  if (typeof value === 'string' && allowedStatuses.has(value as PageStatus)) {
    return value as PageStatus;
  }

  return 'draft';
}

function normalizePageType(value: unknown): PageType {
  if (typeof value === 'string' && allowedPageTypes.has(value as PageType)) {
    return value as PageType;
  }

  return 'topic';
}

function normalizeSlug(value: unknown) {
  const raw = normalizeText(value).toLowerCase();
  const slug = raw
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || `page-${Date.now()}`;
}

function normalizePath(value: unknown, slug: string) {
  const raw = normalizeText(value);
  if (!raw) {
    return `/${slug}`;
  }

  const normalized = raw.startsWith('/') ? raw : `/${raw}`;
  return normalized.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function createUniqueSlug(pages: Page[], slug: string, currentId?: string) {
  const baseSlug = normalizeSlug(slug);
  let nextSlug = baseSlug;
  let index = 2;

  while (pages.some((page) => page.id !== currentId && page.slug === nextSlug)) {
    nextSlug = `${baseSlug}-${index}`;
    index += 1;
  }

  return nextSlug;
}

function createUniquePath(pages: Page[], pagePath: string, currentId?: string) {
  let nextPath = pagePath;
  let index = 2;

  while (pages.some((page) => page.id !== currentId && page.path === nextPath)) {
    nextPath = `${pagePath}-${index}`;
    index += 1;
  }

  return nextPath;
}

function normalizeMediaRefs(value: unknown): PageMediaRef[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const mediaRef = item as Partial<PageMediaRef>;
      return {
        id: normalizeText(mediaRef.id) || `media-${index + 1}`,
        mediaId: normalizeText(mediaRef.mediaId),
        url: normalizeText(mediaRef.url),
        alt: normalizeText(mediaRef.alt),
        caption: normalizeText(mediaRef.caption),
        usage: normalizeText(mediaRef.usage),
        sortOrder: normalizeNumber(mediaRef.sortOrder, index + 1),
      };
    })
    .filter((item) => item.mediaId || item.url);
}

function normalizeSections(value: unknown): PageSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const section = item as Partial<PageSection>;
      return {
        id: normalizeText(section.id) || `section-${index + 1}`,
        type: normalizeText(section.type) || 'text',
        title: normalizeText(section.title),
        subtitle: normalizeText(section.subtitle),
        body: normalizeText(section.body),
        items: Array.isArray(section.items) ? section.items.map(normalizeText).filter(Boolean) : [],
        mediaRefs: normalizeMediaRefs(section.mediaRefs),
        sortOrder: normalizeNumber(section.sortOrder, index + 1),
        enabled: normalizeBoolean(section.enabled, true),
      };
    })
    .filter((item) => item.title || item.subtitle || item.body || item.items.length || item.mediaRefs.length);
}

function normalizeFaqItems(value: unknown): PageFaqItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const faqItem = item as Partial<PageFaqItem>;
      return {
        id: normalizeText(faqItem.id) || `faq-${index + 1}`,
        question: normalizeText(faqItem.question),
        answer: normalizeText(faqItem.answer),
        sortOrder: normalizeNumber(faqItem.sortOrder, index + 1),
        enabled: normalizeBoolean(faqItem.enabled, true),
      };
    })
    .filter((item) => item.question || item.answer);
}

function normalizeRequiredChecks(value: unknown): PageRequiredChecks {
  const checks = (value || {}) as Partial<PageRequiredChecks>;

  return {
    hasTitle: normalizeBoolean(checks.hasTitle, false),
    hasSeoTitle: normalizeBoolean(checks.hasSeoTitle, false),
    hasSeoDescription: normalizeBoolean(checks.hasSeoDescription, false),
    hasRenderablePath: normalizeBoolean(checks.hasRenderablePath, false),
    hasMeaningfulContent: normalizeBoolean(checks.hasMeaningfulContent, false),
    hasNoPlaceholder: normalizeBoolean(checks.hasNoPlaceholder, false),
    canPrerender: normalizeBoolean(checks.canPrerender, false),
  };
}

function collectMeaningfulText(page: Pick<Page, 'title' | 'heroTitle' | 'heroSubtitle' | 'summary' | 'sections' | 'faqItems'>) {
  return [
    page.title,
    page.heroTitle,
    page.heroSubtitle,
    page.summary,
    ...page.sections.flatMap((section) => [section.title, section.subtitle, section.body, ...section.items]),
    ...page.faqItems.flatMap((item) => [item.question, item.answer]),
  ].join('\n');
}

function getCompactTextLength(value: string) {
  return value.replace(/\s/g, '').length;
}

export function validatePageReadiness(page: Page): PageValidationResult {
  const meaningfulText = collectMeaningfulText(page);
  const meaningfulTextLength = getCompactTextLength(meaningfulText);
  const hasRenderablePath = Boolean(page.path)
    && page.path.startsWith('/')
    && !page.path.startsWith('/preview')
    && !page.path.includes('//')
    && !reservedStaticRoutePaths.has(page.path);
  const hasStrongSummary = getCompactTextLength(page.summary) >= 30;
  const hasStrongSectionBody = page.sections.some((section) => (
    section.enabled && getCompactTextLength(section.body) >= 50
  ));
  const hasStrongFaq = page.faqItems.some((item) => (
    item.enabled && Boolean(item.question.trim()) && getCompactTextLength(item.answer) >= 40
  ));
  const hasNoPlaceholder = !placeholderPatterns.some((pattern) => pattern.test(meaningfulText));
  const hasMeaningfulContent = hasNoPlaceholder
    && meaningfulTextLength >= 80
    && (hasStrongSummary || hasStrongSectionBody || hasStrongFaq);
  const checks: PageRequiredChecks = {
    hasTitle: Boolean(page.title),
    hasSeoTitle: Boolean(page.seoTitle),
    hasSeoDescription: Boolean(page.seoDescription),
    hasRenderablePath,
    hasMeaningfulContent,
    hasNoPlaceholder,
    canPrerender: hasRenderablePath,
  };
  const errors = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);

  return {
    ready: errors.length === 0,
    checks,
    errors,
  };
}

function normalizePage(page: Partial<Page>): Page {
  const now = new Date().toISOString();
  const title = normalizeText(page.title) || 'Untitled page';
  const slug = normalizeSlug(page.slug || title);
  const sections = normalizeSections(page.sections);
  const normalizedPage: Page = {
    id: normalizeText(page.id) || `${Date.now()}`,
    path: normalizePath(page.path, slug),
    slug,
    pageType: normalizePageType(page.pageType),
    title,
    status: normalizeStatus(page.status),
    seoTitle: normalizeText(page.seoTitle),
    seoDescription: normalizeText(page.seoDescription),
    keywords: normalizeText(page.keywords),
    heroTitle: normalizeText(page.heroTitle),
    heroSubtitle: normalizeText(page.heroSubtitle),
    summary: normalizeText(page.summary),
    sections,
    faqItems: normalizeFaqItems(page.faqItems),
    mediaRefs: normalizeMediaRefs(page.mediaRefs),
    requiredChecks: normalizeRequiredChecks(page.requiredChecks),
    sortOrder: normalizeNumber(page.sortOrder, 0),
    shouldIndex: normalizeBoolean(page.shouldIndex, false),
    createdAt: normalizeText(page.createdAt) || now,
    updatedAt: normalizeText(page.updatedAt) || now,
    publishedAt: normalizeText(page.publishedAt),
  };

  return {
    ...normalizedPage,
    requiredChecks: {
      ...normalizedPage.requiredChecks,
      ...validatePageReadiness(normalizedPage).checks,
    },
  };
}

function createPageFromInput(input: PageInput, pages: Page[]): Page {
  const now = new Date().toISOString();
  const title = normalizeText(input.title);

  if (!title) {
    throw createPageError('Page title is required.', 400, 'PAGE_TITLE_REQUIRED');
  }

  const requestedSortOrder = normalizeNumber(input.sortOrder, 0);
  const nextSortOrder = pages.reduce((maxSortOrder, item) => Math.max(maxSortOrder, item.sortOrder), 0) + 1;
  const slug = createUniqueSlug(pages, input.slug || title);
  const status = normalizeStatus(input.status);
  const page: Page = normalizePage({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    path: createUniquePath(pages, normalizePath(input.path, slug)),
    slug,
    pageType: normalizePageType(input.pageType),
    title,
    status,
    seoTitle: normalizeText(input.seoTitle),
    seoDescription: normalizeText(input.seoDescription),
    keywords: normalizeText(input.keywords),
    heroTitle: normalizeText(input.heroTitle),
    heroSubtitle: normalizeText(input.heroSubtitle),
    summary: normalizeText(input.summary),
    sections: input.sections,
    faqItems: input.faqItems,
    mediaRefs: input.mediaRefs,
    requiredChecks: normalizeRequiredChecks(input.requiredChecks),
    sortOrder: requestedSortOrder > 0 ? requestedSortOrder : nextSortOrder,
    shouldIndex: normalizeBoolean(input.shouldIndex, false),
    createdAt: now,
    updatedAt: now,
    publishedAt: status === 'published' ? (normalizeText(input.publishedAt) || now) : '',
  });

  return page;
}

function updatePageFromInput(page: Page, input: PageInput, pages: Page[]): Page {
  const title = input.title === undefined ? page.title : normalizeText(input.title);

  if (!title) {
    throw createPageError('Page title is required.', 400, 'PAGE_TITLE_REQUIRED');
  }

  const requestedSlug = input.slug === undefined ? page.slug : input.slug || title;
  const slug = createUniqueSlug(pages, requestedSlug, page.id);
  const status = input.status === undefined ? page.status : normalizeStatus(input.status);
  const updatedPage = normalizePage({
    ...page,
    path: input.path === undefined ? page.path : createUniquePath(pages, normalizePath(input.path, slug), page.id),
    slug,
    pageType: input.pageType === undefined ? page.pageType : normalizePageType(input.pageType),
    title,
    status,
    seoTitle: input.seoTitle === undefined ? page.seoTitle : normalizeText(input.seoTitle),
    seoDescription: input.seoDescription === undefined ? page.seoDescription : normalizeText(input.seoDescription),
    keywords: input.keywords === undefined ? page.keywords : normalizeText(input.keywords),
    heroTitle: input.heroTitle === undefined ? page.heroTitle : normalizeText(input.heroTitle),
    heroSubtitle: input.heroSubtitle === undefined ? page.heroSubtitle : normalizeText(input.heroSubtitle),
    summary: input.summary === undefined ? page.summary : normalizeText(input.summary),
    sections: input.sections === undefined ? page.sections : input.sections,
    faqItems: input.faqItems === undefined ? page.faqItems : input.faqItems,
    mediaRefs: input.mediaRefs === undefined ? page.mediaRefs : input.mediaRefs,
    requiredChecks: input.requiredChecks === undefined ? page.requiredChecks : normalizeRequiredChecks(input.requiredChecks),
    sortOrder: input.sortOrder === undefined ? page.sortOrder : normalizeNumber(input.sortOrder, page.sortOrder),
    shouldIndex: input.shouldIndex === undefined ? page.shouldIndex : normalizeBoolean(input.shouldIndex, page.shouldIndex),
    updatedAt: new Date().toISOString(),
    publishedAt: status === 'published' ? (page.publishedAt || new Date().toISOString()) : '',
  });

  return updatedPage;
}

export async function listPages(filters: PageListFilters = {}) {
  const pages = await readPages();
  const keyword = filters.keyword?.trim().toLowerCase();

  return pages
    .filter((page) => !filters.pageType || page.pageType === filters.pageType)
    .filter((page) => !filters.status || page.status === filters.status)
    .filter((page) => {
      if (!keyword) {
        return true;
      }

      return [
        page.path,
        page.slug,
        page.title,
        page.summary,
        page.seoTitle,
        page.seoDescription,
        page.keywords,
        collectMeaningfulText(page),
      ].some((value) => value.toLowerCase().includes(keyword));
    })
    .sort((a, b) => (a.sortOrder - b.sortOrder) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function getPage(id: string) {
  const pages = await readPages();
  const page = pages.find((item) => item.id === id);

  if (!page) {
    throw createPageError('Page not found.', 404, 'PAGE_NOT_FOUND');
  }

  return page;
}

export async function createPage(input: PageInput) {
  const pages = await readPages();
  const page = createPageFromInput(input, pages);
  const nextPages = [...pages, page];
  await writePages(nextPages);
  return page;
}

export async function updatePage(id: string, input: PageInput) {
  const pages = await readPages();
  const page = pages.find((item) => item.id === id);

  if (!page) {
    throw createPageError('Page not found.', 404, 'PAGE_NOT_FOUND');
  }

  const updatedPage = updatePageFromInput(page, input, pages);
  await writePages(pages.map((item) => (item.id === id ? updatedPage : item)));
  return updatedPage;
}

export async function deletePage(id: string) {
  const pages = await readPages();
  const exists = pages.some((page) => page.id === id);

  if (!exists) {
    throw createPageError('Page not found.', 404, 'PAGE_NOT_FOUND');
  }

  await writePages(pages.filter((page) => page.id !== id));
  return { id };
}

export async function updatePageStatus(id: string, status: unknown) {
  return updatePage(id, { status: normalizeStatus(status) });
}

export async function duplicatePage(id: string) {
  const pages = await readPages();
  const sourcePage = pages.find((page) => page.id === id);

  if (!sourcePage) {
    throw createPageError('Page not found.', 404, 'PAGE_NOT_FOUND');
  }

  const now = new Date().toISOString();
  const duplicatedPage = normalizePage({
    ...sourcePage,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: `${sourcePage.title} Copy`,
    slug: createUniqueSlug(pages, `${sourcePage.slug}-copy`),
    path: createUniquePath(pages, `${sourcePage.path}-copy`),
    status: 'draft',
    shouldIndex: false,
    createdAt: now,
    updatedAt: now,
    publishedAt: '',
  });

  await writePages([...pages, duplicatedPage]);
  return duplicatedPage;
}

export async function reorderPages(items: PageReorderItem[]) {
  if (!Array.isArray(items)) {
    throw createPageError('Invalid page reorder payload.', 400, 'INVALID_PAGE_REORDER');
  }

  const pages = await readPages();
  const sortOrderById = new Map(items.map((item) => [item.id, normalizeNumber(item.sortOrder, 0)]));
  const now = new Date().toISOString();
  const nextPages = pages.map((page) => (
    sortOrderById.has(page.id)
      ? { ...page, sortOrder: sortOrderById.get(page.id) ?? page.sortOrder, updatedAt: now }
      : page
  ));

  await writePages(nextPages);
  return nextPages.sort((a, b) => (a.sortOrder - b.sortOrder) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
