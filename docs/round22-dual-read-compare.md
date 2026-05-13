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
npm.cmd run compare:content -- --module articles
npm.cmd run compare:content -- --module media-library
npm.cmd run compare:content -- --module cases
npm.cmd run compare:content -- --module solutions
npm.cmd run compare:content -- --module publish-logs
npm.cmd run compare:content -- --module all --detail
npm.cmd run compare:content -- --module contact-info --detail
npm.cmd run compare:content -- --module articles --detail
npm.cmd run compare:content -- --module media-library --detail
npm.cmd run compare:content -- --module cases --detail
npm.cmd run compare:content -- --module solutions --detail
npm.cmd run compare:content -- --module publish-logs --detail
npm.cmd run compare:content -- --module all --format json
```

`--detail` is accepted for compatibility. Detail checks are enabled in the JSON report by default for the modules covered by 22-4B and 22-4C.

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

## 22-4C Core Detail Scope

22-4C enhances core module detail comparison:

- `articles`
- `media-library`
- `cases`
- `solutions`
- `publish-logs`

The compare tool is still read-only in 22-4C. JSON remains the official website data source, and MySQL remains only a shadow comparison database. The tool still does not switch services, does not make the website read MySQL, and does not affect API output, frontend UI, admin UI, prerender, sitemap, or publish-log generation.

Core module detail behavior:

- `articles`: compares `source_id`, `slug`, `title`, summary/excerpt/description mapping, `category_slug`, status semantics, `sort_order`, `published_at`, article categories, SEO, and FAQ rows.
- `media-library`: compares source media records to matching `media_files` rows by stable key priority: `public_url/url`, then `file_path`, then `file_name + file_size`. It checks URL/path, file names, display metadata, MIME/ext/size, category, alt text, description, status, and `metadata_json.sourceRecord` core field preservation.
- `cases`: compares case identity and fields, cover metadata, `raw_json`, SEO/FAQ, and `case_images` by case plus `image_url` plus `sort_order`. Related `media_files` rows are checked by URL/path when present.
- `solutions`: compares scene-solution records as scene solutions, not ordinary article pages. It checks `solutions`, `solution_groups`, `solution_media_items`, related media URL/path, SEO/FAQ, and `raw_json`.
- `publish-logs`: compares current `server/data/publish-logs/*.json` files to the MySQL `publish_logs` shadow index, including publish version, status, routes, failed routes, source stats, time fields, and `raw_log_json` core field preservation.

`media_files` is a shared table for `media-library`, `cases`, `solutions`, home modules, and company assets. Extra MySQL media rows that belong to other modules are reported as informational/warning context and do not directly make `media-library` fail. A `media-library` source record missing from `media_files` is still reported as `missing_in_mysql`, and a matching row with different core fields is still reported as `field_mismatch`.

`publish_logs` is a shadow index only. Existing JSON publish logs remain the primary publish-log chain. If `build:prerender` creates a new JSON publish log after MySQL was last indexed, `compare:content -- --module publish-logs` may report `missing_in_mysql` for the new `publish_version`; that is a valid finding, not a tool failure.

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
- `detailStatus` for detail modules
- `stableKeyChecks`
- `fieldChecks`
- `warnings`
- `errors`

`fieldChecks` entries include:

- `fieldName`
- `stableKey` when available
- `jsonValue`
- `mysqlValue`
- `status`
- `message`

`detailStatus` values are:

- `matched`
- `field_mismatch`
- `warning`
- `skipped_empty_source`
- `failed`

## Deferred to 22-4D

22-4D remains a final compare-stage acceptance pass. It should focus on running the full command matrix against the current shadow database, reviewing report output, and confirming that no service switch, no MySQL runtime read path, no JSON mutation, no migration snapshot, no upload changes, and no prerender/sitemap/publish-log logic changes were introduced.

Any decision to change read services, make MySQL authoritative, alter route manifests, or change prerender/sitemap behavior is outside 22-4 and must not be done here.
