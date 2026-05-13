# Round 22 Migration Skeleton

This document describes the Round 22 content migration skeleton through 22-3B-5.

The skeleton can read JSON sources, compute canonical SHA256 hashes, identify migration modules, print dry-run plans, check planned tables and fields against `server/src/db/migrations/001_initial_schema.sql`, create pre-write JSON snapshots, write selected shadow business tables, and write `migration_logs` records for every selected module.

It migrates only the low-risk modules opened in 22-3B-3 plus `articles` opened in 22-3B-5.
It does not migrate the remaining medium-risk or high-risk business data.
It does not switch any service to MySQL.

JSON remains the only primary data source in 22-3. MySQL remains a shadow database target for later steps.

## Commands

```powershell
npm.cmd run migrate:content:dry-run
npm.cmd run migrate:content
npm.cmd run migrate:content -- --module articles
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
6. Writes only the modules enabled through 22-3B-5.
7. Writes one `migration_logs` record per selected source module.
8. Leaves all unopened medium-risk and high-risk business tables untouched.

If MySQL is not configured, `--write` fails before creating a snapshot and before writing any database rows.

## Writable Modules

Only these modules can write business tables through 22-3B-5:

- `articles`
- `pages`
- `contact-info`
- `company-assets`
- `home-video`
- `home-interactive-images`

The writable tables are limited to:

- `article_categories`
- `articles`
- `seo_settings`, for articles and opened page modules
- `faq_items`, for articles when source FAQ exists
- `pages`
- `page_blocks`
- `contact_info`
- `company_assets`
- `home_video`
- `home_interactive_images`
- `media_files`, only for media referenced by the opened low-risk media modules
- `migration_logs`

`article_blocks` remains unused while `articles.json` stores article body as whole `content` without explicit block records.

These modules remain plan-only / not implemented in 22-3B-5:

- `cases`
- `solutions`
- `scenario-detail-pages`
- `media-library`
- `publish-logs`

When `npm.cmd run migrate:content -- --write --module all` is used, only the six writable modules are allowed to write business tables. The plan-only modules receive `migration_logs` records with `status = not_implemented` and `skippedReason = not_implemented_in_22_3B_5`.

## Repeat Runs

Low-risk writes use idempotent upsert keys:

- `articles`: `source_id` when present, otherwise `slug`
- `article_categories`: `slug`
- `seo_settings` for articles: `owner_type = article` plus `owner_id` or stable `owner_source_id`
- `faq_items` for articles: `owner_type = article`, stable `owner_source_id`, `sort_order`, and `question`
- `pages`: `source_id` when present, otherwise `slug`
- `contact-info`: `singleton_key = contact_info`
- `company-assets`: `asset_key`
- `home-video`: `singleton_key = home_video`
- `home-interactive-images`: `slot_number`
- `media_files`: `public_url`

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

## 22-3B-5 Articles

22-3B-5 opens `articles` as the next shadow-write module. It writes `article_categories`, `articles`, article `seo_settings`, article `faq_items` when source FAQ exists, and `migration_logs`.

`articles.json` currently stores article body in a whole `content` field. Because it does not provide explicit block records, the migration does not split content into `article_blocks` in this step.

Article slugs are preserved exactly from JSON. Article categories are derived from source category slugs and upserted by `article_categories.slug`. Article rows are upserted by `source_id` when present and by `slug` as the stable fallback. Repeated runs with the same successful `source_hash` are skipped through `migration_logs`; changed sources update existing rows through the same upsert keys instead of inserting duplicates.

## Boundaries

The skeleton must not change frontend UI, admin UI, business services, API output, JSON data, uploads, prerender scripts, sitemap scripts, route slugs, or existing publish log generation.

`publish-logs` remains JSON-primary in this step. The migration skeleton can index publish logs for snapshot and log metadata only; it must not make MySQL the primary publish log source.

## 22-3B-4 Snapshot Safety

`server/data-backups/mysql-migration/` is a local migration acceptance snapshot directory. It is ignored by Git and must not be committed.

These snapshots are only for local migration verification. They are not formal production backups, not deployment artifacts, and not part of the canonical content source. They may be cleaned after each acceptance pass once the operator no longer needs the local rollback/reference copy.

Formal production backup strategy is deferred to Round 24 deployment preparation.

## 22-3 Next Boundaries

Recommended order after 22-3B-5:

1. 22-3B-6: `media-library` dedupe strategy / shadow migration
2. 22-3B-7: `cases`
3. 22-3B-8: `solutions` + `scenario-detail-pages`
4. 22-3B-9: `publish-logs` shadow index + 22-3 full acceptance

`solutions` should stay last because it spans scene solution records, grouped galleries, images, videos, and display-oriented detail pages. Its write surface and route/content coupling are the highest-risk part of the Round 22 shadow migration.
