import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Article } from '../../../shared/types/article.js';
import type { CaseStudy } from '../../../shared/types/case.js';
import type { HomeInteractiveImageSlot, HomeVideoConfig } from '../../../shared/types/home.js';
import type { SolutionGroup, SolutionScene } from '../../../shared/types/solution.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const projectRoot = path.resolve(serverRoot, '..');
const dataDir = path.join(serverRoot, 'data');
const outputDir = path.join(projectRoot, 'dist-static');
const siteBaseUrl = 'https://www.need-pr.com';
const siteName = 'NEED 尼德公关';
const defaultDescription = 'NEED 尼德公关专注企业活动、品牌活动、场景表达与落地执行，提供企业家庭日、客户答谢、年会活动、商业美陈、学术论坛等活动策划与执行服务。';
const includeDraft = process.argv.includes('--include-draft') || process.env.INCLUDE_DRAFT_STATIC === 'true';

const articleCategoryLabels: Record<Article['category'], string> = {
  how_to_choose: '怎么选活动公司',
  method_judgment: '方法与判断',
  choose_between_two: '二选一怎么选',
};

interface PublicMediaSeed {
  fileName?: string;
  displayName?: string;
  fileType?: string;
  url?: string;
  category?: string;
  alt?: string;
}

interface StaticPage {
  path: string;
  title: string;
  description: string;
  body: string;
  type?: 'website' | 'article';
  jsonLd?: unknown[];
  includeInSitemap?: boolean;
  updatedAt?: string;
}

function normalizeJsonText(text: string) {
  return text.replace(/^\uFEFF/, '').trim();
}

async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  try {
    const raw = normalizeJsonText(await fs.readFile(path.join(dataDir, fileName), 'utf8'));
    return raw ? JSON.parse(raw) as T : fallback;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' || error instanceof SyntaxError) {
      return fallback;
    }
    throw error;
  }
}

async function readSeedJson<T>(fileName: string, fallback: T): Promise<T> {
  try {
    const raw = normalizeJsonText(await fs.readFile(path.join(dataDir, 'seeds', fileName), 'utf8'));
    return raw ? JSON.parse(raw) as T : fallback;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' || error instanceof SyntaxError) {
      return fallback;
    }
    throw error;
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: unknown) {
  return escapeHtml(value);
}

function normalizePath(pagePath: string) {
  if (pagePath === '/') {
    return '/';
  }
  return `/${pagePath.replace(/^\/+|\/+$/g, '')}/`;
}

function canonicalUrl(pagePath: string) {
  return `${siteBaseUrl}${normalizePath(pagePath)}`;
}

function pageOutputPath(pagePath: string) {
  if (pagePath === '/') {
    return path.join(outputDir, 'index.html');
  }
  if (pagePath === '/404.html') {
    return path.join(outputDir, '404.html');
  }
  return path.join(outputDir, pagePath.replace(/^\/+|\/+$/g, ''), 'index.html');
}

function trimDescription(value: string, fallback = defaultDescription) {
  const text = value.replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 160) : fallback;
}

function paragraphize(text: string) {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith('# ')) {
        return `<h2>${escapeHtml(block.replace(/^#\s+/, ''))}</h2>`;
      }
      if (block.startsWith('## ')) {
        return `<h2>${escapeHtml(block.replace(/^##\s+/, ''))}</h2>`;
      }
      const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
      if (lines.length > 0 && lines.every((line) => /^[-*]\s+/.test(line))) {
        return `<ul>${lines.map((line) => `<li>${escapeHtml(line.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
      }
      return `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
}

function sanitizeBasicHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, '');
}

function renderContentHtml(html: string, fallbackText: string) {
  return html.trim() ? sanitizeBasicHtml(html) : paragraphize(fallbackText);
}

function isPlaceholder(text: string) {
  return /待补充|占位|【待补充】/.test(text);
}

function draftBadge(enabled: boolean, label = '草稿预览') {
  return enabled ? `<span class="badge">${escapeHtml(label)}</span>` : '';
}

function renderLayout(page: StaticPage) {
  const title = `${page.title}｜${siteName}`;
  const description = trimDescription(page.description);
  const url = canonicalUrl(page.path);
  const jsonLd = page.jsonLd?.length
    ? page.jsonLd.map((item) => `<script type="application/ld+json">${JSON.stringify(item)}</script>`).join('\n')
    : '';

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttribute(description)}">
  <link rel="canonical" href="${escapeAttribute(url)}">
  <meta property="og:title" content="${escapeAttribute(page.title)}">
  <meta property="og:description" content="${escapeAttribute(description)}">
  <meta property="og:type" content="${page.type === 'article' ? 'article' : 'website'}">
  <meta property="og:url" content="${escapeAttribute(url)}">
  <link rel="stylesheet" href="/assets/static.css">
  ${jsonLd}
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/">NEED</a>
    <nav>
      <a href="/articles/">文章</a>
      <a href="/cases/">案例</a>
      <a href="/solutions/">场景解决方案</a>
      <a href="/contact/">联系 NEED</a>
    </nav>
  </header>
  <main>${page.body}</main>
  <footer class="site-footer">
    <section class="cta">
      <p>联系 NEED</p>
      <h2>先把目标、预算和执行边界聊清楚。</h2>
      <a href="/contact/">开始沟通</a>
    </section>
    <p>© ${new Date().getFullYear()} NEED 尼德公关。本静态站由后台 JSON 数据生成。</p>
  </footer>
</body>
</html>`;
}

async function writePage(page: StaticPage) {
  const filePath = pageOutputPath(page.path);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, renderLayout(page), 'utf8');
}

function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}

function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteName,
    url: siteBaseUrl,
    description: defaultDescription,
  };
}

function articleJsonLd(article: Article) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.seoDescription || article.summary,
    datePublished: article.createdAt,
    dateModified: article.updatedAt,
    author: {
      '@type': 'Organization',
      name: siteName,
    },
    mainEntityOfPage: canonicalUrl(`/articles/${article.slug}/`),
  };
}

function faqJsonLd(faqItems: Array<{ question: string; answer: string }>) {
  const validItems = faqItems.filter((item) => item.question.trim() && item.answer.trim());
  if (!validItems.length) {
    return null;
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: validItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

function renderFaq(faqItems: Array<{ question: string; answer: string }>) {
  const validItems = faqItems.filter((item) => item.question.trim() && item.answer.trim());
  if (!validItems.length) {
    return '';
  }
  return `<section class="section"><h2>常见问题</h2><div class="faq-list">${validItems.map((item) => `
    <article class="card">
      <h3>${escapeHtml(item.question)}</h3>
      <p>${escapeHtml(item.answer)}</p>
    </article>`).join('')}</div></section>`;
}

function visibleArticles(articles: Article[]) {
  return articles
    .filter((article) => article.status === 'published' || (includeDraft && article.status === 'draft'))
    .sort((a, b) => a.category.localeCompare(b.category) || a.sortOrder - b.sortOrder);
}

function sitemapArticles(articles: Article[]) {
  return articles.filter((article) => article.status === 'published');
}

function visibleCases(cases: CaseStudy[]) {
  return cases
    .filter((caseItem) => caseItem.status === 'published' || (includeDraft && caseItem.status === 'draft'))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function sitemapCases(cases: CaseStudy[]) {
  return cases.filter((caseItem) => caseItem.status === 'published');
}

function visibleGroups(scene: SolutionScene) {
  return scene.groups
    .filter((group) => group.enabled || includeDraft)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function renderArticleCard(article: Article) {
  return `<article class="card">
    <div class="card-meta">${escapeHtml(articleCategoryLabels[article.category])} ${draftBadge(article.status !== 'published')}</div>
    <h3><a href="/articles/${escapeAttribute(article.slug)}/">${escapeHtml(article.title)}</a></h3>
    <p>${escapeHtml(article.summary)}</p>
  </article>`;
}

function renderCaseCard(caseItem: CaseStudy) {
  return `<article class="card">
    <div class="card-meta">${escapeHtml(caseItem.clientType)} / ${escapeHtml(caseItem.eventType)} ${draftBadge(caseItem.status !== 'published')}</div>
    <h3><a href="/cases/${escapeAttribute(caseItem.slug)}/">${escapeHtml(caseItem.title)}</a></h3>
    <p>${escapeHtml(caseItem.summary)}</p>
    <p class="muted">${escapeHtml(caseItem.location || '地点待确认')}</p>
  </article>`;
}

function renderSceneCard(scene: SolutionScene) {
  return `<article class="card">
    <div class="card-meta">${scene.groups.length} 个案例组</div>
    <h3><a href="/solutions/${escapeAttribute(scene.slug)}/">${escapeHtml(scene.name)}</a></h3>
    <p>${escapeHtml(scene.description)}</p>
  </article>`;
}

function renderHome(
  homeVideo: HomeVideoConfig,
  slots: HomeInteractiveImageSlot[],
  articles: Article[],
  cases: CaseStudy[],
  scenes: SolutionScene[],
): StaticPage {
  const filledSlots = slots.filter((slot) => slot.enabled && slot.mediaUrl);
  const latestArticles = visibleArticles(articles).slice(0, 6);
  const latestCases = visibleCases(cases).slice(0, 4);
  return {
    path: '/',
    title: 'NEED，认真对待客户的每一次 need',
    description: defaultDescription,
    jsonLd: [organizationJsonLd()],
    body: `
      <section class="hero">
        <p class="eyebrow">NEED PR AGENCY</p>
        <h1>NEED，认真对待客户的每一次 need。</h1>
        <p>把不同的需求，做成有创意、有分寸、也有结果的现场。</p>
        ${homeVideo.enabled && homeVideo.videoUrl ? `<video class="hero-video" src="${escapeAttribute(homeVideo.videoUrl)}" ${homeVideo.posterUrl ? `poster="${escapeAttribute(homeVideo.posterUrl)}"` : ''} controls playsinline></video>` : ''}
      </section>
      <section class="section">
        <h2>服务场景</h2>
        <div class="grid">${scenes.filter((scene) => scene.enabled).map(renderSceneCard).join('')}</div>
      </section>
      ${filledSlots.length ? `<section class="section"><h2>创意案例现场</h2><div class="media-grid">${filledSlots.map((slot) => `<img src="${escapeAttribute(slot.mediaUrl)}" alt="${escapeAttribute(slot.alt || `NEED 首页案例图 ${slot.slotNo}`)}">`).join('')}</div></section>` : '<!-- 首页 12 图当前为空，静态 V1 不显示该区域。 -->'}
      <section class="section">
        <h2>最新文章</h2>
        <div class="grid">${latestArticles.length ? latestArticles.map(renderArticleCard).join('') : '<p class="muted">暂无已发布文章。</p>'}</div>
      </section>
      <section class="section">
        <h2>案例解析</h2>
        <div class="grid">${latestCases.length ? latestCases.map(renderCaseCard).join('') : '<p class="muted">暂无已发布案例。</p>'}</div>
      </section>
    `,
  };
}

function renderArticlesIndex(articles: Article[]): StaticPage {
  const items = visibleArticles(articles);
  const categoryOrder: Article['category'][] = ['how_to_choose', 'method_judgment', 'choose_between_two'];
  return {
    path: '/articles/',
    title: '文章与方法',
    description: 'NEED 关于活动公司选择、二选一判断、活动策划与执行方法的文章。',
    body: `
      <section class="page-title"><p class="breadcrumb"><a href="/">首页</a> / 文章</p><h1>文章与方法</h1><p>把活动策划与执行中的判断，拆成可阅读、可讨论、可校对的内容。</p></section>
      ${categoryOrder.map((category) => {
        const categoryArticles = items.filter((article) => article.category === category).sort((a, b) => a.sortOrder - b.sortOrder);
        return `<section class="section"><h2>${escapeHtml(articleCategoryLabels[category])}</h2><div class="grid">${categoryArticles.length ? categoryArticles.map(renderArticleCard).join('') : '<p class="muted">暂无已发布文章。</p>'}</div></section>`;
      }).join('')}
    `,
  };
}

function renderArticleDetail(article: Article): StaticPage {
  const faqLd = faqJsonLd(article.faqItems);
  return {
    path: `/articles/${article.slug}/`,
    title: article.seoTitle || article.title,
    description: article.seoDescription || article.summary,
    type: 'article',
    updatedAt: article.updatedAt,
    jsonLd: [
      breadcrumbJsonLd([
        { name: '首页', path: '/' },
        { name: '文章', path: '/articles/' },
        { name: article.title, path: `/articles/${article.slug}/` },
      ]),
      articleJsonLd(article),
      ...(faqLd ? [faqLd] : []),
    ],
    includeInSitemap: article.status === 'published',
    body: `
      <article class="article-detail">
        <p class="breadcrumb"><a href="/">首页</a> / <a href="/articles/">文章</a> / ${escapeHtml(article.title)}</p>
        ${draftBadge(article.status !== 'published')}
        ${isPlaceholder(article.content) ? '<div class="notice">该文章仍需补充正式正文。</div>' : ''}
        <h1>${escapeHtml(article.title)}</h1>
        <p class="lead">${escapeHtml(article.summary)}</p>
        <div class="prose">${paragraphize(article.content)}</div>
        ${renderFaq(article.faqItems)}
      </article>
    `,
  };
}

function renderCasesIndex(cases: CaseStudy[]): StaticPage {
  const items = visibleCases(cases);
  return {
    path: '/cases/',
    title: '案例解析',
    description: 'NEED 活动策划与执行案例解析，记录项目背景、现场组织、执行判断和结果。',
    body: `
      <section class="page-title"><p class="breadcrumb"><a href="/">首页</a> / 案例</p><h1>案例解析</h1><p>从真实项目里看需求、判断、执行和结果。</p></section>
      <section class="section"><div class="grid">${items.length ? items.map(renderCaseCard).join('') : '<p class="muted">暂无已发布案例。</p>'}</div></section>
    `,
  };
}

function renderCaseDetail(caseItem: CaseStudy): StaticPage {
  const faqLd = faqJsonLd(caseItem.faqItems);
  return {
    path: `/cases/${caseItem.slug}/`,
    title: caseItem.seoTitle || caseItem.title,
    description: caseItem.seoDescription || caseItem.summary,
    type: 'article',
    updatedAt: caseItem.updatedAt,
    includeInSitemap: caseItem.status === 'published',
    jsonLd: [
      breadcrumbJsonLd([
        { name: '首页', path: '/' },
        { name: '案例', path: '/cases/' },
        { name: caseItem.title, path: `/cases/${caseItem.slug}/` },
      ]),
      {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: caseItem.title,
        description: caseItem.seoDescription || caseItem.summary,
        dateModified: caseItem.updatedAt,
        creator: { '@type': 'Organization', name: siteName },
      },
      ...(faqLd ? [faqLd] : []),
    ],
    body: `
      <article class="article-detail">
        <p class="breadcrumb"><a href="/">首页</a> / <a href="/cases/">案例</a> / ${escapeHtml(caseItem.title)}</p>
        ${draftBadge(caseItem.status !== 'published')}
        <h1>${escapeHtml(caseItem.title)}</h1>
        <p class="lead">${escapeHtml(caseItem.summary)}</p>
        ${caseItem.coverUrl ? `<img class="cover" src="${escapeAttribute(caseItem.coverUrl)}" alt="${escapeAttribute(caseItem.coverDisplayName || caseItem.title)}">` : includeDraft ? '<div class="notice">该案例暂缺封面图。</div>' : ''}
        <dl class="facts">
          <div><dt>客户类型</dt><dd>${escapeHtml(caseItem.clientType || '待确认')}</dd></div>
          <div><dt>活动类型</dt><dd>${escapeHtml(caseItem.eventType || '待确认')}</dd></div>
          <div><dt>时间</dt><dd>${escapeHtml(caseItem.eventDate || '待确认')}</dd></div>
          <div><dt>地点</dt><dd>${escapeHtml(caseItem.location || '待确认')}</dd></div>
        </dl>
        <div class="prose">${renderContentHtml(caseItem.contentHtml, caseItem.contentText)}</div>
        ${caseItem.extractedImages.length ? `<section class="section"><h2>现场图片</h2><div class="media-grid">${caseItem.extractedImages.map((image) => `<img src="${escapeAttribute(image.url)}" alt="${escapeAttribute(image.alt || image.displayName || caseItem.title)}">`).join('')}</div></section>` : includeDraft ? '<div class="notice">该案例暂缺现场图片。</div>' : ''}
        ${renderFaq(caseItem.faqItems)}
      </article>
    `,
  };
}

function renderSolutionsIndex(scenes: SolutionScene[]): StaticPage {
  return {
    path: '/solutions/',
    title: '场景解决方案',
    description: 'NEED 围绕企业家庭日、客户答谢、年会活动、商业美陈、视频与数字资产、学术论坛等场景提供活动策划与执行。',
    body: `
      <section class="page-title"><p class="breadcrumb"><a href="/">首页</a> / 场景解决方案</p><h1>场景解决方案</h1><p>不同业务场景，需要不同的活动判断和落地方式。</p></section>
      <section class="section"><div class="grid">${scenes.filter((scene) => scene.enabled).map(renderSceneCard).join('')}</div></section>
    `,
  };
}

function renderSceneDetail(scene: SolutionScene): StaticPage {
  const groups = visibleGroups(scene);
  return {
    path: `/solutions/${scene.slug}/`,
    title: scene.name,
    description: scene.description || defaultDescription,
    includeInSitemap: scene.enabled,
    jsonLd: [breadcrumbJsonLd([
      { name: '首页', path: '/' },
      { name: '场景解决方案', path: '/solutions/' },
      { name: scene.name, path: `/solutions/${scene.slug}/` },
    ])],
    body: `
      <section class="page-title">
        <p class="breadcrumb"><a href="/">首页</a> / <a href="/solutions/">场景解决方案</a> / ${escapeHtml(scene.name)}</p>
        <h1>${escapeHtml(scene.name)}</h1>
        <p>${escapeHtml(scene.description)}</p>
      </section>
      <section class="section">
        <h2>案例组</h2>
        <div class="grid">${groups.length ? groups.map((group) => `<article class="card">
          <div class="card-meta">${group.items.length} 个素材 ${draftBadge(!group.enabled, '未启用预览')}</div>
          <h3><a href="/solutions/${escapeAttribute(scene.slug)}/${escapeAttribute(group.slug)}/">${escapeHtml(group.title)}</a></h3>
          <p>${escapeHtml(group.summary)}</p>
        </article>`).join('') : '<p class="muted">暂无可展示案例组。</p>'}</div>
      </section>
    `,
  };
}

function renderGroupDetail(scene: SolutionScene, group: SolutionGroup): StaticPage {
  return {
    path: `/solutions/${scene.slug}/${group.slug}/`,
    title: group.title,
    description: group.summary || scene.description,
    includeInSitemap: scene.enabled && group.enabled,
    jsonLd: [breadcrumbJsonLd([
      { name: '首页', path: '/' },
      { name: '场景解决方案', path: '/solutions/' },
      { name: scene.name, path: `/solutions/${scene.slug}/` },
      { name: group.title, path: `/solutions/${scene.slug}/${group.slug}/` },
    ])],
    body: `
      <section class="page-title">
        <p class="breadcrumb"><a href="/">首页</a> / <a href="/solutions/">场景解决方案</a> / <a href="/solutions/${escapeAttribute(scene.slug)}/">${escapeHtml(scene.name)}</a> / ${escapeHtml(group.title)}</p>
        ${draftBadge(!group.enabled, '未启用预览')}
        <h1>${escapeHtml(group.title)}</h1>
        <p>${escapeHtml(group.summary)}</p>
      </section>
      <section class="section">
        <h2>素材</h2>
        ${group.items.length ? `<div class="media-grid">${group.items.sort((a, b) => a.sortOrder - b.sortOrder).map((item) => (
          item.fileType === 'video'
            ? `<video src="${escapeAttribute(item.mediaUrl)}" controls preload="metadata"></video>`
            : `<figure><img src="${escapeAttribute(item.mediaUrl)}" alt="${escapeAttribute(item.alt || item.mediaDisplayName || group.title)}"><figcaption>${escapeHtml(item.caption || item.mediaDisplayName)}</figcaption></figure>`
        )).join('')}</div>` : includeDraft ? '<div class="notice">该案例组暂无素材。</div>' : '<p class="muted">暂无素材。</p>'}
      </section>
    `,
  };
}

function renderContact(seedItems: PublicMediaSeed[]): StaticPage {
  const qrcodes = seedItems.filter((item) => item.category === 'qrcode' && item.url);
  return {
    path: '/contact/',
    title: '联系 NEED',
    description: '有企业活动、品牌活动、空间表达、家庭日、年会、客户答谢等需求，可以先聊清楚目标、预算和执行边界。',
    body: `
      <section class="page-title"><p class="breadcrumb"><a href="/">首页</a> / 联系 NEED</p><h1>联系 NEED</h1><p>有企业活动、品牌活动、空间表达、家庭日、年会、客户答谢等需求，可以先聊清楚目标、预算和执行边界。</p></section>
      <section class="section">
        <div class="grid">${qrcodes.length ? qrcodes.map((item) => `<article class="card"><img class="qr" src="${escapeAttribute(item.url)}" alt="${escapeAttribute(item.alt || item.displayName || 'NEED 联系二维码')}"><h3>${escapeHtml(item.displayName || '联系二维码')}</h3></article>`).join('') : '<p class="muted">联系方式待后台配置。</p>'}</div>
      </section>
    `,
  };
}

function renderNotFound(): StaticPage {
  return {
    path: '/404.html',
    title: '页面未找到',
    description: '页面未找到，请返回 NEED 官网首页。',
    includeInSitemap: false,
    body: '<section class="page-title"><h1>页面未找到</h1><p>这个页面暂时不存在，建议返回首页继续浏览。</p><a class="button" href="/">返回首页</a></section>',
  };
}

function staticCss() {
  return `:root{font-family:Inter,"Noto Sans SC","Microsoft YaHei",sans-serif;color:#111;background:#f5f5f4}*{box-sizing:border-box}body{margin:0}.site-header{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;gap:24px;align-items:center;padding:18px 5vw;background:rgba(255,255,255,.92);border-bottom:1px solid #e7e5e4;backdrop-filter:blur(12px)}.brand{font-weight:900;font-size:24px;letter-spacing:.12em;color:#111;text-decoration:none}nav{display:flex;gap:16px;flex-wrap:wrap}a{color:#111}.site-header a{text-decoration:none;font-weight:800}.hero,.page-title,.section,.article-detail{width:min(1120px,90vw);margin:0 auto}.hero{padding:86px 0 56px}.eyebrow,.card-meta,.breadcrumb{color:#6b7280;font-size:13px;font-weight:900;letter-spacing:.08em}.hero h1,.page-title h1,.article-detail h1{font-size:clamp(38px,7vw,82px);line-height:.98;margin:12px 0}.hero p,.page-title p,.lead{font-size:20px;line-height:1.7;color:#52525b;max-width:760px}.hero-video,.cover{width:100%;max-height:560px;object-fit:cover;border-radius:18px;margin-top:28px;background:#111}.section{padding:44px 0}.section h2{font-size:32px;margin:0 0 18px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.card{background:#fff;border:1px solid #e7e5e4;border-radius:14px;padding:22px;box-shadow:0 16px 50px rgba(15,23,42,.05)}.card h3{font-size:22px;margin:10px 0}.card p{color:#52525b;line-height:1.65}.badge,.notice{display:inline-flex;border-radius:999px;background:#111;color:#fff;padding:6px 10px;font-size:12px;font-weight:900}.notice{display:block;border-radius:12px;background:#fff7ed;color:#9a3412;margin:18px 0;padding:14px}.muted{color:#71717a}.media-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.media-grid img,.media-grid video,.media-grid figure{width:100%;margin:0;border-radius:14px;background:#fff}.media-grid img,.media-grid video{aspect-ratio:4/3;object-fit:cover}.media-grid figcaption{padding:8px 2px;color:#52525b}.article-detail{padding:48px 0}.prose{font-size:18px;line-height:1.85}.prose h2{margin-top:36px}.prose p{color:#292524}.facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:24px 0}.facts div{background:#fff;border:1px solid #e7e5e4;border-radius:12px;padding:14px}.facts dt{font-size:12px;color:#71717a;font-weight:900}.facts dd{margin:8px 0 0;font-weight:800}.qr{width:180px;max-width:100%;border-radius:12px}.site-footer{margin-top:60px;padding:42px 5vw;background:#111;color:#fff}.site-footer a{color:#ccff00}.cta h2{font-size:34px;margin:8px 0 18px}.button{display:inline-flex;padding:12px 18px;border-radius:999px;background:#111;color:#fff;text-decoration:none;font-weight:900}@media(max-width:820px){.site-header{align-items:flex-start;flex-direction:column}.grid,.media-grid,.facts{grid-template-columns:1fr}.hero,.page-title,.section,.article-detail{width:min(92vw,1120px)}}`;
}

function renderSitemap(pages: StaticPage[]) {
  const urls = pages
    .filter((page) => page.includeInSitemap !== false)
    .map((page) => `  <url>
    <loc>${escapeHtml(canonicalUrl(page.path))}</loc>
    ${page.updatedAt ? `<lastmod>${escapeHtml(new Date(page.updatedAt).toISOString())}</lastmod>` : ''}
  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

function renderRobots() {
  return `User-agent: *
Allow: /
Sitemap: ${siteBaseUrl}/sitemap.xml
`;
}

async function main() {
  const [homeVideo, slots, articles, cases, scenes, seedItems] = await Promise.all([
    readJson<HomeVideoConfig>('home-video.json', {
      videoUrl: '',
      videoFileName: '',
      videoDisplayName: '',
      posterUrl: '',
      posterFileName: '',
      posterDisplayName: '',
      title: '',
      description: '',
      enabled: false,
      updatedAt: '',
    }),
    readJson<HomeInteractiveImageSlot[]>('home-interactive-images.json', []),
    readJson<Article[]>('articles.json', []),
    readJson<CaseStudy[]>('cases.json', []),
    readJson<SolutionScene[]>('solutions.json', []),
    readSeedJson<PublicMediaSeed[]>('public-home-media.seed.json', []),
  ]);

  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(path.join(outputDir, 'assets'), { recursive: true });
  await fs.writeFile(path.join(outputDir, 'assets', 'static.css'), staticCss(), 'utf8');

  const pages: StaticPage[] = [
    renderHome(homeVideo, slots, articles, cases, scenes),
    renderArticlesIndex(articles),
    ...visibleArticles(articles).map(renderArticleDetail),
    renderCasesIndex(cases),
    ...visibleCases(cases).map(renderCaseDetail),
    renderSolutionsIndex(scenes),
    ...scenes.filter((scene) => scene.enabled).map(renderSceneDetail),
    ...scenes.flatMap((scene) => visibleGroups(scene).map((group) => renderGroupDetail(scene, group))),
    renderContact(seedItems),
    renderNotFound(),
  ];

  await Promise.all(pages.map(writePage));
  await fs.writeFile(path.join(outputDir, 'sitemap.xml'), renderSitemap([
    renderHome(homeVideo, slots, articles, cases, scenes),
    renderArticlesIndex(articles),
    ...sitemapArticles(articles).map(renderArticleDetail),
    renderCasesIndex(cases),
    ...sitemapCases(cases).map(renderCaseDetail),
    renderSolutionsIndex(scenes),
    ...scenes.filter((scene) => scene.enabled).map(renderSceneDetail),
    ...scenes.flatMap((scene) => scene.enabled ? scene.groups.filter((group) => group.enabled).map((group) => renderGroupDetail(scene, group)) : []),
    renderContact(seedItems),
  ]), 'utf8');
  await fs.writeFile(path.join(outputDir, 'robots.txt'), renderRobots(), 'utf8');

  console.log(`Static site generated: ${outputDir}`);
  console.log(`Pages written: ${pages.length}`);
  console.log(`Include draft preview: ${includeDraft ? 'yes' : 'no'}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
