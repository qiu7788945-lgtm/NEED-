import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ScenarioCaseRef,
  ScenarioCaseRelationType,
  ScenarioCta,
  ScenarioDetailPage,
  ScenarioDetailPageInput,
  ScenarioDetailPageStatus,
  ScenarioDetailPageType,
  ScenarioFaqItem,
  ScenarioMediaFileType,
  ScenarioMediaItem,
  ScenarioMediaUsage,
  ScenarioProjectItem,
  ScenarioSection,
  ScenarioSectionType,
  ScenarioValidationChecks,
  VideoAssetType,
  VideoShowcaseBlock,
} from '../../../../shared/types/scenario-detail.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dataDir = path.join(serverRoot, 'data');
const scenarioDetailPagesPath = path.join(dataDir, 'scenario-detail-pages.json');

const allowedPageTypes = new Set<ScenarioDetailPageType>(['scenarioShowcasePage', 'mediaShowcasePage']);
const allowedStatuses = new Set<ScenarioDetailPageStatus>(['draft', 'published', 'archived']);
const allowedMediaFileTypes = new Set<ScenarioMediaFileType>(['image', 'video']);
const allowedMediaUsages = new Set<ScenarioMediaUsage>([
  'hero',
  'cover',
  'gallery',
  'projectGallery',
  'caseCard',
  'poster',
  'thumbnail',
  'caseFilm',
  'recap',
  'promo',
  'screenshot',
  'finalAsset',
  'other',
]);
const allowedCaseRelationTypes = new Set<ScenarioCaseRelationType>([
  'featured',
  'related',
  'sourceCase',
  'similarScene',
]);
const allowedSectionTypes = new Set<ScenarioSectionType>([
  'intro',
  'strategy',
  'execution',
  'audience',
  'goal',
  'caseGrid',
  'mediaShowcase',
  'projectGallery',
  'cta',
  'other',
]);
const allowedVideoAssetTypes = new Set<VideoAssetType>([
  'recap',
  'promo',
  'caseFilm',
  'shortClip',
  'screenshot',
  'finalAsset',
  'other',
]);

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

export interface ScenarioDetailPageListFilters {
  pageType?: string;
  status?: string;
  keyword?: string;
}

export interface ScenarioDetailPageReorderItem {
  id: string;
  sortOrder: number;
}

function createScenarioDetailPageError(message: string, statusCode: number, code: string) {
  return Object.assign(new Error(message), {
    statusCode,
    code,
  });
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value: unknown, fallback: number) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function normalizeOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : null;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(normalizeText).filter(Boolean) : [];
}

function normalizeStatus(value: unknown): ScenarioDetailPageStatus {
  if (typeof value === 'string' && allowedStatuses.has(value as ScenarioDetailPageStatus)) {
    return value as ScenarioDetailPageStatus;
  }

  return 'draft';
}

function normalizePageType(value: unknown): ScenarioDetailPageType {
  if (typeof value === 'string' && allowedPageTypes.has(value as ScenarioDetailPageType)) {
    return value as ScenarioDetailPageType;
  }

  return 'scenarioShowcasePage';
}

function normalizeMediaFileType(value: unknown): ScenarioMediaFileType {
  if (typeof value === 'string' && allowedMediaFileTypes.has(value as ScenarioMediaFileType)) {
    return value as ScenarioMediaFileType;
  }

  return 'image';
}

function normalizeMediaUsage(value: unknown): ScenarioMediaUsage {
  if (typeof value === 'string' && allowedMediaUsages.has(value as ScenarioMediaUsage)) {
    return value as ScenarioMediaUsage;
  }

  return 'gallery';
}

function normalizeCaseRelationType(value: unknown): ScenarioCaseRelationType {
  if (typeof value === 'string' && allowedCaseRelationTypes.has(value as ScenarioCaseRelationType)) {
    return value as ScenarioCaseRelationType;
  }

  return 'related';
}

function normalizeSectionType(value: unknown): ScenarioSectionType {
  if (typeof value === 'string' && allowedSectionTypes.has(value as ScenarioSectionType)) {
    return value as ScenarioSectionType;
  }

  return 'other';
}

function normalizeVideoAssetType(value: unknown): VideoAssetType {
  if (typeof value === 'string' && allowedVideoAssetTypes.has(value as VideoAssetType)) {
    return value as VideoAssetType;
  }

  return 'other';
}

function normalizeSlug(value: unknown) {
  const raw = normalizeText(value).toLowerCase();
  const slug = raw
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || `scenario-${Date.now()}`;
}

function normalizePath(value: unknown, slug: string) {
  const raw = normalizeText(value);
  if (!raw) {
    return `/solutions/${slug}`;
  }

  const normalized = raw.startsWith('/') ? raw : `/${raw}`;
  return normalized.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function createUniqueSlug(pages: ScenarioDetailPage[], slug: string, currentId?: string) {
  const baseSlug = normalizeSlug(slug);
  let nextSlug = baseSlug;
  let index = 2;

  while (pages.some((page) => page.id !== currentId && page.slug === nextSlug)) {
    nextSlug = `${baseSlug}-${index}`;
    index += 1;
  }

  return nextSlug;
}

function createUniquePath(pages: ScenarioDetailPage[], pagePath: string, currentId?: string) {
  let nextPath = pagePath;
  let index = 2;

  while (pages.some((page) => page.id !== currentId && page.path === nextPath)) {
    nextPath = `${pagePath}-${index}`;
    index += 1;
  }

  return nextPath;
}

function normalizeValidationChecks(value: unknown): ScenarioValidationChecks {
  const checks = (value || {}) as Partial<ScenarioValidationChecks>;

  return {
    hasTitle: normalizeBoolean(checks.hasTitle, false),
    hasSeoTitle: normalizeBoolean(checks.hasSeoTitle, false),
    hasSeoDescription: normalizeBoolean(checks.hasSeoDescription, false),
    hasValidPath: normalizeBoolean(checks.hasValidPath, false),
    hasMeaningfulIntro: normalizeBoolean(checks.hasMeaningfulIntro, false),
    hasProjectOrMediaContent: normalizeBoolean(checks.hasProjectOrMediaContent, false),
    hasNoPlaceholder: normalizeBoolean(checks.hasNoPlaceholder, false),
    canPublish: normalizeBoolean(checks.canPublish, false),
  };
}

function normalizeMediaItems(value: unknown, fallbackUsage: ScenarioMediaUsage): ScenarioMediaItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const mediaItem = item as Partial<ScenarioMediaItem>;
      return {
        id: normalizeText(mediaItem.id) || `media-${index + 1}`,
        mediaId: normalizeText(mediaItem.mediaId),
        url: normalizeText(mediaItem.url),
        fileType: normalizeMediaFileType(mediaItem.fileType),
        usage: normalizeMediaUsage(mediaItem.usage || fallbackUsage),
        alt: normalizeText(mediaItem.alt),
        caption: normalizeText(mediaItem.caption),
        posterMediaId: normalizeText(mediaItem.posterMediaId),
        posterUrl: normalizeText(mediaItem.posterUrl),
        thumbnailUrl: normalizeText(mediaItem.thumbnailUrl),
        duration: normalizeOptionalNumber(mediaItem.duration),
        projectId: normalizeText(mediaItem.projectId),
        blockId: normalizeText(mediaItem.blockId),
        sortOrder: normalizeNumber(mediaItem.sortOrder, index + 1),
        enabled: normalizeBoolean(mediaItem.enabled, true),
      };
    })
    .filter((item) => item.mediaId || item.url);
}

function normalizeProjectItems(value: unknown): ScenarioProjectItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const projectItem = item as Partial<ScenarioProjectItem>;
      const id = normalizeText(projectItem.id) || `project-${index + 1}`;
      const mediaItems = normalizeMediaItems(projectItem.mediaItems, 'projectGallery')
        .map((mediaItem) => ({ ...mediaItem, projectId: mediaItem.projectId || id }));

      return {
        id,
        title: normalizeText(projectItem.title),
        slogan: normalizeText(projectItem.slogan),
        summary: normalizeText(projectItem.summary),
        tags: normalizeStringArray(projectItem.tags),
        location: normalizeText(projectItem.location),
        clientType: normalizeText(projectItem.clientType),
        eventType: normalizeText(projectItem.eventType),
        dateText: normalizeText(projectItem.dateText),
        coverMediaId: normalizeText(projectItem.coverMediaId),
        mediaItems,
        caseRefId: normalizeText(projectItem.caseRefId),
        sortOrder: normalizeNumber(projectItem.sortOrder, index + 1),
        enabled: normalizeBoolean(projectItem.enabled, true),
      };
    })
    .filter((item) => item.title || item.summary || item.mediaItems.length || item.coverMediaId);
}

function normalizeCaseRefs(value: unknown): ScenarioCaseRef[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const caseRef = item as Partial<ScenarioCaseRef>;
      return {
        id: normalizeText(caseRef.id) || `case-${index + 1}`,
        title: normalizeText(caseRef.title),
        path: normalizeText(caseRef.path),
        summary: normalizeText(caseRef.summary),
        coverMediaId: normalizeText(caseRef.coverMediaId),
        relationType: normalizeCaseRelationType(caseRef.relationType),
        sortOrder: normalizeNumber(caseRef.sortOrder, index + 1),
        enabled: normalizeBoolean(caseRef.enabled, true),
      };
    })
    .filter((item) => item.title || item.path || item.summary || item.coverMediaId);
}

function normalizeSections(value: unknown, fallbackType: ScenarioSectionType): ScenarioSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const section = item as Partial<ScenarioSection>;
      return {
        id: normalizeText(section.id) || `section-${index + 1}`,
        type: normalizeSectionType(section.type || fallbackType),
        title: normalizeText(section.title),
        subtitle: normalizeText(section.subtitle),
        body: normalizeText(section.body),
        items: normalizeStringArray(section.items),
        mediaItems: normalizeMediaItems(section.mediaItems, 'gallery'),
        sortOrder: normalizeNumber(section.sortOrder, index + 1),
        enabled: normalizeBoolean(section.enabled, true),
      };
    })
    .filter((item) => item.title || item.subtitle || item.body || item.items.length || item.mediaItems.length);
}

function normalizeFaqItems(value: unknown): ScenarioFaqItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const faqItem = item as Partial<ScenarioFaqItem>;
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

function normalizeCta(value: unknown): ScenarioCta | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const cta = value as Partial<ScenarioCta>;
  const normalizedCta = {
    title: normalizeText(cta.title),
    description: normalizeText(cta.description),
    buttonText: normalizeText(cta.buttonText),
    href: normalizeText(cta.href),
  };

  return normalizedCta.title || normalizedCta.description || normalizedCta.buttonText || normalizedCta.href
    ? normalizedCta
    : null;
}

function normalizeVideoBlocks(value: unknown): VideoShowcaseBlock[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const block = item as Partial<VideoShowcaseBlock>;
      return {
        id: normalizeText(block.id) || `video-block-${index + 1}`,
        title: normalizeText(block.title),
        description: normalizeText(block.description),
        videoMediaId: normalizeText(block.videoMediaId),
        posterMediaId: normalizeText(block.posterMediaId),
        thumbnailUrl: normalizeText(block.thumbnailUrl),
        assetType: normalizeVideoAssetType(block.assetType),
        distributionChannels: normalizeStringArray(block.distributionChannels),
        relatedProjectId: normalizeText(block.relatedProjectId),
        sortOrder: normalizeNumber(block.sortOrder, index + 1),
        enabled: normalizeBoolean(block.enabled, true),
      };
    })
    .filter((item) => item.title || item.description || item.videoMediaId || item.thumbnailUrl);
}

function normalizeHeroMedia(value: unknown): ScenarioMediaItem | null {
  const mediaItems = normalizeMediaItems(value ? [value] : [], 'hero');
  return mediaItems[0] ?? null;
}

function collectScenarioDetailText(page: Pick<
  ScenarioDetailPage,
  | 'title'
  | 'seoTitle'
  | 'seoDescription'
  | 'heroTitle'
  | 'heroSubtitle'
  | 'intro'
  | 'audience'
  | 'goals'
  | 'projectItems'
  | 'caseRefs'
  | 'strategySections'
  | 'executionPoints'
  | 'videoBlocks'
  | 'faqItems'
  | 'cta'
>) {
  return [
    page.title,
    page.seoTitle,
    page.seoDescription,
    page.heroTitle,
    page.heroSubtitle,
    page.intro,
    ...page.audience,
    ...page.goals,
    ...page.projectItems.flatMap((item) => [item.title, item.slogan, item.summary, ...item.tags, item.location, item.clientType, item.eventType]),
    ...page.caseRefs.flatMap((item) => [item.title, item.path, item.summary]),
    ...page.strategySections.flatMap((section) => [section.title, section.subtitle, section.body, ...section.items]),
    ...page.executionPoints.flatMap((section) => [section.title, section.subtitle, section.body, ...section.items]),
    ...page.videoBlocks.flatMap((block) => [block.title, block.description, ...block.distributionChannels]),
    ...page.faqItems.flatMap((item) => [item.question, item.answer]),
    page.cta?.title,
    page.cta?.description,
    page.cta?.buttonText,
  ].filter(Boolean).join('\n');
}

function getCompactTextLength(value: string) {
  return value.replace(/\s/g, '').length;
}

function isValidScenarioPath(pagePath: string) {
  return Boolean(pagePath)
    && pagePath.startsWith('/')
    && !pagePath.startsWith('/preview')
    && !pagePath.includes('//')
    && pagePath !== '/preview';
}

export function validateScenarioDetailPage(page: ScenarioDetailPage): ScenarioValidationChecks {
  const scenarioText = collectScenarioDetailText(page);
  const hasNoPlaceholder = !placeholderPatterns.some((pattern) => pattern.test(scenarioText));
  const hasEnabledProject = page.projectItems.some((item) => item.enabled && (item.title || item.summary || item.mediaItems.some((mediaItem) => mediaItem.enabled)));
  const hasEnabledMedia = page.mediaGallery.some((item) => item.enabled && (item.mediaId || item.url))
    || Boolean(page.heroMedia?.enabled && (page.heroMedia.mediaId || page.heroMedia.url));
  const hasEnabledVideo = page.videoBlocks.some((block) => block.enabled && (block.videoMediaId || block.thumbnailUrl || block.title));
  const checks: Omit<ScenarioValidationChecks, 'canPublish'> = {
    hasTitle: Boolean(page.title),
    hasSeoTitle: Boolean(page.seoTitle),
    hasSeoDescription: Boolean(page.seoDescription),
    hasValidPath: isValidScenarioPath(page.path),
    hasMeaningfulIntro: hasNoPlaceholder && getCompactTextLength(page.intro) >= 30,
    hasProjectOrMediaContent: hasEnabledProject || hasEnabledMedia || hasEnabledVideo,
    hasNoPlaceholder,
  };

  return {
    ...checks,
    canPublish: Object.values(checks).every(Boolean),
  };
}

function normalizeScenarioDetailPage(page: Partial<ScenarioDetailPage>): ScenarioDetailPage {
  const now = new Date().toISOString();
  const title = normalizeText(page.title) || 'Untitled scenario detail page';
  const slug = normalizeSlug(page.slug || title);
  const normalizedPage: ScenarioDetailPage = {
    id: normalizeText(page.id) || `${Date.now()}`,
    path: normalizePath(page.path, slug),
    slug,
    pageType: normalizePageType(page.pageType),
    status: normalizeStatus(page.status),
    title,
    seoTitle: normalizeText(page.seoTitle),
    seoDescription: normalizeText(page.seoDescription),
    keywords: normalizeText(page.keywords),
    heroTitle: normalizeText(page.heroTitle),
    heroSubtitle: normalizeText(page.heroSubtitle),
    heroMedia: normalizeHeroMedia(page.heroMedia),
    intro: normalizeText(page.intro),
    audience: normalizeStringArray(page.audience),
    goals: normalizeStringArray(page.goals),
    projectItems: normalizeProjectItems(page.projectItems),
    mediaGallery: normalizeMediaItems(page.mediaGallery, 'gallery'),
    caseRefs: normalizeCaseRefs(page.caseRefs),
    strategySections: normalizeSections(page.strategySections, 'strategy'),
    executionPoints: normalizeSections(page.executionPoints, 'execution'),
    videoBlocks: normalizeVideoBlocks(page.videoBlocks),
    faqItems: normalizeFaqItems(page.faqItems),
    cta: normalizeCta(page.cta),
    shouldIndex: normalizeBoolean(page.shouldIndex, false),
    sortOrder: normalizeNumber(page.sortOrder, 0),
    validationChecks: normalizeValidationChecks(page.validationChecks),
    createdAt: normalizeText(page.createdAt) || now,
    updatedAt: normalizeText(page.updatedAt) || now,
    publishedAt: normalizeText(page.publishedAt),
  };

  return {
    ...normalizedPage,
    validationChecks: validateScenarioDetailPage(normalizedPage),
  };
}

async function readScenarioDetailPages(): Promise<ScenarioDetailPage[]> {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    const raw = await fs.readFile(scenarioDetailPagesPath, 'utf8');
    const parsed = JSON.parse(raw) as ScenarioDetailPage[];
    return Array.isArray(parsed) ? parsed.map(normalizeScenarioDetailPage) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await writeScenarioDetailPages([]);
      return [];
    }

    throw error;
  }
}

async function writeScenarioDetailPages(pages: ScenarioDetailPage[]) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(scenarioDetailPagesPath, `${JSON.stringify(pages, null, 2)}\n`, 'utf8');
}

function createScenarioDetailPageFromInput(input: ScenarioDetailPageInput, pages: ScenarioDetailPage[]): ScenarioDetailPage {
  const now = new Date().toISOString();
  const title = normalizeText(input.title);

  if (!title) {
    throw createScenarioDetailPageError('Scenario detail page title is required.', 400, 'SCENARIO_DETAIL_TITLE_REQUIRED');
  }

  const requestedSortOrder = normalizeNumber(input.sortOrder, 0);
  const nextSortOrder = pages.reduce((maxSortOrder, item) => Math.max(maxSortOrder, item.sortOrder), 0) + 1;
  const slug = createUniqueSlug(pages, input.slug || title);
  const status = normalizeStatus(input.status);

  return normalizeScenarioDetailPage({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    path: createUniquePath(pages, normalizePath(input.path, slug)),
    slug,
    pageType: normalizePageType(input.pageType),
    status,
    title,
    seoTitle: normalizeText(input.seoTitle),
    seoDescription: normalizeText(input.seoDescription),
    keywords: normalizeText(input.keywords),
    heroTitle: normalizeText(input.heroTitle),
    heroSubtitle: normalizeText(input.heroSubtitle),
    heroMedia: input.heroMedia,
    intro: normalizeText(input.intro),
    audience: input.audience,
    goals: input.goals,
    projectItems: input.projectItems,
    mediaGallery: input.mediaGallery,
    caseRefs: input.caseRefs,
    strategySections: input.strategySections,
    executionPoints: input.executionPoints,
    videoBlocks: input.videoBlocks,
    faqItems: input.faqItems,
    cta: input.cta,
    shouldIndex: normalizeBoolean(input.shouldIndex, false),
    sortOrder: requestedSortOrder > 0 ? requestedSortOrder : nextSortOrder,
    validationChecks: normalizeValidationChecks(input.validationChecks),
    createdAt: now,
    updatedAt: now,
    publishedAt: status === 'published' ? (normalizeText(input.publishedAt) || now) : '',
  });
}

function updateScenarioDetailPageFromInput(
  page: ScenarioDetailPage,
  input: ScenarioDetailPageInput,
  pages: ScenarioDetailPage[],
): ScenarioDetailPage {
  const title = input.title === undefined ? page.title : normalizeText(input.title);

  if (!title) {
    throw createScenarioDetailPageError('Scenario detail page title is required.', 400, 'SCENARIO_DETAIL_TITLE_REQUIRED');
  }

  const requestedSlug = input.slug === undefined ? page.slug : input.slug || title;
  const slug = createUniqueSlug(pages, requestedSlug, page.id);
  const status = input.status === undefined ? page.status : normalizeStatus(input.status);

  return normalizeScenarioDetailPage({
    ...page,
    path: input.path === undefined ? page.path : createUniquePath(pages, normalizePath(input.path, slug), page.id),
    slug,
    pageType: input.pageType === undefined ? page.pageType : normalizePageType(input.pageType),
    status,
    title,
    seoTitle: input.seoTitle === undefined ? page.seoTitle : normalizeText(input.seoTitle),
    seoDescription: input.seoDescription === undefined ? page.seoDescription : normalizeText(input.seoDescription),
    keywords: input.keywords === undefined ? page.keywords : normalizeText(input.keywords),
    heroTitle: input.heroTitle === undefined ? page.heroTitle : normalizeText(input.heroTitle),
    heroSubtitle: input.heroSubtitle === undefined ? page.heroSubtitle : normalizeText(input.heroSubtitle),
    heroMedia: input.heroMedia === undefined ? page.heroMedia : input.heroMedia,
    intro: input.intro === undefined ? page.intro : normalizeText(input.intro),
    audience: input.audience === undefined ? page.audience : input.audience,
    goals: input.goals === undefined ? page.goals : input.goals,
    projectItems: input.projectItems === undefined ? page.projectItems : input.projectItems,
    mediaGallery: input.mediaGallery === undefined ? page.mediaGallery : input.mediaGallery,
    caseRefs: input.caseRefs === undefined ? page.caseRefs : input.caseRefs,
    strategySections: input.strategySections === undefined ? page.strategySections : input.strategySections,
    executionPoints: input.executionPoints === undefined ? page.executionPoints : input.executionPoints,
    videoBlocks: input.videoBlocks === undefined ? page.videoBlocks : input.videoBlocks,
    faqItems: input.faqItems === undefined ? page.faqItems : input.faqItems,
    cta: input.cta === undefined ? page.cta : input.cta,
    shouldIndex: input.shouldIndex === undefined ? page.shouldIndex : normalizeBoolean(input.shouldIndex, page.shouldIndex),
    sortOrder: input.sortOrder === undefined ? page.sortOrder : normalizeNumber(input.sortOrder, page.sortOrder),
    validationChecks: input.validationChecks === undefined ? page.validationChecks : normalizeValidationChecks(input.validationChecks),
    updatedAt: new Date().toISOString(),
    publishedAt: status === 'published' ? (page.publishedAt || new Date().toISOString()) : '',
  });
}

export async function listScenarioDetailPages(filters: ScenarioDetailPageListFilters = {}) {
  const pages = await readScenarioDetailPages();
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
        page.intro,
        page.seoTitle,
        page.seoDescription,
        page.keywords,
        collectScenarioDetailText(page),
      ].some((value) => value.toLowerCase().includes(keyword));
    })
    .sort((left, right) => (left.sortOrder - right.sortOrder) || String(right.updatedAt).localeCompare(String(left.updatedAt)));
}

export async function getScenarioDetailPageById(id: string) {
  const pages = await readScenarioDetailPages();
  const page = pages.find((item) => item.id === id);

  if (!page) {
    throw createScenarioDetailPageError('Scenario detail page not found.', 404, 'SCENARIO_DETAIL_PAGE_NOT_FOUND');
  }

  return page;
}

export async function createScenarioDetailPage(input: ScenarioDetailPageInput) {
  const pages = await readScenarioDetailPages();
  const page = createScenarioDetailPageFromInput(input, pages);
  await writeScenarioDetailPages([...pages, page]);
  return page;
}

export async function updateScenarioDetailPage(id: string, input: ScenarioDetailPageInput) {
  const pages = await readScenarioDetailPages();
  const page = pages.find((item) => item.id === id);

  if (!page) {
    throw createScenarioDetailPageError('Scenario detail page not found.', 404, 'SCENARIO_DETAIL_PAGE_NOT_FOUND');
  }

  const updatedPage = updateScenarioDetailPageFromInput(page, input, pages);
  await writeScenarioDetailPages(pages.map((item) => (item.id === id ? updatedPage : item)));
  return updatedPage;
}

export async function updateScenarioDetailPageStatus(id: string, status: unknown) {
  return updateScenarioDetailPage(id, { status: normalizeStatus(status) });
}

export async function deleteScenarioDetailPage(id: string) {
  const pages = await readScenarioDetailPages();
  const exists = pages.some((page) => page.id === id);

  if (!exists) {
    throw createScenarioDetailPageError('Scenario detail page not found.', 404, 'SCENARIO_DETAIL_PAGE_NOT_FOUND');
  }

  await writeScenarioDetailPages(pages.filter((page) => page.id !== id));
  return { id };
}

export async function duplicateScenarioDetailPage(id: string) {
  const pages = await readScenarioDetailPages();
  const sourcePage = pages.find((page) => page.id === id);

  if (!sourcePage) {
    throw createScenarioDetailPageError('Scenario detail page not found.', 404, 'SCENARIO_DETAIL_PAGE_NOT_FOUND');
  }

  const now = new Date().toISOString();
  const duplicatedPage = normalizeScenarioDetailPage({
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

  await writeScenarioDetailPages([...pages, duplicatedPage]);
  return duplicatedPage;
}

export async function reorderScenarioDetailPages(items: ScenarioDetailPageReorderItem[]) {
  if (!Array.isArray(items)) {
    throw createScenarioDetailPageError('Invalid scenario detail page reorder payload.', 400, 'INVALID_SCENARIO_DETAIL_PAGE_REORDER');
  }

  const pages = await readScenarioDetailPages();
  const sortOrderById = new Map(items.map((item) => [item.id, normalizeNumber(item.sortOrder, 0)]));
  const now = new Date().toISOString();
  const nextPages = pages.map((page) => (
    sortOrderById.has(page.id)
      ? normalizeScenarioDetailPage({ ...page, sortOrder: sortOrderById.get(page.id) ?? page.sortOrder, updatedAt: now })
      : page
  ));

  await writeScenarioDetailPages(nextPages);
  return nextPages.sort((left, right) => (left.sortOrder - right.sortOrder) || String(right.updatedAt).localeCompare(String(left.updatedAt)));
}
