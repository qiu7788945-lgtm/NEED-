import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import mammoth from 'mammoth';
import type { CaseExtractedImage, CaseFaqItem, CaseInput, CaseStatus, CaseStudy } from '../../../../shared/types/case.js';
import { imageUploadDir, normalizeOriginalFileName } from '../../middlewares/upload.middleware.js';
import { readCasesWithMysqlFallback } from '../data-source/cases-content-source.js';
import { shadowReorderCases, shadowUpdateCase, shadowUpdateCaseStatus } from '../data-source/cases-write-shadow.js';
import { registerLocalImageFile } from '../media/media.service.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dataDir = path.join(serverRoot, 'data');
const casesPath = path.join(dataDir, 'cases.json');

const allowedStatuses = new Set<CaseStatus>(['draft', 'published', 'offline']);
const imageExtByContentType: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.png',
};

export interface CaseListFilters {
  status?: string;
  keyword?: string;
}

export interface CaseReorderItem {
  id: string;
  sortOrder: number;
}

interface UpdateCaseOptions {
  skipShadow?: boolean;
}

function createCaseError(message: string, statusCode: number, code: string) {
  return Object.assign(new Error(message), {
    statusCode,
    code,
  });
}

function normalizeCases(value: unknown): CaseStudy[] {
  return Array.isArray(value) ? value.map((item) => normalizeCase(item as Partial<CaseStudy>)) : [];
}

async function readCasesFromJson(): Promise<CaseStudy[]> {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    const raw = await fs.readFile(casesPath, 'utf8');
    return normalizeCases(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await writeCases([]);
      return [];
    }

    throw error;
  }
}

async function readCases(): Promise<CaseStudy[]> {
  return readCasesWithMysqlFallback(readCasesFromJson, normalizeCases);
}

async function writeCases(cases: CaseStudy[]) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(casesPath, `${JSON.stringify(cases, null, 2)}\n`, 'utf8');
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value: unknown, fallback: number) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function normalizeStatus(value: unknown): CaseStatus {
  if (typeof value === 'string' && allowedStatuses.has(value as CaseStatus)) {
    return value as CaseStatus;
  }

  return 'draft';
}

function normalizeFaqItems(value: unknown): CaseFaqItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => ({
      question: normalizeText((item as CaseFaqItem).question),
      answer: normalizeText((item as CaseFaqItem).answer),
    }))
    .filter((item) => item.question || item.answer);
}

function normalizeExtractedImages(value: unknown): CaseExtractedImage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => ({
    fileName: normalizeText((item as CaseExtractedImage).fileName),
    url: normalizeText((item as CaseExtractedImage).url),
    displayName: normalizeText((item as CaseExtractedImage).displayName),
    alt: normalizeText((item as CaseExtractedImage).alt),
    sortOrder: normalizeNumber((item as CaseExtractedImage).sortOrder, index + 1),
  })).filter((item) => item.fileName && item.url);
}

function normalizeSlug(value: unknown) {
  const raw = normalizeText(value).toLowerCase();
  const slug = raw
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || `case-${Date.now()}`;
}

function createUniqueSlug(cases: CaseStudy[], slug: string, currentId?: string) {
  const baseSlug = normalizeSlug(slug);
  let nextSlug = baseSlug;
  let index = 2;

  while (cases.some((item) => item.id !== currentId && item.slug === nextSlug)) {
    nextSlug = `${baseSlug}-${index}`;
    index += 1;
  }

  return nextSlug;
}

function normalizeCase(item: Partial<CaseStudy>): CaseStudy {
  const now = new Date().toISOString();
  const title = normalizeText(item.title) || '未命名案例';

  return {
    id: normalizeText(item.id) || `${Date.now()}`,
    title,
    slug: normalizeSlug(item.slug || title),
    summary: normalizeText(item.summary),
    clientType: normalizeText(item.clientType),
    eventType: normalizeText(item.eventType),
    eventDate: normalizeText(item.eventDate),
    location: normalizeText(item.location),
    coverUrl: normalizeText(item.coverUrl),
    coverFileName: normalizeText(item.coverFileName),
    coverDisplayName: normalizeText(item.coverDisplayName),
    wordFileName: normalizeText(item.wordFileName),
    wordOriginalName: normalizeText(item.wordOriginalName),
    contentHtml: normalizeText(item.contentHtml),
    contentText: normalizeText(item.contentText),
    extractedImages: normalizeExtractedImages(item.extractedImages),
    sortOrder: normalizeNumber(item.sortOrder, 0),
    status: normalizeStatus(item.status),
    seoTitle: normalizeText(item.seoTitle),
    seoDescription: normalizeText(item.seoDescription),
    keywords: normalizeText(item.keywords),
    faqItems: normalizeFaqItems(item.faqItems),
    createdAt: normalizeText(item.createdAt) || now,
    updatedAt: normalizeText(item.updatedAt) || now,
  };
}

function createCaseFromInput(input: CaseInput, cases: CaseStudy[]): CaseStudy {
  const now = new Date().toISOString();
  const title = normalizeText(input.title) || '未命名案例';

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    slug: createUniqueSlug(cases, input.slug || title),
    summary: normalizeText(input.summary),
    clientType: normalizeText(input.clientType),
    eventType: normalizeText(input.eventType),
    eventDate: normalizeText(input.eventDate),
    location: normalizeText(input.location),
    coverUrl: normalizeText(input.coverUrl),
    coverFileName: normalizeText(input.coverFileName),
    coverDisplayName: normalizeText(input.coverDisplayName),
    wordFileName: normalizeText(input.wordFileName),
    wordOriginalName: normalizeText(input.wordOriginalName),
    contentHtml: normalizeText(input.contentHtml),
    contentText: normalizeText(input.contentText),
    extractedImages: normalizeExtractedImages(input.extractedImages),
    sortOrder: normalizeNumber(input.sortOrder, cases.length + 1),
    status: normalizeStatus(input.status),
    seoTitle: normalizeText(input.seoTitle),
    seoDescription: normalizeText(input.seoDescription),
    keywords: normalizeText(input.keywords),
    faqItems: normalizeFaqItems(input.faqItems),
    createdAt: now,
    updatedAt: now,
  };
}

function updateCaseFromInput(item: CaseStudy, input: CaseInput, cases: CaseStudy[]): CaseStudy {
  const title = input.title === undefined ? item.title : normalizeText(input.title);

  if (!title) {
    throw createCaseError('案例标题不能为空。', 400, 'CASE_TITLE_REQUIRED');
  }

  return {
    ...item,
    title,
    slug: input.slug === undefined ? item.slug : createUniqueSlug(cases, input.slug || title, item.id),
    summary: input.summary === undefined ? item.summary : normalizeText(input.summary),
    clientType: input.clientType === undefined ? item.clientType : normalizeText(input.clientType),
    eventType: input.eventType === undefined ? item.eventType : normalizeText(input.eventType),
    eventDate: input.eventDate === undefined ? item.eventDate : normalizeText(input.eventDate),
    location: input.location === undefined ? item.location : normalizeText(input.location),
    coverUrl: input.coverUrl === undefined ? item.coverUrl : normalizeText(input.coverUrl),
    coverFileName: input.coverFileName === undefined ? item.coverFileName : normalizeText(input.coverFileName),
    coverDisplayName: input.coverDisplayName === undefined ? item.coverDisplayName : normalizeText(input.coverDisplayName),
    wordFileName: input.wordFileName === undefined ? item.wordFileName : normalizeText(input.wordFileName),
    wordOriginalName: input.wordOriginalName === undefined ? item.wordOriginalName : normalizeText(input.wordOriginalName),
    contentHtml: input.contentHtml === undefined ? item.contentHtml : normalizeText(input.contentHtml),
    contentText: input.contentText === undefined ? item.contentText : normalizeText(input.contentText),
    extractedImages: input.extractedImages === undefined ? item.extractedImages : normalizeExtractedImages(input.extractedImages),
    sortOrder: input.sortOrder === undefined ? item.sortOrder : normalizeNumber(input.sortOrder, item.sortOrder),
    status: input.status === undefined ? item.status : normalizeStatus(input.status),
    seoTitle: input.seoTitle === undefined ? item.seoTitle : normalizeText(input.seoTitle),
    seoDescription: input.seoDescription === undefined ? item.seoDescription : normalizeText(input.seoDescription),
    keywords: input.keywords === undefined ? item.keywords : normalizeText(input.keywords),
    faqItems: input.faqItems === undefined ? item.faqItems : normalizeFaqItems(input.faqItems),
    updatedAt: new Date().toISOString(),
  };
}

function getTitleFromWord(contentHtml: string, contentText: string, fallback: string) {
  const h1Match = contentHtml.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const h1Text = h1Match?.[1]?.replace(/<[^>]+>/g, '').trim();
  if (h1Text) {
    return h1Text;
  }

  const firstLine = contentText.split('\n').map((line) => line.trim()).find(Boolean);
  return firstLine || fallback;
}

function getWordTitleFallback(file: Express.Multer.File) {
  return path.basename(normalizeOriginalFileName(file.originalname), path.extname(file.originalname)) || '未命名案例';
}

function createImageFileName(ext: string) {
  const baseName = `case-word-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${baseName}${ext}`;
}

export async function listCases(filters: CaseListFilters = {}) {
  const cases = await readCases();
  const keyword = filters.keyword?.trim().toLowerCase();

  return cases
    .filter((item) => !filters.status || item.status === filters.status)
    .filter((item) => {
      if (!keyword) {
        return true;
      }

      return [
        item.title,
        item.slug,
        item.summary,
        item.clientType,
        item.eventType,
        item.location,
        item.contentText,
        item.seoTitle,
        item.seoDescription,
        item.keywords,
      ].some((value) => value.toLowerCase().includes(keyword));
    })
    .sort((a, b) => (a.sortOrder - b.sortOrder) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function getCase(id: string) {
  const cases = await readCases();
  const item = cases.find((caseItem) => caseItem.id === id || caseItem.slug === id);

  if (item) {
    return item;
  }

  const jsonCases = await readCasesFromJson();
  const jsonItem = jsonCases.find((caseItem) => caseItem.id === id || caseItem.slug === id);

  if (!jsonItem) {
    throw createCaseError('没有找到这个案例。', 404, 'CASE_NOT_FOUND');
  }

  return jsonItem;
}

export async function createCase(input: CaseInput) {
  const cases = await readCasesFromJson();
  const item = createCaseFromInput(input, cases);
  await writeCases([...cases, item]);
  return item;
}

export async function updateCase(id: string, input: CaseInput, options: UpdateCaseOptions = {}) {
  const cases = await readCasesFromJson();
  const item = cases.find((caseItem) => caseItem.id === id);

  if (!item) {
    throw createCaseError('没有找到这个案例。', 404, 'CASE_NOT_FOUND');
  }

  const updatedCase = updateCaseFromInput(item, input, cases);
  await writeCases(cases.map((caseItem) => (caseItem.id === id ? updatedCase : caseItem)));
  if (!options.skipShadow) {
    await shadowUpdateCase(updatedCase);
  }
  return updatedCase;
}

export async function deleteCase(id: string) {
  const cases = await readCasesFromJson();
  const exists = cases.some((item) => item.id === id);

  if (!exists) {
    throw createCaseError('没有找到这个案例。', 404, 'CASE_NOT_FOUND');
  }

  await writeCases(cases.filter((item) => item.id !== id));
  return { id };
}

export async function updateCaseStatus(id: string, status: unknown) {
  const updatedCase = await updateCase(id, { status: normalizeStatus(status) }, { skipShadow: true });
  await shadowUpdateCaseStatus(updatedCase);
  return updatedCase;
}

export async function reorderCases(items: CaseReorderItem[]) {
  if (!Array.isArray(items)) {
    throw createCaseError('排序数据格式不正确。', 400, 'INVALID_CASE_REORDER');
  }

  const cases = await readCasesFromJson();
  const sortOrderById = new Map(items.map((item) => [item.id, normalizeNumber(item.sortOrder, 0)]));
  const now = new Date().toISOString();
  const nextCases = cases.map((item) => (
    sortOrderById.has(item.id)
      ? { ...item, sortOrder: sortOrderById.get(item.id) ?? item.sortOrder, updatedAt: now }
      : item
  ));

  await writeCases(nextCases);
  await shadowReorderCases(nextCases);
  return nextCases.sort((a, b) => (a.sortOrder - b.sortOrder) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function importCaseWord(file: Express.Multer.File) {
  if (!file) {
    throw createCaseError('请上传 .docx Word 文件。', 400, 'WORD_FILE_REQUIRED');
  }

  const cases = await readCasesFromJson();
  const extractedImages: CaseExtractedImage[] = [];
  let imageIndex = 0;

  const htmlResult = await mammoth.convertToHtml(
    { path: file.path },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        imageIndex += 1;
        const contentType = image.contentType || 'image/png';
        const ext = imageExtByContentType[contentType] ?? '.png';
        const base64 = await image.read('base64');
        const buffer = Buffer.from(base64, 'base64');
        const fileName = createImageFileName(ext);
        const imagePath = path.join(imageUploadDir, fileName);
        const displayName = `Word 导入图片 ${imageIndex}`;
        const url = `/uploads/images/${encodeURIComponent(fileName)}`;

        await fs.writeFile(imagePath, buffer);
        extractedImages.push({
          fileName,
          url,
          displayName,
          alt: displayName,
          sortOrder: imageIndex,
        });

        return {
          src: url,
          alt: displayName,
        };
      }),
    },
  );
  const textResult = await mammoth.extractRawText({ path: file.path });
  const title = getTitleFromWord(htmlResult.value, textResult.value, getWordTitleFallback(file));
  const draftCase = createCaseFromInput({
    title,
    summary: textResult.value.split('\n').map((line) => line.trim()).find((line) => line && line !== title) ?? '',
    contentHtml: htmlResult.value,
    contentText: textResult.value.trim(),
    extractedImages,
    wordFileName: file.filename,
    wordOriginalName: normalizeOriginalFileName(file.originalname),
    status: 'draft',
    sortOrder: cases.length + 1,
  }, cases);

  for (const image of extractedImages) {
    await registerLocalImageFile(image.fileName, {
      originalName: image.fileName,
      displayName: image.displayName,
      category: 'case_image',
      ownerType: 'case',
      ownerSlug: draftCase.slug,
      groupKey: 'word-import',
      slotNo: image.sortOrder,
      sortOrder: image.sortOrder,
      alt: image.alt,
    });
  }

  await writeCases([...cases, draftCase]);
  return draftCase;
}
