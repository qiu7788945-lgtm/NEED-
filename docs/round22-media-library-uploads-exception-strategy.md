# Round 22 Media Library / Uploads Exception Strategy

This document records the Round 22-7-6-3 media-library / uploads exception strategy.

It is a documentation landing step only. It does not change business code, routes, services, schemas, migrations, MySQL data, `server/data/**/*.json`, `server/uploads/**`, export behavior, backup or rollback behavior, JSON fallback behavior, or Round 23 permissions.

## 1. Status

`media-library` and uploads are accepted as a Round 22 asset-layer exception.

This exception is not single-source completion. It is a risk acceptance and boundary freeze that lets Round 22 continue discussing low-risk content modules without pretending that media assets, physical files, delete recovery, or media ownership are solved.

The exception is not enough to enter Round 23 by itself. Round 22-8 total acceptance must explicitly review and accept the media risk treatment before any later permission round can use this exception as a prerequisite.

## 2. Why media-library / uploads cannot be treated as normal content modules

Normal content modules can be evaluated by comparing structured JSON records with MySQL rows and by preserving a reversible JSON shape.

`media-library` is different because the visible admin media library depends on:

- metadata in `server/data/media-library.json`
- physical image files under `server/uploads/images`
- physical video files under `server/uploads/videos`
- file stat, byte size, dimensions, and detected MIME information
- duplicate warnings
- runtime usage and reference checks
- shared `media_files` rows that may belong to multiple business modules

Physical files cannot be recreated from JSON metadata alone. They also cannot be recreated from MySQL rows alone.

## 3. Current roles

### 3.1 media-library.json

`server/data/media-library.json` remains the metadata safety anchor.

It must be retained. It must not be frozen, deleted, or treated as first-phase rollback-eligible content while the media exception is active.

It can be backed up as metadata with special handling, but it is not an ordinary content rollback source for the first-phase JSON rollback path.

### 3.2 server/uploads/images and server/uploads/videos

`server/uploads/images` and `server/uploads/videos` remain the physical file sources.

Uploads are outside the current first-phase JSON backup and rollback rehearsal scope. They need a separate backup and restore strategy before any complete rollback or single-source closure claim.

### 3.3 media_files

`media_files` is a shared metadata, index, and reference table.

It is not a media-library-only table. It can support metadata, ownership hints, stable keys, references, and compare checks, but it must not be treated as the only source for `media-library`.

The project must not directly export all `media_files` rows back into `media-library.json`.

## 4. Ownership classification

Current code and prior Round 22 decisions use conservative ownership classes for `media_files`.

### 4.1 likelyMediaLibrary

Rows may be considered likely media-library candidates when metadata provides enough media-library signals, such as `metadata_json.moduleName`, `metadata_json.sourceRecord.moduleName`, or media-library-style source metadata.

These rows can be candidates for read-only media-library list behavior, but they still do not prove that full export, delete, rollback, or primary write is safe.

### 4.2 sharedButReferenced

Rows classified as `sharedButReferenced` belong to, or are strongly associated with, business module references such as home, company assets, cases, solutions, articles, pages, scenario detail pages, or solution page data.

They must not be mutated, exported, deleted, or tombstoned as normal media-library-owned rows.

### 4.3 unknown

Rows with insufficient ownership metadata are `unknown`.

Unknown ownership blocks MySQL-only media-library reads when the adapter cannot safely decide the official list, and it blocks media-library export, delete double-write, JSON freeze / delete, and single-source closure.

### 4.4 why ownership report is required

The existing classification logic is not a full ownership report.

A dedicated ownership report must come before:

- media-library export implementation
- media-library MySQL primary write
- delete double-write
- JSON freeze / delete
- global `export --write`
- any Round 23 entry decision based on media closure

Round 22-7-6-5 lands the ownership report design in [Round 22 Media Files Ownership Report Design](./round22-media-files-ownership-report.md). That document is design-only: implementation, report output, media-library export, delete double-write, JSON freeze / delete, and Round 23 treatment remain deferred.

## 5. Business references and shared physical files

`media_files` and upload URLs can be referenced by many modules:

- `home-video`: `video_media_id`, `poster_media_id`, `videoUrl`, `posterUrl`
- `home-interactive-images`: `media_id`, `mediaUrl`, `imageUrl`
- `company-assets`: `media_id`, `media_url`, `imageUrl`
- `cases`: `cover_media_id`, `coverUrl`, `case_images.media_id`, `case_images.image_url`, rich text upload URLs, raw JSON
- `solutions`: `cover_media_id`, `coverUrl`, `solution_media_items.media_id`, `mediaUrl`, `media_url`, raw JSON
- `articles`: cover fields, article content, article blocks, and SEO image references
- `pages`, `scenario-detail-pages`, `solution_pages`, and `solution_page_blocks`: deferred or future media references
- `seo_settings`: `og_image_media_id` and image URLs

A single physical file can be referenced by more than one module. Therefore, deleting a media-library item can accidentally delete a file that business content still uses.

The current delete guard is not complete enough for full business-module, rich-text, raw-json, MySQL foreign-key, and SEO-reference coverage.

## 6. Uploads backup boundary

A future uploads backup strategy must cover at least:

- `server/uploads/images`
- `server/uploads/videos`

If later thumbnail, derived, temporary, or object-storage directories exist, they must be inventoried separately.

The backup manifest should record at least:

- relative path
- SHA-256 file hash
- byte size
- MIME type
- dimensions when detectable
- original file name and display name mapping when available
- restore target
- missing file report
- orphan file report
- consistency report between `media-library.json` and physical files

Public assets are not the same as uploads. If public assets are referenced by content, they need a reference inventory, not silent inclusion in the uploads backup scope.

## 7. Uploads restore boundary

The first uploads restore phase should be temp-only.

Formal restore over the real uploads directories must be deferred until a later explicit strategy accepts the risks.

The restore design must:

- avoid automatically overwriting existing files
- produce conflict reports
- verify hashes
- report missing physical files
- report orphan physical files
- compare restored files with `media-library.json`
- compare restored files with `media_files`

When physical files, `media-library.json`, and `media_files` disagree:

- the backup manifest and file hashes are the physical-file facts
- `media-library.json` is the metadata safety anchor
- `media_files` is an index and reference aid

Manual repair must be required until a later repair / replay strategy is accepted.

## 8. Delete recovery / tombstone boundary

Delete is the highest-risk media operation.

Current delete behavior requires the item to be archived, deletes the physical upload file, and removes the JSON index entry. Physical deletion cannot be recovered by JSON rollback or MySQL rollback.

Delete double-write is forbidden in the current Round 22 boundary.

Before delete can move toward single-source closure, the project needs:

- strict archived-only behavior
- complete usage and shared-reference guard coverage
- MySQL tombstone policy
- deleted file quarantine instead of direct permanent removal
- soft-delete window
- physical backup before delete
- delete dry-run / impact report
- restore and recovery policy
- manual repair path for mismatches

## 9. Deferred items

The following items are deferred:

- media_files ownership report
- uploads backup / restore temp-only strategy
- delete recovery / tombstone / quarantine strategy
- media-library export implementation
- media-library MySQL primary write
- delete double-write
- formal rollback for media assets
- global `export --write`
- JSON freeze / delete

## 10. What is explicitly forbidden in Round 22

Current Round 22 must not:

- implement media-library export
- implement media-library MySQL primary write
- implement delete double-write
- delete `server/data/media-library.json`
- delete or replace `server/uploads/**`
- treat `media_files` as the only media-library source
- open global `export --write`
- close JSON fallback
- freeze or delete JSON
- enter Round 23 from this step alone
- execute formal rollback
- run real upload / delete / archive / restore / metadata API tests as part of this documentation step

## 11. What can continue

Low-risk and medium-risk content module work can continue when it does not claim to solve media-library / uploads.

Examples include content modules such as contact info, home interactive images, company assets, and home video, provided each step keeps its own JSON fallback, backup, rollback, export, validation, and write boundaries.

These content module successes must not be generalized to media-library / uploads.

## 12. Impact on JSON freeze / delete

JSON freeze and JSON deletion remain forbidden.

`media-library.json` must remain available as metadata safety anchor and emergency reference. JSON fallback must remain available while media ownership, physical backup / restore, delete recovery, and formal rollback remain unresolved.

## 13. Impact on export --write

Global `export --write` remains disabled.

The media exception blocks global write mode because media-library export is deferred, uploads backup / restore is not implemented, formal rollback is not complete, delete recovery is not accepted, and unknown or shared ownership may still exist.

Any future write mode must explicitly define whether media-library is excluded, module-scoped, or still blocked.

## 14. Impact on Round 23

Round 23 must not start only because this exception strategy exists.

Before Round 23 can use this media exception, Round 22-8 total acceptance must confirm:

- media-library / uploads exception strategy is landed
- `media-library.json` is retained
- uploads are retained
- `media_files` is only metadata / index / reference aid
- media-library export remains deferred with explicit reason
- media-library primary write remains deferred with explicit reason
- delete double-write remains deferred with explicit reason
- ownership report follow-up is numbered
- uploads backup / restore follow-up is numbered
- delete recovery / tombstone follow-up is numbered
- `export --write` remains disabled
- fallback remains enabled
- JSON freeze / delete is still forbidden
- the media risk treatment is explicitly accepted

## 15. Required follow-up steps

These follow-up numbers are route markers only. They are not implemented by this document.

- Round 22-7-6-4: media_files ownership report design
- Round 22-7-6-5: media_files ownership report documentation landing
- Round 22-7-6-5A: media_files ownership report implementation boundary confirmation
- Round 22-7-6-5B: media_files ownership report read-only implementation
- Round 22-7-6-5C: ownership report result acceptance and blocker matrix judgment
- Round 22-7-6-6: uploads backup / restore temp-only strategy design
- Round 22-7-6-7: delete recovery / tombstone / quarantine strategy design
- Round 22-7-7: JSON freeze condition decision
- Round 22-8: Round 22 total acceptance
