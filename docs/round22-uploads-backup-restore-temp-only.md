# Round 22 Uploads Backup / Restore Temp-Only Design

This document records the Round 22-7-6-7 uploads backup / restore temp-only design landing.

It is a documentation landing step only. It does not implement uploads backup, does not implement uploads restore, does not copy upload files, does not execute restore, does not change business code, does not write MySQL, does not modify `server/data/**/*.json`, does not modify `server/uploads/**`, does not run API write tests, does not run export, does not run `build:prerender`, does not run backup or rollback, and does not create generated artifacts.

## 1. Purpose

The purpose of this design is to define how uploaded physical files should be backed up and restored before media-library can move toward export, delete double-write, JSON freeze / delete, global `export --write`, or Round 23 treatment.

Uploads are physical files. They are not ordinary JSON content. They cannot be recovered from JSON rollback alone, and they cannot be recovered from MySQL rollback alone.

Hard principles:

- physical files cannot be recreated from JSON metadata
- physical files cannot be recreated from MySQL metadata
- temp-only restore must come before formal restore
- formal restore over real `server/uploads/**` remains deferred
- no physical backup or quarantine means delete double-write remains forbidden
- backup / restore design can land before implementation
- missing implementation must remain a deferred media risk for Round 22-8 total acceptance

## 2. Current status

Current status:

- uploads backup / restore is design-only
- uploads backup implementation is deferred
- uploads restore implementation is deferred
- no upload files are copied by this document
- no restore output directory is created by this document
- no generated upload backup or restore artifacts should be committed
- media-library export remains disabled
- media-library delete double-write remains disabled
- JSON freeze / delete cannot cover media-library
- global `export --write` remains disabled for media-library
- Round 23 must not treat media-library as an ordinary migrated module

## 3. Why uploads are not covered by JSON rollback

The existing first-phase backup and rollback path is for rollback-eligible JSON files. It explicitly excludes `server/uploads/**`.

`server/data/media-library.json` can describe a media item, but it does not contain the bytes of the uploaded file. `media_files` can store metadata, paths, and ownership hints, but it does not contain the physical file either.

Therefore a complete media rollback needs a separate uploads backup / restore path. Until that path is implemented and accepted, media-library remains an asset-layer exception.

## 4. Backup scope

### 4.1 server/uploads/images

The first uploads backup phase must cover:

```text
server/uploads/images
```

This scope covers uploaded image files referenced by media-library, business modules, rich text, and SEO / OG image fields.

### 4.2 server/uploads/videos

The first uploads backup phase must cover:

```text
server/uploads/videos
```

This scope covers uploaded video files referenced by home video, solution media, media-library metadata, and future media references.

### 4.3 deferred directories: thumbnails / derived / temp

Thumbnails, derived files, temporary upload directories, document uploads, object-storage mirrors, and other media-like paths are not confirmed in this first scope.

They must be handled by a later inventory step. They must not be silently included in the first uploads backup scope.

## 5. File record schema

Each file record should include at least:

- `relativePath`
- `sourcePath`
- `backupPath`
- `restoreTarget`
- `fileName`
- `displayName`
- `displayNameSource`
- `publicUrl`
- `mimeType`
- `sizeBytes`
- `dimensions`
- `fileHash`
- `lastModified`
- `sourceMetadata`
- `mediaLibraryJsonMatched`
- `mediaFilesMatched`
- `ownershipClass`
- `referencedByModules`
- `mediaLibraryRecordId`
- `mediaFileId`
- `warnings`
- `blockers`

`absolutePath` may be written only to local audit reports. It must not be used as a cross-machine restore identity. Portable recovery must use `relativePath`, `fileHash`, and `restoreTarget`.

## 6. Backup manifest schema

Future upload backup manifests should use this schema shape:

```json
{
  "schemaVersion": "1.0",
  "backupId": "YYYYMMDD-HHmmss",
  "createdAt": "ISO-8601 datetime",
  "gitHead": "string",
  "branch": "string",
  "command": "string",
  "mode": "dry-run | real-copy",
  "sourceRoots": ["server/uploads/images", "server/uploads/videos"],
  "backupRoot": "server/data-backups/uploads/<YYYYMMDD-HHmmss>/",
  "hashAlgorithm": "sha256",
  "totalFileCount": 0,
  "totalBytes": 0,
  "ownershipSummary": {
    "likelyMediaLibrary": 0,
    "businessOwned": 0,
    "sharedButReferenced": 0,
    "unknown": 0,
    "orphanCandidate": 0,
    "missingPhysicalFile": 0,
    "missingMetadata": 0,
    "conflict": 0
  },
  "files": [
    {
      "relativePath": "images/example.png",
      "sourcePath": "server/uploads/images/example.png",
      "backupPath": "server/data-backups/uploads/<backupId>/images/example.png",
      "restoreTarget": "server/uploads/images/example.png",
      "fileName": "example.png",
      "fileHash": "sha256:...",
      "sizeBytes": 0,
      "mimeType": "image/png",
      "dimensions": {
        "width": null,
        "height": null
      },
      "ownershipClass": "likelyMediaLibrary | businessOwned | sharedButReferenced | unknown | orphanCandidate | missingPhysicalFile | missingMetadata | conflict",
      "referencedByModules": ["media-library"],
      "mediaLibraryRecordId": "string | null",
      "mediaFileId": "string | number | null",
      "warnings": [],
      "blockers": []
    }
  ],
  "missingFiles": [],
  "orphanFiles": [],
  "conflicts": [],
  "warnings": [],
  "blockers": [],
  "wroteServerData": false,
  "wroteMysql": false
}
```

The backup manifest is the physical-file audit record. When metadata disagrees with file facts, `fileHash`, `relativePath`, and byte size are the physical evidence.

## 7. Backup execution modes

### 7.1 dry-run report only

Dry-run mode scans and reports only. It must not copy files.

It should produce the same manifest shape with `mode="dry-run"`, `wroteServerData=false`, and `wroteMysql=false`.

### 7.2 real copy backup

Real copy mode is the first mode allowed to copy uploads files.

Future default output:

```text
server/data-backups/uploads/<YYYYMMDD-HHmmss>/
```

Rules:

- copy only from accepted upload source roots
- preserve relative paths under the backup root
- generate `backup-manifest.json`
- generate `backup-summary.json`
- generate `consistency-report.json`
- generate `failure-report.json` when backup fails
- never write MySQL
- never modify `media-library.json`
- never modify original upload files
- fail if the backup directory already exists

### 7.3 temp-only restore rehearsal

Temp-only restore rehearsal validates a backup without touching real uploads.

It restores backup files into a temporary rehearsal directory and validates hashes, counts, skipped files, conflicts, and blocker reports.

### 7.4 formal restore deferred

Formal restore over real `server/uploads/**` remains deferred.

It must not be opened in Round 22-7. A later explicit strategy must define overwrite policy, conflict handling, ownership checks, backup selection, quarantine interaction, repair steps, and operator approval.

## 8. Restore temp-only design

The first uploads restore phase must be temp-only.

Future default restore root:

```text
server/data-restore-rehearsals/uploads/<YYYYMMDD-HHmmss>/
```

Rules:

- do not overwrite real `server/uploads`
- do not write MySQL
- do not modify `media-library.json`
- do not modify `media_files`
- restore only into the temp restore root
- record `hashMatched`
- treat missing backup files as blockers
- treat hash mismatches as blockers
- record existing target conflicts only
- do not automatically resolve conflicts
- keep formal restore disabled

Temp-only restore should reject any restore root that points to or is inside `server/uploads`, `server/data`, or `server/data-backups`.

## 9. Restore manifest schema

Future upload restore manifests should use this schema shape:

```json
{
  "schemaVersion": "1.0",
  "restoreId": "YYYYMMDD-HHmmss",
  "createdAt": "ISO-8601 datetime",
  "sourceBackupId": "string",
  "sourceBackupManifestPath": "string",
  "sourceBackupRoot": "string",
  "restoreRoot": "server/data-restore-rehearsals/uploads/<restoreId>/",
  "mode": "temp-only",
  "overwroteUploads": false,
  "wroteMysql": false,
  "wroteServerData": false,
  "restoredFiles": [
    {
      "relativePath": "images/example.png",
      "backupPath": "string",
      "restorePath": "string",
      "restoreTarget": "server/uploads/images/example.png",
      "backupHash": "sha256:...",
      "restoredHash": "sha256:...",
      "hashMatched": true,
      "sizeBytes": 0,
      "ownershipClass": "string"
    }
  ],
  "skippedFiles": [],
  "conflicts": [],
  "missingBackupFiles": [],
  "hashMismatches": [],
  "validationStatus": "passed | warning | failed",
  "warnings": [],
  "blockers": []
}
```

Restore validation must fail when required backup files are missing, file hashes do not match, restore output escapes the temp restore root, or restore output would touch real uploads.

## 10. Consistency report

Uploads backup / restore should generate a consistency report comparing:

- physical files
- `media-library.json`
- `media_files`
- ownership report

The report should include at least:

- `physicalWithoutMetadata`
- `metadataWithoutPhysical`
- `mediaFilesWithoutPhysical`
- `mediaLibraryJsonWithoutPhysical`
- `ownershipUnknown`
- `sharedReferences`
- `duplicatePhysicalFiles`
- `hashConflicts`
- `unsafeDeleteCandidates`

This report does not repair anything. It is a blocker and warning surface for later manual review or separately authorized repair tooling.

## 11. Relationship with media_files ownership report

Uploads backup should read the ownership report when available.

If the ownership report is not implemented, uploads backup can only run in conservative mode:

- `unknown` ownership is a blocker
- `sharedButReferenced` is at least a high-risk warning
- `sharedButReferenced` is a blocker for delete or export decisions
- `ownershipClass` must be written into backup manifest records
- backup manifest should become a prerequisite input for delete recovery
- ownership report should come before delete dry-run
- ownership report and backup report may be implemented separately, but they must reference each other

The ownership report remains the ownership decision surface. The upload backup manifest remains the physical-file recovery surface.

## 12. Relationship with delete recovery / quarantine

Delete is not safe without physical recovery.

Before media-library delete double-write can be considered, the project must have:

- physical backup
- clear ownership
- usage guard pass
- tombstone strategy
- shared / unknown / conflict blockers
- quarantine or soft-delete window
- recovery path from backup or quarantine

Current direct physical deletion risk must be replaced or guarded by a later delete recovery / tombstone / quarantine strategy.

Without backup or quarantine, delete double-write remains forbidden.

Round 22-7-6-9 lands that strategy in [Round 22 Delete Recovery / Tombstone / Quarantine Strategy](./round22-delete-recovery-tombstone-quarantine.md). It confirms that delete dry-run must precede any real delete, `canDelete` defaults to `false`, quarantine or a soft-delete window must exist before permanent delete, and delete recovery must support restore from quarantine or uploads backup with hash, ownership, and reference validation.

## 13. Relationship with JSON freeze / delete

Uploads backup / restore not being implemented blocks JSON freeze / delete coverage for media-library.

`server/data/media-library.json` must remain available as a metadata safety anchor while physical backup, temp-only restore, ownership, delete recovery, and formal media rollback remain unresolved.

## 14. Relationship with export --write

Global `export --write` must remain disabled while uploads backup / restore is deferred.

Any future write mode must explicitly state whether media-library is excluded, still blocked, or governed by a separate media-specific write and recovery plan.

The default while uploads backup / restore is deferred is blocked.

## 15. Relationship with Round 22 final validation

Round 22-8 total acceptance must check:

- uploads backup / restore temp-only design is landed
- uploads backup / restore implementation is deferred or separately accepted
- deferred risk is explicitly accepted
- `media-library.json` is retained
- uploads are retained
- ownership report is still deferred or implemented and accepted
- delete double-write remains forbidden
- `export --write` remains disabled
- JSON freeze / delete cannot cover media-library
- Round 23 entry requires explicit acceptance of this media risk boundary

Silent acceptance is not enough. The media risk treatment must be explicit.

## 16. Relationship with Round 23

Round 23 must not start because this document exists.

Before Round 23 can rely on the media exception, Round 22-8 must explicitly accept the deferred media risk and confirm that uploads backup / restore, media-library export, delete double-write, JSON freeze / delete, and formal media rollback remain outside the closed scope unless separately implemented and accepted.

## 17. Deferred implementation status

Uploads backup / restore implementation is deferred.

This document does not:

- scan uploads
- copy upload files
- create a backup directory
- create a restore directory
- execute restore
- query MySQL
- write MySQL
- modify `media-library.json`
- modify `media_files`
- modify `server/uploads/**`
- add `.gitignore` entries
- implement backup tooling
- implement restore tooling

Implementation requires a later boundary-confirmation step.

## 18. Explicitly forbidden actions

This document does not authorize:

- business code changes
- MySQL reads or writes
- `server/data/**/*.json` changes
- `server/uploads/**` changes
- copying upload files
- creating real uploads backup
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
- uploads backup tool implementation
- uploads restore tool implementation
- delete double-write implementation
- media-library export implementation

## 19. Follow-up steps

These numbers are route markers only. They are not implemented by this document.

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
