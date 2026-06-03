# Round 22 Low-Risk Primary Write Design Boundary

This document records the Round 22-7-5B low-risk MySQL primary-write design boundary.

It is a documentation landing step only. It does not enable MySQL primary writes, does not modify services, does not close JSON fallback, does not freeze or delete JSON, does not enable export `--write`, does not execute real API write tests, does not create backup, and does not execute rollback.

## 1. Current Phase Conclusion

Round 22-7-5B only confirms design boundaries for low-risk module MySQL primary writes.

Current conclusions:

- MySQL primary writes are not enabled.
- No service is modified by this document.
- JSON fallback remains open.
- JSON is not frozen.
- JSON is not deleted.
- Export `--write` remains disabled.
- No real API write test has been executed.
- Low-risk modules remain in the migration state: JSON primary writes, MySQL shadow or migrated rows, MySQL-first runtime reads where available, and JSON fallback.

## 2. Low-Risk Module Candidate Table

| Module | Current Runtime Read | Current Write Source | MySQL Shadow Status | Export Status | Diff Status / Warning | Media Field Risk | Candidate Priority | Can Enter Primary Write Design? | Can Enter Primary Write Code Now? | Blocking Conditions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `contact-info` | MySQL-first with JSON fallback | JSON primary | Present from migration/shadow path | Implemented | Expected matched | Low; no media-file dependency | First candidate | Yes | No | Real backup, temp-only rollback rehearsal, controlled API write test, matched export acceptance |
| `company-assets` | MySQL-first with JSON fallback | JSON primary | Present from migration/shadow path | Implemented | Expected matched | Medium; image URL and media fields | Second candidate | Yes | No | Media field strategy, no reliance on complete `media_files`, real backup, rollback rehearsal, controlled API write test |
| `home-video` | MySQL-first with JSON fallback | JSON primary | Present from migration/shadow path | Implemented | `updatedAt` warning possible | Medium; video URL, poster, and media fields | Deferred candidate | Yes | No | Timestamp policy, media field strategy, real backup, rollback rehearsal, controlled API write test |
| `home-interactive-images` | MySQL-first with JSON fallback | JSON primary | Present from migration/shadow path | Implemented | Expected matched | Medium; slot media fields | Second candidate | Yes | No | Hard 12-slot validation, media field preservation, real backup, rollback rehearsal, controlled API write test |

## 3. Module Decisions

### A. contact-info

`contact-info` is the cleanest first candidate for MySQL primary-write design.

Current state:

- Runtime read is already MySQL-first with JSON fallback.
- Current writes remain JSON primary.
- MySQL shadow or migrated rows already exist.
- MySQL-to-JSON export is implemented.
- Export is expected to match the current source JSON.

Before primary-write code can start, the module still requires real backup, temp-only rollback rehearsal, controlled API write tests, and accepted matched export results.

After a future MySQL primary write, JSON shadow write-back should remain enabled until fallback closure conditions pass in a later step. JSON's future role is fallback, backup, rollback source, archive, and emergency recovery. JSON must not be deleted.

### B. company-assets

`company-assets` can be a first-batch candidate, but only with an explicit media field strategy.

Current state:

- Runtime read is already MySQL-first with JSON fallback.
- Current writes remain JSON primary.
- MySQL shadow or migrated rows already exist.
- MySQL-to-JSON export is implemented.
- Export is expected to match the current source JSON.

This module includes `imageUrl`, `imageAlt`, `media_url`, `media_id`, and related display fields. Primary-write design must not use `media_files` completeness as the only source of truth. Missing or incomplete `media_files` rows must not break the existing JSON shape.

After a future MySQL primary write, JSON shadow write-back should remain enabled. The media-library and uploads closure risk must not be mixed into this module's primary-write implementation. Company assets may store or preserve media references, but they must not attempt to solve full media-library, upload backup, or physical-file rollback in this step.

### C. home-video

`home-video` can enter design discussion, but it should not be the first module to receive primary-write code.

Current state:

- Runtime read is already MySQL-first with JSON fallback.
- Current writes remain JSON primary.
- MySQL shadow or migrated rows already exist.
- MySQL-to-JSON export is implemented.
- Export can carry an `updatedAt` warning.

The timestamp warning does not block design discussion, but it blocks primary-write code acceptance. Before implementation, the project must define whether the module preserves the historical JSON `updatedAt`, uses MySQL `updated_at`, or normalizes timestamps at write time.

This module also includes video URL, poster URL, and media fields. Primary-write design must not rely on incomplete `media_files` rows. The future write path must preserve video URL, video file name, video display name, poster URL, poster file name, poster display name, title, description, enabled state, and accepted timestamp behavior.

### D. home-interactive-images

`home-interactive-images` can be a first-batch candidate, but the 12-slot shape is a hard invariant.

Current state:

- Runtime read is already MySQL-first with JSON fallback.
- Current writes remain JSON primary.
- MySQL shadow or migrated rows already exist.
- MySQL-to-JSON export is implemented.
- Export is expected to match the current source JSON.

Future MySQL primary writes must guarantee:

- exactly 12 slots
- unique `slotNo` values from 1 to 12
- empty slots are preserved and not accidentally deleted
- stable `sortOrder`
- stable `enabled` state
- no media field loss

Before implementation, this module needs dedicated 12-slot validation for write input, MySQL persistence, JSON shadow write-back, export, compare, and fallback response shape.

After a future MySQL primary write, JSON shadow write-back should remain enabled until fallback closure is separately accepted.

## 4. Recommended Primary-Write Mode

### Mode A: MySQL primary write plus JSON shadow write-back

In this mode:

- API writes MySQL first.
- After MySQL succeeds, the write path synchronizes JSON.
- JSON remains fallback, backup input, rollback source, archive, and emergency recovery.
- This fits the Round 22 transition state.
- The main risks are dual-write consistency and partial failure.

Conclusion: low-risk module next-stage design should prioritize Mode A.

### Mode B: MySQL primary write without real-time JSON sync

In this mode:

- API writes only MySQL.
- JSON is not updated in real time.
- Scheduled or manual export regenerates JSON.
- The risks are stale fallback, stale prerender inputs, stale route or sitemap inputs, and weaker rollback freshness.

Conclusion: Mode B is not recommended now. It is especially unsuitable for `company-assets`, `home-video`, and `home-interactive-images`, because those modules carry media fields, fallback expectations, and prerender/static-source risks.

### Mode C: Continue JSON primary write plus MySQL shadow

In this mode:

- The current migration state remains.
- Risk stays lowest.
- The project cannot complete single-primary-source closure.

Conclusion: the project is still actually in Mode C. Moving toward Mode A requires later small-step confirmation.

## 5. MySQL Primary-Write Preconditions

Before any low-risk module primary-write code begins, these conditions must be satisfied:

- Real backup is implemented.
- Backup manifest is traceable.
- Rollback rehearsal has passed and restores only to a temporary directory.
- The target module export dry-run is matched, or every warning has an accepted criterion.
- Export `--write` cannot bypass backup.
- JSON fallback remains available.
- Controlled API write test plan is accepted.
- MySQL write failure strategy is accepted.
- JSON write-back failure strategy is accepted.
- Compare-after-write strategy is accepted.
- Write audit or report strategy is accepted.
- Publish, prerender, route manifest, and sitemap behavior are not affected.
- Media fields do not depend on incomplete `media_files`.
- Delete operations do not enter the first primary-write batch.
- JSON fallback is not closed.
- JSON is not frozen or deleted.

## 6. Failure Strategy Design

Future low-risk MySQL primary writes must follow these failure rules:

- If MySQL primary write fails, the API should fail.
- The write path must not fall back to writing JSON and pretend that MySQL primary write succeeded.
- If MySQL succeeds but JSON shadow write-back fails, the API must not silently report full success.
- Partial failure must be recorded.
- Partial failure must prevent the module from entering a "fully closed" state.
- Compare-after-write is required.
- Write audit log or write report is required, but it must not be confused with Round 23 permission or operation logs.
- Single-row or single-module MySQL writes should use transactions where practical.
- Cross-boundary MySQL plus JSON file writes are not naturally transactional, so partial failure reporting is mandatory.
- Delete operations must not be included in the first primary-write batch.
- Manual repair or replay tooling needs a design boundary, but this document does not implement it.

## 7. Real API Write Test Boundary

Future real API write tests must be controlled.

Rules:

- Use test data or recoverable controlled fields.
- Create real backup before testing.
- After testing, run temp-only rollback rehearsal and compare validation.
- Do not pollute production JSON.
- Do not leave polluted MySQL rows.
- Test data must be identifiable, cleanable, and auditable.
- Verify API response shape.
- Verify fallback behavior.
- Verify export diff.
- Verify prerender, route manifest, and sitemap are unaffected.
- Cleanup must cover MySQL, JSON shadow write-back, audit or reports, and final git status.

## 8. Module Priority Recommendation

First candidate:

- `contact-info`

Second candidates:

- `home-interactive-images`
- `company-assets`

Deferred candidate:

- `home-video`, until timestamp strategy is accepted.

Rationale:

- `contact-info` has no media-file dependency and is the cleanest low-risk module.
- `home-interactive-images` has a hard 12-slot invariant, but its export is expected matched and the invariant can be tested directly.
- `company-assets` is viable, but its media fields require a careful field preservation strategy.
- `home-video` has an `updatedAt` warning and should define timestamp policy before code acceptance.

## 9. Relationship to Later Round 22-7 Steps

Round 22-7-5B only lands the design document.

Before low-risk primary-write code implementation, later steps must at least complete:

- real backup implementation boundary confirmation
- rollback rehearsal temp-only implementation boundary confirmation
- low-risk primary-write code pre-implementation acceptance

Media-library and uploads single-source exception strategy remains Round 22-7-6.

JSON freeze condition judgment remains Round 22-7-7.

Round 22-7 total acceptance remains Round 22-7-8.

## 10. Forbidden Interpretations

This document is not a MySQL primary-write switch instruction.

This document is not a service modification instruction.

This document is not an export `--write` enablement instruction.

This document is not a fallback closure instruction.

This document is not a JSON freeze instruction.

This document is not a JSON deletion instruction.

This document is not a Round 23 permission entry point.

Any code implementation must be confirmed in a separate later step.
