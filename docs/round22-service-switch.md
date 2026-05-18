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
