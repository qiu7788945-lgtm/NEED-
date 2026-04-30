import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Article, ArticleCategory, ArticleFaqItem, ArticleInput, ArticleStatus } from '../../../../shared/types/article.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dataDir = path.join(serverRoot, 'data');
const articlesPath = path.join(dataDir, 'articles.json');

const allowedCategories = new Set<ArticleCategory>(['how_to_choose', 'choose_between_two', 'method_judgment']);
const allowedStatuses = new Set<ArticleStatus>(['draft', 'published', 'offline']);

export interface ArticleListFilters {
  category?: string;
  status?: string;
  keyword?: string;
}

export interface ArticleReorderItem {
  id: string;
  sortOrder: number;
}

function createArticleError(message: string, statusCode: number, code: string) {
  return Object.assign(new Error(message), {
    statusCode,
    code,
  });
}

async function readArticles(): Promise<Article[]> {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    const raw = await fs.readFile(articlesPath, 'utf8');
    const parsed = JSON.parse(raw) as Article[];
    return Array.isArray(parsed) ? parsed.map(normalizeArticle) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await writeArticles([]);
      return [];
    }

    throw error;
  }
}

async function writeArticles(articles: Article[]) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(articlesPath, `${JSON.stringify(articles, null, 2)}\n`, 'utf8');
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value: unknown, fallback: number) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function normalizeCategory(value: unknown): ArticleCategory {
  if (typeof value === 'string' && allowedCategories.has(value as ArticleCategory)) {
    return value as ArticleCategory;
  }

  return 'how_to_choose';
}

function normalizeStatus(value: unknown): ArticleStatus {
  if (typeof value === 'string' && allowedStatuses.has(value as ArticleStatus)) {
    return value as ArticleStatus;
  }

  return 'draft';
}

function normalizeFaqItems(value: unknown): ArticleFaqItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => ({
      question: normalizeText((item as ArticleFaqItem).question),
      answer: normalizeText((item as ArticleFaqItem).answer),
    }))
    .filter((item) => item.question || item.answer);
}

function normalizeArticle(article: Partial<Article>): Article {
  const now = new Date().toISOString();
  const title = normalizeText(article.title) || '未命名文章';

  return {
    id: normalizeText(article.id) || `${Date.now()}`,
    title,
    slug: normalizeSlug(article.slug || title),
    category: normalizeCategory(article.category),
    summary: normalizeText(article.summary),
    content: normalizeText(article.content),
    sortOrder: normalizeNumber(article.sortOrder, 0),
    status: normalizeStatus(article.status),
    seoTitle: normalizeText(article.seoTitle),
    seoDescription: normalizeText(article.seoDescription),
    keywords: normalizeText(article.keywords),
    faqItems: normalizeFaqItems(article.faqItems),
    createdAt: normalizeText(article.createdAt) || now,
    updatedAt: normalizeText(article.updatedAt) || now,
  };
}

function normalizeSlug(value: unknown) {
  const raw = normalizeText(value).toLowerCase();
  const slug = raw
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || `article-${Date.now()}`;
}

function createUniqueSlug(articles: Article[], slug: string, currentId?: string) {
  const baseSlug = normalizeSlug(slug);
  let nextSlug = baseSlug;
  let index = 2;

  while (articles.some((article) => article.id !== currentId && article.slug === nextSlug)) {
    nextSlug = `${baseSlug}-${index}`;
    index += 1;
  }

  return nextSlug;
}

function createArticleFromInput(input: ArticleInput, articles: Article[]): Article {
  const now = new Date().toISOString();
  const title = normalizeText(input.title);
  const category = normalizeCategory(input.category);
  const requestedSortOrder = normalizeNumber(input.sortOrder, 0);
  const nextCategorySortOrder = articles
    .filter((item) => item.category === category)
    .reduce((maxSortOrder, item) => Math.max(maxSortOrder, item.sortOrder), 0) + 1;

  if (!title) {
    throw createArticleError('文章标题不能为空。', 400, 'ARTICLE_TITLE_REQUIRED');
  }

  const article: Article = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    slug: createUniqueSlug(articles, input.slug || title),
    category,
    summary: normalizeText(input.summary),
    content: normalizeText(input.content),
    sortOrder: requestedSortOrder > 0 ? requestedSortOrder : nextCategorySortOrder,
    status: normalizeStatus(input.status),
    seoTitle: normalizeText(input.seoTitle),
    seoDescription: normalizeText(input.seoDescription),
    keywords: normalizeText(input.keywords),
    faqItems: normalizeFaqItems(input.faqItems),
    createdAt: now,
    updatedAt: now,
  };

  return article;
}

function updateArticleFromInput(article: Article, input: ArticleInput, articles: Article[]): Article {
  const title = input.title === undefined ? article.title : normalizeText(input.title);
  if (!title) {
    throw createArticleError('文章标题不能为空。', 400, 'ARTICLE_TITLE_REQUIRED');
  }

  return {
    ...article,
    title,
    slug: input.slug === undefined ? article.slug : createUniqueSlug(articles, input.slug || title, article.id),
    category: input.category === undefined ? article.category : normalizeCategory(input.category),
    summary: input.summary === undefined ? article.summary : normalizeText(input.summary),
    content: input.content === undefined ? article.content : normalizeText(input.content),
    sortOrder: input.sortOrder === undefined ? article.sortOrder : normalizeNumber(input.sortOrder, article.sortOrder),
    status: input.status === undefined ? article.status : normalizeStatus(input.status),
    seoTitle: input.seoTitle === undefined ? article.seoTitle : normalizeText(input.seoTitle),
    seoDescription: input.seoDescription === undefined ? article.seoDescription : normalizeText(input.seoDescription),
    keywords: input.keywords === undefined ? article.keywords : normalizeText(input.keywords),
    faqItems: input.faqItems === undefined ? article.faqItems : normalizeFaqItems(input.faqItems),
    updatedAt: new Date().toISOString(),
  };
}

export async function listArticles(filters: ArticleListFilters = {}) {
  const articles = await readArticles();
  const keyword = filters.keyword?.trim().toLowerCase();

  return articles
    .filter((article) => !filters.category || article.category === filters.category)
    .filter((article) => !filters.status || article.status === filters.status)
    .filter((article) => {
      if (!keyword) {
        return true;
      }

      return [
        article.title,
        article.slug,
        article.summary,
        article.content,
        article.seoTitle,
        article.seoDescription,
        article.keywords,
      ].some((value) => value.toLowerCase().includes(keyword));
    })
    .sort((a, b) => (a.sortOrder - b.sortOrder) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function getArticle(id: string) {
  const articles = await readArticles();
  const article = articles.find((item) => item.id === id);

  if (!article) {
    throw createArticleError('没有找到这篇文章。', 404, 'ARTICLE_NOT_FOUND');
  }

  return article;
}

export async function createArticle(input: ArticleInput) {
  const articles = await readArticles();
  const article = createArticleFromInput(input, articles);
  const nextArticles = [...articles, article];
  await writeArticles(nextArticles);
  return article;
}

export async function updateArticle(id: string, input: ArticleInput) {
  const articles = await readArticles();
  const article = articles.find((item) => item.id === id);

  if (!article) {
    throw createArticleError('没有找到这篇文章。', 404, 'ARTICLE_NOT_FOUND');
  }

  const updatedArticle = updateArticleFromInput(article, input, articles);
  await writeArticles(articles.map((item) => (item.id === id ? updatedArticle : item)));
  return updatedArticle;
}

export async function deleteArticle(id: string) {
  const articles = await readArticles();
  const exists = articles.some((article) => article.id === id);

  if (!exists) {
    throw createArticleError('没有找到这篇文章。', 404, 'ARTICLE_NOT_FOUND');
  }

  await writeArticles(articles.filter((article) => article.id !== id));
  return { id };
}

export async function updateArticleStatus(id: string, status: unknown) {
  return updateArticle(id, { status: normalizeStatus(status) });
}

export async function reorderArticles(items: ArticleReorderItem[]) {
  if (!Array.isArray(items)) {
    throw createArticleError('排序数据格式不正确。', 400, 'INVALID_ARTICLE_REORDER');
  }

  const articles = await readArticles();
  const sortOrderById = new Map(items.map((item) => [item.id, normalizeNumber(item.sortOrder, 0)]));
  const now = new Date().toISOString();
  const nextArticles = articles.map((article) => (
    sortOrderById.has(article.id)
      ? { ...article, sortOrder: sortOrderById.get(article.id) ?? article.sortOrder, updatedAt: now }
      : article
  ));

  await writeArticles(nextArticles);
  return nextArticles.sort((a, b) => (a.sortOrder - b.sortOrder) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
