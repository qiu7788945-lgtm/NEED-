# Round 22 Backup / Rollback Rehearsal Scope

This document records the Round 22-7-4B backup and rollback rehearsal scope decision.

It is a documentation landing step only. It does not implement real backup, does not execute rollback, does not enable export `--write`, does not switch MySQL primary writes, does not freeze JSON, does not delete JSON, and does not grant Round 23 permissions.

## 1. Current Phase Conclusion

Round 22-7-4B only defines the backup and rollback rehearsal boundaries.

Current conclusions:

- Real backup is not implemented.
- Real rollback has not been executed.
- Export `--write` remains disabled.
- MySQL primary writes remain disabled.
- JSON remains the primary write safety anchor.
- JSON fallback must remain available.
- Backup and rollback scope must be defined before implementation.

## 2. Backup Scope

The first backup phase is a JSON safety backup for rollback-eligible content files. It is not a full operational disaster recovery backup.

### A. Required first-phase backup files

The first phase must include these JSON files:

- `server/data/contact-info.json`
- `server/data/company-assets.json`
- `server/data/home-video.json`
- `server/data/home-interactive-images.json`
- `server/data/articles.json`
- `server/data/cases.json`
- `server/data/solutions.json`
- `server/data/pages.json`
- `server/data/scenario-detail-pages.json`

`server/data/pages.json` and `server/data/scenario-detail-pages.json` must still be backed up when they are empty. Empty-source backups prove that a future write can return to the exact pre-write file state.

### B. Excluded from first-phase backup

The first phase must not include:

- `server/uploads/**`
- MySQL databases
- MySQL tombstone rows
- `migration_logs`
- `dist-prerender`
- generated export outputs
- `node_modules`
- temporary logs
- historical abnormal media-library copies such as `server/data/media-library.corrupt-*` and `server/data/media-library.broken-backup.json`

### C. Separately classified items

These paths need separate handling and must not be silently treated as ordinary content rollback input:

- `server/data/media-library.json`
- `server/data/publish-logs/**`
- `server/data-backups/**`
- `server/data-exports/**`

## 3. media-library.json Boundary

`server/data/media-library.json` should be included in future backup as a metadata and safety-anchor file.

In the first phase, it is not ordinary content rollback input. A first-phase content rollback must not overwrite the real `server/data/media-library.json`.

Media-library rollback requires a dedicated design that covers uploads, `media_files`, delete guards, owners, shared references, and unknown ownership. `media-library.json` cannot be treated as a simple content JSON file because the visible media library depends on both metadata and physical or object-storage assets.

## 4. uploads Boundary

`server/uploads/**` does not enter the first-phase JSON backup.

`server/uploads/**` does not enter the first-phase rollback rehearsal.

Uploads are a blocker for complete rollback because MySQL cannot restore physical files by itself and JSON metadata cannot recreate missing uploaded assets.

Uploads need a separate backup and restore strategy. The uploads strategy must be revisited before the Round 24 deployment backup strategy is accepted.

## 5. publish-logs Boundary

`server/data/publish-logs/**` is the publish audit record chain.

Publish logs may be retained, archived, or backed up for traceability, but they are not content rollback input.

Content rollback must not restore publish logs in the first phase. `build:prerender` can create new publish logs, so including publish logs in rollback rehearsal would blur the boundary between content recovery and publish audit history.

Publish logs must not replace Round 23 operation logs.

## 6. Rollback Rehearsal Scope

The first rollback rehearsal phase is temp-only.

Rules:

- Restore only into a temporary rehearsal directory.
- Do not overwrite `server/data`.
- Use this target shape:

```text
server/data-restore-rehearsals/mysql-json-export/<timestamp>/
```

- Do not restore MySQL.
- Do not restore uploads.
- Do not restore publish logs.
- Do not restore tombstone rows.
- Do not restore `migration_logs`.
- Do not restore media-library physical files.
- Only verify that rollback-eligible JSON files from a backup can be restored.
- After restore, run hash, shape, and diff checks against the backup manifest.
- Any failure must produce a failure report.

The first rehearsal phase proves recoverability without modifying live source JSON.

## 7. export --write Preconditions

Future export `--write` must depend on real backup.

Required rules:

- A real backup must exist before export `--write` can be opened.
- Export `--write` must automatically create and verify backup before writing.
- If backup creation or verification fails, write must stop.
- Bypassing backup for export `--write` is not allowed.
- Write must not proceed from a report-only backup plan.
- After write, rollback must be able to return rollback-eligible JSON files to their pre-write state.

The backup manifest must record:

- schema
- timestamp
- git HEAD and branch
- command arguments
- file list
- file hash
- file size
- record count or shape summary
- backup directory
- rollback eligibility
- excluded items
- risks and warnings

The rollback manifest must bind to one concrete backup manifest and record the backup manifest hash.

## 8. Rollback Failure Policy

Rollback failure must never be silent.

A rollback failure report must include:

- restored files
- unrestored files
- error reason
- failure phase
- manual handling guidance

Rollback failure reports must be preserved for audit and recovery follow-up.

Rollback does not restore MySQL in this phase.

Rollback does not restore uploads in this phase.

## 9. Relationship to Later Round 22-7 Steps

Round 22-7-4B only lands documentation.

Entering Round 22-7-5 does not require real backup implementation first.

Entering Round 22-7-5 does not require rollback rehearsal execution first.

Round 22-7-5 may only confirm low-risk module MySQL primary-write design boundaries. It must not switch primary writes or change code unless a later step explicitly allows implementation.

Real backup and rollback rehearsal must be implemented before export `--write` is opened or any real overwrite is allowed.

Media-library and uploads still require a dedicated Round 22-7-6 single-source exception strategy.

## 10. Round 22-7-5C-2 Real Backup Implementation Boundary

Round 22-7-5C-2 is the documentation and code-boundary landing step for future real backup implementation.

It is not the real backup execution step. It does not enable export `--write`, does not execute rollback, and does not switch MySQL primary writes.

Round 22-7-5D is reserved for rollback rehearsal temp-only implementation boundary confirmation. Low-risk module primary-write code must not start before real backup is implemented and before temp-only rollback rehearsal is separately accepted.

### Output Directory

Future real backup output should use this directory shape:

```text
server/data-backups/mysql-json-export/<YYYYMMDD-HHmmss>/
```

Each backup must use a unique timestamp. A backup implementation must refuse to overwrite an existing backup directory.

Backup artifacts must never be committed to Git. This includes backup files, `backup-manifest.json`, `backup-summary.json`, `risks.json`, and `failure-report.json`.

The backup directory should contain:

- `backup-manifest.json`
- `backup-summary.json`
- `risks.json`
- `failure-report.json` only when backup fails
- `files/<relative-path>.json`

### Git Ignore Boundary

Real backup implementation is forbidden unless backup artifacts are ignored by Git.

The preferred ignore rule is:

```text
server/data-backups/
```

At minimum, the implementation-specific directory must be ignored:

```text
server/data-backups/mysql-json-export/
```

If `.gitignore` does not cover the real backup output directory, real backup implementation must not proceed. Backup output must not pollute `git status`.

### Manifest Schema

The real backup manifest must include at least:

- `schemaVersion`
- `backupId`
- `createdAt`
- `gitHead`
- `branch`
- `command`
- `mode`
- `sourceRoot`
- `backupRoot`
- `files[]`
- `excludedItems[]`
- `deferredItems[]`
- `risks[]`
- `canRollback`
- `rollbackManifestPlanned`
- `validationStatus`

Each `files[]` item must include:

- `relativePath`
- `sourcePath`
- `backupPath`
- `exists`
- `sha256`
- `sizeBytes`
- `recordCount`
- `shapeSummary`
- `rollbackEligible`
- `specialHandling`
- `warnings`

### First-Phase Backup Scope

The first-phase required rollback-eligible files are:

- `server/data/contact-info.json`
- `server/data/company-assets.json`
- `server/data/home-video.json`
- `server/data/home-interactive-images.json`
- `server/data/articles.json`
- `server/data/cases.json`
- `server/data/solutions.json`
- `server/data/pages.json`
- `server/data/scenario-detail-pages.json`

If any required rollback-eligible file is missing or cannot be backed up, backup fails.

`server/data/pages.json` and `server/data/scenario-detail-pages.json` must still be hashed, copied, and shape-recorded when they contain empty arrays.

Every required file must record its relative path, byte size, SHA-256 hash, record count, and shape summary.

The implementation must not automatically back up unknown abnormal `server/data` copies such as `server/data/media-library.corrupt-*` or `server/data/media-library.broken-backup.json`.

If `server/data/media-library.json` is backed up, it must use `specialHandling=metadata_safety_anchor` and `rollbackEligible=false`.

`server/data/publish-logs/**` is excluded from first-phase content backup.

`server/uploads/**` is excluded from first-phase backup.

### Backup Validation

After backup creation, validation must confirm:

- all required files exist
- copied backup file hashes match source file hashes
- JSON files are readable
- record count and shape summary can be generated
- manifest fields are complete
- summary has no blocker
- backup directory is unique
- `server/data` was not modified
- uploads were not copied
- MySQL was not written
- `git status` has no tracked pollution from backup output

### Failure Report

Backup failure must output a failure report. The failure report must include at least:

- `failedAt`
- `backupId`
- `failedStep`
- `failedFile`
- `errorMessage`
- `partialFilesCopied`
- `cleanupStatus`
- `writeBlocked=true`
- `manualActionRequired`
- `risks`

Failure policy:

- Any required rollback-eligible JSON backup failure fails the whole backup.
- Backup failure must block future export `--write`.
- Backup failure may still allow dry-run export to continue, but it must not allow write mode.
- Partial success is not enough to enter write mode.
- `media-library.json` special backup failure may be a warning for low-risk content write, but it blocks any claim that complete rollback coverage exists.
- Excluding uploads is not a backup failure, but it must be recorded as a full rollback blocker.

### Relationship To Rollback Rehearsal

Real backup implementation should precede rollback rehearsal temp-only implementation.

Rollback rehearsal must read the backup manifest, verify the backup manifest hash, and restore only files where `rollbackEligible=true`.

Rollback rehearsal must not overwrite `server/data`.

Rollback rehearsal should output a restore manifest and a failure report when applicable.

Backup and rollback rehearsal must be accepted as a pair. Backup alone does not prove the rollback path is usable.

## 11. Forbidden Interpretations

This document is not an export `--write` enablement instruction.

This document is not a rollback execution instruction.

This document is not a JSON freeze instruction.

This document is not a JSON deletion instruction.

This document is not a MySQL primary-write switch instruction.

This document is not a Round 23 permission entry point.

Any implementation must be confirmed in a separate later step.
