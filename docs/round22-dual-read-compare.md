# Round 22 Dual-Read Compare

This document describes the 22-4A compare tool.

22-4A is a compare tool only. It is not a service switch, not dual-read runtime behavior, and not a MySQL primary-source change. JSON remains the official data source for the website. MySQL is only a shadow database used for manual consistency checks.

## Commands

```powershell
npm.cmd run compare:content
npm.cmd run compare:content -- --module articles
npm.cmd run compare:content -- --module cases
npm.cmd run compare:content -- --module solutions
npm.cmd run compare:content -- --module publish-logs
npm.cmd run compare:content -- --module all --format json
```

The tool is manual-only. It does not run during server startup, prerender, sitemap generation, publishing, dev server startup, or build.

## MySQL Configuration

`compare:content` requires `MYSQL_HOST`, `MYSQL_DATABASE`, `MYSQL_USER`, and `MYSQL_PASSWORD`.

If MySQL is not configured, the tool exits with a clear JSON error and does not affect lint, typecheck, prerender, dev server, or the existing JSON runtime chain.

## Scope

22-4A compares module-level, record-count-level, and basic stable-key-level data:

- JSON source count versus MySQL table count
- JSON source hash from the migration source loader
- stable keys where available, such as article slugs, case slugs, solution slugs, media URLs, and publish versions
- empty-source handling for modules such as `pages` and `scenario-detail-pages`

The JSON report includes:

- `mode: compare`
- `generatedAt`
- `moduleFilter`
- `summary`
- per-module `jsonSource`
- per-module `mysqlTarget`
- `jsonCount`
- `mysqlCount`
- `status`
- `stableKeyChecks`
- `warnings`
- `errors`

## Supported Modules

The 22-4A registry covers:

- `pages`
- `contact-info`
- `company-assets`
- `home-video`
- `home-interactive-images`
- `articles`
- `media-library`
- `cases`
- `solutions`
- `scenario-detail-pages`
- `publish-logs`

`media_files` is a shared table. For `media-library`, count equality is informational in 22-4A and the report includes a shared-table warning. Source-level media ownership checks are deferred.

## Deferred Depth

These deeper checks are intentionally deferred to 22-4B / 22-4C:

- full field-by-field comparison
- HTML content comparison
- SEO and FAQ deep comparison
- media metadata details such as dimensions and duration
- publish log `raw_log_json` deep comparison
- route, sitemap, and prerender output comparison

## Boundaries

The compare tool must not change frontend UI, admin UI, business services, API output, JSON data, publish log JSON files, uploads, prerender scripts, sitemap scripts, route manifests, or publish log generation.

The compare tool does not write MySQL. It only reads MySQL rows that were already written by the Round 22-3 shadow migration.
