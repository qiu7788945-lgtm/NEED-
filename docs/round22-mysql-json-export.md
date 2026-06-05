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
- `--create-backup`: create a real JSON backup under `server/data-backups/mysql-json-export/<YYYYMMDD-HHmmss>/` without writing `server/data`.

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
- `home-video`: reads the active `home_video` singleton row. As of Round 22-7-5K-6G, valid `home_video.raw_json` is the preferred JSON-shape base; scalar columns are used only for consistency warnings, and optional `media_files` metadata is used only when `raw_json` is missing.
- `home-interactive-images`: reads active `home_interactive_images` rows, preserves a stable 12-slot array, and reports a warning if the active row count is not exactly 12.

These modules now report `exportStatus=implemented`. `articles`, `cases`, and `solutions` remain `skeleton_only`; `pages` remains `skipped_empty_source` when the JSON source is empty.

For implemented modules, `modules/<module-name>/exported.json` contains the restored JSON shape. `modules/<module-name>/diff.json` compares source JSON with exported JSON and records:

- `diffStatus`: `matched`, `warning`, `error`, or `mysql_unavailable`
- `fieldDiffs`: field path, source value, exported value, severity, and reason
- source/exported counts
- module warnings and blockers

The exporter must not hide differences. If MySQL is unavailable, implemented modules report `mysql_unavailable` and do not pretend to match. If the core JSON shape cannot be restored, the module reports `error` / `shape_risk`. Non-core media metadata gaps are warnings only.

### Round 22-7-5K-6G home-video raw_json priority

`home-video` preserves its current JSON shape from `home_video.raw_json` when that value is present and valid. The exporter keeps `updatedAt`, `videoFileName`, `videoDisplayName`, `posterFileName`, and `posterDisplayName` from `raw_json`; MySQL `updated_at`, scalar columns, and `media_files` do not override those fields.

If `raw_json` is missing, the exporter falls back to the previous scalar plus optional `media_files` reconstruction and records a warning. If `raw_json` is present but cannot restore the required shape, the module reports `shape_risk` rather than pretending to match. This remains dry-run export only and does not enable `export --write`.

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

## 22-7-4B Backup / Rollback Scope Decision

Round 22-7-4B lands the documentation-only scope decision for future real backup and rollback rehearsal. The full boundary is recorded in [Round 22 Backup / Rollback Rehearsal Scope](./round22-backup-rollback-rehearsal.md).

The first real backup phase must cover these rollback-eligible JSON files:

- `server/data/contact-info.json`
- `server/data/company-assets.json`
- `server/data/home-video.json`
- `server/data/home-interactive-images.json`
- `server/data/articles.json`
- `server/data/cases.json`
- `server/data/solutions.json`
- `server/data/pages.json`
- `server/data/scenario-detail-pages.json`

`pages.json` and `scenario-detail-pages.json` must be backed up even when empty, so a future write can return to the exact pre-write file state.

`server/data/media-library.json` may be backed up as metadata and a safety anchor, but it is not first-phase content rollback input and must not be overwritten by the first rehearsal phase.

`server/data/publish-logs/**` may be retained or archived as publish audit history, but it is not content rollback input.

The first rollback rehearsal phase must restore only to:

```text
server/data-restore-rehearsals/mysql-json-export/<timestamp>/
```

It must not overwrite `server/data`, restore MySQL, restore uploads, restore publish logs, restore tombstone rows, restore `migration_logs`, or restore media-library physical files.

Future export `--write` must create and verify a real backup before writing. If backup creation or verification fails, write must stop. Bypassing backup for `--write` is not allowed.

## 22-7-5C-3 Real Backup Creation

Round 22-7-5C-3 adds the explicit real-backup CLI flag:

```bash
npm.cmd run export:content:dry-run -- --create-backup
```

The flag creates a real JSON backup at:

```text
server/data-backups/mysql-json-export/<YYYYMMDD-HHmmss>/
```

The backup directory contains `backup-manifest.json`, `backup-summary.json`, `risks.json`, optional `failure-report.json`, and copied JSON files under `files/`.

The required rollback-eligible files are:

- `server/data/contact-info.json`
- `server/data/company-assets.json`
- `server/data/home-video.json`
- `server/data/home-interactive-images.json`
- `server/data/articles.json`
- `server/data/cases.json`
- `server/data/solutions.json`
- `server/data/pages.json`
- `server/data/scenario-detail-pages.json`

`server/data/media-library.json` is backed up when present as `specialHandling=metadata_safety_anchor` and `rollbackEligible=false`.

`server/uploads/**`, `server/data/publish-logs/**`, MySQL rows, tombstone rows, generated export outputs, and abnormal media-library backup/corrupt copies remain excluded.

When `--create-backup` succeeds, export reports include:

- `backupCreated=true`
- `backupRoot`
- `backupManifestPath`
- `backupValidationStatus`
- `wroteServerData=false`
- `wroteMysql=false`
- `canRollback=false`
- `rollbackAvailable=false`
- `writeModeEnabled=false`

`--plan-backup` remains report-only. `--write` and `--rollback` remain safely rejected after real backup creation is available.

## 22-7-5D-2 Rollback Rehearsal Temp-Only Boundary

Round 22-7-5D-2 lands only documentation and `.gitignore` boundaries for future temp-only rollback rehearsal. It does not implement rehearsal, execute rollback, open `--rollback`, open `--write`, overwrite `server/data`, write MySQL, or restore uploads, publish logs, or `media-library.json`.

Future rehearsal output should use:

```text
server/data-restore-rehearsals/mysql-json-export/<YYYYMMDD-HHmmss>/
```

The output directory must be unique, must fail if it already exists, and must be ignored by Git.

The recommended future CLI flag is:

```text
--rehearse-rollback <backup-manifest-path>
```

Optional override:

```text
--restore-dir <path>
```

`--rehearse-rollback` is temp-only. `--rollback` remains formal rollback and remains disabled. `--rollback` must not be used to disguise a rehearsal command.

The only trusted input is `backup-manifest.json`. Rehearsal may restore only `rollbackEligible=true` files from the manifest, limited to the nine first-phase JSON files: `contact-info.json`, `company-assets.json`, `home-video.json`, `home-interactive-images.json`, `articles.json`, `cases.json`, `solutions.json`, `pages.json`, and `scenario-detail-pages.json`.

The rehearsal must skip `rollbackEligible=false` entries, `media-library.json`, `server/data/publish-logs/**`, `server/uploads/**`, MySQL rows, tombstones, `migration_logs`, `dist-prerender`, export outputs, and the backup directory itself.

The future restore manifest and failure report schema are defined in [Round 22 Backup / Rollback Rehearsal Scope](./round22-backup-rollback-rehearsal.md). Current `--write` remains disabled; a real backup alone is not enough to open write mode.

## 22-7-5D-3 Rollback Rehearsal Temp Restore

Round 22-7-5D-3 adds the temp-only rehearsal CLI:

```bash
npm.cmd run export:content -- --rehearse-rollback server/data-backups/mysql-json-export/<timestamp>/backup-manifest.json
```

Optional restore override:

```text
--restore-dir <path>
```

Without `--restore-dir`, rehearsal writes to:

```text
server/data-restore-rehearsals/mysql-json-export/<YYYYMMDD-HHmmss>/
```

The command reads `backup-manifest.json`, restores only the nine `rollbackEligible=true` first-phase JSON files into `files/`, and writes `restore-manifest.json`, `restore-summary.json`, and `risks.json`. `failure-report.json` is written when a rehearsal failure occurs after the restore root is created.

The command skips `rollbackEligible=false` entries, including `media-library.json`, and excludes publish logs, uploads, MySQL rows, tombstones, `migration_logs`, generated outputs, and the backup directory itself.

Rehearsal validates manifest shape, backup file existence, SHA-256 hashes, readable JSON, record counts, shape summaries, unchanged `server/data` hashes, unchanged backup inputs, and no tracked Git pollution from rehearsal output.

`--rollback` remains formal rollback and remains safely rejected. `--write` remains safely rejected. Temp-only rehearsal does not write MySQL and does not require MySQL configuration.

## Deferred Areas

`media-library` is deferred because `media_files` is shared across modules and upload/delete rollback is not defined.

Round 22-7-6-3 lands the asset-layer exception strategy in [Round 22 Media Library / Uploads Exception Strategy](./round22-media-library-uploads-exception-strategy.md). `media-library` remains deferred because `media_files` is not the unique media-library source, unknown ownership blocks export, `sharedButReferenced` rows cannot be directly exported as media-library-owned records, uploads are not backed up or restorable by the current JSON rollback path, and delete recovery / tombstone behavior is not closed.

Round 22-7-6-5 lands the ownership report design in [Round 22 Media Files Ownership Report Design](./round22-media-files-ownership-report.md). The design keeps ownership report implementation deferred and records that `unknown`, `sharedButReferenced`, `businessOwned`, `missingPhysicalFile`, and `conflict` cases block media-library export and delete ownership claims.

Round 22-7-6-7 lands the uploads backup / restore temp-only design in [Round 22 Uploads Backup / Restore Temp-Only Design](./round22-uploads-backup-restore-temp-only.md). The design keeps uploads backup / restore implementation deferred and records that physical-file backup, temp-only restore validation, consistency reporting, and quarantine or recovery policy are required before media-library delete double-write or media-library write closure.

The exception, ownership report design, and uploads backup / restore design do not enable `export --write`. They require explicit follow-ups for ownership report implementation boundary confirmation, read-only ownership report implementation, uploads backup dry-run, real copy backup, temp-only restore rehearsal, delete recovery / tombstone / quarantine design, and a later media-library export re-entry decision.

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
