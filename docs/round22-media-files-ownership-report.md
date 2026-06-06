# Round 22 Media Files Ownership Report Design

This document records the Round 22-7-6-5 media_files ownership report design landing.

It is a documentation landing step only. It does not implement the report, does not change business code, does not query or write MySQL, does not modify `server/data/**/*.json`, does not modify `server/uploads/**`, does not run API write tests, does not run export, does not run `build:prerender`, does not run backup or rollback, and does not create generated artifacts.

## 1. Purpose

The ownership report exists to classify media assets before any later media-library export, media-library delete double-write, JSON freeze / delete, global `export --write`, or Round 23 decision can treat media as closed.

The report must answer:

- which files are likely owned by media-library
- which files are owned by business modules
- which files are shared references
- which files have unclear ownership

Hard principles:

- unclear ownership cannot be exported
- unclear ownership cannot enter delete double-write
- `sharedButReferenced` files cannot be handled as media-library-exclusive assets
- `businessOwned` files cannot be overwritten, exported, tombstoned, or deleted by a media-library flow
- the report design can exist before implementation
- missing report implementation does not block Round 22 exception closure by itself
- missing report implementation must remain a deferred media risk for Round 22-8 total acceptance

## 2. Current status

Current status:

- this document is design only
- ownership report implementation is deferred
- no ownership report output directory is created by this step
- no generated report artifact should be committed
- media-library export remains disabled
- media-library delete double-write remains disabled
- global `export --write` must not include media-library as a closed module
- JSON freeze / delete must not cover media-library
- Round 23 must not treat media-library as an ordinary migrated module

`media_files` remains a metadata, index, and reference aid. It is not the unique source of media-library truth.

## 3. Why ownership report is required

Media-library is not a normal JSON content module because it spans:

- `server/data/media-library.json`
- `server/uploads/images`
- `server/uploads/videos`
- `media_files`
- business module media references
- rich text URLs
- SEO / OG image references
- physical file state

MySQL rows cannot recreate missing physical uploads. JSON metadata cannot prove that a file is safe to delete. A single physical file may be referenced by media-library and one or more business modules.

The ownership report is therefore required before the project can safely decide media export, delete recovery, physical backup, JSON freeze, or Round 23 treatment.

## 4. Ownership classes

### 4.1 likelyMediaLibrary

The file has enough media-library signals to be treated as a likely media-library candidate.

Signals may include:

- media-library metadata in `media-library.json`
- `metadata_json.moduleName` indicating media-library ownership
- `metadata_json.sourceRecord.moduleName` indicating media-library ownership
- stable URL or path match against media-library index data
- `ownerType` or `groupKey` patterns accepted by a later implementation design
- physical file exists

This class may support read-only list comparison later. It does not by itself allow export, delete, primary write, or rollback.

### 4.2 businessOwned

The file is owned by, or directly tied to, a business module.

Example modules include:

- `home-video`
- `home-interactive-images`
- `company-assets`
- `cases`
- `case_images`
- `solutions`
- `solution_media_items`
- `articles`
- `pages`
- `scenario-detail-pages`
- `solution_pages`
- `solution_page_blocks`
- `seo_settings`

Business-owned files must not be exported or deleted by a media-library-exclusive path.

### 4.3 sharedButReferenced

The file is referenced by more than one module or has evidence that the same physical file is shared across media-library and business content.

This class is a write and delete blocker for media-library-exclusive operations. It can only become actionable after a later shared-reference policy defines ownership, delete guard behavior, backup, tombstone, and recovery rules.

### 4.4 unknown

The file has insufficient or ambiguous ownership metadata.

`unknown` is a blocker. Unknown ownership blocks media-library export, delete double-write, JSON freeze / delete coverage, global `export --write` inclusion, and single-source closure claims.

### 4.5 orphanCandidate

The physical file exists, but no accepted JSON or MySQL reference clearly owns it.

`orphanCandidate` must be evaluated with uploads backup / restore. It is not safe to delete solely because it appears orphaned.

### 4.6 missingPhysicalFile

Metadata or database references exist, but the physical upload file is missing.

`missingPhysicalFile` is an export, backup, restore, and delete blocker. It must be reported before any write or delete path can proceed.

### 4.7 missingMetadata

The physical file exists, but metadata is missing or too incomplete to classify ownership.

This class should usually produce warnings and may become a blocker when export, delete, backup, or restore needs the missing metadata.

### 4.8 conflict

The available facts disagree.

Examples:

- `media-library.json` and `media_files` point to different metadata for the same stable key
- source module metadata conflicts with business references
- file hash, path, MIME, or size evidence conflicts with stored metadata
- duplicate stable keys would affect a write or delete path

`conflict` is a blocker until manually resolved or accepted by a later explicit policy.

## 5. Ownership record schema

Future ownership report records should use this schema shape:

```json
{
  "mediaFileId": "string | number | null",
  "stableKey": "string",
  "ownershipClass": "likelyMediaLibrary | businessOwned | sharedButReferenced | unknown | orphanCandidate | missingPhysicalFile | missingMetadata | conflict",
  "confidence": "high | medium | low",
  "reasonCodes": ["string"],
  "fileName": "string | null",
  "displayName": "string | null",
  "publicUrl": "string | null",
  "filePath": "string | null",
  "relativePath": "string | null",
  "physicalExists": "boolean",
  "fileHash": "string | null",
  "sizeBytes": "number | null",
  "mimeType": "string | null",
  "dimensions": {
    "width": "number | null",
    "height": "number | null"
  },
  "mediaLibraryJsonMatched": "boolean",
  "mediaFilesMatched": "boolean",
  "referencedByModules": ["string"],
  "referencedByRecords": [
    {
      "module": "string",
      "recordId": "string | null",
      "slug": "string | null",
      "field": "string | null",
      "referenceType": "media_id | url | rich_text | seo_og | unknown"
    }
  ],
  "sourceModule": "string | null",
  "sourceRecordId": "string | null",
  "sourceRecordSlug": "string | null",
  "ownerType": "string | null",
  "groupKey": "string | null",
  "metadataJson": "object | null",
  "warnings": ["string"],
  "blockers": ["string"],
  "recommendedAction": "string"
}
```

`fileHash` may be nullable in an initial read-only design, but a later backup / restore / delete readiness step should require a verified hash before treating a physical file as recoverable.

## 6. Reason codes

The report should support at least these reason codes:

- `metadata_module_match`
- `source_record_module_match`
- `media_library_json_match`
- `physical_file_exists`
- `referenced_by_home_video`
- `referenced_by_home_interactive`
- `referenced_by_company_assets`
- `referenced_by_cases`
- `referenced_by_solutions`
- `referenced_by_articles`
- `referenced_by_pages`
- `referenced_by_rich_text`
- `referenced_by_og_image`
- `shared_reference_detected`
- `unknown_module`
- `missing_physical_file`
- `missing_media_library_index`
- `missing_media_files_row`
- `conflicting_metadata`
- `duplicate_physical_file`
- `unsafe_delete_candidate`
- `stable_key_match`
- `url_match`
- `media_id_match`
- `file_hash_match`
- `file_hash_mismatch`
- `orphan_physical_file`
- `missing_hash`
- `deleted_at_present`
- `status_archived`

Future implementation may add codes, but it must not collapse blockers into generic warnings.

## 7. Blocker / warning matrix

| Condition | Severity | Blocks export | Blocks delete double-write | Blocks JSON freeze / delete | Notes |
| --- | --- | --- | --- | --- | --- |
| `unknown` ownership | blocker | Yes | Yes | Yes | Cannot prove safe ownership. |
| `sharedButReferenced` treated as media-library-exclusive | blocker | Yes | Yes | Yes | Shared assets need separate policy. |
| `businessOwned` selected for media-library export / delete | blocker | Yes | Yes | Yes | Media-library must not overwrite business ownership. |
| Physical file missing for export / backup / delete | blocker | Yes | Yes | Yes | Metadata alone is not recoverable media. |
| Metadata conflicts with physical file facts | blocker | Yes | Yes | Yes | Requires manual resolution or accepted policy. |
| `media-library.json` conflicts with `media_files` | blocker | Yes | Yes | Yes | Source mismatch cannot be hidden. |
| Delete candidate has no physical backup | blocker | No | Yes | Yes | Delete recovery would be impossible. |
| Delete candidate has no usage guard | blocker | No | Yes | Yes | Shared reference risk is unresolved. |
| Delete candidate has no tombstone / quarantine | blocker | No | Yes | Yes | Recovery path is missing. |
| Rich text or SEO / OG references are not scanned | blocker | Yes | Yes | Yes | Hidden references can keep files in use. |
| Duplicate stable key participates in write / delete | blocker | Yes | Yes | Yes | Duplicate resolution is required. |
| `displayName` missing | warning | No | No | No | Should be preserved when available. |
| Dimensions missing | warning | No | No | No | May become blocker for backup acceptance. |
| MIME is inferred only | warning | No | No | No | Record derivation source. |
| Hash not computed | warning | No | No | No | Becomes blocker for backup / delete readiness. |
| `media_id` missing but URL matches | warning | No | No | No | Keep both match facts visible. |
| `media_files` row exists without media-library index | warning | No | No | No | May become `businessOwned`, `unknown`, or orphan risk. |
| Optional metadata is stale | warning | No | No | No | Do not hide drift. |
| `sourceRecord` partially missing | warning | No | No | No | May lower confidence. |

## 8. Output directory and report files

Future implementation should write local audit reports under:

```text
server/data-reports/media-ownership/<YYYYMMDD-HHmmss>/
```

Expected files:

- `ownership-summary.json`
- `ownership-records.json`
- `ownership-blockers.json`
- `ownership-warnings.json`
- `ownership-orphans.json`
- `ownership-missing-files.json`
- `ownership-shared-references.json`
- `ownership-risk-matrix.json`
- `ownership-readable-summary.md`

Rules:

- the directory should be added to `.gitignore` before implementation
- report files are local audit artifacts
- report files must not be committed
- report implementation requires separate later authorization

## 9. Relationship with uploads backup / restore

The ownership report is a prerequisite input for uploads backup / restore design.

The report should provide:

- relative path
- physical existence
- file hash
- byte size
- MIME type
- dimensions when detectable
- media-library metadata match status
- `media_files` match status
- orphan candidates
- missing file candidates
- shared reference candidates

Uploads backup should use the ownership report to decide which files need manifest coverage and which files are blockers or warnings. Uploads restore should begin as temp-only and must not overwrite real upload directories until a later explicit strategy accepts that risk.

Round 22-7-6-7 lands the uploads backup / restore temp-only design in [Round 22 Uploads Backup / Restore Temp-Only Design](./round22-uploads-backup-restore-temp-only.md). The ownership report remains the ownership decision surface; the uploads backup manifest is the physical-file recovery surface. If ownership report implementation remains deferred, uploads backup may only run in conservative mode.

Round 22-7-6-9 lands the delete recovery / tombstone / quarantine strategy in [Round 22 Delete Recovery / Tombstone / Quarantine Strategy](./round22-delete-recovery-tombstone-quarantine.md). The ownership report remains a prerequisite for delete dry-run and delete recovery, while delete recovery, tombstone, quarantine, and permanent delete implementation remain deferred.

## 10. Relationship with delete recovery / tombstone / quarantine

The ownership report is a prerequisite for delete recovery.

A delete candidate must be:

- ownership clear
- not `sharedButReferenced`
- not `unknown`
- not `businessOwned` unless a business-module delete policy owns the operation
- backed by a physical file backup
- covered by usage guards
- covered by tombstone metadata
- protected by quarantine or a soft-delete window

Without these facts, delete double-write remains forbidden.

The delete recovery / tombstone / quarantine strategy is landed separately in [Round 22 Delete Recovery / Tombstone / Quarantine Strategy](./round22-delete-recovery-tombstone-quarantine.md). It confirms that `canDelete` defaults to `false`, `unknown`, `sharedButReferenced`, and `conflict` are blockers, `businessOwned` cannot be deleted by media-library delete, and `orphanCandidate` needs backup plus quarantine before it can become a delete candidate.

## 11. Relationship with JSON freeze / delete

JSON freeze / delete must not cover media-library while ownership report implementation is deferred.

`server/data/media-library.json` remains the metadata safety anchor. It must be retained while ownership, uploads backup / restore, delete recovery, and media rollback are unresolved.

## 12. Relationship with export --write

Global `export --write` must not treat media-library as part of the closed export scope while the ownership report is not implemented and accepted.

Any future write mode must explicitly state whether media-library is:

- excluded from write mode
- handled by a separate media-specific write mode
- still blocked

The default while this report is deferred is blocked.

## 13. Relationship with Round 22 final validation

Round 22-8 total acceptance must check:

- ownership report design is landed
- ownership report implementation is still deferred or separately accepted
- deferred media risk is explicitly accepted
- media-library export remains deferred
- delete double-write remains forbidden
- `export --write` remains disabled for media-library
- JSON freeze / delete cannot cover media-library
- `media-library.json` is retained
- uploads are retained
- `media_files` remains only an auxiliary metadata / index / reference aid

If Round 22-8 accepts the media exception, it must do so explicitly. Silent acceptance is not enough.

## 14. Relationship with Round 23

Round 23 must not treat media-library as an ordinary migrated module only because the exception strategy or this design exists.

Before Round 23 can rely on the media exception, Round 22-8 must explicitly accept the deferred media risk and confirm that media-library export, delete double-write, JSON freeze / delete, uploads restore, and formal media rollback remain outside the closed scope unless separately implemented and accepted.

## 15. Deferred implementation status

Ownership report implementation is deferred.

This document does not:

- scan uploads
- query MySQL
- read API output
- implement report generation
- create output files
- add `.gitignore` entries
- create export behavior
- create delete behavior

Implementation requires a later boundary-confirmation step.

## 16. Explicitly forbidden actions

This document does not authorize:

- business code changes
- MySQL reads or writes
- `server/data/**/*.json` changes
- `server/uploads/**` changes
- `media_files` writes
- `media-library.json` writes
- PUT / POST / DELETE API calls
- upload / delete / archive / restore / metadata API calls
- API write tests
- `export:content`
- `export --write`
- `build:prerender`
- backup or rollback execution
- formal rollback
- closing JSON fallback
- freezing JSON
- deleting JSON
- Round 23 permission work
- ownership report implementation
- media-library export implementation
- media-library MySQL primary write
- delete double-write

## 17. Follow-up steps

These numbers are route markers only. They are not implemented by this document.

- Round 22-7-6-5A: media_files ownership report implementation boundary confirmation
- Round 22-7-6-5B: media_files ownership report read-only implementation
- Round 22-7-6-5C: ownership report result acceptance and blocker matrix judgment
- Round 22-7-6-6: uploads backup / restore temp-only strategy design
- Round 22-7-6-7: uploads backup / restore temp-only documentation landing
- Round 22-7-6-7A: uploads backup / restore implementation boundary confirmation
- Round 22-7-6-7B: uploads backup dry-run report implementation
- Round 22-7-6-7C: uploads real copy backup implementation
- Round 22-7-6-7D: uploads temp-only restore rehearsal implementation
- Round 22-7-6-8: delete recovery / tombstone / quarantine strategy design
- Round 22-7-6-9: delete recovery / tombstone / quarantine documentation landing
- Round 22-7-6-9A: delete dry-run / impact report implementation boundary confirmation
- Round 22-7-6-9B: tombstone schema / storage implementation boundary confirmation
- Round 22-7-6-9C: quarantine / soft-delete window implementation boundary confirmation
- Round 22-7-6-9D: delete recovery temp-only restore design
- Round 22-7-7: JSON freeze condition decision
- Round 22-8: Round 22 total acceptance
