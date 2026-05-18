# Round 22 Service Switch

This document tracks the Round 22-5 service switch phase after the JSON-to-MySQL shadow migration and dual-read compare work.

Round 22-5 is a staged runtime-read switch. It is not a full-site MySQL cutover. JSON fallback stays in place, and JSON remains the safe recovery path for the website while each module is switched and validated separately.

## 22-5A Scope

22-5A only introduces MySQL-first reads for low-risk modules:

- `pages`
- `contact-info`
- `home-video`
- `home-interactive-images`
- `company-assets`

The following modules are not switched in 22-5A and must continue using the existing JSON/runtime paths:

- `articles`
- `media-library`
- `cases`
- `solutions`
- `scenario-detail-pages`
- `publish-logs`

22-5A does not change frontend UI, admin UI, API response shape, route manifest generation, sitemap generation, prerender scripts, publish log generation, or any write-side migration logic.

## Runtime Source Strategy

The low-risk runtime source is MySQL-first with JSON fallback:

- If MySQL is configured and a low-risk module query returns usable data, the service maps MySQL rows back to the existing JSON/API shape.
- If MySQL is not configured, the service reads the existing JSON file.
- If MySQL connection or query fails, the service logs a low-frequency warning and reads the existing JSON file.
- If MySQL returns an empty or unusable result for `contact-info`, `company-assets`, `home-video`, or `home-interactive-images`, the service falls back to JSON so content does not disappear.
- `pages` remains guarded in 22-5A because the accepted source is empty. The service checks MySQL safely, but JSON fallback remains the exposed behavior to avoid adding pages to APIs, route manifests, or sitemaps.

The fallback path is read-only. It does not write MySQL, rewrite JSON, generate migration snapshots, or repair data automatically.

## API Shape

MySQL rows are mapped back to the existing API structures:

- `contact-info`: keeps `companyName`, `brandName`, `address`, `email`, `phone`, and `socials`.
- `company-assets`: keeps `id`, `title`, `summary`, `description`, `location`, `imageUrl`, `imageAlt`, `sortOrder`, and `enabled`.
- `home-video`: keeps `videoUrl`, `videoFileName`, `videoDisplayName`, `posterUrl`, `posterFileName`, `posterDisplayName`, `title`, `description`, `enabled`, and `updatedAt`.
- `home-interactive-images`: keeps 12 slots with `slotNo`, `mediaUrl`, `mediaFileName`, `alt`, `sortOrder`, and `enabled`.
- `pages`: keeps the existing pages API behavior and does not expose unexpected MySQL rows during 22-5A.

Frontend and admin code do not need MySQL column names such as `is_enabled`, `sort_order`, `media_url`, `video_url`, or `image_url`.

## Guardrails

22-5A keeps these ownership boundaries:

- JSON fallback remains available for every switched low-risk module.
- MySQL failure must not break the website, dev server, prerender, sitemap checks, or publish logs.
- Route manifest, sitemap, and publish log generation continue to use their established paths.
- Articles, cases, solutions, scenario detail pages, media library, and publish logs are not switched.
- The website is not promoted to a MySQL-primary data source in 22-5A.

## Suggested Validation

Run these checks before considering 22-5A complete:

```powershell
git status --short -uall
git diff --stat
git diff --name-only

npm.cmd run lint
npm.cmd run typecheck:server

npm.cmd run db:health
npm.cmd run compare:content -- --module contact-info
npm.cmd run compare:content -- --module company-assets
npm.cmd run compare:content -- --module home-video
npm.cmd run compare:content -- --module home-interactive-images
npm.cmd run compare:content -- --module pages

npm.cmd run build:prerender
```

Also validate `build:prerender` in an environment without `MYSQL_*` variables. It should continue to succeed through JSON fallback.

## Next Phase

22-5B should only start after the 22-5A modules pass their individual checks with MySQL configured and with MySQL unavailable. 22-5B may consider `articles`, but it should still be a single-module switch with its own compare, runtime, fallback, prerender, and API-shape validation. It should not switch the full site at once.

## 22-5B Articles

22-5B only switches the `articles` read chain. It does not switch cases, solutions, scenario detail pages, media-library service, publish logs, route manifest generation, sitemap generation, prerender scripts, frontend UI, or admin UI.

Articles now use MySQL-first reads with JSON fallback:

- `articles` rows provide the primary article fields.
- `article_categories` is joined to keep category slugs compatible with the original `Article.category` values.
- `seo_settings` rows with `owner_type = 'article'` provide `seoTitle`, `seoDescription`, and `keywords`.
- `faq_items` rows with `owner_type = 'article'` provide `faqItems`; zero FAQ rows remains valid when the source has no FAQ.
- If MySQL is not configured, the service reads `server/data/articles.json`.
- If MySQL connection, query, count, category, status, content, or SEO structure is unusable, the service logs one warning and falls back to JSON.
- If MySQL returns no article rows, the service falls back to JSON so article pages do not disappear.

The API response shape remains the existing article shape: `id`, `title`, `slug`, `category`, `summary`, `content`, `sortOrder`, `status`, `seoTitle`, `seoDescription`, `keywords`, `faqItems`, `createdAt`, and `updatedAt`. MySQL column names such as `source_id`, `category_slug`, and `sort_order` are mapped back before the API responds.

Article writes still use the JSON maintenance path in 22-5B. This keeps the existing admin maintenance entry and avoids introducing MySQL write behavior in this read-switch step.

Route manifest, sitemap, and publish log behavior remains on the established chain. Unpublished articles must continue to be skipped by the existing route manifest / prerender logic, and published article route counts should remain consistent with the current JSON source. 22-5B is not a full-site MySQL primary-source closeout.

The next step, 22-5C, may only consider media-library or another single module after 22-5B is validated with MySQL available and unavailable. It must have its own single-module acceptance pass and must not switch the whole site at once.

## 22-5C Media-Library Boundary Confirmation

22-5C is only a boundary confirmation step for media-library. It does not switch the media service to MySQL, does not change upload/list/archive/restore/delete/update behavior, and does not change frontend UI, admin UI, route manifest, sitemap, prerender, publish logs, JSON data, uploads, cases, solutions, scenario detail pages, or publish logs.

### Current Media Read/Write Chain

The current media-library runtime index is `server/data/media-library.json`. It is read by `readMediaIndex()` in `server/src/services/media/media.service.ts`, and written by `writeMediaIndex()` with a file lock queue and temporary-file rename. `listLocalImages()` does not simply return the JSON object; it combines:

- files currently present under the image and video upload directories
- metadata from `server/data/media-library.json`
- derived file stats such as size and dimensions
- home usage checks from `readHomeInteractiveImages()` and `readHomeVideoConfig()`
- filters for category, owner, slot, enabled, status, file type, cleanup, and keyword

The media API is mounted at `/api/media`. Current entry points are:

- `POST /api/media/upload` -> `toUploadedImage()`
- `GET /api/media/list` -> `listLocalImages()`
- `PATCH /api/media/:fileName` -> `updateLocalImageMetadata()`
- `PATCH /api/media/:fileName/archive` -> `archiveLocalImage()`
- `PATCH /api/media/:fileName/restore` -> `restoreLocalImage()`
- `DELETE /api/media/:fileName` -> `deleteLocalImage()`
- batch archive/restore/delete endpoints -> batch service wrappers

Admin callers include the media library page, `MediaPicker`, home management upload flows, case management upload flows, and solution management upload flows. This means the media service currently supports the admin media library, uploads, image/video selection, and module-specific material attachment through one shared endpoint family.

The JSON index distinguishes storage and display metadata:

- the JSON object key is the storage file name
- `originalName` is the uploaded source name
- `displayName` is the editable/admin display title
- `url` is the public URL
- storage path is derived from file type plus file name rather than stored as a first-class JSON field
- `category`, `alt`, `description`, `ownerType`, `ownerId`, `ownerSlug`, `groupKey`, `slotNo`, `caption`, `enabled`, `sortOrder`, `status`, and `createdAt` are stored in the JSON entry

### MySQL Shared Table Assessment

`media_files` is a shared table, not a media-library-only table. It already contains records written or updated for media-library, company-assets, home-video, home-interactive-images, cases images, and solutions media items.

The table has enough first-class fields for a read-only media row foundation: `file_name`, `original_name`, `file_path`, `public_url`, `mime_type`, `file_ext`, `file_size`, `width`, `height`, `duration_seconds`, `category`, `alt_text`, `description`, `storage_provider`, `usage_count`, `status`, timestamps, and `deleted_at`.

However, the current admin media API shape also needs `displayName`, owner fields, group keys, slot numbers, captions, enabled state, sort order, and source-record context. For media-library migration rows, these are preserved in `metadata_json` with:

- `moduleName: media-library`
- `sourceKey`
- `displayName` / `title`
- `fileType`
- `ownerType`, `ownerId`, `ownerSlug`, `groupKey`, `slotNo`
- `caption`, `enabled`, `sortOrder`, `createdAt`
- `dedupeKey`
- `sourceRecord`

The 22-4C compare checks are strong enough to support a future read-only adapter draft: they match media-library source records by `public_url/url`, then `file_path`, then `file_name + file_size`; they compare URL/path, file name, original/display metadata, MIME/ext/size, category, alt, description, status, and `metadata_json.sourceRecord`. They also explicitly treat extra MySQL media rows as warning/info because `media_files` is shared.

### Risks Before Switching

media-library should not directly read all `media_files` rows as the admin library list. Doing so may show cases, solutions, home, and company-assets assets that were only meant to be module-owned or derived records.

Filtering only by `metadata_json.moduleName = media-library` is also risky. Shared dedupe/update behavior can leave a row owned by another module while still preserving media-library-compatible ownership metadata, or vice versa. The next step must define a precise ownership rule for which `media_files` rows belong in the media-library list.

The largest runtime risk is read/write inconsistency. Today uploads, metadata edits, archive/restore, permanent delete, and batch operations all write `server/data/media-library.json` and/or the local upload files. If the admin list starts reading MySQL before writes are mirrored to the same source, users can upload or edit a media item and not see the expected list state.

Deletion is especially sensitive. Current permanent delete removes the local file and JSON index entry after archive, and it only blocks known home usages from the media service usage map. A MySQL-backed list/delete design must not delete shared files that cases, solutions, home, company-assets, articles, or pages still reference.

Switching media-library must not affect the already accepted `home-video`, `home-interactive-images`, `company-assets`, and `articles` read fallbacks, and it must not make `build:prerender` depend on MySQL media success. The uploads directory structure must remain unchanged.

### Recommendation

media-library is not suitable for an immediate direct service switch. The next safe move is a read-only adapter draft that is not connected to business endpoints, followed by a shadow comparison of adapter output versus the current `listLocalImages()` output.

The future ownership rule should be defined before any endpoint switch. A candidate rule should include media-library source rows matched by stable key, plus rows whose metadata keeps enough media-library/sourceRecord context, while excluding module-only records from cases, solutions, home, and company-assets unless they are intentionally part of the admin media library.

### Suggested Round 22-5 Sequence

- 22-5C-1: media-library read-chain inventory and ownership rule confirmation.
- 22-5C-2: media-library read-only adapter draft, not connected to business routes.
- 22-5C-3: media-library admin list MySQL-first + JSON fallback small-scope switch after adapter compare passes.
- 22-5C-4: media-library write consistency plan for upload, metadata update, archive/restore, delete, and batch operations.
- 22-5D: cases service switch, separately validated.
- 22-5E: solutions service switch, separately validated.
- 22-5F: decide whether publish-logs should continue to keep JSON as the primary runtime chain.
- 22-6: MySQL-to-JSON export and rollback rehearsal.

## 22-5C-2 Media-Library Read-Only Adapter Draft

22-5C-2 adds a standalone, read-only media-library MySQL adapter and shadow compare command. It is not connected to `/api/media/list`, the admin media library, upload, update, archive, restore, delete, batch operations, prerender, sitemap, or publish logs.

The official media-library runtime chain remains unchanged:

- `/api/media/list` still uses `listLocalImages()`
- `listLocalImages()` still combines `server/data/media-library.json`, local upload files, file stats, and usage checks
- upload/update/archive/restore/delete still use the existing JSON/uploads path
- no business route reads MySQL `media_files` through the new adapter

The standalone adapter reads `media_files` and maps rows into a media-library-like shadow shape with `id`, `url`, `publicUrl`, `fileName`, `originalName`, `displayName`, `title`, `filePath`, `mimeType`, `fileExt`, `fileSize`, `category`, `altText`, `description`, `status`, timestamps, `source`, `ownershipReason`, and raw metadata.

Ownership is intentionally conservative because `media_files` is shared:

- `likelyMediaLibrary`: metadata explicitly says `moduleName: media-library`, source metadata says media-library, or `metadata_json.sourceRecord` keeps media-library-style stable and display fields.
- `sharedButReferenced`: metadata points to shared business ownership such as home, cases, solutions, company-assets, or their media categories.
- `unknown`: metadata is insufficient for a safe media-library list decision.

The shadow compare command is:

```powershell
npm.cmd run compare:media-library-source
```

It is stdout-only and read-only. It compares current `listLocalImages({ status: 'all' })` output against the standalone MySQL adapter output and reports:

- JSON/uploads list count
- MySQL total, likely media-library, shared excluded, and unknown ownership counts
- matched stable keys
- JSON/uploads records missing from the MySQL likely media-library set
- MySQL likely media-library records missing from JSON/uploads
- displayName/title, originalName, fileSize, mimeType, category, and status mismatches
- shared rows excluded from official media-library consideration
- unknown ownership rows

22-5C-3 should not start until this report is reviewed. The next gate is whether the likely-media-library ownership rule matches current admin expectations closely enough. Write consistency, delete protection, rename/displayName synchronization, and shared-reference safety remain out of scope for 22-5C-2.

## 22-5C-2B Media-Library Compare Normalization

22-5C-2B only corrects the read-only adapter and shadow compare report for category and ownership normalization. It does not switch the admin media-library list, does not change `/api/media/list`, and does not connect any official media service read path to MySQL `media_files`.

The normalization is compare-only:

- JSON source values are not rewritten.
- MySQL `media_files` values are not rewritten.
- raw category values remain visible in the report.
- normalized category values are added for comparison and diagnostics.
- equivalent raw category formats are no longer hard `fieldMismatches`.
- true category or ownership conflicts remain hard mismatches.

The category canonicalization used by the shadow compare is:

- `solution_image`, `solution-image`, `solution_media`, `solution-media`, plus actual solution video/cover forms such as `solution_video`, `solution-video`, `solution-cover`, and `solution-page-cover` -> `solution-media`
- `case_image`, `case-image`, `case_media`, `case-media`, and actual cover form `case-cover` -> `case-media`
- `home_interactive`, `home-interactive`, `home_interactive_images`, `home-interactive-images` -> `home-interactive-images`
- `home_video`, `home-video` -> `home-video`
- `company_assets`, `company-assets`, `company_asset`, `company-asset` -> `company-assets`
- `media_library`, `media-library` -> `media-library`

The normalizer lowercases values and treats underscores, spaces, short hyphens, and simple singular/plural variants as equivalent where the business meaning is the same.

Ownership normalization reads these metadata fields without writing them back:

- `metadata_json.moduleName`
- `metadata_json.ownerType`
- `metadata_json.ownerSlug`
- `metadata_json.groupKey`
- `metadata_json.sourceRecord.moduleName`
- `metadata_json.sourceRecord.category`
- `metadata_json.sourceRecord.ownerType`
- `metadata_json.sourceRecord.ownerSlug`
- `metadata_json.sourceRecord.groupKey`

`ownerSlug` is normalized and preserved in the signal list, but it is not treated as authoritative by itself because slugs can be arbitrary business identifiers. Category, module name, owner type, and group key are used to infer the normalized ownership bucket: `media-library`, `home-video`, `home-interactive-images`, `company-assets`, `case-media`, `solution-media`, or `unknown`. A bare `ownerType: home` is still treated as shared ownership for exclusion, but it does not become a hard conflict unless category/module/group signals identify a contradictory home subtype.

The compare report now separates:

- raw category differences
- normalized category matches
- true category mismatches
- ownership conflicts
- shared rows excluded from official media-library consideration
- rows with unknown ownership

`normalizedCategoryMatches[]` records the raw JSON value, raw MySQL value, normalized JSON value, normalized MySQL value, stable key, file name, and a message explaining why the raw difference was downgraded. `fieldMismatches[]` is reserved for non-equivalent category differences, ownership conflicts, and the existing non-category field mismatches.

If a row has conflicting business signals, such as a MySQL category normalized to `solution-media` while metadata points to `case-media`, the shadow compare keeps it as a hard mismatch. `sharedButReferenced` rows remain excluded from the official media-library candidate set and are shown only as shadow compare context.

After 22-5C-2B, the project still cannot directly enter the admin media-library list switch. Whether 22-5C-3 is safe depends on the normalized report: missing rows, true mismatches, ownership conflicts, shared exclusions, and unknown ownership must be reviewed first.

## 22-5C-3 Media-Library Admin List Read Switch

22-5C-3 switches only the read path behind `GET /api/media/list`. It is a small-scope MySQL-first list read with JSON/uploads fallback, not a full media-library MySQL primary-source closeout.

The route response shape stays the existing media API shape:

- the controller still returns `success(images)`
- `images` remains an array of media items
- existing fields such as `fileName`, `originalName`, `displayName`, `fileType`, `url`, `size`, `mimeType`, `width`, `height`, `duration`, `category`, `alt`, `description`, owner fields, `slotNo`, `caption`, `enabled`, `sortOrder`, `status`, `createdAt`, `usageCount`, `usages`, `duplicateWarnings`, `isLargeFile`, and `isLargeDimension` remain compatible with the current admin UI
- MySQL category forms are mapped back to the existing media API category values such as `solution_image`, `case_image`, `home_interactive`, and `home_video`
- no frontend or admin UI code is changed for MySQL column names

The MySQL-first path is used only when the read-only adapter can safely return `likelyMediaLibrary` rows from `media_files`. `sharedButReferenced` rows do not enter the official media-library list. `unknown` ownership rows also do not enter the official list.

The route falls back to the existing `listLocalImages()` / JSON/uploads chain when:

- MySQL is not configured
- MySQL connection or query fails
- the adapter returns no `likelyMediaLibrary` rows
- any row has `unknownOwnership`
- ownership signals conflict
- a likely media-library row cannot be mapped back to the existing media API fields
- a likely media-library row is missing key fields such as file name, public URL, MIME type, file size, category, or status

The fallback is read-only and preserves the current behavior that scans local uploads, reads `server/data/media-library.json`, computes usage markers, applies the existing filters, and returns the same API structure. A throttled warning is logged when fallback happens; it does not print database credentials or full connection configuration.

The following operations still use the original JSON/uploads chain and are not switched in 22-5C-3:

- upload
- metadata/displayName/category edits
- archive
- restore
- delete
- batch archive/restore/delete

22-5C-3 does not change frontend UI, admin UI, cases, solutions, articles, scenario detail pages, route manifest generation, sitemap generation, prerender scripts, publish logs, JSON data, upload directories, or MySQL write behavior. MySQL failure must not block the admin media-library page from opening, and it must not affect `build:prerender`.

The next step, 22-5C-4, should remain separate and should focus on write consistency, delete protection, rename/displayName synchronization, and shared-reference safety before any broader media-library source-of-truth decision.

## 22-5C-4 Media-Library Write Consistency Plan

22-5C-4 is documentation and planning only. It does not change upload, delete, displayName/metadata update, archive, restore, batch operations, `/api/media/list`, frontend UI, admin UI, JSON data, uploads, MySQL data, route manifest generation, sitemap generation, prerender, publish logs, cases, solutions, articles, or scenario detail pages.

The current state after 22-5C-3 is deliberately mixed:

- `GET /api/media/list` is MySQL-first with JSON/uploads fallback.
- media-library writes still use the original JSON/uploads chain.
- `media_files` remains a shared table and must not be treated as media-library-only.
- JSON fallback and future MySQL-to-JSON export remain required until the source-of-truth transition is complete.

### Current Write Chain Inventory

The current media write implementation is centered in `server/src/services/media/media.service.ts`, with route/controller entry points in `server/src/controllers/media.controller.ts` and existing admin callers in `admin/src/api/media.ts`, `admin/src/pages/MediaLibraryPage.tsx`, and `admin/src/components/MediaPicker.tsx`.

Current operation behavior:

- Upload: `POST /api/media/upload` uses the upload middleware to write the physical file under `server/uploads/images` or `server/uploads/videos`, then `toUploadedImage()` writes metadata into `server/data/media-library.json`. If image validation fails after upload, the newly uploaded file is unlinked. No MySQL write happens.
- List: `GET /api/media/list` now attempts MySQL-first read, then falls back to `listLocalImages()`. This is the only 22-5C-3 runtime switch.
- Display name / metadata update: `PATCH /api/media/:fileName` calls `updateLocalImageMetadata()` and writes only `server/data/media-library.json`. It does not rename the physical upload file.
- Archive: `PATCH /api/media/:fileName/archive` calls `archiveLocalImage()`, checks the current home usage map, and writes `status: archived` into `server/data/media-library.json`.
- Restore: `PATCH /api/media/:fileName/restore` calls `restoreLocalImage()` and writes `status: active` into `server/data/media-library.json`.
- Delete: `DELETE /api/media/:fileName` calls `deleteLocalImage()`. The item must already be archived, the current home usage map is checked, the physical upload file is deleted with `fs.unlink()`, and the JSON index entry is removed from `server/data/media-library.json`. No MySQL write happens.
- Batch archive/restore/delete: batch handlers call the single-item operations sequentially, so they inherit the same JSON/uploads writes and the same protection limits.
- Register existing local media: `registerLocalImageFile()` can add metadata for an already existing upload file, currently used by module flows such as case Word-image registration. It writes `server/data/media-library.json`.
- Cleanup, duplicate warnings, usage counts, and usages: cleanup filters, duplicate warnings, usage counts, and usage arrays are derived while listing. Duplicate warnings are computed from the JSON index and file stats, not persisted as a separate JSON field. `usageCount` and `usages` are computed from the current home interactive images and home video config; they are not stored in `media-library.json`.

Current write targets:

- `server/data/media-library.json`: upload metadata, displayName/metadata edits, archive/restore status, delete index removal, register-local-file metadata.
- `server/uploads/images`: uploaded image files and deleted image files.
- `server/uploads/videos`: uploaded video files and deleted video files.
- other JSON indexes: current media-library write functions only read home interactive/video configs for usage checks; they do not update cases, solutions, articles, publish logs, route manifests, or sitemap files.
- MySQL `media_files`: not written by the current media-library write path.

### Required Answers Before Write Switching

Current answers from the 22-5C-4 inventory:

- Current upload writes the physical file first, then writes `server/data/media-library.json`.
- Current delete can delete the real upload file from `server/uploads/images` or `server/uploads/videos`.
- Current delete checks only the media service usage map for home interactive images and home video/poster references. It does not fully check cases, solutions, company-assets, articles, scenario detail pages, or shared MySQL ownership.
- Current displayName and metadata edits write `server/data/media-library.json`.
- Current rename is display metadata only; storage file names are not renamed by `updateLocalImageMetadata()`.
- Current archive and restore write status into `server/data/media-library.json`.
- Current batch operations write through the same single-item JSON/uploads operations.
- Current duplicate warnings are computed at read/upload time from the JSON index and file stats; they are not stored as durable JSON state.
- Current usage counts and usage details are computed at read time from home interactive images and home video config; they are not stored as durable JSON state.
- `media-library.json` and uploads can be inconsistent if an upload is interrupted between file write and JSON write, a file is manually removed, a JSON entry points at a missing file, or a local file exists without indexed metadata.
- MySQL `media_files` and `media-library.json` can be inconsistent because the list can read MySQL-first while writes still update only JSON/uploads.
- If the list reads MySQL while writes still write JSON only, uploads and metadata edits may not appear in the MySQL-first list, archive/restore may look stale, and deletes may leave rows that still appear until fallback or repair.
- During a future upload shadow-write phase, MySQL failure should not fail the existing JSON-primary upload. It should be logged, measured, and retried by a repair/shadow tool.
- During a future true dual-write delete, partial failure can create orphaned files, orphaned rows, or missing files with live rows. Delete must be handled last with strict reference protection, idempotent steps, and recoverable tombstone/repair behavior.
- If a media file is referenced by cases, solutions, home, company assets, articles, or scenario pages, deletion should be blocked until references are removed or an explicit migration-safe policy handles the reference.
- If MySQL contains `sharedButReferenced` rows, the backend media-library write path must not update or delete them as normal media-library-owned rows.
- The final target should be a single primary data source, likely MySQL after validation, with JSON export and rollback available during transition. Long-term JSON/MySQL dual-primary should be avoided.

### Write Consistency Risks

The main risks are:

- Split-brain list/write behavior: users can write JSON/uploads while the list shows MySQL rows.
- Stale MySQL rows: displayName, category, archive status, or delete state may differ from JSON.
- Upload visibility gaps: a new upload can be valid in JSON/uploads but absent from the MySQL-first list.
- Shared-row mutation: module-owned rows from cases, solutions, home, or company-assets could be accidentally modified by media-library writes.
- Incomplete reference protection: current media delete protection does not cover all business modules.
- Hard-delete ordering: deleting uploads, JSON, and MySQL in the wrong order can permanently remove files while references or rows remain.
- Fallback ambiguity: if MySQL is partially stale but not failing, fallback may not trigger automatically unless explicit health and freshness checks exist.
- Recovery gaps: without JSON export and MySQL repair tools, failed dual writes can require manual repair.

### Future Write Strategy

The first safe write strategy is JSON primary plus MySQL shadow write:

- Existing JSON/uploads write behavior remains authoritative.
- A thin shadow writer attempts a MySQL upsert after the current JSON write succeeds.
- Shadow failure is non-fatal to the current operation.
- Shadow failures are logged without secrets and should be visible through compare/repair tooling.
- The compare command remains the acceptance gate before any stronger write switch.

True dual write should only come after shadow write has proven stable:

- Operations need idempotent upserts keyed by stable media identity.
- Each operation needs a predictable recovery path.
- Archive/restore and metadata edits are safer than delete because they can be replayed.
- Delete needs tombstones, reference checks, delayed file removal or repair, and strict ownership checks.

MySQL primary plus JSON export is the final convergence model:

- MySQL becomes the single runtime/write source after compare and shadow/dual-write validation pass.
- JSON is generated from MySQL for rollback, export, and emergency recovery.
- JSON is not maintained as a long-term independent primary source.
- Before final cutover, no module should depend on data that cannot be exported back to the existing JSON shape.

### Recommended Operation Order

Recommended order for future implementation:

- Upload can be shadow-written first because JSON/uploads can remain primary and MySQL failure can be non-fatal.
- DisplayName and metadata updates can follow because they are mostly row metadata upserts and can be replayed.
- Archive and restore can follow after status mapping is verified and compare can detect stale status.
- Batch operations should wait until the single-item operation they wrap has a proven shadow path.
- Delete must be last because it can remove physical files and because current reference protection is incomplete.

Deletion prerequisites:

- Expand reference discovery beyond home interactive images and home video.
- Include cases, solutions, company-assets, articles, scenario detail pages, and known shared MySQL ownership signals.
- Treat `sharedButReferenced` rows as protected from normal media-library writes.
- Prefer soft delete / archived / tombstone state before any physical file deletion.
- Provide repair tooling for row-only, JSON-only, and file-only drift.

### Follow-Up Execution Path

The write work should be split into small gates:

- 22-5C-4A: current read-only inventory and write consistency plan.
- 22-5C-4B: add media write shadow/repair tooling that is not connected to official business writes.
- 22-5C-4C: upload remains JSON primary, with MySQL shadow write and compare validation.
- 22-5C-4D: displayName and metadata updates remain JSON primary, with MySQL shadow write.
- 22-5C-4E: archive and restore remain JSON primary, with MySQL shadow write.
- 22-5C-4F: deletion protection and reference-check design, including cases, solutions, home, company-assets, articles, scenario detail pages, and shared MySQL rows.
- 22-5C-4G: small-scope delete dual/shadow write with strict protection, soft-delete/tombstone behavior, and recovery checks.
- 22-5C-4H: media-library write consistency acceptance across upload, metadata, archive/restore, delete, fallback, compare, and rollback.
- 22-5D: cases service switch, separately validated.
- 22-5E: solutions service switch, separately validated.
- 22-5F: decide whether publish logs continue to keep JSON as the primary runtime chain.
- 22-6: MySQL-to-JSON export and rollback rehearsal.

This order keeps destructive operations last, keeps shared-table ownership explicit, and avoids turning media-library into MySQL-only before the write path and rollback path are proven.

## 22-5C-4B Media Write Shadow Tool

22-5C-4B adds a standalone dry-run shadow tool for planning future media-library writes into MySQL `media_files`. It is not connected to `/api/media/list`, upload, delete, displayName/metadata update, archive, restore, batch operations, controllers, routes, frontend UI, or admin UI.

The command is:

```powershell
npm.cmd run shadow:media-write
npm.cmd run shadow:media-write -- --module media-library
npm.cmd run shadow:media-write -- --action upload
npm.cmd run shadow:media-write -- --action metadata
npm.cmd run shadow:media-write -- --action archive
npm.cmd run shadow:media-write -- --action restore
npm.cmd run shadow:media-write -- --action delete
```

The tool is dry-run only:

- reads `server/data/media-library.json` directly without using the official media write service
- reads upload file stats from `server/uploads/images` and `server/uploads/videos` when a safe local path can be derived
- reads MySQL `media_files` with `SELECT`
- generates a future `media_files` upsert/tombstone plan for each JSON media-library record
- reports `insert`, `update`, `skip`, `conflict`, and `warning` decisions
- reports stable-key matching by `public_url`, then `file_path`, then `file_name + file_size`
- keeps raw category and normalized category in the plan
- blocks normal media-library write plans from mutating `sharedButReferenced` or `unknown` MySQL rows
- treats duplicate MySQL matches for one stable key as conflicts
- never writes JSON
- never changes uploads
- never writes MySQL
- recognizes `--write` only to reject it safely

Action semantics are intentionally planning-only:

- default / `all`: plan current-state upserts for every JSON media-library record
- `upload`: model the future JSON-primary upload shadow upsert
- `metadata`: model the future JSON-primary displayName/metadata shadow upsert
- `archive`: model a future archive shadow write with status forced to `archived`
- `restore`: model a future restore shadow write with status forced to `active`
- `delete`: only considers archived JSON records and plans a MySQL soft-delete/tombstone; active records are skipped

The tool does not make any official business endpoint write MySQL. It is an inspection and planning step before 22-5C-4C. The next write implementation step must still keep JSON/uploads as the official write path and should start with upload shadow writes only after this report is reviewed.

## 22-5C-4C Upload Shadow Write

22-5C-4C adds only one official write-side change: after an upload has already succeeded through the existing uploads and `server/data/media-library.json` path, the media service attempts a MySQL shadow upsert into `media_files`.

The upload order remains:

- write the uploaded file under the existing uploads directory
- validate and build the existing media-library JSON record
- write `server/data/media-library.json`
- build the unchanged upload API response object
- attempt MySQL shadow write using that uploaded media record
- return the existing upload API response shape

JSON/uploads remain the upload source of truth in this step. MySQL is not the upload primary source, and upload does not become a JSON/MySQL transaction. If MySQL is not configured, if the connection fails, if the upsert fails, if the uploaded record is missing required fields, or if a matched MySQL row is shared/unknown and unsafe to mutate, the shadow writer logs a throttled warning and the upload response still succeeds.

The shadow writer writes only `media_files` and only from the upload-success path. It uses stable-key matching in this order:

- `public_url` / uploaded `url`
- `file_path`
- `file_name + file_size`

Inserted or updated shadow rows keep media-library ownership metadata in `metadata_json`, including:

- `moduleName: media-library`
- `sourceKey`
- `displayName` / `title`
- `fileType`
- `ownerType`, `ownerId`, `ownerSlug`, `groupKey`, `slotNo`
- `caption`, `enabled`, `sortOrder`, `createdAt`
- `normalizedCategory`
- `shadowWrite: true`
- `shadowWriteStage: 22-5C-4C`
- `sourceRecord`

The upload response structure is unchanged. No frontend or admin UI field is added, and MySQL shadow status is not exposed as an upload success condition.

The following operations remain on the original JSON/uploads path and are not switched in 22-5C-4C:

- delete
- rename / displayName update
- metadata update
- archive
- restore
- batch archive/restore/delete

22-5C-4D may consider displayName/metadata shadow write as a separate step. Delete protection, reference checks, tombstone behavior, and physical file deletion remain later work and must not be folded into the upload shadow-write step.

## 22-5C-4D Metadata Shadow Update

22-5C-4D adds only the metadata/displayName shadow update after the existing JSON metadata update succeeds. The official metadata write path remains `server/data/media-library.json`; MySQL is still a non-blocking shadow target.

The metadata update order remains:

- validate the existing upload file
- apply the existing metadata/displayName/category/owner fields supported by `PATCH /api/media/:fileName`
- write `server/data/media-library.json`
- build the unchanged metadata update API response object
- attempt a MySQL metadata-only shadow update
- return the existing API response shape

The MySQL shadow update uses the same stable-key priority as the upload shadow writer:

- `public_url` / current media `url`
- `file_path`
- `file_name + file_size`

The metadata shadow update is intentionally narrower than the upload shadow write. It may update metadata-oriented fields such as:

- `original_name`
- `category`
- `alt_text`
- `description`
- `status`
- `metadata_json`

It must not overwrite file identity or storage fields:

- `public_url`
- `file_path`
- `file_name`
- `file_size`
- `mime_type`
- `storage_provider`
- `created_at`

`metadata_json` is merged with the existing MySQL metadata where available and keeps:

- `moduleName: media-library`
- `sourceRecord`
- `ownerType`, `ownerId`, `ownerSlug`, `groupKey`, `slotNo`
- `caption`, `enabled`, `sortOrder`
- `normalizedCategory`
- `shadowWrite: true`
- `shadowWriteStage: 22-5C-4D`
- `lastShadowAction: metadata`

If MySQL is not configured, the matched row is missing, the matched row is `sharedButReferenced`, the ownership is unknown, ownership signals conflict, or the update fails, the shadow writer logs a throttled warning and the JSON metadata update remains successful. MySQL shadow status is not exposed through the API response.

22-5C-4C upload shadow write remains in place. 22-5C-4D does not change upload's JSON/uploads primary behavior, delete, archive, restore, batch operations, `/api/media/list`, frontend UI, admin UI, route manifest, sitemap, prerender, publish logs, cases, solutions, articles, or scenario detail pages.

22-5C-4E may consider archive/restore shadow write as a separate step. Delete protection and physical file deletion remain later work.

## 22-5C-4E Archive / Restore Shadow Status Update

22-5C-4E adds only the single-item archive/restore shadow status update after the existing JSON status update succeeds. The official archive/restore write path remains `server/data/media-library.json`; MySQL is still a non-blocking shadow target.

The single-item archive order remains:

- run the existing home usage protection
- write `status: archived` to `server/data/media-library.json`
- build the unchanged archive API response object
- attempt a MySQL status-only shadow update to `status = archived`
- return the existing API response shape

The single-item restore order remains:

- write `status: active` to `server/data/media-library.json`
- build the unchanged restore API response object
- attempt a MySQL status-only shadow update to `status = active`
- return the existing API response shape

The shadow status update uses the same stable-key priority as the upload and metadata shadow writers:

- `public_url` / current media `url`
- `file_path`
- `file_name + file_size`

The status shadow update only changes:

- `status`
- `metadata_json`

`updated_at` is advanced by the table's normal update behavior. The shadow status update does not overwrite file identity or storage fields:

- `public_url`
- `file_path`
- `file_name`
- `file_size`
- `mime_type`
- `storage_provider`
- `created_at`

`metadata_json` is merged with the existing MySQL metadata where available and keeps:

- `moduleName: media-library`
- `sourceRecord.status`
- `shadowWrite: true`
- `shadowWriteStage: 22-5C-4E`
- `lastShadowAction: archive` or `lastShadowAction: restore`

If MySQL is not configured, the matched row is missing, the matched row is `sharedButReferenced`, ownership is unknown, ownership signals conflict, or the update fails, the shadow writer logs a throttled warning and the JSON archive/restore operation remains successful. MySQL shadow status is not exposed through the API response.

22-5C-4E does not change upload's JSON/uploads primary behavior, metadata/displayName JSON primary behavior, delete, batch operation semantics, `/api/media/list`, frontend UI, admin UI, route manifest, sitemap, prerender, publish logs, cases, solutions, articles, or scenario detail pages. Batch archive/restore remain outside this step and are kept on the original JSON-only behavior.

22-5C-4F may consider deletion protection design. Delete and physical file removal remain later work and are not touched by 22-5C-4E.

## 22-5C-4F Media Delete Protection Design

22-5C-4F is a design and risk-boundary step only. It does not change the formal delete execution path, does not delete upload files, does not remove JSON records, does not write MySQL, does not change upload, metadata/displayName, archive/restore, batch operations, `/api/media/list`, frontend UI, admin UI, route manifest, sitemap, prerender, publish logs, cases, solutions, articles, or scenario detail pages.

### Current Delete Chain

The current single delete entry point is `deleteLocalImage(fileName)` in `server/src/services/media/media.service.ts`, exposed by `DELETE /api/media/:fileName`.

Current single delete behavior:

- validates the requested file name
- runs `assertNotUsedByHomeInteractive(fileName)`
- reads `server/data/media-library.json`
- requires the media JSON status to be `archived`
- deletes the physical upload file from `server/uploads/images` or `server/uploads/videos` with `fs.unlink`
- removes the entry from `server/data/media-library.json`
- returns `{ fileName, deletedFile, removedFromIndex, fileMissing }`

The current batch delete entry point is `batchDeleteLocalImages(fileNames)`. It loops over file names, checks each item is `archived`, then calls `deleteLocalImage(fileName)` for each item. Batch delete therefore inherits the same upload-file deletion, JSON removal, and limited usage protection as the single delete function.

The admin UI also checks `image.usageCount > 0` before showing permanent delete, but that count comes from the same limited server usage map. The UI confirmation correctly warns that permanent delete removes the real server file, but it is not a full reference guard.

### Current Usage Coverage

The current usage map is built by `getMediaUsagesByFileName()` and only covers:

- `home-interactive-images`: `slot.mediaFileName` and file name parsed from `slot.mediaUrl`
- `home-video`: `videoFileName`
- `home-video`: `posterFileName`

The current usage map does not fully cover:

- company-assets
- cases cover images
- case_images
- images embedded in case `contentHtml`
- solutions cover images
- solution_groups-derived media ownership
- solution_media_items
- solution_pages / scenario detail pages
- page editor blocks and page content
- articles cover images
- article content and article blocks
- SEO / Open Graph images
- contact-info QR codes, social QR codes, and public company assets
- MySQL `media_files` rows classified as `sharedButReferenced`, `unknown`, or ownership-conflicted

Because these sources are not covered by the current delete guard, `usageCount = 0` and `usages = []` are not enough to prove that a file is safe to delete.

### Required Reference Scan

A future delete guard must be read-only and must scan both JSON and MySQL reference surfaces before any physical delete is attempted.

At minimum, the guard must check:

- `home-video`: JSON config and MySQL `home_video.video_media_id`, `poster_media_id`, `video_url`, and `poster_url`
- `home-interactive-images`: JSON config and MySQL `home_interactive_images.media_id` / `image_url`
- `company-assets`: `company-assets.json`, MySQL `company_assets.media_id` / `media_url`, and public asset URLs
- `cases`: `cases.json` cover fields, `contentHtml` embedded upload URLs, MySQL `cases.cover_media_id` / `cover_url`, and case raw JSON
- `case_images`: MySQL `case_images.media_id` / `image_url`
- `solutions`: `solutions.json` cover and media fields, MySQL `solutions.cover_media_id` / `cover_url`, and raw JSON
- `solution_groups`: group ownership context so grouped media cannot be deleted only because the file appears media-library-like
- `solution_media_items`: MySQL `solution_media_items.media_id`, `media_url`, and `media_file_name`
- `scenario-detail-pages`: JSON scenario detail media fields such as `posterUrl` and embedded block/media URLs
- `pages`: page editor block JSON and any rich-text or media URL fields
- `articles`: article cover fields, content, article blocks, and MySQL `articles.cover_media_id` / `cover_url`
- `seo_settings`: MySQL `og_image_media_id` / `og_image_url`
- `contact-info` / social QR / assets: public QR image URLs and related media-library rows, including seeded QR assets

The scan should match by stable media identity, not by only one string:

- `public_url` / JSON `url`
- `file_path`
- file name parsed from URLs
- `file_name + file_size`
- MySQL `media_files.id` when a module has a media foreign key

### Delete Protection Decisions

Delete should be blocked when:

- media status is not `archived`
- `usageCount > 0` or `usages` is not empty
- any read-only global reference scan finds a JSON or MySQL reference
- MySQL identifies the row as `sharedButReferenced`
- MySQL ownership is `unknown`
- MySQL ownership signals conflict
- stable keys do not match between JSON, upload file, and MySQL
- the upload file does not exist, is outside the expected upload directory, or does not match JSON metadata
- the media belongs to home, company assets, cases, solutions, articles, pages, scenario detail pages, SEO, contact QR, or another module-owned context

Delete should be `needs_review` when:

- MySQL is unavailable and the guard cannot complete the cross-store reference scan
- MySQL has no matching row but JSON/upload metadata indicates module ownership
- JSON has no record but the upload file exists
- JSON points to a missing file
- multiple MySQL rows match the same stable key
- a file is a public/static asset rather than a managed upload
- a module reference is found only through rich-text or raw JSON where ownership cannot be resolved automatically

Delete can be considered `allowed` only when all of these are true:

- JSON status is `archived`
- current `usageCount` is `0`
- current `usages` is empty
- read-only global reference scan finds no references
- MySQL has no `sharedButReferenced`, `unknown`, or ownership-conflict signal for the stable media identity
- JSON record, upload file, and MySQL record have consistent stable keys
- upload file exists under the expected upload directory
- the row is not home, company, case, solution, article, page, scenario, SEO, QR, or other shared/module-owned media

Until that full guard exists, deletion should prefer archive over permanent delete. Any incomplete reference coverage should become `blocked` or `needs_review`, not `allowed`.

### Future 22-5C-4G Design

22-5C-4G may introduce a read-only delete guard and delete-protection report before connecting any new delete behavior. A future report can include `blocked`, `needs_review`, and `allowed` counts, reference reasons, coverage by module, and stable-key diagnostics.

Only after the guard is accepted should a later delete implementation consider:

- keeping JSON/uploads as the primary delete path while the transition is still in progress
- marking MySQL rows as deleted or tombstoned by shadow write rather than hard-deleting rows
- deciding whether MySQL failure blocks delete for shared or uncertain ownership cases
- refusing to delete the physical upload file until reference protection passes
- handling partial failures such as JSON success but file delete failure, file delete success but JSON failure, or JSON/uploads success but MySQL tombstone failure
- providing repair reports for JSON-only, file-only, and MySQL-only drift

This step does not implement those behaviors because current delete is destructive. Adding execution before full reference coverage would risk removing files still used by cases, solutions, pages, articles, home, company assets, SEO, or QR/contact surfaces.

22-5C-4F therefore changes no data and no execution path. It only documents the required protection boundary for a later 22-5C-4G delete guard / shadow delete step.

## 22-5C-4G Delete Guard / Risk Report

22-5C-4G adds a read-only delete guard report to the existing shadow media write tool. It does not change the formal delete execution path, does not delete upload files, does not remove or rewrite `server/data/media-library.json`, does not write MySQL, does not change upload, metadata/displayName, archive/restore, batch operations, `/api/media/list`, frontend UI, admin UI, route manifest, sitemap, prerender, publish logs, cases, solutions, articles, or scenario detail pages.

The command is:

```powershell
npm.cmd run shadow:media-write -- --action delete
npm.cmd run shadow:media-write -- --action delete --target /uploads/images/example.jpg
npm.cmd run shadow:media-write -- --action delete --target example.jpg
```

`--write` remains disabled and is still rejected safely:

```powershell
npm.cmd run shadow:media-write -- --write
```

The delete risk report reads only:

- `server/data/media-library.json`
- upload file existence and stat information
- business JSON sources under `server/data`
- MySQL `media_files`

The report adds `deleteProtection` with:

- `summary.checkedCount`
- `summary.blockedCount`
- `summary.needsReviewCount`
- `summary.safeCandidateCount`
- `summary.archivedCount`
- `summary.activeCount`
- `summary.missingUploadFileCount`
- `summary.referencedCount`
- `summary.unknownCoverageCount`
- per-source coverage flags and coverage details
- per-item decision, reasons, references, MySQL status/ownership, and upload-file status

Reference scanning covers the current JSON surfaces for:

- home-video
- home-interactive-images
- company-assets
- cases and case image URLs embedded in case content
- solutions, solution groups, and solution media items
- scenario-detail-pages
- pages
- articles and SEO / Open Graph-like URL fields present in article JSON
- contact-info
- social QR and public seeded media assets when the seed JSON is present

The MySQL side is limited to `media_files` for this step. It checks stable-key matching, current MySQL status, `sharedButReferenced`, `unknown`, and ownership-conflict signals. It does not query module foreign-key tables such as `case_images`, `solution_media_items`, or `seo_settings`; those remain part of the future formal delete guard design if 22-5C-4H connects the guard to the delete path.

Decision rules are conservative:

- `blocked`: status is not `archived`, any reference is found, or the matched MySQL row is `sharedButReferenced`.
- `needs_review`: reference coverage is incomplete, upload file is missing, MySQL row is missing, multiple MySQL rows match, MySQL ownership is unknown, ownership conflicts, JSON/uploads/MySQL stable keys do not align, or source metadata has warnings.
- `safe_candidate`: the item is archived, no references are found, coverage is complete, the upload file exists, MySQL ownership is not shared/unknown/conflicted, and JSON/uploads/MySQL stable keys align.

`safe_candidate` is not permission to delete. It is only a dry-run candidate status for later human review and for a future formal guard acceptance step. The report intentionally avoids terms such as `allowed_delete`, `can_delete`, or `ready_to_delete`.

If 22-5C-4H proceeds, it may consider connecting a read-only guard to the formal delete path before any destructive operation. True delete shadow write, MySQL tombstone behavior, and any JSON/uploads delete sequencing remain later work and are not implemented in 22-5C-4G.
