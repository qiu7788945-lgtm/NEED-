# 第22-7-5K-2｜home-video primary write 策略边界

This document lands the Round 22-7-5K-2 strategy boundary for future `home-video` MySQL primary write work.

It is a documentation-only step. It does not change application code, routes, services, data-source code, export code, schema, migrations, MySQL data, `server/data/**/*.json`, uploads, fallback behavior, export `--write`, or Round 23 permissions.

## 1. Current Conclusion

`home-video` is not an ordinary low-risk module now.

`home-video` is temporarily classified as a medium-risk primary-write candidate because:

- it had an `updatedAt` export warning risk until the raw_json priority export step;
- the timestamp policy for future primary writes is still not closed;
- it carries both video and poster media fields;
- the scalar `home_video` columns cannot fully represent the existing JSON shape without `raw_json`;
- `home_video.raw_json` is now the accepted shape-preservation source for export, not a primary-write switch;
- `media_files` cannot be a hard dependency;
- the current home route required checks do not directly verify `videoUrl` or `posterUrl`.

`home-video` must not directly copy the implementation pace used by `contact-info`, `home-interactive-images`, or `company-assets`.

The project must not enter `home-video` primary-write code implementation until timestamp and media-field strategy are accepted.

## 2. Current Read And Write Chain

The runtime read path is already MySQL-first with JSON fallback:

- API route: `/api/home/video`
- route file: `server/src/routes/home.routes.ts`
- controller: `getHomeVideo`
- service: `readHomeVideoConfig`
- data-source reader: `readHomeVideoWithMysqlFallback`

The read path falls back to JSON when MySQL is not configured, MySQL config is invalid, MySQL read fails, no usable active singleton row exists, or `video_url` is empty.

The current write path remains JSON primary:

- API route: `/api/home/video`
- route file: `server/src/routes/home.routes.ts`
- controller: `saveHomeVideo`
- service: `writeHomeVideoConfig`
- write target: `server/data/home-video.json`

There is no current `home-video` primary-write adapter. The current PUT path does not write MySQL, does not write `media_files`, does not modify uploads, and does not write `media-library.json`.

## 3. JSON Shape And MySQL Schema Differences

Current `server/data/home-video.json` is a singleton object.

Current JSON shape:

- `videoUrl`
- `videoFileName`
- `videoDisplayName`
- `posterUrl`
- `posterFileName`
- `posterDisplayName`
- `title`
- `description`
- `enabled`
- `updatedAt`

The current JSON `updatedAt` value is:

```text
2026-04-30T13:32:35.4234094+08:00
```

The current MySQL `home_video` table has:

- `video_media_id`
- `poster_media_id`
- `video_url`
- `poster_url`
- `title`
- `description`
- `is_enabled`
- `created_at`
- `updated_at`
- `deleted_at`
- `singleton_key`

The scalar MySQL `home_video` columns do not have:

- `videoFileName`
- `videoDisplayName`
- `posterFileName`
- `posterDisplayName`

Therefore, scalar `home_video` columns alone cannot fully restore the existing JSON shape. The `raw_json` column is the accepted export-preservation source after Round 22-7-5K-6E/K-6G, but it does not make `home-video` MySQL-primary.

## 4. updatedAt / Timestamp Strategy

JSON `updatedAt` is part of the current JSON shape.

The current JSON `updatedAt` value comes from historical JSON data. It must not be automatically refreshed without explicit authorization.

MySQL `updated_at` should be treated as an internal database update timestamp. It must not directly overwrite JSON shape `updatedAt`.

Future primary-write behavior must follow these rules:

- same-value PUT should keep JSON `updatedAt` equal to the baseline value;
- if the API body includes `updatedAt`, the body value should be preserved;
- if the API body does not include `updatedAt`, the previous JSON value should be preserved;
- JSON `updatedAt` should not be automatically refreshed;
- MySQL `updated_at` may change as an internal database field, but that change must not leak into JSON shape unless a later accepted policy explicitly says so.

Automatically refreshing JSON `updatedAt` would create tracked diffs and make export diff and baseline acceptance unstable.

The raw_json priority exporter must output JSON `updatedAt` from `home_video.raw_json.updatedAt`. MySQL `updated_at` remains an internal database timestamp and must not overwrite the JSON shape timestamp.

Until this timestamp strategy is implemented or otherwise explicitly accepted, `home-video` must not enter primary-write code implementation.

## 5. Video / Poster Media Field Strategy

`home-video` media fields are:

- `videoUrl`
- `videoFileName`
- `videoDisplayName`
- `posterUrl`
- `posterFileName`
- `posterDisplayName`

Future primary write must not rely on complete `media_files` rows.

`video_media_id` and `poster_media_id` may be `NULL`.

`videoUrl` and `posterUrl` should be taken from the API body. The write path must not reverse-lookup `media_files` by `media_id` and use that result to overwrite `videoUrl` or `posterUrl`.

`videoFileName`, `videoDisplayName`, `posterFileName`, and `posterDisplayName` must be preserved in JSON shadow write-back.

Future `home-video` primary write must not write:

- `media_files`
- uploads
- `media-library.json`

Any future `media_id` backfill belongs to a separate media-library / `media_files` strategy step.

## 6. Validation Strategy

Future code implementation must validate the incoming body before any MySQL write.

Minimum validation rules:

- body must be a plain object;
- body must not be an array;
- body must not be `null`;
- `enabled` must be boolean;
- `videoUrl` must be a string;
- `posterUrl` must be a string and may be empty;
- `videoFileName` must be a string;
- `posterFileName` must be a string;
- `videoDisplayName` must be a string;
- `posterDisplayName` must be a string;
- `title` must be a string;
- `description` must be a string;
- `updatedAt` must be a string or omitted;
- `subtitle` must not be silently introduced;
- when `enabled=true`, `videoUrl` should be non-empty;
- `posterUrl` may remain empty;
- string fields may be trimmed, but the existing JSON shape must be preserved;
- extra fields must either be rejected or explicitly discarded, and must not pollute the JSON shape.

Validation failure must stop before MySQL and JSON writes.

## 7. Export Diff And Warning Strategy

`home-video` export is implemented.

The previous warning risk came from exporting JSON `updatedAt` from MySQL `updated_at`.

This warning does not break current runtime behavior, but it blocks stable future export matched acceptance.

After a same-value PUT, MySQL `updated_at` will likely change. If the exporter keeps using MySQL `updated_at`, the write-after export diff may not match.

Before `home-video` primary-write implementation, the project must keep the accepted export diff behavior:

- export should preserve historical JSON `updatedAt` from `raw_json`;
- `raw_json` remains the JSON-shape source for file/display names;
- a known `updatedAt` warning should not be accepted once raw_json priority is available;
- a stable matched result means the single-module dry-run export matches `server/data/home-video.json`.

The project must not enter API write testing while the warning meaning is undefined.

Future write-after acceptance should still include single-module dry-run export for `--module home-video`. That export has stable acceptance value only after timestamp strategy is closed.

## 8. Homepage Prerender Acceptance Strategy

`home-video` affects the homepage.

`server/src/scripts/build-static-site.ts` reads `server/data/home-video.json` and renders the home video when `enabled` is true and `videoUrl` is present.

The current home route required checks do not verify `videoUrl` or `posterUrl`.

Therefore, `build:prerender` passing does not by itself prove that `home-video` fields were preserved.

If future primary-write implementation is approved, write-after acceptance must include:

- homepage `build:prerender` with MySQL configured;
- homepage `build:prerender` with no-MySQL fallback;
- explicit check that `dist-prerender/index.html` contains the expected `videoUrl`;
- explicit check that `posterUrl` is present or intentionally empty according to the baseline;
- sitemap, route manifest, and publish status checks;
- confirmation that generated artifacts remain ignored and are not committed.

Existing required checks must not be treated as full `home-video` field acceptance.

## 9. Code Implementation Preconditions

The project may enter `home-video` primary-write minimal code implementation only after all of these are accepted:

- timestamp strategy is determined;
- export warning handling is determined;
- media field preservation strategy is determined;
- JSON shape fidelity strategy is determined;
- validation rules are determined;
- schema needs for `raw_json`, `json_updated_at`, or equivalent JSON-shape storage are decided;
- the implementation is confirmed to avoid writes to `media_files`, uploads, and `media-library.json`;
- JSON shadow write-back remains enabled;
- JSON fallback remains enabled;
- API write tests continue to use UTF-8 byte body;
- write-after acceptance includes homepage dual-state prerender plus explicit video field checks.

## 10. Forbidden Items

This strategy does not permit:

- `home-video` primary-write code implementation;
- route changes;
- service changes;
- data-source changes;
- export code changes;
- schema or migration changes;
- MySQL writes;
- JSON data changes;
- uploads changes;
- API write tests;
- `build:prerender`;
- `export:content`;
- backup, rollback, or rehearsal execution;
- export `--write`;
- fallback closure;
- JSON freeze or deletion;
- Round 23 permission work;
- reclassifying `home-video` as a low-risk module.

## 11. Next Recommendation

Do not enter `home-video` primary-write code implementation now.

Keep `home-video` as a medium-risk candidate.

After this strategy is landed, the next decision should choose one of these paths:

- decide whether schema or export adjustments are required before write implementation;
- decide whether the timestamp and media strategy is sufficient to enter minimal primary-write implementation;
- decide whether to move first into the media-library / uploads exception strategy.

Before the strategy is closed and implementation is separately approved, API write testing for `home-video` remains forbidden.
