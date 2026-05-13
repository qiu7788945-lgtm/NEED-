# Round 22 Dual-Read Compare

This document describes the Round 22-4 manual compare tool.

22-4 is a compare-only phase. It is not a service switch, not runtime dual-read behavior, and not a MySQL primary-source change. JSON remains the official website data source. MySQL is only a shadow database used for manual consistency checks.

The compare tool is read-only. It does not write MySQL, JSON files, publish logs, uploads, migration snapshots, route manifests, sitemap output, prerender output, frontend UI, admin UI, API output, or business services.

The tool is manual-only. It does not run during server startup, dev server startup, lint, typecheck, prerender, sitemap generation, publishing, or build. A compare failure must not affect the website's existing JSON runtime chain.

## Commands

```powershell
npm.cmd run compare:content
npm.cmd run compare:content -- --module all
npm.cmd run compare:content -- --module pages
npm.cmd run compare:content -- --module contact-info
npm.cmd run compare:content -- --module company-assets
npm.cmd run compare:content -- --module home-video
npm.cmd run compare:content -- --module home-interactive-images
npm.cmd run compare:content -- --module all --detail
npm.cmd run compare:content -- --module contact-info --detail
npm.cmd run compare:content -- --module all --format json
```

`--detail` is accepted for 22-4B compatibility. Low-risk detail checks are enabled in the JSON report by default.

## MySQL Configuration

`compare:content` requires `MYSQL_HOST`, `MYSQL_DATABASE`, `MYSQL_USER`, and `MYSQL_PASSWORD`.

If MySQL is not configured, the tool exits with a clear JSON error that lists the missing variables. This failure is isolated to the manual compare command and does not affect lint, typecheck, prerender, dev server, build, or the JSON runtime path.

## 22-4A Baseline

22-4A compares module-level source counts and stable keys:

- JSON source count versus MySQL target row count
- JSON source hash from the migration source loader
- stable keys where available, such as slugs, source IDs, publish versions, asset keys, singleton keys, and home image slots
- empty-source handling for modules such as `pages` and `scenario-detail-pages`

## 22-4B Low-Risk Detail Scope

22-4B only enhances low-risk module detail comparison:

- `pages`
- `contact-info`
- `company-assets`
- `home-video`
- `home-interactive-images`

The report adds low-risk `detailStatus` and `fieldChecks` entries. These checks cover count context, stable key context, key fields, enabled/status semantics, sort order, media URLs, alt text, descriptions, missing-field warnings, and JSON payload preservation where the schema has JSON columns.

Module detail behavior:

- `pages`: `pages.json` is currently an empty source. Empty JSON plus empty MySQL is `skipped_empty_source`. Empty JSON plus MySQL rows is reported as `missing_in_json`.
- `contact-info`: compares singleton key, `content_json` structure, `is_enabled`, contact fields, address, email, phone, WeChat, and Xiaohongshu data.
- `company-assets`: compares `asset_key`, `media_url`, `alt_text`, `description`, `sort_order`, `is_enabled`, and `raw_json` core source fields. Extra metadata is allowed, but core source fields must not be lost.
- `home-video`: compares singleton key, `video_url`, `poster_url`, `title`, `description`, and `is_enabled`. Linked `media_files` rows are checked by URL/path and ownership metadata when present.
- `home-interactive-images`: compares `slot_number`, `image_url`, `alt_text`, `sort_order`, and `is_enabled`. Linked `media_files` rows are checked by URL/path and ownership metadata when present. Because `media_files` is shared, `metadata_json.moduleName` may be `home-interactive-images` or `media-library`. A `media-library` row is accepted when its metadata, or `metadata_json.sourceRecord`, keeps the matching slot plus home-interactive ownership markers such as `ownerType: home`, `groupKey: home-interactive`, or `category: home_interactive`.

`media_files` remains a shared table. 22-4B checks related media rows for `home-video` and `home-interactive-images` by association or URL, but it never uses the shared table's total count as a direct module failure condition.

## Report Shape

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
- `detailStatus` for low-risk detail modules
- `stableKeyChecks`
- `fieldChecks`
- `warnings`
- `errors`

Low-risk `fieldChecks` entries include:

- `fieldName`
- `stableKey` when available
- `jsonValue`
- `mysqlValue`
- `status`
- `message`

Low-risk `detailStatus` values are:

- `matched`
- `field_mismatch`
- `warning`
- `skipped_empty_source`
- `failed`

## Deferred to 22-4C

Deep comparison for these modules is intentionally deferred to 22-4C:

- `articles`
- `media-library`
- `cases`
- `solutions`
- `publish-logs`

Deferred checks include full article/case/solution field comparison, HTML content comparison, SEO and FAQ deep comparison, media-library metadata depth, publish log `raw_log_json` comparison, and any route, sitemap, or prerender output comparison.
