# Round 22 Migration Skeleton

This document describes the 22-3B-3 migration skeleton only.

The skeleton can read JSON sources, compute canonical SHA256 hashes, identify migration modules, print dry-run plans, check planned tables and fields against `server/src/db/migrations/001_initial_schema.sql`, create pre-write JSON snapshots, write selected low-risk business tables, and write `migration_logs` records for every selected module.

It migrates only the low-risk modules opened in 22-3B-3.
It does not migrate high-risk business data.
It does not switch any service to MySQL.

JSON remains the only primary data source in 22-3B-3. MySQL remains a shadow database target for later steps.

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

`--write` is enabled only for 22-3B-3 low-risk shadow writes. It:

1. Requires `MYSQL_HOST`, `MYSQL_DATABASE`, `MYSQL_USER`, and `MYSQL_PASSWORD`.
2. Checks the MySQL connection.
3. Checks schema compatibility.
4. Creates a JSON snapshot under `server/data-backups/mysql-migration/YYYYMMDD-HHmmss/`.
5. Writes `source-manifest.json` into the snapshot directory.
6. Writes only the 22-3B-3 low-risk business tables.
7. Writes one `migration_logs` record per selected source module.
8. Leaves all high-risk business tables untouched.

If MySQL is not configured, `--write` fails before creating a snapshot and before writing any database rows.

## Writable Modules

Only these modules can write business tables in 22-3B-3:

- `pages`
- `contact-info`
- `company-assets`
- `home-video`
- `home-interactive-images`

The writable tables are limited to:

- `pages`
- `page_blocks`
- `seo_settings`
- `contact_info`
- `company_assets`
- `home_video`
- `home_interactive_images`
- `media_files`, only for media referenced by the writable modules
- `migration_logs`

These modules remain plan-only / not implemented in 22-3B-3:

- `articles`
- `cases`
- `solutions`
- `scenario-detail-pages`
- `media-library`
- `publish-logs`

When `npm.cmd run migrate:content -- --write --module all` is used, only the five writable modules are allowed to write business tables. The plan-only modules receive `migration_logs` records with `status = not_implemented` and `skippedReason = not_implemented_in_22_3B_3`.

## Repeat Runs

Low-risk writes use idempotent upsert keys:

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

- `businessWritesEnabled`, true only for successfully written low-risk modules
- `snapshotDir`
- `moduleName`
- `plannedWrites`
- `actualWrites`
- `warnings`
- `schemaCompatibility`
- `skippedReason`

Rows are inserted with an upsert on the existing `(migration_key, source_hash)` unique key so repeated runs against unchanged sources update the skeleton log instead of failing on duplicates.

## Boundaries

The skeleton must not change frontend UI, admin UI, business services, API output, JSON data, uploads, prerender scripts, sitemap scripts, route slugs, or existing publish log generation.

`publish-logs` remains JSON-primary in this step. The migration skeleton can index publish logs for snapshot and log metadata only; it must not make MySQL the primary publish log source.

## 22-3B-4 Snapshot Safety

`server/data-backups/mysql-migration/` is a local migration acceptance snapshot directory. It is ignored by Git and must not be committed.

These snapshots are only for local migration verification. They are not formal production backups, not deployment artifacts, and not part of the canonical content source. They may be cleaned after each acceptance pass once the operator no longer needs the local rollback/reference copy.

Formal production backup strategy is deferred to Round 24 deployment preparation.

## 22-3 Next Boundaries

Recommended order after the completed low-risk 22-3B-3 writes:

1. 22-3B-5: `articles`
2. 22-3B-6: `media-library` dedupe strategy / shadow migration
3. 22-3B-7: `cases`
4. 22-3B-8: `solutions` + `scenario-detail-pages`
5. 22-3B-9: `publish-logs` shadow index + 22-3 full acceptance

`solutions` should stay last because it spans scene solution records, grouped galleries, images, videos, and display-oriented detail pages. Its write surface and route/content coupling are the highest-risk part of the Round 22 shadow migration.
