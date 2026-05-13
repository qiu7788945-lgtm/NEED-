# Round 22 Service Switch

This document tracks the Round 22-5 service switch phase after the JSON-to-MySQL shadow migration and dual-read compare work.

Round 22-5 is a staged runtime-read switch. It is not a full-site MySQL cutover. JSON fallback stays in place, and JSON remains the safe recovery path for the website while each module is switched and validated separately.

## 22-5A Scope

22-5A only introduces MySQL-first reads for low-risk modules:

- `pages`
- `contact-info`
- `home-video`
- `home-interactive-images`
- `company-assets`

The following modules are not switched in 22-5A and must continue using the existing JSON/runtime paths:

- `articles`
- `media-library`
- `cases`
- `solutions`
- `scenario-detail-pages`
- `publish-logs`

22-5A does not change frontend UI, admin UI, API response shape, route manifest generation, sitemap generation, prerender scripts, publish log generation, or any write-side migration logic.

## Runtime Source Strategy

The low-risk runtime source is MySQL-first with JSON fallback:

- If MySQL is configured and a low-risk module query returns usable data, the service maps MySQL rows back to the existing JSON/API shape.
- If MySQL is not configured, the service reads the existing JSON file.
- If MySQL connection or query fails, the service logs a low-frequency warning and reads the existing JSON file.
- If MySQL returns an empty or unusable result for `contact-info`, `company-assets`, `home-video`, or `home-interactive-images`, the service falls back to JSON so content does not disappear.
- `pages` remains guarded in 22-5A because the accepted source is empty. The service checks MySQL safely, but JSON fallback remains the exposed behavior to avoid adding pages to APIs, route manifests, or sitemaps.

The fallback path is read-only. It does not write MySQL, rewrite JSON, generate migration snapshots, or repair data automatically.

## API Shape

MySQL rows are mapped back to the existing API structures:

- `contact-info`: keeps `companyName`, `brandName`, `address`, `email`, `phone`, and `socials`.
- `company-assets`: keeps `id`, `title`, `summary`, `description`, `location`, `imageUrl`, `imageAlt`, `sortOrder`, and `enabled`.
- `home-video`: keeps `videoUrl`, `videoFileName`, `videoDisplayName`, `posterUrl`, `posterFileName`, `posterDisplayName`, `title`, `description`, `enabled`, and `updatedAt`.
- `home-interactive-images`: keeps 12 slots with `slotNo`, `mediaUrl`, `mediaFileName`, `alt`, `sortOrder`, and `enabled`.
- `pages`: keeps the existing pages API behavior and does not expose unexpected MySQL rows during 22-5A.

Frontend and admin code do not need MySQL column names such as `is_enabled`, `sort_order`, `media_url`, `video_url`, or `image_url`.

## Guardrails

22-5A keeps these ownership boundaries:

- JSON fallback remains available for every switched low-risk module.
- MySQL failure must not break the website, dev server, prerender, sitemap checks, or publish logs.
- Route manifest, sitemap, and publish log generation continue to use their established paths.
- Articles, cases, solutions, scenario detail pages, media library, and publish logs are not switched.
- The website is not promoted to a MySQL-primary data source in 22-5A.

## Suggested Validation

Run these checks before considering 22-5A complete:

```powershell
git status --short -uall
git diff --stat
git diff --name-only

npm.cmd run lint
npm.cmd run typecheck:server

npm.cmd run db:health
npm.cmd run compare:content -- --module contact-info
npm.cmd run compare:content -- --module company-assets
npm.cmd run compare:content -- --module home-video
npm.cmd run compare:content -- --module home-interactive-images
npm.cmd run compare:content -- --module pages

npm.cmd run build:prerender
```

Also validate `build:prerender` in an environment without `MYSQL_*` variables. It should continue to succeed through JSON fallback.

## Next Phase

22-5B should only start after the 22-5A modules pass their individual checks with MySQL configured and with MySQL unavailable. 22-5B may consider `articles`, but it should still be a single-module switch with its own compare, runtime, fallback, prerender, and API-shape validation. It should not switch the full site at once.

## 22-5B Articles

22-5B only switches the `articles` read chain. It does not switch cases, solutions, scenario detail pages, media-library service, publish logs, route manifest generation, sitemap generation, prerender scripts, frontend UI, or admin UI.

Articles now use MySQL-first reads with JSON fallback:

- `articles` rows provide the primary article fields.
- `article_categories` is joined to keep category slugs compatible with the original `Article.category` values.
- `seo_settings` rows with `owner_type = 'article'` provide `seoTitle`, `seoDescription`, and `keywords`.
- `faq_items` rows with `owner_type = 'article'` provide `faqItems`; zero FAQ rows remains valid when the source has no FAQ.
- If MySQL is not configured, the service reads `server/data/articles.json`.
- If MySQL connection, query, count, category, status, content, or SEO structure is unusable, the service logs one warning and falls back to JSON.
- If MySQL returns no article rows, the service falls back to JSON so article pages do not disappear.

The API response shape remains the existing article shape: `id`, `title`, `slug`, `category`, `summary`, `content`, `sortOrder`, `status`, `seoTitle`, `seoDescription`, `keywords`, `faqItems`, `createdAt`, and `updatedAt`. MySQL column names such as `source_id`, `category_slug`, and `sort_order` are mapped back before the API responds.

Article writes still use the JSON maintenance path in 22-5B. This keeps the existing admin maintenance entry and avoids introducing MySQL write behavior in this read-switch step.

Route manifest, sitemap, and publish log behavior remains on the established chain. Unpublished articles must continue to be skipped by the existing route manifest / prerender logic, and published article route counts should remain consistent with the current JSON source. 22-5B is not a full-site MySQL primary-source closeout.

The next step, 22-5C, may only consider media-library or another single module after 22-5B is validated with MySQL available and unavailable. It must have its own single-module acceptance pass and must not switch the whole site at once.
