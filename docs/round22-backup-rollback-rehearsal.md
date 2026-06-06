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

Round 22-7-6-3 lands the media-library / uploads exception strategy in [Round 22 Media Library / Uploads Exception Strategy](./round22-media-library-uploads-exception-strategy.md). The strategy keeps `media-library.json` as a metadata safety anchor, keeps uploads as the physical file source, treats `media_files` only as metadata / index / reference aid, and defers media-library export, media-library primary write, delete double-write, ownership report, uploads backup / restore, and delete recovery / tombstone work.

Round 22-7-6-5 lands the ownership report design in [Round 22 Media Files Ownership Report Design](./round22-media-files-ownership-report.md). The design confirms that the report is a prerequisite input for uploads backup / restore and delete recovery, while implementation and generated report outputs remain deferred.

Round 22-7-6-7 lands the uploads backup / restore temp-only design in [Round 22 Uploads Backup / Restore Temp-Only Design](./round22-uploads-backup-restore-temp-only.md). The design defines the future uploads backup scope, manifest, temp-only restore manifest, consistency report, `.gitignore` requirement, and deferred risk acceptance. It does not implement backup or restore.

Round 22-7-6-9 lands the delete recovery / tombstone / quarantine strategy in [Round 22 Delete Recovery / Tombstone / Quarantine Strategy](./round22-delete-recovery-tombstone-quarantine.md). The strategy defines delete dry-run, tombstone, quarantine, soft-delete window, and recovery boundaries. It does not implement delete recovery, tombstones, quarantine, permanent delete, or delete double-write.

## 4. uploads Boundary

`server/uploads/**` does not enter the first-phase JSON backup.

`server/uploads/**` does not enter the first-phase rollback rehearsal.

Uploads are a blocker for complete rollback because MySQL cannot restore physical files by itself and JSON metadata cannot recreate missing uploaded assets.

Uploads need a separate backup and restore strategy. The uploads strategy must be revisited before the Round 24 deployment backup strategy is accepted.

The first uploads restore design should be temp-only. Formal restore over real uploads, automatic overwrites, delete recovery, tombstone replay, and physical file replacement remain deferred until a dedicated media follow-up accepts those risks.

The dedicated uploads backup / restore temp-only design is documented in [Round 22 Uploads Backup / Restore Temp-Only Design](./round22-uploads-backup-restore-temp-only.md). That design keeps `server/uploads/images` and `server/uploads/videos` as the first minimum backup scope and requires formal restore to remain deferred.

The dedicated delete recovery / tombstone / quarantine strategy is documented in [Round 22 Delete Recovery / Tombstone / Quarantine Strategy](./round22-delete-recovery-tombstone-quarantine.md). That strategy requires a physical backup, traceable manifest, matching physical hash, quarantine or soft-delete window, tombstone, and temp-only recovery rehearsal before delete can be considered recoverable.

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

Round 22-7-6-3 lands that exception strategy as documentation. It is not rollback coverage and does not open `--write`, `--rollback`, JSON freeze/delete, or Round 23 permissions.

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

## 11. Round 22-7-5C-3 Real Backup Implementation

Round 22-7-5C-3 adds the real JSON backup creation path for the export tool.

The CLI flag is:

```text
--create-backup
```

This flag creates a real backup under:

```text
server/data-backups/mysql-json-export/<YYYYMMDD-HHmmss>/
```

It still does not enable export `--write`, does not execute rollback, does not write MySQL, does not modify `server/data`, and does not copy uploads.

The backup directory contains:

- `backup-manifest.json`
- `backup-summary.json`
- `risks.json`
- `failure-report.json` only when backup fails
- `files/<json-file-name>.json`

The first-phase required rollback-eligible files are copied with `rollbackEligible=true`:

- `server/data/contact-info.json`
- `server/data/company-assets.json`
- `server/data/home-video.json`
- `server/data/home-interactive-images.json`
- `server/data/articles.json`
- `server/data/cases.json`
- `server/data/solutions.json`
- `server/data/pages.json`
- `server/data/scenario-detail-pages.json`

`server/data/media-library.json` is copied when present as `specialHandling=metadata_safety_anchor` and `rollbackEligible=false`.

`server/uploads/**` and `server/data/publish-logs/**` remain excluded. The generated `risks.json` must record uploads, publish logs, MySQL rows, tombstone rows, and media-library metadata-only limitations.

`--plan-backup` remains report-only and does not create a backup directory. `--create-backup` is the explicit real-backup opt-in.

`--write` and `--rollback` remain safely rejected after this implementation. A real backup alone does not make rollback available; `canRollback` remains `false` until temp-only rollback rehearsal is implemented and accepted.

## 12. Round 22-7-5D-2 Rollback Rehearsal Temp-Only Boundary

Round 22-7-5D-2 is a documentation and `.gitignore` boundary landing step only.

It does not implement rollback rehearsal, does not execute rollback, does not overwrite `server/data`, does not write MySQL, does not restore uploads, does not restore publish logs, and does not restore `media-library.json`.

`--rollback` and `--write` remain safely rejected. This step does not allow low-risk module primary-write code implementation.

### Current Stage Conclusion

Current conclusions:

- Rollback rehearsal is not implemented yet.
- Real rollback has not been executed.
- `--rollback` remains the formal rollback command surface and remains disabled.
- `--write` remains disabled.
- `server/data` is not covered by any temp-only restore write.
- MySQL is not written.
- Uploads, publish logs, and media-library restore are not covered.
- The project cannot enter low-risk module primary-write code implementation from this step.

### Output Directory

Future temp-only rollback rehearsal should restore into:

```text
server/data-restore-rehearsals/mysql-json-export/<YYYYMMDD-HHmmss>/
```

Rules:

- Each rehearsal must use a unique timestamp directory.
- If the target directory already exists, rehearsal must fail and must not overwrite it.
- Restore artifacts must not enter Git.
- `server/data-restore-rehearsals/` must be ignored by `.gitignore`.
- The default `restoreRoot` must not be `server/data`.
- The default `restoreRoot` must not be inside `server/uploads`.
- Optional `--restore-dir <path>` must use the same path protections.

### Trusted Input

The only trusted rehearsal input is:

```text
backup-manifest.json
```

The future implementation must validate:

- the manifest file exists
- `schemaVersion` is supported
- `backupId` exists
- `backupRoot` exists
- `files[]` exists
- each selected `files[].backupPath` exists
- only `rollbackEligible=true` files are processed
- `rollbackEligible=false` files are skipped
- `media-library.json` is skipped
- `server/data/publish-logs/**` is skipped
- `server/uploads/**` is skipped

Manifest self-hashing can be a future enhancement. The temp-only implementation may first compute the manifest file SHA-256 and record it as `sourceBackupManifestSha256` in the restore manifest.

### Restore Scope

The first temp-only restore phase may restore only these nine rollback-eligible JSON files:

- `contact-info.json`
- `company-assets.json`
- `home-video.json`
- `home-interactive-images.json`
- `articles.json`
- `cases.json`
- `solutions.json`
- `pages.json`
- `scenario-detail-pages.json`

The first temp-only restore phase must exclude:

- `media-library.json`
- `server/data/publish-logs/**`
- `server/uploads/**`
- MySQL
- tombstone rows
- `migration_logs`
- `dist-prerender`
- export outputs
- the backup directory itself

### Restore Manifest Schema

The restore manifest must include at least:

- `schemaVersion`
- `rehearsalId`
- `createdAt`
- `sourceBackupId`
- `sourceBackupManifestPath`
- `sourceBackupManifestSha256`
- `sourceBackupRoot`
- `restoreRoot`
- `mode: "temp-only"`
- `overwroteServerData: false`
- `wroteMysql: false`
- `restoredFiles[]`
- `skippedFiles[]`
- `excludedItems[]`
- `validationStatus`
- `risks[]`
- `failureReportPath`

Each `restoredFiles[]` item must include at least:

- `relativePath`
- `backupPath`
- `restorePath`
- `rollbackEligible`
- `backupSha256`
- `restoredSha256`
- `hashMatched`
- `sizeBytes`
- `recordCount`
- `shapeSummary`
- `warnings`

### Restore Validation

After temp-only restore, validation must confirm:

- only `rollbackEligible=true` files were restored
- restored file count is exactly 9
- each restored file hash matches the backup file hash
- restored JSON files are readable
- `recordCount` and `shapeSummary` can be generated
- `restoreRoot` is not `server/data`
- `restoreRoot` is not inside `server/uploads`
- `server/data` was not modified
- uploads were not modified
- MySQL was not written
- the backup directory was not modified
- `git status` has no tracked pollution from rehearsal output

### Failure Report

Rollback rehearsal failure must produce a failure report with at least:

- `failedAt`
- `rehearsalId`
- `sourceBackupId`
- `failedStep`
- `failedFile`
- `errorMessage`
- `partialFilesRestored`
- `cleanupStatus`
- `serverDataTouched: false`
- `mysqlTouched: false`
- `uploadsTouched: false`
- `manualActionRequired`
- `risks`

Failure policy:

- Any required rollback-eligible file restore failure fails the rehearsal.
- Hash mismatch fails the rehearsal.
- Missing manifest fails the rehearsal.
- Missing backup file fails the rehearsal.
- Unreadable JSON fails the rehearsal.
- `restoreRoot` pointing to `server/data` must be rejected.
- `restoreRoot` pointing inside `server/uploads` must be rejected.
- Partial success must not be marked as passed.

### CLI Boundary

The recommended future temp-only command is:

```text
--rehearse-rollback <backup-manifest-path>
```

Optional restore override:

```text
--restore-dir <path>
```

Rules:

- `--rehearse-rollback` performs only temp-only rehearsal.
- `--rollback` remains formal rollback and remains disabled.
- `--rollback` must not be used to disguise temp-only rehearsal.
- `--rehearse-rollback` must not overwrite `server/data`.
- `--rehearse-rollback` must not write MySQL.
- `--rehearse-rollback` must not restore uploads.
- `--restore-dir` must reject `server/data` and `server/uploads`.
- Without `--restore-dir`, the default restore rehearsal directory must be used.

### Relationship To Write Mode

Only real backup plus accepted temp-only rollback rehearsal can allow discussion of opening `export --write`.

Backup alone is not enough. Rehearsal alone is not enough. `export --write` must depend on backup, and formal post-write rollback still needs a separate future design.

Current `--write` remains disabled.

### Relationship To Primary Write Code

This step does not allow low-risk module primary-write code implementation.

Remaining blockers include:

- temp-only rollback rehearsal implementation and acceptance
- primary-write code pre-implementation acceptance
- API write test plan
- final failure and partial-sync strategy confirmation
- JSON fallback retention
- no early Round 23 permissions work

## 13. Round 22-7-5D-3 Rollback Rehearsal Temp Restore Implementation

Round 22-7-5D-3 adds the temp-only rollback rehearsal implementation for the export tool.

This is not formal rollback. It does not open `--rollback`, does not open `--write`, does not overwrite `server/data`, does not write MySQL, does not restore uploads, does not restore publish logs, and does not restore `media-library.json`.

The new CLI flag is:

```text
--rehearse-rollback <backup-manifest-path>
```

Optional temp-only restore override:

```text
--restore-dir <path>
```

`--rollback` remains formal rollback and remains safely rejected. `--rehearse-rollback` must not be used as a formal rollback substitute.

### Implemented Output Directory

Without `--restore-dir`, rehearsal writes to:

```text
server/data-restore-rehearsals/mysql-json-export/<YYYYMMDD-HHmmss>/
```

The restore directory must be unique. If it already exists, rehearsal fails and does not overwrite it.

The output directory contains:

- `restore-manifest.json`
- `restore-summary.json`
- `risks.json`
- `failure-report.json` only when rehearsal fails after the restore root is created
- `files/contact-info.json`
- `files/company-assets.json`
- `files/home-video.json`
- `files/home-interactive-images.json`
- `files/articles.json`
- `files/cases.json`
- `files/solutions.json`
- `files/pages.json`
- `files/scenario-detail-pages.json`

### Implemented Input Validation

The trusted input is `backup-manifest.json`.

The implementation validates:

- manifest file existence
- readable manifest JSON
- supported `schemaVersion`
- `backupId`
- `backupRoot`
- `files[]`
- selected `files[].backupPath` existence
- selected `files[].sha256`
- backup manifest SHA-256, recorded as `sourceBackupManifestSha256`
- selected backup files are inside `backupRoot`
- restore root does not point to `server/data`, `server/uploads`, or `server/data-backups`
- restore root does not point to or contain the source backup directory

### Implemented Restore Scope

The implementation restores only the nine first-phase files where `rollbackEligible=true`:

- `server/data/contact-info.json`
- `server/data/company-assets.json`
- `server/data/home-video.json`
- `server/data/home-interactive-images.json`
- `server/data/articles.json`
- `server/data/cases.json`
- `server/data/solutions.json`
- `server/data/pages.json`
- `server/data/scenario-detail-pages.json`

It skips `rollbackEligible=false` files and excludes `media-library.json`, `server/data/publish-logs/**`, `server/uploads/**`, MySQL, tombstone rows, `migration_logs`, `dist-prerender`, export outputs, and the backup directory itself.

### Implemented Restore Reports

`restore-manifest.json` records:

- `schemaVersion`
- `rehearsalId`
- `createdAt`
- `sourceBackupId`
- `sourceBackupManifestPath`
- `sourceBackupManifestSha256`
- `sourceBackupRoot`
- `restoreRoot`
- `mode: "temp-only"`
- `overwroteServerData: false`
- `wroteMysql: false`
- `restoredFiles[]`
- `skippedFiles[]`
- `excludedItems[]`
- `validationStatus`
- `risks[]`
- `failureReportPath`

Each restored file records `relativePath`, `backupPath`, `restorePath`, `rollbackEligible`, `backupSha256`, `restoredSha256`, `hashMatched`, `sizeBytes`, `recordCount`, `shapeSummary`, and `warnings`.

`restore-summary.json` records rehearsal status, source backup id, restore root, required count, restored count, skipped count, excluded count, warning count, blocker count, `overwroteServerData=false`, and `wroteMysql=false`.

`risks.json` records the temp-only nature of rehearsal, the exclusions, disabled formal rollback, disabled write mode, and the continuing JSON fallback requirement.

Failure reports record `failedAt`, `rehearsalId`, `sourceBackupId`, `failedStep`, `failedFile`, `errorMessage`, `partialFilesRestored`, `cleanupStatus`, `serverDataTouched=false`, `mysqlTouched=false`, `uploadsTouched=false`, `manualActionRequired`, and risks.

### Implemented Validation

After restore, rehearsal validates:

- only `rollbackEligible=true` first-phase files were restored
- restored file count is exactly 9
- backup file hashes match manifest hashes
- restored file hashes match backup file hashes
- restored JSON files are readable
- `recordCount` and `shapeSummary` are generated
- `server/data` required JSON hashes did not change
- backup input files and manifest did not change
- `git status --short -uall` has no tracked pollution from rehearsal output

The rehearsal does not depend on MySQL. It can run when `MYSQL_*` variables are unset, and every report records `wroteMysql=false`.

### Relationship To Write And Primary Writes

`--write` remains safely rejected after Round 22-7-5D-3. A real backup plus accepted temp-only rehearsal can only allow discussion of future `export --write`; it does not open write mode by itself.

Low-risk module MySQL primary-write code remains blocked until the temp-only rehearsal acceptance, primary-write pre-implementation acceptance, API write test plan, final failure or partial-sync strategy, and JSON fallback policy are all accepted.

## 14. Forbidden Interpretations

This document is not an export `--write` enablement instruction.

This document is not a rollback execution instruction.

This document is not a JSON freeze instruction.

This document is not a JSON deletion instruction.

This document is not a MySQL primary-write switch instruction.

This document is not a Round 23 permission entry point.

Any implementation must be confirmed in a separate later step.
