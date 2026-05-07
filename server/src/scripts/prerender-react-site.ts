import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { getStaticRouteManifest, type RouteManifestItem } from './prerender-route-manifest.js';

interface RouteConfig {
  path: string;
  outputFile: string;
  sourceType: string;
  canonicalPath: string;
  metadata: {
    title: string;
    description: string;
  };
  requiredChecks: Array<{
    label: string;
    test: (normalizedBodyText: string, normalizedHtml: string) => boolean;
  }>;
}

interface FailedRouteLog {
  path: string;
  errors: string[];
}

interface PublishLogContext {
  publishId: string;
  startedAt: string;
  finishedAt: string;
  status: 'success' | 'failed';
  triggeredBy: 'cli';
  totalRoutes: number;
  generatedRoutes: string[];
  failedRoutes: FailedRouteLog[];
  skippedRoutes: Array<{
    path?: string;
    sourceType: string;
    sourceId?: string;
    slug?: string;
    skipReason: string;
    errors?: string[];
  }>;
  sitemapPath: string;
  robotsPath: string;
  manifestPath: string;
  errors: string[];
  manifestSnapshot: object;
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const outputDir = path.join(projectRoot, 'dist-prerender');
const publishLogDir = path.join(projectRoot, 'server', 'data', 'publish-logs');
const baseUrl = process.env.PRERENDER_BASE_URL || 'http://localhost:3000';
const SITE_BASE_URL = process.env.SITE_BASE_URL || 'http://localhost:3000';
const manifest = getStaticRouteManifest(SITE_BASE_URL);
const expectedRouteCount = 17;
let publishLogContext: PublishLogContext | undefined;
const serviceChecks = [
  {
    url: 'http://localhost:4000',
    unavailableMessage: 'Backend API is not reachable at http://localhost:4000',
    runCommand: 'Please run: npm.cmd run dev:server',
  },
  {
    url: 'http://localhost:3000',
    unavailableMessage: 'Frontend Vite app is not reachable at http://localhost:3000',
    runCommand: 'Please run: npm.cmd run dev',
  },
];

function createRequiredCheck(label: string): RouteConfig['requiredChecks'][number] {
  return {
    label,
    test: (bodyText, html) => bodyText.includes(label) || html.includes(label),
  };
}

function toRouteConfig(route: RouteManifestItem): RouteConfig {
  return {
    path: route.path,
    outputFile: route.outputPath,
    sourceType: route.sourceType,
    canonicalPath: route.canonicalPath,
    metadata: {
      title: route.title,
      description: route.description,
    },
    requiredChecks: route.requiredChecks.map(createRequiredCheck),
  };
}

const routes = manifest.routes
  .filter((route) => route.shouldGenerate)
  .map(toRouteConfig);

function reportCheckFailure(message: string) {
  console.error(message);
  publishLogContext?.errors.push(message);
  process.exitCode = 1;
}

function formatPublishDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function createPublishLogContext(startedAtDate: Date): PublishLogContext {
  const publishId = `publish-${formatPublishDate(startedAtDate)}`;

  return {
    publishId,
    startedAt: startedAtDate.toISOString(),
    finishedAt: '',
    status: 'failed',
    triggeredBy: 'cli',
    totalRoutes: routes.length,
    generatedRoutes: [],
    failedRoutes: [],
    skippedRoutes: manifest.skippedRoutes.map((route) => ({
      path: route.path || undefined,
      sourceType: route.sourceType,
      sourceId: route.sourceId || undefined,
      slug: route.slug || undefined,
      skipReason: route.skipReason,
      errors: route.errors,
    })),
    sitemapPath: path.join(outputDir, 'sitemap.xml'),
    robotsPath: path.join(outputDir, 'robots.txt'),
    manifestPath: path.join(outputDir, 'route-manifest.json'),
    errors: [],
    manifestSnapshot: manifest,
  };
}

function addFailedRoute(pathName: string, errors: string[]) {
  if (publishLogContext) {
    publishLogContext.generatedRoutes = publishLogContext.generatedRoutes.filter((routePath) => routePath !== pathName);
  }

  const existingRoute = publishLogContext?.failedRoutes.find((route) => route.path === pathName);

  if (existingRoute) {
    existingRoute.errors.push(...errors);
    return;
  }

  publishLogContext?.failedRoutes.push({
    path: pathName,
    errors,
  });
}

async function writePublishLog() {
  if (!publishLogContext) {
    return;
  }

  publishLogContext.finishedAt = new Date().toISOString();
  publishLogContext.status = process.exitCode === 1 ? 'failed' : 'success';

  const publishLogFile = path.join(publishLogDir, `${publishLogContext.publishId}.json`);

  await fs.mkdir(publishLogDir, { recursive: true });
  await fs.writeFile(publishLogFile, JSON.stringify(publishLogContext, null, 2), 'utf8');

  console.log(`Publish log file: ${publishLogFile}`);
  console.log(`Publish status: ${publishLogContext.status}`);
}

function normalizeContent(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function htmlToText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
}

function routeUrl(routePath: string) {
  return new URL(routePath, `${baseUrl.replace(/\/+$/, '')}/`).toString();
}

function canonicalUrl(routePath: string) {
  return new URL(routePath, `${SITE_BASE_URL.replace(/\/+$/, '')}/`).toString();
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function upsertHeadTag(html: string, existingTagPattern: RegExp, replacementTag: string) {
  if (existingTagPattern.test(html)) {
    return html.replace(existingTagPattern, replacementTag);
  }

  return html.replace(/<\/head>/i, `${replacementTag}\n</head>`);
}

function applyRouteHead(html: string, route: RouteConfig) {
  const title = escapeHtml(route.metadata.title);
  const description = escapeHtml(route.metadata.description);
  const canonical = escapeHtml(canonicalUrl(route.path));

  let nextHtml = upsertHeadTag(html, /<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  nextHtml = upsertHeadTag(
    nextHtml,
    /<meta\b(?=[^>]*\bname=["']description["'])[^>]*>/i,
    `<meta name="description" content="${description}">`,
  );
  nextHtml = upsertHeadTag(
    nextHtml,
    /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i,
    `<link rel="canonical" href="${canonical}">`,
  );

  return nextHtml;
}

function getMissingHeadChecks(html: string, route: RouteConfig) {
  const escapedTitle = escapeHtml(route.metadata.title);
  const escapedDescription = escapeHtml(route.metadata.description);
  const escapedCanonical = escapeHtml(canonicalUrl(route.path));
  const missingChecks: string[] = [];

  if (!/<title\b[^>]*>[\s\S]*?<\/title>/i.test(html)) {
    missingChecks.push('title tag');
  }

  if (!html.includes(escapedTitle)) {
    missingChecks.push(`title: ${route.metadata.title}`);
  }

  if (!/<meta\b(?=[^>]*\bname=["']description["'])[^>]*>/i.test(html)) {
    missingChecks.push('meta description');
  }

  if (!html.includes(escapedDescription)) {
    missingChecks.push(`description: ${route.metadata.description}`);
  }

  if (!html.includes('rel="canonical"')) {
    missingChecks.push('rel="canonical"');
  }

  if (!html.includes(escapedCanonical)) {
    missingChecks.push(`canonical URL: ${canonicalUrl(route.path)}`);
  }

  return missingChecks;
}

function getMissingHtmlFileChecks(html: string, route: RouteConfig) {
  const normalizedBodyText = normalizeContent(htmlToText(html));
  const normalizedHtml = normalizeContent(html);
  const normalizedUpperBodyText = normalizedBodyText.toUpperCase();
  const normalizedUpperHtml = normalizedHtml.toUpperCase();

  return [
    ...(!/<html\b/i.test(html) ? ['<html> element'] : []),
    ...(!/<head\b/i.test(html) ? ['<head> element'] : []),
    ...(!/<body\b/i.test(html) ? ['<body> element'] : []),
    ...getMissingHeadChecks(html, route),
    ...route.requiredChecks
      .filter(
        (check) =>
          !check.test(normalizedBodyText, normalizedHtml) && !check.test(normalizedUpperBodyText, normalizedUpperHtml),
      )
      .map((check) => `required check: ${check.label}`),
  ];
}

function renderSitemap() {
  const urls = routes
    .map((route) => `  <url><loc>${escapeXml(canonicalUrl(route.path))}</loc></url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function renderRobots() {
  return `User-agent: *
Allow: /
Sitemap: ${canonicalUrl('/sitemap.xml')}
`;
}

function validateManifestCompleteness() {
  let hasFailedChecks = false;

  if (!Array.isArray(manifest.routes)) {
    reportCheckFailure('Route manifest check failed: manifest.routes must be an array.');
    return false;
  }

  if (!Array.isArray(manifest.skippedRoutes)) {
    reportCheckFailure('Route manifest check failed: manifest.skippedRoutes must be an array.');
    return false;
  }

  const shouldGenerateRoutes = manifest.routes.filter((route) => route.shouldGenerate);

  if (shouldGenerateRoutes.length !== routes.length) {
    hasFailedChecks = true;
    reportCheckFailure(
      `Route manifest check failed: shouldGenerate routes count mismatch. Expected ${shouldGenerateRoutes.length}, got ${routes.length}.`,
    );
  }

  for (const route of shouldGenerateRoutes) {
    const missingFields: string[] = [];

    if (!route.path) missingFields.push('path');
    if (!route.outputPath) missingFields.push('outputPath');
    if (!route.sourceType) missingFields.push('sourceType');
    if (!route.title) missingFields.push('title');
    if (!route.description) missingFields.push('description');
    if (!route.canonicalPath) missingFields.push('canonicalPath');
    if (!Array.isArray(route.requiredChecks)) {
      missingFields.push('requiredChecks array');
    } else if (route.requiredChecks.length === 0) {
      missingFields.push('requiredChecks non-empty array');
    }

    if (missingFields.length > 0) {
      hasFailedChecks = true;
      const message = `Route manifest check failed for ${route.path || '(missing path)'}. Missing: ${missingFields.join(', ')}`;
      reportCheckFailure(message);
      addFailedRoute(route.path || '(missing path)', [message]);
    }
  }

  return !hasFailedChecks;
}

function validateSkippedRoutes() {
  let hasFailedChecks = false;

  if (!Array.isArray(manifest.skippedRoutes)) {
    reportCheckFailure('Skipped route check failed: manifest.skippedRoutes must be an array.');
    return false;
  }

  for (const route of manifest.skippedRoutes) {
    const routeLabel = route.path || route.slug || route.sourceId || '(unknown skipped route)';
    const missingFields: string[] = [];

    if (route.shouldGenerate !== false) missingFields.push('shouldGenerate=false');
    if (!route.skipReason) missingFields.push('skipReason');
    if (!route.sourceType) missingFields.push('sourceType');
    if (!route.sourceId && !route.slug) missingFields.push('sourceId or slug');

    if (missingFields.length > 0) {
      hasFailedChecks = true;
      reportCheckFailure(`Skipped route check failed for ${routeLabel}. Missing/invalid: ${missingFields.join(', ')}`);
    }
  }

  return !hasFailedChecks;
}

async function writePrerenderIndexFiles() {
  const sitemapFile = path.join(outputDir, 'sitemap.xml');
  const robotsFile = path.join(outputDir, 'robots.txt');
  const routeManifestFile = path.join(outputDir, 'route-manifest.json');

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(routeManifestFile, JSON.stringify(manifest, null, 2), 'utf8');
  await fs.writeFile(sitemapFile, renderSitemap(), 'utf8');
  await fs.writeFile(robotsFile, renderRobots(), 'utf8');

  console.log(`Route manifest file: ${routeManifestFile}`);
  console.log(`Sitemap file: ${sitemapFile}`);
  console.log(`Robots file: ${robotsFile}`);

  return { sitemapFile, robotsFile, routeManifestFile };
}

async function getMissingIndexFileChecks(sitemapFile: string, robotsFile: string, routeManifestFile: string) {
  const missingChecks: string[] = [];
  let sitemap = '';
  let robots = '';
  let routeManifestJson = '';

  try {
    sitemap = await fs.readFile(sitemapFile, 'utf8');
  } catch {
    missingChecks.push(`sitemap.xml file: ${sitemapFile}`);
  }

  try {
    robots = await fs.readFile(robotsFile, 'utf8');
  } catch {
    missingChecks.push(`robots.txt file: ${robotsFile}`);
  }

  try {
    routeManifestJson = await fs.readFile(routeManifestFile, 'utf8');
  } catch {
    missingChecks.push(`route-manifest.json file: ${routeManifestFile}`);
  }

  if (sitemap) {
    for (const route of routes) {
      const url = canonicalUrl(route.path);

      if (!sitemap.includes(escapeXml(url))) {
        missingChecks.push(`sitemap URL: ${url}`);
      }
    }
  }

  if (robots && !robots.includes(`Sitemap: ${canonicalUrl('/sitemap.xml')}`)) {
    missingChecks.push(`robots Sitemap line: Sitemap: ${canonicalUrl('/sitemap.xml')}`);
  }

  if (routeManifestJson) {
    try {
      const routeManifest = JSON.parse(routeManifestJson) as Partial<{
        routes: unknown[];
        skippedRoutes: unknown[];
      }>;

      if (!Array.isArray(routeManifest.routes)) {
        missingChecks.push('route-manifest.json routes array');
      } else if (routeManifest.routes.length !== routes.length) {
        missingChecks.push(`route-manifest.json routes.length: expected ${routes.length}, got ${routeManifest.routes.length}`);
      }

      if (!Array.isArray(routeManifest.skippedRoutes)) {
        missingChecks.push('route-manifest.json skippedRoutes array');
      }
    } catch (error) {
      missingChecks.push(`route-manifest.json valid JSON: ${(error as Error).message}`);
    }
  }

  return missingChecks;
}

async function validateGeneratedHtmlFiles() {
  let checkedCount = 0;
  let hasFailedChecks = false;

  for (const route of routes) {
    const outputFile = path.join(outputDir, route.outputFile);

    if (!(await fileExists(outputFile))) {
      hasFailedChecks = true;
      const error = `Output file: ${outputFile}. Reason: file does not exist.`;
      addFailedRoute(route.path, [error]);
      reportCheckFailure(`HTML file check failed for ${route.path}. ${error}`);
      continue;
    }

    const html = await fs.readFile(outputFile, 'utf8');
    checkedCount += 1;

    if (html.length === 0) {
      hasFailedChecks = true;
      const error = `Output file: ${outputFile}. Reason: file is empty.`;
      addFailedRoute(route.path, [error]);
      reportCheckFailure(`HTML file check failed for ${route.path}. ${error}`);
      continue;
    }

    const missingChecks = getMissingHtmlFileChecks(html, route);

    if (missingChecks.length > 0) {
      hasFailedChecks = true;
      addFailedRoute(route.path, missingChecks);
      reportCheckFailure(
        `HTML file check failed for ${route.path}. Output file: ${outputFile}. Missing: ${missingChecks.join(', ')}`,
      );
    }
  }

  return {
    checkedCount,
    hasFailedChecks,
  };
}

async function validateSitemapFile(sitemapFile: string) {
  let checkedCount = 0;
  let hasFailedChecks = false;

  if (!(await fileExists(sitemapFile))) {
    reportCheckFailure(`Sitemap check failed: sitemap.xml file does not exist: ${sitemapFile}`);
    return {
      checkedCount,
      hasFailedChecks: true,
    };
  }

  const sitemap = await fs.readFile(sitemapFile, 'utf8');
  const generatedUrls = new Set(routes.map((route) => canonicalUrl(route.canonicalPath || route.path)));

  for (const route of routes) {
    checkedCount += 1;
    const url = canonicalUrl(route.canonicalPath || route.path);

    if (!sitemap.includes(escapeXml(url))) {
      hasFailedChecks = true;
      addFailedRoute(route.path, [`Missing sitemap URL: ${url}`]);
      reportCheckFailure(`Missing sitemap URL for ${route.path}: ${url}`);
    }
  }

  for (const skippedRoute of manifest.skippedRoutes) {
    const skippedPath = skippedRoute.canonicalPath || skippedRoute.path;

    if (!skippedPath) {
      continue;
    }

    const skippedUrl = canonicalUrl(skippedPath);

    if (generatedUrls.has(skippedUrl)) {
      continue;
    }

    if (sitemap.includes(escapeXml(skippedUrl))) {
      hasFailedChecks = true;
      reportCheckFailure(`Unexpected skipped sitemap URL for ${skippedRoute.path || skippedRoute.slug}: ${skippedUrl}`);
    }
  }

  return {
    checkedCount,
    hasFailedChecks,
  };
}

async function validateRobotsFile(robotsFile: string) {
  if (!(await fileExists(robotsFile))) {
    reportCheckFailure(`Robots check failed: robots.txt file does not exist: ${robotsFile}`);
    return true;
  }

  const robots = await fs.readFile(robotsFile, 'utf8');
  const expectedSitemapLine = `Sitemap: ${canonicalUrl('/sitemap.xml')}`;
  let hasFailedChecks = false;

  if (!robots.includes('Sitemap:')) {
    hasFailedChecks = true;
    reportCheckFailure('Robots check failed: missing Sitemap line.');
  }

  if (!robots.includes(expectedSitemapLine)) {
    hasFailedChecks = true;
    reportCheckFailure(`Robots check failed: missing expected Sitemap URL line: ${expectedSitemapLine}`);
  }

  return hasFailedChecks;
}

async function isServiceReachable(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    await response.body?.cancel();
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkRequiredServices() {
  const results = await Promise.all(
    serviceChecks.map(async (service) => ({
      service,
      isReachable: await isServiceReachable(service.url),
    })),
  );

  const unreachableServices = results.filter((result) => !result.isReachable);

  for (const { service } of unreachableServices) {
    reportCheckFailure(service.unavailableMessage);
    console.error(service.runCommand);
  }

  return unreachableServices.length === 0;
}

async function main() {
  publishLogContext = createPublishLogContext(new Date());

  console.log(`Manifest routes loaded: ${routes.length}`);
  console.log(`Manifest skipped routes: ${manifest.skippedRoutes.length}`);

  try {
    const isManifestComplete = validateManifestCompleteness();
    const areSkippedRoutesValid = validateSkippedRoutes();

    if (!isManifestComplete || !areSkippedRoutesValid) {
      return;
    }

    if (routes.length === 0) {
      reportCheckFailure('No routes with shouldGenerate=true found in route manifest.');
      return;
    }

    if (routes.length !== expectedRouteCount) {
      console.warn(`Warning: expected ${expectedRouteCount} manifest routes, but loaded ${routes.length}.`);
    }

    const canPrerender = await checkRequiredServices();

    if (!canPrerender) {
      process.exitCode = 1;
      return;
    }

    const browser = await chromium.launch();
    let hasFailedChecks = false;

    try {
      const page = await browser.newPage();

      for (const route of routes) {
        const targetUrl = routeUrl(route.path);
        const outputFile = path.join(outputDir, route.outputFile);

        try {
          await page.goto(targetUrl, { waitUntil: 'networkidle' });
          await page.waitForTimeout(2000);

          const html = applyRouteHead(await page.content(), route);
          const bodyText = await page.locator('body').innerText();

          await fs.mkdir(path.dirname(outputFile), { recursive: true });
          await fs.writeFile(outputFile, html, 'utf8');

          console.log(`Visited URL: ${targetUrl}`);
          console.log(`Output file: ${outputFile}`);
          console.log(`HTML characters: ${html.length}`);
          console.log(`Body text preview: ${normalizeContent(bodyText).slice(0, 300)}`);

          const normalizedBodyText = normalizeContent(bodyText);
          const normalizedHtml = normalizeContent(html);
          const missingTexts = [
            ...route.requiredChecks
              .filter((check) => !check.test(normalizedBodyText, normalizedHtml))
              .map((check) => check.label),
            ...getMissingHeadChecks(html, route),
          ];

          if (missingTexts.length > 0) {
            hasFailedChecks = true;
            addFailedRoute(route.path, missingTexts);
            console.error(`Content check failed for ${route.path}. Missing: ${missingTexts.join(', ')}`);
          } else {
            publishLogContext.generatedRoutes.push(route.path);
            console.log(`Content check passed for ${route.path}`);
          }
        } catch (error) {
          hasFailedChecks = true;
          const message = (error as Error).message;
          addFailedRoute(route.path, [message]);
          reportCheckFailure(`Prerender failed for ${route.path}. Output file: ${outputFile}. Error: ${message}`);
        }
      }

      const { sitemapFile, robotsFile, routeManifestFile } = await writePrerenderIndexFiles();
      publishLogContext.sitemapPath = sitemapFile;
      publishLogContext.robotsPath = robotsFile;
      publishLogContext.manifestPath = routeManifestFile;

      const missingIndexFileChecks = await getMissingIndexFileChecks(sitemapFile, robotsFile, routeManifestFile);
      const htmlFileCheckResult = await validateGeneratedHtmlFiles();
      const sitemapCheckResult = await validateSitemapFile(sitemapFile);
      const robotsHasFailedChecks = await validateRobotsFile(robotsFile);

      if (missingIndexFileChecks.length > 0) {
        hasFailedChecks = true;
        publishLogContext.errors.push(`Prerender index file check failed. Missing: ${missingIndexFileChecks.join(', ')}`);
        console.error(`Prerender index file check failed. Missing: ${missingIndexFileChecks.join(', ')}`);
      }

      if (htmlFileCheckResult.hasFailedChecks || sitemapCheckResult.hasFailedChecks || robotsHasFailedChecks) {
        hasFailedChecks = true;
      }

      console.log(`Generated HTML files checked: ${htmlFileCheckResult.checkedCount}`);
      console.log(`Sitemap URLs checked: ${sitemapCheckResult.checkedCount}`);
      console.log(`Skipped routes checked: ${manifest.skippedRoutes.length}`);

      if (hasFailedChecks) {
        process.exitCode = 1;
      } else {
        console.log('All prerender content checks passed');
      }
    } finally {
      await browser.close();
    }
  } finally {
    await writePublishLog();
  }
}

main().catch((error) => {
  const message = `Failed to prerender React routes: ${(error as Error).message}`;
  reportCheckFailure(message);
  console.error('Failed to prerender React routes:', error);
  process.exitCode = 1;
});
