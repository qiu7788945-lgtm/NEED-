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

## 22-6-4 Articles Implemented Dry-Run Export

22-6-4 keeps the same dry-run boundaries and upgrades `articles` from `skeleton_only` to `implemented`.

The articles exporter reads only active MySQL rows:

- `articles` for the article scalar fields and stable source key.
- `article_categories` for category slug fallback.
- `seo_settings` with `owner_type = 'article'` for `seoTitle`, `seoDescription`, and `keywords`.
- `faq_items` with `owner_type = 'article'` for active `faqItems`.

If an `articles.raw_json` column exists, it is used as the JSON-shape base where available. The exporter then overlays the normalized article table fields, SEO rows, FAQ rows, ordering, status, and timestamps so the output remains the existing `Article` shape:

```text
id, title, slug, category, summary, content, sortOrder, status,
seoTitle, seoDescription, keywords, faqItems, createdAt, updatedAt
```

If `articles.raw_json` is absent or missing for some rows, the exporter reconstructs the shape from normalized tables and records a warning. If `raw_json` exists but cannot be parsed, or if required core article fields cannot be restored, the module reports `shape_risk` / `error` rather than pretending to match.

Article diff reports align source/exported arrays by stable `slug` first and `id` second before comparing fields, so ordering differences do not hide real slug/key mismatches or create noisy cross-record diffs.

`articles` now reports `exportStatus=implemented`. `cases` and `solutions` remain `skeleton_only`; `pages` remains `skipped_empty_source` when the JSON source is empty. The exporter still never overwrites `server/data`, never writes MySQL, never modifies uploads, and does not implement rollback.

## 22-6-5 Cases Implemented Dry-Run Export

22-6-5 keeps the same dry-run boundaries and upgrades `cases` from `skeleton_only` to `implemented`.

The cases exporter reads only active MySQL rows:

- `cases` for the main case row and `raw_json` shape base.
- `case_images` for active image split rows, grouped by `case_id`.
- `seo_settings` with `owner_type = 'case'` for case SEO fields.
- `faq_items` with `owner_type = 'case'` for case FAQ fields.

It does not read `media_files`, does not touch uploads, and does not export tombstoned rows where `deleted_at IS NOT NULL`.

`cases.raw_json` is the preferred recovery base because it preserves the current `CaseStudy` JSON shape, including long content fields, Word-import metadata, and `extractedImages`. The exporter overlays normalized `cases` table fields, uses `case_images` only to validate or supplement images, and fills SEO/FAQ fields into the existing case JSON shape. If raw JSON is missing, the exporter attempts a reduced reconstruction from the split tables and records a warning. If raw JSON is unparseable or required fields such as `id`, `title`, `slug`, or supported `status` cannot be restored, the module reports `shape_risk` / `error`.

Case diff reports align source/exported arrays by stable `slug` first and `id` second before comparing fields. This avoids noisy cross-record diffs when MySQL ordering differs from the current JSON source.

`cases` now reports `exportStatus=implemented`. `solutions` remains `skeleton_only`; `pages` remains `skipped_empty_source` when the JSON source is empty. The exporter still never overwrites `server/data`, never writes MySQL, never modifies uploads, and does not implement rollback.

## 22-6-6 Solutions Implemented Dry-Run Export

22-6-6 keeps the same dry-run boundaries and upgrades `solutions` from `skeleton_only` to `implemented`.

The solutions exporter reads only active MySQL rows:

- `solutions` for the scene row and `raw_json` scene-shape base.
- `solution_groups` for active grouped case/gallery sections.
- `solution_media_items` for active group image/video items.

It does not read `media_files`, does not touch uploads, does not process `media-library`, `scenario-detail-pages`, `solution_pages`, or `solution_page_blocks`, and does not export rows where `deleted_at IS NOT NULL`.

`solutions.raw_json` is the preferred recovery base because it preserves the current `SolutionScene` JSON shape, including fixed scenes, `groups`, `items`, `enabled`, `sortOrder`, timestamps, and the special `video-digital-assets` image/video structure. When `raw_json.groups` exists, that shape is preserved and split rows are used for validation. When `raw_json` or `groups` is missing, the exporter reconstructs the smallest compatible shape from `solutions`, `solution_groups`, and `solution_media_items` and records warnings. Unparseable `raw_json`, missing fixed scenes, missing core media URL/file type, duplicate scenes, or invalid video-scene rules are reported as `shape_risk` / `error`.

Solution diff reports align scenes by `slug`, groups by `slug` first and `id` second, and items by `id` first and `mediaUrl + sortOrder` second. This avoids order-only noise while still comparing scene fields, group fields, item fields, group counts, and item counts.

`solutions` now reports `exportStatus=implemented`. Implemented export modules are `contact-info`, `company-assets`, `home-video`, `home-interactive-images`, `articles`, `cases`, and `solutions`; `pages` remains empty-source/skipped. `media-library`, `scenario-detail-pages`, `solution_pages`, `solution_page_blocks`, and `publish-logs` remain deferred or non-blocking exactly as in earlier 22-6 steps.

## 22-6-8 Backup / Rollback Skeleton

22-6-8 adds only the safety skeleton required before any future write mode. It does not enable `--write`, does not create a real backup, does not execute rollback, does not overwrite `server/data`, does not write MySQL, and does not restore uploads.

Dry-run reports now include:

- `writeModeEnabled=false`
- `backupCreated=false`
- `rollbackAvailable=false`
- `rollbackModeEnabled=false`
- `backupRequiredBeforeWrite=true`
- `backupPlan`
- `rollbackPlan`
- `rollbackScope`
- `rollbackDeferredItems`

The backup plan is report-only. Its future default directory naming rule is:

```text
server/data-backups/mysql-json-export/<YYYYMMDD-HHmmss>/
```

In 22-6-8 the exporter only records which selected module JSON files would be included in a future backup. It writes this plan inside the normal dry-run report under `server/data-exports/mysql-json-export/<timestamp>/`; it does not copy files to `server/data-backups`.

The rollback skeleton defines the future minimum scope as restoring `server/data/*.json` from a verified backup manifest. It explicitly excludes MySQL rows, uploads, publish logs, media-library physical files, migration logs, and tombstone/deleted rows. `canRollback` remains `false`.

The optional `--plan-backup` flag marks the backup plan as requested but still does not create a backup. The optional `--rollback <manifest>` placeholder is parsed but safely rejected in 22-6-8.

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
npm.cmd run export:content -- --module cases
npm.cmd run export:content -- --module solutions
npm.cmd run export:content -- --write
npm.cmd run build:prerender
```

The `--write` command must fail safely and must not overwrite `server/data`. Implemented module dry-runs may report `matched`, `warning`, `error`, or `mysql_unavailable`; skeleton modules must not present skeleton payloads as matched exports.

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
