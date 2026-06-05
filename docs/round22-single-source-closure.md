# Round 22 Single Source Closure Matrix

This document records the Round 22-7-2 source of truth matrix and closure decision table.

It is a decision document only. It does not switch any service to MySQL primary writes, does not freeze JSON, does not delete JSON, does not close JSON fallback, does not enable export `--write`, does not execute rollback, and does not grant Round 23 permissions.

## Current Phase Conclusion

Round 22-7 is the pre-closure decision phase for single primary data source ownership.

The current project state is still a migration state:

- JSON primary writes.
- MySQL-first runtime reads for migrated modules.
- JSON fallback remains available.
- MySQL shadow writes exist for selected write paths.
- MySQL to JSON export is dry-run only.
- Backup and rollback exist only as report-only skeletons.

Current hard conclusions:

- MySQL primary writes are not allowed yet.
- JSON must not be frozen yet.
- JSON must not be deleted.
- JSON fallback must not be closed.
- Export `--write` must not be opened.
- Real rollback must not be executed.
- Round 23 permission work must not be mixed into Round 22.

## Global Principles

MySQL primary write design must be decided module by module. The project must not switch every service at once.

The low-risk module primary-write design boundary is defined in [Round 22 Low-Risk Primary Write Design Boundary](./round22-low-risk-primary-write-design.md). It permits design discussion for `contact-info`, `company-assets`, `home-video`, and `home-interactive-images`, but it does not permit primary-write code implementation. `home-video` now has a dedicated medium-risk strategy boundary in [Round 22 Home Video Primary Write Strategy](./round22-home-video-primary-write-strategy.md).

JSON must not be deleted. Its future role is downgrade only: backup, export result, rollback source, archive, or emergency fallback.

`media-library` and uploads are the largest global blockers for single-source closure. MySQL can store metadata and public paths, but upload files remain physical or object-storage assets outside MySQL.

JSON publish logs remain the official publish record chain. MySQL `publish_logs` is only a shadow/index table at this stage.

Route manifest, prerender, sitemap, and robots dependencies must be confirmed separately before any fallback closure.

Real backup and rollback rehearsal are prerequisites before closing fallback or allowing write-mode overwrites.

The concrete Round 22 backup and rollback rehearsal scope is defined in [Round 22 Backup / Rollback Rehearsal Scope](./round22-backup-rollback-rehearsal.md). The first rehearsal phase is temp-only and must not overwrite `server/data`, restore MySQL, restore uploads, or restore publish logs.

Real API write tests are prerequisites before any module becomes MySQL primary write.

Round 23 permissions must not be pulled into Round 22 closure work.

## Source of Truth Matrix

| Module | Runtime Read Source | Current Write Source | MySQL Shadow Status | MySQL -> JSON Export Status | JSON Fallback Required | Can Enter MySQL Primary Write Design? | Blocking Conditions | Warning / Deferred Items | Future JSON Role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `contact-info` | MySQL-first with JSON fallback | JSON primary | Present from migration/shadow path | Implemented; expected matched | Yes | Yes, low risk design only | Real backup, rollback rehearsal, controlled write API test, export matched acceptance | None currently blocking | Backup, rollback source, emergency fallback, archive |
| `company-assets` | MySQL-first with JSON fallback | JSON primary | Present from migration/shadow path | Implemented; expected matched | Yes | Yes, low risk design only | Real backup, rollback rehearsal, controlled write API test, media URL/image field acceptance | Media references must be confirmed without making `media_files` the only source | Backup, rollback source, emergency fallback, archive |
| `home-video` | MySQL-first with JSON fallback | JSON primary | Present from migration/shadow path | Implemented; warning on timestamp possible | Yes | Yes, medium-risk candidate after timestamp/media strategy | Real backup, rollback rehearsal, controlled write API test, timestamp acceptance, media field preservation, export warning acceptance | `updatedAt` warning; video/poster media fields; no `raw_json` in `home_video` | Backup, rollback source, emergency fallback, archive |
| `home-interactive-images` | MySQL-first with JSON fallback | JSON primary | Present from migration/shadow path | Implemented; expected matched | Yes | Yes, after 12-slot guard validation | Real backup, rollback rehearsal, controlled write API test, stable 12-slot export/compare/rollback | 12-slot invariant must remain hard | Backup, rollback source, emergency fallback, archive |
| `articles` | MySQL-first with JSON fallback | JSON primary | Shadow database exists; write side is not primary | Implemented; warning | Yes | Yes, discussion only | Raw shape strategy, SEO/FAQ write strategy, timestamp policy, real backup, rollback rehearsal, controlled write API tests | No `raw_json` column in current export context; created/updated timestamp differences | Backup, rollback source, emergency fallback, archive |
| `cases` | MySQL-first with JSON fallback | JSON primary plus MySQL shadow for selected paths | Present and relatively broad | Implemented; warning | Yes | Yes, discussion only | Word import, `case_images`, delete tombstone, media references, timestamp policy, rollback rehearsal, real API write tests | Timestamp warning; media and Word-import risks | Backup, rollback source, emergency fallback, archive |
| `solutions` | MySQL-first with JSON fallback | JSON primary plus MySQL shadow for group/item paths | Present and relatively broad | Implemented; matched in current acceptance | Yes | Yes, discussion only | Hierarchical write consistency, video-digital-assets invariant, delete rehearsal, rollback rehearsal, media boundary, scenario/page split boundary | `scenario-detail-pages`, `solution_pages`, and `solution_page_blocks` remain deferred | Backup, rollback source, emergency fallback, archive |
| `pages` | JSON exposed behavior; MySQL check guarded | JSON primary | Schema/shadow exists, but source is empty | `skipped_empty_source` | Yes | No, defer until real PageEditor source exists | Real content source, route ownership, prerender/sitemap policy, write tests | Empty source; do not infer extra MySQL content | Backup, rollback source, emergency fallback, archive when populated |
| `media-library` | MySQL-first list may fall back to JSON/uploads, but official closure is not complete | JSON/uploads primary with selected MySQL shadow | Present but shared and incomplete for closure | Deferred | Yes | No, needs dedicated strategy first | Ownership rules, shared references, uploads backup, delete guard, physical file rollback, `media_files` consistency | Largest global blocker; delete not fully closed | Safety anchor, backup, rollback source for metadata, archive |
| `publish-logs` | JSON publish log chain | JSON generated by publish/prerender | MySQL shadow/index only | Not content export; not blocking | Yes | No for content primary write; separate traceability decision only | Preserve official publish traceability, do not replace Round 23 operation logs | Not in rollback scope; may drift from MySQL shadow index | Official publish record, archive, traceability backup |
| `scenario-detail-pages` | JSON or empty/deferred source | JSON primary when present | Schema/planning exists | Deferred / empty source | Yes | No, defer | Real source, route ownership, PageEditor boundary, prerender policy | Empty/deferred; not current mainline | Backup, rollback source, emergency fallback, archive when populated |
| `solution_pages / solution_page_blocks` | Deferred; not current runtime primary chain | Deferred / not current primary write chain | Schema exists | Deferred | Yes | No, defer | PageEditor ownership, solution detail ownership, route/prerender policy, write strategy | Related to scenario detail/PageEditor direction | Backup, rollback source, emergency fallback, archive when activated |

## Module Decision Details

### contact-info

`contact-info` may enter low-risk MySQL primary write design discussion.

It must not switch directly to MySQL primary write in this step. Before primary write, the module needs real backup, rollback rehearsal, controlled write API tests, and an accepted matched export result.

Future JSON role: backup, emergency fallback, export result, and rollback source.

### company-assets

`company-assets` may enter low-risk MySQL primary write design discussion.

The module includes media URL and image fields, so primary write design must confirm media URL behavior, image field preservation, and export shape stability.

The module must not use `media_files` completeness as the only prerequisite for primary write. JSON remains required while the media-library/uploads closure is unresolved.

Future JSON role: backup, emergency fallback, export result, and rollback source.

### home-video

`home-video` may enter MySQL primary write design discussion.

The current export can carry an `updatedAt` warning because MySQL row timestamps may differ from the historical JSON timestamp. This does not block Round 22-7 discussion, but it does block exact write overwrite acceptance until a timestamp policy is defined.

Round 22-7-5K-2 classifies `home-video` as a medium-risk candidate, not an ordinary low-risk module. It must not enter primary-write code implementation until timestamp policy, video/poster media-field preservation, JSON shape fidelity, and export warning acceptance are closed. The write path must not depend on or write `media_files`, uploads, or `media-library.json`.

Future JSON role: backup, emergency fallback, export result, and rollback source.

### home-interactive-images

`home-interactive-images` may enter MySQL primary write design discussion.

The 12-slot structure is a hard invariant. Before primary write, compare, export, rollback rehearsal, and API write tests must prove that the 12 slots remain stable and ordered.

Future JSON role: backup, emergency fallback, export result, and rollback source.

### articles

`articles` may enter MySQL primary write design discussion.

The current export has warning risk around absent `raw_json` and `createdAt` / `updatedAt` differences. Before primary write, the project must decide the article shape recovery strategy, SEO/FAQ write-back strategy, timestamp policy, and acceptance criteria for reconstructed JSON shape.

JSON fallback must remain available.

Future JSON role: backup, emergency fallback, export result, and rollback source.

### cases

`cases` may enter MySQL primary write design discussion.

The shadow write coverage is relatively broad, but primary write is still blocked by Word import, `case_images`, delete tombstone behavior, media references, timestamp warnings, real API write tests, and rollback rehearsal.

The case structure must not be inferred from `media_files`. `media_files` can support media metadata, but it cannot define the case content shape.

Future JSON role: backup, emergency fallback, export result, and rollback source.

### solutions

`solutions` may enter MySQL primary write design discussion.

The current export is matched in the latest acceptance state, and group/item shadow/tombstone behavior is relatively mature. Primary write is still blocked by hierarchical write consistency, the `video-digital-assets` one-item rule, delete rehearsal, media boundary, rollback rehearsal, and deferred solution page ownership.

PageEditor must not take over the current scene-solution model during this closure step.

JSON fallback must remain available.

Future JSON role: backup, emergency fallback, export result, and rollback source.

### pages

`pages` is currently an empty source.

It does not block core content closure discussion, but it must not be forced into MySQL primary ownership by reverse-exporting content that is not part of the accepted current source.

When real PageEditor content exists, pages need a separate source of truth decision, route ownership review, prerender review, and write strategy.

### media-library

`media-library` is the largest global blocker for single-source closure.

`media_files` must not be treated as the only media asset source. It is shared across media-library, home modules, company assets, cases, and solutions. Ownership rules, shared references, delete guard behavior, and unknown ownership must be settled first.

Uploads cannot be recovered from MySQL alone. Physical file backup or object-storage backup is required before any real rollback or single-source closure.

Permanent delete remains sensitive and not fully closed. `media-library.json` must remain a safety anchor.

This area should have a dedicated media-library/uploads source of truth strategy.

### publish-logs

JSON publish logs are the official publish record chain.

MySQL `publish_logs` is a shadow/index table. It does not block main content single-source discussion, but publish logs are not part of the current content rollback scope.

Publish logs must not be used as a replacement for Round 23 operation logs.

Future JSON role: official publish traceability, archive, and recovery reference.

### scenario-detail-pages

`scenario-detail-pages` is currently empty/deferred.

It does not block core content closure discussion and should not be forced into the current mainline. It needs a separate source, route, PageEditor, and prerender decision when real content exists.

### solution_pages / solution_page_blocks

`solution_pages` and `solution_page_blocks` are deferred.

They are related to scenario detail and PageEditor direction, but they do not block current main content closure. They need a separate source of truth decision before any active runtime or write ownership.

## Blocking Conditions Summary

Global blockers before fallback closure or real MySQL primary write:

- Real backup exists for first-phase JSON, but backup plus rollback rehearsal acceptance must remain paired.
- Temp-only rollback rehearsal exists, but formal rollback is not implemented.
- Export `--write` is not open.
- MySQL primary write is not open.
- JSON fallback cannot be closed.
- `media-library` and uploads are not closed.
- Some warnings do not yet have accepted criteria.
- Real API write tests have not been completed.
- Route manifest, prerender, sitemap, and robots dependencies still need explicit confirmation.
- The permission system is not part of Round 22, but it affects admin safety before production launch.

## Warning Acceptance Matrix

| Warning | Blocks Round 22-7 Discussion? | Blocks MySQL Primary Write? | Blocks Export `--write`? | Needs Cleanup Step? | Suggested Handling |
| --- | --- | --- | --- | --- | --- |
| `home-video` `updatedAt` warning | No | Yes, until timestamp policy is accepted | Yes, for exact overwrite | Yes | Preserve JSON-shape `updatedAt` unless explicitly authorized; MySQL `updated_at` must not silently overwrite it. |
| `articles` raw_json absence / `createdAt` / `updatedAt` warning | No | Yes | Yes | Yes | Define reconstructed shape acceptance, SEO/FAQ strategy, and timestamp policy. |
| `cases` timestamp warning | No | Yes, until accepted | Yes, for exact overwrite | Yes | Define timestamp normalization and case export overwrite criteria. |
| Prerender `expected 17 manifest routes, but loaded 24` | No | Not directly | Not directly, but should be explained before final closure | Yes | Explain or update acceptance criteria in a dedicated route/prerender review step. |
| Historical `solutions` `cover_url` warning; current export matched | No | No current blocker if matched remains true | No current blocker if matched remains true | Monitor | Keep in acceptance notes and re-check if solution/media mappings change. |

## Recommended Round 22-7 Follow-Up Steps

- 22-7-3: warning cleanup and acceptance criteria boundary confirmation.
- 22-7-4: real backup design and rollback rehearsal boundary confirmation.
- 22-7-4B: backup / rollback scope documentation landing.
- 22-7-5: low-risk module MySQL primary write design boundary confirmation.
- 22-7-5B: low-risk module MySQL primary write design documentation landing.
- 22-7-5C-2: real backup implementation documentation and code-boundary landing.
- 22-7-5C-3: real MySQL-to-JSON backup creation implementation; `--write` and rollback remain disabled.
- 22-7-5D: rollback rehearsal temp-only implementation boundary confirmation.
- 22-7-5D-2: rollback rehearsal temp-only documentation and `.gitignore` boundary landing; no rehearsal implementation, no rollback, no `--write`, and no primary-write code.
- 22-7-5D-3: rollback rehearsal temp-only implementation; restores only 9 rollbackEligible JSON files to ignored rehearsal output, while `--rollback` and `--write` remain disabled.
- 22-7-6: media-library/uploads single-source exception strategy.
- 22-7-7: JSON freeze condition judgment.
- 22-7-8: Round 22-7 total acceptance and decision on whether to enter Round 22-8.

Round 22-7-2 itself only records the source of truth matrix and decision table.

## Forbidden Interpretations

This document is not a MySQL primary write switch instruction.

This document is not a JSON freeze instruction.

This document is not a JSON deletion instruction.

This document is not a fallback closure instruction.

This document is not an export `--write` enablement instruction.

This document is not a Round 23 permission entry point.

Any code change must be approved in a separate later step.
