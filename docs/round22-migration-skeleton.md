# Round 22 Migration Skeleton

This document describes the 22-3B-2 migration skeleton only.

The skeleton can read JSON sources, compute canonical SHA256 hashes, identify migration modules, print dry-run plans, check planned tables and fields against `server/src/db/migrations/001_initial_schema.sql`, create pre-write JSON snapshots, and write `migration_logs` skeleton records.

It does not migrate business data.
It does not write MySQL business tables.
It does not switch any service to MySQL.

JSON remains the only primary data source in 22-3B-2. MySQL remains a shadow database target for later steps.

## Commands

```powershell
npm.cmd run migrate:content:dry-run
npm.cmd run migrate:content
npm.cmd run migrate:content -- --module articles
npm.cmd run migrate:content -- --module all --fail-fast
npm.cmd run migrate:content -- --write
```

`migrate:content` defaults to dry-run.

Dry-run reads JSON and prints the migration plan only. It does not create snapshots and does not write `migration_logs`.

`--write` is enabled only for 22-3B-2 snapshot and log scaffolding. It:

1. Requires `MYSQL_HOST`, `MYSQL_DATABASE`, `MYSQL_USER`, and `MYSQL_PASSWORD`.
2. Creates a JSON snapshot under `server/data-backups/mysql-migration/YYYYMMDD-HHmmss/`.
3. Writes `source-manifest.json` into the snapshot directory.
4. Writes one `migration_logs` skeleton record per selected source module.
5. Leaves all business tables untouched.

If MySQL is not configured, `--write` fails before creating a snapshot and before writing any database rows.

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

`--write` writes only `migration_logs`. Each selected source module receives one row using the existing schema fields:

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

- `businessWritesEnabled: false`
- `snapshotDir`
- `moduleName`
- `plannedWrites`
- `warnings`
- `schemaCompatibility`

Rows are inserted with an upsert on the existing `(migration_key, source_hash)` unique key so repeated runs against unchanged sources update the skeleton log instead of failing on duplicates.

## Boundaries

The skeleton must not change frontend UI, admin UI, business services, API output, JSON data, uploads, prerender scripts, sitemap scripts, route slugs, or existing publish log generation.

`publish-logs` remains JSON-primary in this step. The migration skeleton can index publish logs for snapshot and log metadata only; it must not make MySQL the primary publish log source.
