# Round 22 Migration Skeleton

This document describes the Round 22 content migration skeleton through 22-3B-7.

The skeleton can read JSON sources, compute canonical SHA256 hashes, identify migration modules, print dry-run plans, check planned tables and fields against `server/src/db/migrations/001_initial_schema.sql`, create pre-write JSON snapshots, write selected shadow business tables, and write `migration_logs` records for every selected module.

It migrates only the low-risk modules opened in 22-3B-3, `articles` opened in 22-3B-5, `media-library` opened in 22-3B-6, and `cases` opened in 22-3B-7.
It does not migrate the remaining medium-risk or high-risk business data.
It does not switch any service to MySQL.

JSON remains the only primary data source in 22-3. MySQL remains a shadow database target for later steps.

## Commands

```powershell
npm.cmd run migrate:content:dry-run
npm.cmd run migrate:content
npm.cmd run migrate:content -- --module articles
npm.cmd run migrate:content -- --module media-library
npm.cmd run migrate:content -- --module cases
npm.cmd run migrate:content -- --module all --fail-fast
npm.cmd run migrate:content -- --write
```

`migrate:content` defaults to dry-run.

Dry-run reads JSON and prints the migration plan only. It does not create snapshots, write `migration_logs`, or write business tables. The plan includes `businessWritesEnabled` and `skippedReason` so reviewers can see which modules are writable and which remain plan-only.

`--write` is enabled only for the current Round 22 shadow writes. It:

1. Requires `MYSQL_HOST`, `MYSQL_DATABASE`, `MYSQL_USER`, and `MYSQL_PASSWORD`.
2. Checks the MySQL connection.
3. Checks schema compatibility.
4. Creates a unique JSON snapshot under `server/data-backups/mysql-migration/`.
5. Writes `source-manifest.json` into the snapshot directory.
6. Writes only the modules enabled through 22-3B-7.
7. Writes one `migration_logs` record per selected source module.
8. Leaves all unopened medium-risk and high-risk business tables untouched.

If MySQL is not configured, `--write` fails before creating a snapshot and before writing any database rows.

## Writable Modules

Only these modules can write business tables through 22-3B-7:

- `articles`
- `cases`
- `pages`
- `contact-info`
- `company-assets`
- `home-video`
- `home-interactive-images`
- `media-library`

The writable tables are limited to:

- `article_categories`
- `articles`
- `seo_settings`, for articles, cases, and opened page modules
- `faq_items`, for articles and cases when source FAQ exists
- `pages`
- `page_blocks`
- `contact_info`
- `company_assets`
- `home_video`
- `home_interactive_images`
- `media_files`, for media referenced by opened modules, cases, and the media-library shadow migration
- `cases`
- `case_images`
- `migration_logs`

`article_blocks` remains unused while `articles.json` stores article body as whole `content` without explicit block records.

These modules remain plan-only / not implemented in 22-3B-7:

- `solutions`
- `scenario-detail-pages`
- `publish-logs`

When `npm.cmd run migrate:content -- --write --module all` is used, only the eight writable modules are allowed to write business tables. The plan-only modules receive `migration_logs` records with `status = not_implemented` and `skippedReason = not_implemented_in_22_3B_7`.

## Repeat Runs

Low-risk writes use idempotent upsert keys:

- `articles`: `source_id` when present, otherwise `slug`
- `article_categories`: `slug`
- `seo_settings` for articles: `owner_type = article` plus `owner_id` or stable `owner_source_id`
- `faq_items` for articles: `owner_type = article`, stable `owner_source_id`, `sort_order`, and `question`
- `cases`: `source_id` when present, otherwise `slug`
- `case_images`: `case_id + image_url + sort_order`
- media files from cases: `public_url`, then `file_path`, then `file_name + file_size`
- `pages`: `source_id` when present, otherwise `slug`
- `contact-info`: `singleton_key = contact_info`
- `company-assets`: `asset_key`
- `home-video`: `singleton_key = home_video`
- `home-interactive-images`: `slot_number`
- media files from opened low-risk modules: `public_url`
- `media-library`: `public_url`, then `file_path`, then `file_name + file_size`

If a module has already recorded the same `source_hash` with a successful migration status, a later `--write` run skips that module and records `status = skipped_success_hash`. MySQL rows that do not exist in JSON are not hard-deleted in this stage.

## Snapshot Manifest

`source-manifest.json` records each top-level `server/data/*.json` file plus a `publish-logs/*.json` source group. Each entry includes:

- `batch_id`
- `created_at`
- `git_commit`
- `source_file`
- `relative_path`
- `source_hash`
- `raw_file_hash`
- `file_size`
- `record_count`
- `included_in_migration`
- `notes`

The snapshot copies top-level JSON files from `server/data/*.json`, writes `server/data/publish-logs/publish-logs-index.json`, and copies the latest publish log JSON files for inspection. Existing publish log generation is unchanged.

## Migration Logs

`--write` writes `migration_logs` after the selected business writes. Each selected source module receives one row using the existing schema fields:

- `migration_key`
- `batch_id`
- `source_file`
- `source_hash`
- `status`
- `source_count`
- `inserted_count`
- `updated_count`
- `skipped_count`
- `warning_count`
- `error_message`
- `details_json`
- `started_at`
- `finished_at`

`details_json` includes:

- `businessWritesEnabled`, true only for successfully written enabled modules
- `snapshotDir`
- `moduleName`
- `plannedWrites`
- `actualWrites`
- `warnings`
- `schemaCompatibility`
- `skippedReason`
- `moduleStats`, plus direct per-module counters where available

Rows are inserted with an upsert on the existing `(migration_key, source_hash)` unique key so repeated runs against unchanged sources update the skeleton log instead of failing on duplicates.

For `articles`, `details_json` records direct counters for `categoryCount`, `articleCount`, `seoCount`, `faqCount`, `articleBlockCount`, and `skippedArticleCount`. It also records skip reasons when the source has no FAQ items or no explicit block records.

For `media-library`, `details_json` records direct counters for `sourceCount`, `mediaFilesCount`, `missingPublicUrlCount`, `missingFilePathCount`, `missingStableKeyCount`, `missingWritablePathCount`, `duplicateCount`, `duplicateKeyCount`, `uniqueStableKeyCount`, `dedupeStrategy`, and per-table inserted / updated / skipped / duplicate counts.

For `cases`, `details_json` records direct counters for `sourceCount`, `caseCount`, `caseImagesCount`, `mediaFilesCount`, `seoCount`, `faqCount`, `skippedCaseCount`, `missingImageUrlCount`, `duplicateCount`, `dedupeStrategy`, and per-table inserted / updated / skipped / duplicate counts. It also records skip reasons when the source has no FAQ items or no SEO fields.

## 22-3B-5 Articles

22-3B-5 opens `articles` as the next shadow-write module. It writes `article_categories`, `articles`, article `seo_settings`, article `faq_items` when source FAQ exists, and `migration_logs`.

`articles.json` currently stores article body in a whole `content` field. Because it does not provide explicit block records, the migration does not split content into `article_blocks` in this step.

Article slugs are preserved exactly from JSON. Article categories are derived from source category slugs and upserted by `article_categories.slug`. Article rows are upserted by `source_id` when present and by `slug` as the stable fallback. Repeated runs with the same successful `source_hash` are skipped through `migration_logs`; changed sources update existing rows through the same upsert keys instead of inserting duplicates.

## 22-3B-6 Media Library

22-3B-6 opens `media-library` as a shadow-write module. It writes only `media_files` and `migration_logs`.

The media library source currently stores records as a keyed object in `media-library.json`. The top-level key is preserved as `sourceKey` in `metadata_json`. The migration keeps the storage `file_name`, original upload name, display name / title, source URL, category, alt text, description, dimensions, duration, status, and the raw source record in `metadata_json`.

Deduplication uses this priority:

1. `public_url`
2. `file_path`
3. `file_name + file_size`

When source `file_path` is missing but `public_url` exists, the migration records a warning and writes the normalized `public_url` as the shadow `file_path` fallback. When `public_url` is missing but `file_path` exists, it records a warning and uses `file_path` as the writable URL fallback because the current `media_files.public_url` column is required. If a record can only form `file_name + file_size`, it can update an existing matching row; a new row is skipped when no public URL or file path exists because the current schema cannot store a fresh media row without a non-null `public_url`.

Source duplicate stable keys are skipped within the same run and counted in `details_json`. Existing MySQL rows that match the stable key are updated rather than duplicated. No upload files are moved, deleted, or renamed.

## 22-3B-7 Cases

22-3B-7 opens `cases` as a shadow-write module. It writes `cases`, `case_images`, case-related `media_files`, case `seo_settings` when source SEO exists, case `faq_items` when source FAQ exists, and `migration_logs`.

Case slugs are preserved exactly from JSON. Case rows are upserted by `source_id` when present and by `slug` as the stable fallback. The migration keeps titles, summaries, client and event metadata, event date, location, cover fields, Word import file fields, whole `content_html`, whole `content_text`, status, sort order, home featured status, and the full source record in `raw_json`.

Case images are sourced from explicit image lists such as `extractedImages`. They are upserted by `case_id + image_url + sort_order`; empty image URLs are skipped with warnings and do not fail the case row. Related cover and image files are upserted into `media_files` using the same dedupe priority opened in 22-3B-6: `public_url`, then `file_path`, then `file_name + file_size`. No upload files are moved, deleted, or renamed.

## Boundaries

The skeleton must not change frontend UI, admin UI, business services, API output, JSON data, uploads, prerender scripts, sitemap scripts, route slugs, or existing publish log generation.

`publish-logs` remains JSON-primary in this step. The migration skeleton can index publish logs for snapshot and log metadata only; it must not make MySQL the primary publish log source.

## 22-3B-4 Snapshot Safety

`server/data-backups/mysql-migration/` is a local migration acceptance snapshot directory. It is ignored by Git and must not be committed.

These snapshots are only for local migration verification. They are not formal production backups, not deployment artifacts, and not part of the canonical content source. They may be cleaned after each acceptance pass once the operator no longer needs the local rollback/reference copy.

Formal production backup strategy is deferred to Round 24 deployment preparation.

## 22-3 Next Boundaries

Recommended order after 22-3B-7:

1. 22-3B-8: `solutions` + `scenario-detail-pages`
2. 22-3B-9: `publish-logs` shadow index + 22-3 full acceptance

`solutions` should stay last because it spans scene solution records, grouped galleries, images, videos, and display-oriented detail pages. Its write surface and route/content coupling are the highest-risk part of the Round 22 shadow migration.
