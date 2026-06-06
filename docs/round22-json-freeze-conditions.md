# Round 22 JSON Freeze Conditions

This document records the Round 22-7-7B JSON freeze condition landing.

It is a documentation-only step. It does not change business code, write MySQL, modify `server/data/**/*.json`, modify `server/uploads/**`, run API writes, run export, run prerender, run backup or rollback, freeze JSON, delete JSON, close fallback, enable export `--write`, or grant Round 23 permissions.

## 1. Purpose

The purpose of this document is to make the Round 22-7-7 read-only judgment explicit before Round 22-8 total acceptance.

It defines the current JSON freeze and delete boundary, the future-only soft freeze concept, module-by-module JSON roles, fallback requirements, export `--write` restrictions, publish log handling, and the Round 22-8 gate.

## 2. Current decision

Current hard decisions:

- `server/data/*.json` cannot be hard-frozen.
- No business JSON file can be deleted.
- `server/data/media-library.json` cannot be deleted.
- `server/data/publish-logs/**` cannot be deleted.
- JSON fallback must remain available.
- Export `--write` remains disabled.
- Publish logs remain the official publish audit chain.
- Soft freeze can be discussed later, but it is not executed in this step.
- Soft freeze is not delete and is not hard freeze.
- Round 22-8 total acceptance must explicitly check JSON freeze, JSON delete, fallback, export `--write`, and publish logs.
- Round 23 must not start early.

## 3. Freeze is not delete

Freeze and delete are separate decisions.

A freeze policy would only define who may write or manually edit a JSON file. It would not remove the file, remove fallback, remove JSON shadow write-back, open export write mode, or prove rollback readiness.

Deleting JSON is a higher-risk action because current JSON files still provide fallback, backup, exact pre-write state, export comparison source, emergency recovery evidence, route/prerender inputs, or audit records.

## 4. Hard freeze is not allowed

Hard freeze of `server/data/*.json` is not allowed in the current project state.

Blocking conditions:

- JSON fallback is still a Round 22 safety mechanism.
- `media-library.json` and uploads remain an asset-layer exception and safety anchor.
- Media ownership report implementation is deferred.
- Uploads backup / restore implementation is deferred.
- Delete recovery, tombstone, quarantine, and soft-delete implementation are deferred.
- Export `--write` is disabled.
- Formal rollback is disabled.
- Repair / replay behavior is not implemented.
- Route manifest, prerender, sitemap, and static build dependencies still read JSON in selected paths.
- Round 22-8 total validation has not been completed.

Hard freeze must not be used to imply single-source completion.

## 5. Soft freeze is only a future policy candidate

Soft freeze is a future policy candidate only.

If accepted later, soft freeze can only mean that manual direct edits to selected JSON files are forbidden. It does not mean:

- JSON files are deleted.
- JSON fallback is closed.
- JSON shadow write-back is closed.
- Hard freeze is active.
- Export `--write` is open.
- Formal rollback is available.
- Repair / replay is implemented.
- Round 22-8 can be skipped.
- Round 23 can start early.

Whether soft freeze can be used must be decided after Round 22-8 total acceptance or in a separately approved follow-up such as Round 22-7-7C.

This step does not execute any soft freeze.

## 6. Why JSON cannot be deleted

JSON cannot be deleted because current JSON files still serve one or more required roles:

- Runtime fallback when MySQL is unavailable or incomplete.
- Shadow write-back and backup source after selected MySQL primary-write paths.
- Exact pre-write file state for backup and rehearsal.
- Export comparison source.
- Emergency repair source.
- Route manifest, prerender, sitemap, or static build input.
- Media-library metadata safety anchor.
- Publish audit chain.
- Deferred source for PageEditor, pages, scenario details, and future route ownership.

Deleting JSON before these roles are replaced and accepted would remove recovery evidence and make later validation weaker.

## 7. Module-by-module JSON roles

| Module / path | Current JSON role | Current decision |
| --- | --- | --- |
| `contact-info.json` | MySQL primary-write path exists, but JSON remains shadow write-back, fallback, backup, and emergency source. | Cannot freeze or delete. |
| `company-assets.json` | MySQL primary-write path exists, but JSON remains shadow write-back, fallback, backup, and emergency source. | Cannot freeze or delete. |
| `home-interactive-images.json` | MySQL primary-write path exists, but JSON remains shadow write-back, fallback, backup, and emergency source. The 12-slot invariant still needs protection. | Cannot freeze or delete. |
| `home-video.json` | MySQL primary-write path exists, and Round 22 evidence records staged raw_json/export/homepage-prerender acceptance for the current scope. JSON remains shadow write-back, fallback, backup, and emergency source. | Cannot freeze or delete. |
| `articles.json` | Read paths have MySQL fallback and export capability, but create/update/delete still write JSON. JSON remains the primary write and backup source. | Cannot freeze or delete. |
| `cases.json` | JSON remains the primary source. MySQL is a partial shadow/tombstone path for selected writes. | Cannot freeze or delete. |
| `solutions.json` | JSON remains the primary source. MySQL is a partial shadow path for selected group/item writes. | Cannot freeze or delete. |
| `pages.json` | Current source may be empty or skipped, but it is still the exact state backup for route, PageEditor, and deferred source decisions. | Cannot delete. |
| `scenario-detail-pages.json` | Current source may be empty or deferred, but it remains needed for future route and PageEditor ownership decisions. | Cannot delete. |
| `media-library.json` | Metadata safety anchor for uploads and media-library. It is not ordinary first-phase content rollback input. | Must be retained; cannot freeze or delete. |
| `publish-logs/*.json` | Official publish audit chain. Not ordinary content rollback input. | Must be retained; cannot delete. |

## 8. Fallback requirements

Fallback must remain available.

No-MySQL fallback has been validated for selected modules, but that is not a reason to close fallback. It proves the safety path works; it does not prove the safety path is no longer needed.

Modules with validated no-MySQL fallback evidence include:

- `contact-info`
- `company-assets`
- `home-interactive-images`
- `home-video`

`articles`, `cases`, `solutions`, `pages`, `scenario-detail-pages`, and `media-library` still have JSON primary, fallback, backup, or safety-anchor meaning.

Fallback closure remains blocked.

## 9. Export --write restrictions

Export `--write` remains disabled.

The code-level export boundary remains:

- `writeModeEnabled=false`
- `--write` is rejected
- `canRollback=false`
- `rollbackAvailable=false`
- `rollbackModeEnabled=false`

Current blockers include:

- media-library / uploads exception
- ownership report implementation deferred
- uploads backup / restore implementation deferred
- delete recovery implementation deferred
- formal rollback disabled
- repair / replay not implemented

Future module-scoped export write can be considered only after separate acceptance. This document does not open any export write mode.

## 10. Publish logs handling

`server/data/publish-logs/**` is the official publish audit chain.

Publish logs:

- must be retained
- must not be deleted
- must not be treated as ordinary content rollback input
- must not replace Round 23 operation logs
- do not block main business content migration by themselves
- do block any blanket deletion of `server/data` JSON

Round 22-8 must confirm that publish logs do not block the main content acceptance while remaining preserved.

## 11. Media-library / uploads exception impact

`server/data/media-library.json` remains a metadata safety anchor.

Uploads remain physical file sources under `server/uploads/**`. MySQL metadata cannot recreate missing uploaded files by itself, and JSON metadata cannot recreate physical files by itself.

The media exception keeps these actions blocked:

- media-library export implementation
- media-library MySQL primary write
- media-library delete double-write
- permanent media delete
- global JSON freeze / delete
- global export `--write`
- Round 23 treatment that assumes media closure

## 12. Backup / rollback impact

Real JSON backup exists as a creation path, and temp-only rollback rehearsal exists for the first-phase rollback-eligible JSON files. These do not open formal rollback.

Formal rollback remains disabled. First-phase rehearsal does not restore `server/data`, MySQL, uploads, publish logs, tombstone rows, or `media-library.json`.

Backup and rehearsal must remain paired with fallback retention. A backup alone is not enough to freeze or delete JSON.

## 13. Route manifest / prerender impact

Route manifest, prerender, sitemap, robots, and static build dependencies still need explicit total acceptance before fallback closure or any JSON freeze/delete decision.

Known JSON-dependent areas include route manifest and static build sources for content modules such as pages, solutions, articles, cases, home video, and home interactive images.

Round 22-8 must verify these paths in their own acceptance step.

## 14. Round 22 final validation requirements

Round 22-8 total acceptance must check:

- this JSON freeze conditions document is landed
- hard freeze remains forbidden unless explicitly re-approved
- JSON delete remains forbidden
- soft freeze remains only a future policy candidate
- fallback remains enabled
- `media-library.json` remains retained
- uploads remain retained
- publish logs remain retained
- export `--write` remains disabled
- formal rollback remains disabled or has a separately accepted boundary
- media exception deferred risk is explicitly accepted
- no-MySQL fallback is fully usable
- MySQL-configured mode is fully usable
- `build:prerender` passes in the Round 22-8 validation step
- sitemap validation passes in the Round 22-8 validation step
- publish logs do not block main content acceptance
- frontend and admin UI behavior are not affected
- Git status is clean after validation

Round 22-8 must not be skipped.

## 15. Round 23 gate

Round 23 cannot start early.

Round 23 permission, login, and security work must wait until Round 22-8 total acceptance has explicitly accepted the JSON freeze/delete/fallback/export/publish-log boundaries and any deferred media risk treatment.

This document is not a Round 23 entry point.

## 16. Deferred risks

Deferred risks:

- media ownership report implementation
- uploads backup / restore implementation
- delete dry-run / impact report implementation
- tombstone storage implementation
- quarantine / soft-delete window implementation
- delete recovery temp-only restore
- repair / replay policy
- formal rollback
- export `--write`
- future soft freeze policy
- future media-library export re-entry

## 17. Explicitly forbidden actions

This document does not allow:

- business code changes
- MySQL writes
- modifications to `server/data/**/*.json`
- modifications to `server/uploads/**`
- JSON deletion
- JSON hard freeze
- soft freeze execution
- fallback closure
- export `--write`
- formal rollback
- API write tests
- media upload, delete, archive, restore, or metadata API tests
- generated artifact commits
- Round 23 entry

Do not interpret this document as proof that JSON freeze has been completed.

## 18. Follow-up steps

Suggested route markers:

- Round 22-7-7C: soft freeze policy boundary confirmation.
- Round 22-8: Round 22 total acceptance.
- Round 23: admin login, security, and permissions.

These route markers are not executed by this document.
