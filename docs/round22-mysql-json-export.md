# Round 22 MySQL to JSON Export

## 22-6-2 Dry-Run Skeleton

22-6-2 adds only a safe MySQL-to-JSON export dry-run skeleton. It does not make MySQL primary, does not freeze JSON, does not overwrite `server/data`, does not write MySQL, and does not implement rollback.

The CLI entry point is:

```bash
npm.cmd run export:content
npm.cmd run export:content:dry-run
```

Supported options:

- `--dry-run`: default mode.
- `--module <name>`: `all`, `contact-info`, `company-assets`, `home-video`, `home-interactive-images`, `articles`, `cases`, `solutions`, or `pages`.
- `--output-dir <path>`: optional output directory outside `server/data` and `server/uploads`.
- `--format json`: JSON output only.
- `--write`: intentionally rejected in 22-6-2.

Default output path:

```text
server/data-exports/mysql-json-export/<YYYYMMDD-HHmmss>/
```

The output directory contains:

- `export-manifest.json`
- `export-summary.json`
- `diff-report.json`
- `risks.json`
- `modules/<module-name>/source.json`
- `modules/<module-name>/exported.json`
- `modules/<module-name>/diff.json`

These files are dry-run artifacts. They are ignored by Git and are not official content sources.

## Module Status

The 22-6-2 registry includes:

- `contact-info`
- `company-assets`
- `home-video`
- `home-interactive-images`
- `articles`
- `cases`
- `solutions`
- `pages`

All real MySQL-to-JSON transforms remain future work. The skeleton reads the current source JSON, checks MySQL configuration and table counts when available, writes explicit skeleton `exported.json` files, and marks reports as not comparable when a transform is not implemented. It must not report skeleton output as matched content.

## 22-6-3 Low-Risk Implemented Dry-Run Exports

22-6-3 keeps the same dry-run boundaries, but implements real MySQL-to-JSON export readers for four low-risk modules:

- `contact-info`: reads `contact_info.content_json` from the active singleton row and restores the current `contact-info.json` object shape.
- `company-assets`: reads active `company_assets` rows, uses `raw_json` for core display fields, and uses primary table fields for media URL, alt text, description, ordering, and enabled state.
- `home-video`: reads the active `home_video` singleton row and optional `media_files` metadata for file names; missing media metadata is reported as a warning, not a hard failure.
- `home-interactive-images`: reads active `home_interactive_images` rows, preserves a stable 12-slot array, and reports a warning if the active row count is not exactly 12.

These modules now report `exportStatus=implemented`. `articles`, `cases`, and `solutions` remain `skeleton_only`; `pages` remains `skipped_empty_source` when the JSON source is empty.

For implemented modules, `modules/<module-name>/exported.json` contains the restored JSON shape. `modules/<module-name>/diff.json` compares source JSON with exported JSON and records:

- `diffStatus`: `matched`, `warning`, `error`, or `mysql_unavailable`
- `fieldDiffs`: field path, source value, exported value, severity, and reason
- source/exported counts
- module warnings and blockers

The exporter must not hide differences. If MySQL is unavailable, implemented modules report `mysql_unavailable` and do not pretend to match. If the core JSON shape cannot be restored, the module reports `error` / `shape_risk`. Non-core media metadata gaps are warnings only.

## Deferred Areas

`media-library` is deferred because `media_files` is shared across modules and upload/delete rollback is not defined.

`publish-logs` do not block 22-6. JSON publish logs remain the formal publish record chain, and MySQL `publish_logs` remains a shadow index.

`scenario-detail-pages`, `solution_pages`, and `solution_page_blocks` are deferred because the current source is empty and PageEditor/scenario detail ownership is outside this step.

## Rollback Boundary

Rollback is not implemented in 22-6-2. The minimum future rollback definition is restoring `server/data/*.json` from a backup created before any write mode. Future rollback must not restore MySQL shadow rows, tombstones, uploads, or publish logs unless a later step explicitly designs those paths.

Before any future `--write` mode:

- create a backup of `server/data`
- generate a rollback manifest
- run module-level diff reports
- run compare validation
- run prerender validation

## Validation

Recommended MySQL-configured validation:

```bash
npm.cmd run lint
npm.cmd run typecheck:server
npm.cmd run db:health
npm.cmd run export:content:dry-run
npm.cmd run export:content -- --module contact-info
npm.cmd run export:content -- --module company-assets
npm.cmd run export:content -- --module home-video
npm.cmd run export:content -- --module home-interactive-images
npm.cmd run export:content -- --module articles
npm.cmd run export:content -- --write
npm.cmd run build:prerender
```

The `--write` command must fail safely and must not overwrite `server/data`. Low-risk module dry-runs may report `matched`, `warning`, `error`, or `mysql_unavailable`; skeleton modules must not present skeleton payloads as matched exports.

No-MySQL validation should also run with all `MYSQL_*` variables removed:

```bash
npm.cmd run export:content:dry-run
```

Expected no-MySQL behavior:

- the CLI does not crash
- `export-manifest.json` and `export-summary.json` report `mysqlConfigured=false`
- implemented module reports mark MySQL as unavailable
- `server/data` is not modified
- MySQL is not written

Final Git validation:

```bash
git status --short -uall
git diff --stat
git diff --name-only
```

Only the export tooling, docs, package scripts, and `.gitignore` should appear. `server/data`, `server/uploads`, and generated `server/data-exports` artifacts must not appear in Git status.
