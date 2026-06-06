# Round 22 Delete Recovery / Tombstone / Quarantine Strategy

This document records the Round 22-7-6-9 delete recovery / tombstone / quarantine strategy landing.

It is a documentation landing step only. It does not change business code, does not implement delete recovery, does not implement tombstones, does not implement quarantine, does not implement delete dry-run, does not implement delete double-write, does not write MySQL, does not modify `server/data/**/*.json`, does not modify `server/uploads/**`, does not copy, delete, or move upload files, does not create backup or quarantine directories, does not run API write tests, does not run export, does not run `build:prerender`, does not run backup or rollback, and does not create generated artifacts.

## 1. Purpose

The purpose of this strategy is to define the safety boundary required before media-library delete can move toward double-write, single-source closure, JSON freeze / delete, global `export --write`, or Round 23 treatment.

Hard principles:

- delete is the highest-risk media-library / uploads operation
- archived does not mean safe to permanently delete
- direct physical deletion cannot be the future main delete path
- delete dry-run must come before any destructive delete
- `canDelete` defaults to `false`
- delete recovery, tombstone, quarantine, and permanent delete implementation are deferred
- missing implementation must remain a deferred media risk for Round 22-8 total acceptance

## 2. Current delete behavior

The current single delete entry point is `deleteLocalImage(fileName)`.

Current behavior:

- validates the requested file name
- runs the current home interactive / home video usage guard
- reads `server/data/media-library.json`
- requires the media JSON status to be `archived`
- deletes the physical upload file from `server/uploads/images` or `server/uploads/videos` with `fs.unlink`
- removes the entry from `server/data/media-library.json`
- returns whether the file was deleted, missing, or removed from the index

Batch delete calls the same single-item delete path for each archived file, so it inherits the same physical deletion, JSON index removal, and guard limitations.

The current delete guard does not completely cover:

- cases
- solutions
- articles
- pages
- rich text
- SEO / Open Graph images
- `raw_json`
- MySQL foreign keys and `media_id` references
- shared physical files

## 3. Why delete is the highest-risk media operation

Delete is the highest-risk media operation because it can remove both metadata and the actual physical file bytes.

The physical upload file cannot be recreated from `media-library.json`. It also cannot be recreated from MySQL metadata. Once `fs.unlink` removes the file, JSON rollback and MySQL rollback are not enough to recover the media asset.

A single physical file may be referenced by media-library and by business content at the same time. If the guard misses a rich-text, SEO, raw JSON, or MySQL foreign-key reference, permanent delete can break live content even when the media-library admin card appears unused.

Current delete cannot enter double-write and cannot be treated as part of a single-source closed loop.

## 4. Why archived does not mean safe to permanently delete

`archived` is only a local lifecycle state. It can hide an item from default media-library lists and mark it as a candidate for review.

`archived` does not prove:

- ownership is clear
- there are no business-module references
- rich text has no embedded upload URL
- SEO / OG image fields are clear
- `raw_json` has no preserved reference
- MySQL foreign-key references are clear
- the physical file has a verified backup
- quarantine or soft-delete recovery exists
- tombstone metadata can be written
- formal restore has been rehearsed

Permanent delete remains forbidden until all required guards and recovery surfaces exist and pass.

## 5. Required preconditions before delete

Future delete may be considered only when all of these preconditions are satisfied:

- file status is `archived`
- ownership report has been generated
- `ownershipClass` is clear
- `ownershipClass` is not `unknown`
- `ownershipClass` is not `sharedButReferenced`
- `ownershipClass` is not `conflict`
- `businessOwned` files are not deleted by a media-library delete flow
- usage guard passes
- rich-text references have been scanned
- SEO / OG image references have been scanned
- `raw_json` references have been scanned
- MySQL foreign keys and `media_id` references have been scanned
- shared physical file risk has been excluded
- physical backup exists
- backup manifest is traceable
- current physical hash matches the backup hash
- quarantine or soft-delete window is enabled
- tombstone can be written
- delete impact report has been generated
- recovery path is clear
- delete dry-run has passed
- real delete has separate explicit authorization

If any precondition is missing, delete double-write remains forbidden and `canDelete` must stay `false`.

## 6. Delete dry-run / impact report

Future delete dry-run / impact reports should use this schema shape:

```json
{
  "reportId": "YYYYMMDD-HHmmss",
  "createdAt": "ISO-8601 datetime",
  "gitHead": "string",
  "branch": "string",
  "command": "string",
  "targetMediaId": "string | number | null",
  "targetStableKey": "string",
  "targetPublicUrl": "string | null",
  "targetPhysicalPath": "string | null",
  "archivedStatus": "active | archived | unknown",
  "ownershipClass": "likelyMediaLibrary | businessOwned | sharedButReferenced | unknown | orphanCandidate | missingPhysicalFile | missingMetadata | conflict",
  "ownershipConfidence": "high | medium | low",
  "referencedByModules": ["string"],
  "referencedByRecords": [
    {
      "module": "string",
      "recordId": "string | null",
      "slug": "string | null",
      "field": "string | null",
      "referenceType": "media_id | url | rich_text | seo_og | raw_json | mysql_fk | unknown"
    }
  ],
  "usageGuardStatus": "passed | warning | failed",
  "richTextScanStatus": "passed | warning | failed | not_scanned",
  "seoOgScanStatus": "passed | warning | failed | not_scanned",
  "rawJsonScanStatus": "passed | warning | failed | not_scanned",
  "mysqlReferenceScanStatus": "passed | warning | failed | not_scanned",
  "physicalExists": true,
  "physicalHash": "sha256:...",
  "backupManifestPath": "string | null",
  "quarantinePlan": {
    "enabled": false,
    "quarantineRoot": "string | null",
    "quarantinePath": "string | null"
  },
  "tombstonePlan": {
    "enabled": false,
    "target": "media_files.metadata_json | tombstone_report | both"
  },
  "blockers": ["string"],
  "warnings": ["string"],
  "recommendedAction": "do_not_delete | dry_run_only | ready_for_quarantine | ready_for_soft_delete | manual_review",
  "canDelete": false
}
```

Decision rules:

- `canDelete` defaults to `false`
- only a full guard pass can make `canDelete=true`
- `not_scanned` in a delete path is a blocker or high-risk warning
- `unknown`, `sharedButReferenced`, and `conflict` are direct blockers
- missing backup is a blocker
- backup hash mismatch is a blocker
- missing quarantine, tombstone, or recovery path is a blocker
- a dry-run safe candidate is not permission to execute permanent delete

## 7. Tombstone strategy

Future tombstones should use this schema shape:

```json
{
  "tombstoneId": "string",
  "deletedAt": "ISO-8601 datetime",
  "deletedBy": "string | null",
  "operator": "string | null",
  "command": "string",
  "mediaFileId": "string | number | null",
  "mediaLibraryRecordId": "string | null",
  "stableKey": "string",
  "fileName": "string | null",
  "displayName": "string | null",
  "publicUrl": "string | null",
  "originalPhysicalPath": "string | null",
  "quarantinePath": "string | null",
  "physicalHash": "sha256:...",
  "sizeBytes": 0,
  "mimeType": "string | null",
  "dimensions": {
    "width": "number | null",
    "height": "number | null"
  },
  "ownershipClass": "string",
  "referencedByModulesBeforeDelete": ["string"],
  "backupManifestPath": "string | null",
  "deleteImpactReportPath": "string",
  "reason": "string",
  "restorePolicy": "quarantine | backup | manual | not_restorable",
  "restoreDeadline": "ISO-8601 datetime | null",
  "softDeleteExpiresAt": "ISO-8601 datetime | null",
  "wroteMysql": false,
  "wroteServerData": false,
  "removedFromMediaLibraryJson": false,
  "physicalFileMovedToQuarantine": false,
  "physicalFileDeletedPermanently": false,
  "warnings": [],
  "blockers": []
}
```

Tombstone storage should combine three surfaces:

- MySQL `media_files.deleted_at` and `metadata_json` record machine-queryable state
- an independent tombstone report records audit and recovery details
- `media-library.json` keeps only archive and safety-anchor metadata

The three surfaces must reference each other. `media-library.json` must not be the only tombstone source.

## 8. Quarantine / soft-delete window strategy

Future delete should prefer moving the physical file to quarantine over direct `fs.unlink`.

Recommended quarantine root:

```text
server/data-backups/uploads-quarantine/<YYYYMMDD-HHmmss>/
```

Alternative quarantine root:

```text
server/uploads/.quarantine/<YYYYMMDD-HHmmss>/
```

If `server/uploads/.quarantine` is used, the implementation must prove that the quarantine path cannot be accidentally exposed by static file serving.

Quarantine rules:

- quarantine artifacts must be ignored by Git
- quarantine manifest must exist
- original `relativePath` must be preserved
- original hash must be preserved
- byte size must be preserved
- MIME type must be preserved
- restore target must be preserved
- quarantine must not overwrite existing files
- permanent delete remains separately authorized

Soft-delete window rules:

- default window should be 14 days
- configurable windows may be 7, 14, or 30 days
- restore is allowed during the soft-delete window
- after the window expires, permanent delete still requires separate authorization
- permanent delete is not open in Round 22
- Round 22 only designs this behavior and does not implement it

## 9. Recovery / restore strategy

Delete recovery must support at least:

- restore from quarantine
- restore from uploads backup
- restore to the original `relativePath`
- restore `media-library.json` index metadata
- restore `media_files` metadata and clear or replay `deleted_at`
- verify file hash
- verify ownership
- verify references
- generate a restore report
- refuse to automatically overwrite conflict files
- begin with temp-only restore rehearsal
- defer formal restore until a later explicit step

Without successful restore rehearsal, delete must not be considered safely recoverable.

Formal restore remains deferred. A later step must define overwrite policy, conflict handling, operator approval, metadata replay, MySQL tombstone handling, and manual repair.

## 10. Relationship with media_files ownership report

Delete dry-run must depend on the ownership report.

Ownership rules:

- `unknown` ownership is a blocker
- `sharedButReferenced` is a blocker
- `conflict` is a blocker
- `businessOwned` cannot be deleted by media-library delete
- `orphanCandidate` may enter delete-candidate review only when backup and quarantine exist
- `missingPhysicalFile` cannot execute physical delete
- ownership report implementation being deferred keeps delete double-write forbidden

The ownership report remains the ownership decision surface. Tombstone and quarantine reports must not override ownership blockers silently.

## 11. Relationship with uploads backup / restore

Delete is not safe without physical recovery.

Before delete:

- physical backup must exist
- backup manifest must be traceable
- backup hash must match the current physical hash
- missing backup is a blocker
- backup mismatch is a blocker
- temp-only restore rehearsal should pass first
- uploads backup / restore implementation being deferred keeps delete double-write forbidden

The upload backup manifest is the physical-file recovery surface. Quarantine is the short-term recovery surface. Both must remain consistent with the ownership report and delete impact report.

## 12. Relationship with media-library.json

`server/data/media-library.json` remains the metadata safety anchor.

Delete recovery must be able to restore or replay the media-library index entry when recovery is authorized. The current delete path removes the index entry, so a future recoverable delete path must preserve enough metadata in the tombstone report and related manifests to rebuild the record.

`media-library.json` must not be frozen or deleted while delete recovery, quarantine, ownership, uploads backup / restore, or formal media restore remain unresolved.

## 13. Relationship with media_files

`media_files` remains a metadata, index, and reference aid. It is not the only media-library source.

Future tombstone behavior may write `media_files.deleted_at` and tombstone metadata, but this requires a separate implementation boundary. Hard-deleting `media_files` rows is not part of this strategy.

Business-owned, shared, unknown, and conflicted `media_files` rows must not be tombstoned by a media-library-exclusive delete flow.

## 14. Relationship with JSON freeze / delete

Delete recovery not being implemented blocks JSON freeze / delete coverage for media-library.

JSON freeze / delete must not cover media-library while any of these remain deferred:

- ownership report implementation
- uploads backup implementation
- uploads temp-only restore rehearsal
- delete dry-run / impact report implementation
- tombstone implementation
- quarantine or soft-delete implementation
- delete recovery restore rehearsal

Fallback must remain available and `media-library.json` must remain retained.

## 15. Relationship with export --write

Global `export --write` must remain disabled while delete recovery is deferred.

Any future write mode must explicitly state whether media-library is:

- excluded from write mode
- governed by a separate media-specific write and recovery plan
- still blocked

The default while delete recovery is deferred is blocked.

## 16. Relationship with Round 22 final validation

Round 22-8 total acceptance must check:

- delete recovery / tombstone / quarantine strategy is landed
- delete recovery implementation is deferred or separately accepted
- tombstone implementation is deferred or separately accepted
- quarantine implementation is deferred or separately accepted
- delete double-write remains forbidden
- permanent delete remains forbidden
- deferred risk is explicitly accepted
- `media-library.json` is retained
- uploads are retained
- `export --write` remains disabled
- fallback remains available
- JSON freeze / delete cannot cover media-library
- Round 23 entry requires explicit acceptance of this risk boundary

Silent acceptance is not enough.

## 17. Relationship with Round 23

Round 23 must not treat media-library delete as a closed capability because this document exists.

Before Round 23 can rely on the media exception, Round 22-8 must explicitly accept the deferred media risk and confirm that media-library export, delete double-write, permanent delete, JSON freeze / delete, uploads restore, and formal media rollback remain outside the closed scope unless separately implemented and accepted.

## 18. Deferred implementation status

Delete recovery, tombstone, quarantine, delete dry-run, delete double-write, and permanent delete implementation are deferred.

This document does not:

- implement delete recovery
- implement tombstone writing
- implement quarantine
- implement soft-delete windows
- implement permanent delete
- implement delete dry-run
- write MySQL
- write `media_files`
- modify `media-library.json`
- modify `server/uploads/**`
- copy, delete, or move files
- create backup or quarantine directories
- add `.gitignore` entries

Implementation requires separate later authorization.

## 19. Explicitly forbidden actions

This document does not authorize:

- business code changes
- MySQL reads or writes
- `server/data/**/*.json` changes
- `server/uploads/**` changes
- copying upload files
- deleting upload files
- moving upload files
- creating quarantine directories
- creating backup directories
- executing restore
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
- delete recovery implementation
- tombstone implementation
- quarantine implementation
- delete double-write implementation
- delete dry-run implementation
- permanent delete implementation

## 20. Follow-up steps

These numbers are route markers only. They are not implemented by this document.

- Round 22-7-6-9A: delete dry-run / impact report implementation boundary confirmation
- Round 22-7-6-9B: tombstone schema / storage implementation boundary confirmation
- Round 22-7-6-9C: quarantine / soft-delete window implementation boundary confirmation
- Round 22-7-6-9D: delete recovery temp-only restore design
- Round 22-7-7: JSON freeze condition decision
- Round 22-8: Round 22 total acceptance
