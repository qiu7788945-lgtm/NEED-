# NEED API Server

This directory is the future Node.js + Express + TypeScript API layer for the NEED website system.

Current round scope:

- Express app skeleton
- `GET /api/health`
- Unified API response helpers
- Unified 404 and error middleware
- Environment config placeholder
- Database client placeholder
- Database config placeholder
- MySQL 8 schema draft
- Migration runner placeholder
- Local image upload endpoint
- Local image listing endpoint
- Local media metadata edit endpoint
- Local media usage tracking for homepage 12 image slots
- Local media archive/restore endpoints
- Local archived-media permanent delete endpoint
- Local media batch archive/restore/permanent delete endpoints
- Local image and video upload endpoint
- Static image access under `/uploads/images`
- Static video access under `/uploads/videos`
- Local homepage interactive image slot config
- Local homepage video config
- Audit service placeholder
- No database connection
- No migration execution
- No database-backed media library
- No physical deletion when media is only archived
- No COS integration
- No image compression or thumbnail generation
- No video duration extraction or video thumbnail generation
- No publishing system

Development command:

```bash
npm.cmd run dev:server
```

Health check:

```text
http://localhost:4000/api/health
```

Expected response shape:

```json
{
  "ok": true,
  "message": "OK",
  "data": {
    "service": "need-api",
    "time": "2026-04-28T00:00:00.000Z"
  }
}
```

Media upload:

```text
POST http://localhost:4000/api/media/upload
form-data field: file
optional form-data field: category
optional form-data fields: displayName, storageName, alt, description, ownerType, ownerId, ownerSlug, groupKey, slotNo, caption, enabled, sortOrder
allowed images: jpg, jpeg, png, webp
allowed videos: mp4, webm
image limit: MEDIA_MAX_IMAGE_SIZE_MB, default 10MB
video limit: MEDIA_MAX_VIDEO_SIZE_MB, default 500MB
```

Media file names:

- `originalName`: original upload filename, used for source tracking. New uploads try to decode Chinese names correctly.
- `displayName`: admin-facing asset name. If omitted, it falls back to `originalName`; use it to fix old mojibake display names.
- `fileName`: safe storage filename under `server/uploads/images/` or `server/uploads/videos/`.
- `storageName`: optional upload field for choosing the storage basename, for example `family-day-main-visual-01`. Only letters, numbers, hyphens, and underscores are allowed. The server keeps the original extension automatically.
- If the requested `storageName` already exists, the upload middleware automatically appends a suffix such as `-2` to avoid overwriting the existing file and returns a duplicate warning.

Expected response shape:

```json
{
  "ok": true,
  "message": "OK",
  "data": {
    "fileName": "image-0000000000000-abcd1234.jpg",
    "originalName": "example.jpg",
    "displayName": "family day main visual",
    "fileType": "image",
    "url": "/uploads/images/image-0000000000000-abcd1234.jpg",
    "size": 12345,
    "mimeType": "image/jpeg",
    "width": 1200,
    "height": 800,
    "duration": null,
    "category": "temporary",
    "alt": "",
    "description": "",
    "ownerType": "",
    "ownerId": null,
    "ownerSlug": "",
    "groupKey": "",
    "slotNo": null,
    "caption": "",
    "enabled": true,
    "sortOrder": 0,
    "status": "active",
    "usageCount": 0,
    "usages": [],
    "suggestedCategory": "solution_image",
    "categoryWarning": "这张素材仍是临时素材，建议归类。",
    "duplicateWarnings": [],
    "isLargeFile": false,
    "isLargeDimension": false
  }
}
```

Media list:

```text
GET http://localhost:4000/api/media/list
GET http://localhost:4000/api/media/list?category=home_interactive
GET http://localhost:4000/api/media/list?ownerType=solution&ownerSlug=family-day&groupKey=hyundai-family-day-2025
GET http://localhost:4000/api/media/list?enabled=true
GET http://localhost:4000/api/media/list?keyword=logo
GET http://localhost:4000/api/media/list?status=archived
GET http://localhost:4000/api/media/list?status=all
GET http://localhost:4000/api/media/list?fileType=image
GET http://localhost:4000/api/media/list?fileType=video
GET http://localhost:4000/api/media/list?cleanup=temporary
GET http://localhost:4000/api/media/list?cleanup=old_temporary
GET http://localhost:4000/api/media/list?cleanup=old_archived
```

`status` supports:

- `active`: normal media, also the default when `status` is omitted
- `archived`: archived media
- `all`: active and archived media

Old media index entries without `status` are treated as `active`.

Old media index entries without `fileType` are treated as `image` unless the mime type or extension clearly indicates video. Missing `duration` is returned as `null`.

Round 9.7 adds lightweight automation fields:

- `suggestedCategory`: rule-based category suggestion. It is not AI classification and does not override a user-selected category.
- `categoryWarning`: currently used to remind admins when a file remains `temporary`.
- `duplicateWarnings`: possible duplicate signals, such as same original name, same display name, same size, same original name plus size, or storage-name auto-renaming.
- `isLargeFile`: true for images larger than 2MB.
- `isLargeDimension`: true for images wider or taller than 2500px.

Duplicate warnings never block upload. The only hard upload failures are unsupported type, invalid storage name, missing file, or size limit violations.

`GET /api/media/list` also returns first-pass usage tracking fields:

- `usageCount`: number of known references.
- `usages`: usage details. It checks `server/data/home-interactive-images.json` and `server/data/home-video.json`.

Example usage item:

```json
{
  "type": "home_interactive",
  "label": "首页管理 / 创意案例现场图组",
  "detail": "第 1 张图"
}
```

Media metadata edit:

```text
PATCH http://localhost:4000/api/media/:fileName
Content-Type: application/json
```

Editable fields:

- `displayName`
- `category`
- `alt`
- `caption`
- `description`
- `ownerType`
- `ownerId`
- `ownerSlug`
- `groupKey`
- `slotNo`
- `sortOrder`
- `enabled`

This endpoint validates `fileName`, returns `MEDIA_FILE_NOT_FOUND` when the media is missing, and returns the updated media object. It never changes `fileName`, `storageName`, `originalName`, or `url`, and it does not physically rename files.

Media archive and restore:

```text
PATCH http://localhost:4000/api/media/:fileName/archive
PATCH http://localhost:4000/api/media/:fileName/restore
DELETE http://localhost:4000/api/media/:fileName
```

Archive/restore only updates `server/data/media-library.json`; it does not physically delete files from `server/uploads/images/` or `server/uploads/videos/`.

Permanent delete is different: it is only allowed for `archived` media, removes the media index entry, and deletes the real file from the matching upload directory. Active media returns `MEDIA_NOT_ARCHIVED`.

`fileName` is validated to reject path traversal. If a media file is referenced by the local homepage 12-image config or homepage video config, archive and permanent delete return `MEDIA_USED_BY_HOME` so the homepage reference can be removed first.

Batch media operations:

```text
PATCH http://localhost:4000/api/media/batch/archive
PATCH http://localhost:4000/api/media/batch/restore
DELETE http://localhost:4000/api/media/batch
```

Request body:

```json
{
  "fileNames": ["a.png", "b.jpg"]
}
```

Response body:

```json
{
  "ok": true,
  "message": "OK",
  "data": {
    "total": 2,
    "success": 1,
    "skipped": 1,
    "failed": 0,
    "results": [
      { "fileName": "a.png", "status": "success" },
      { "fileName": "b.jpg", "status": "skipped", "reason": "MEDIA_USED_BY_HOME" }
    ]
  }
}
```

Batch rules:

- Each `fileName` is validated independently.
- One failed item does not fail the whole batch.
- Batch archive only applies to `active` media.
- Batch restore only applies to `archived` media.
- Batch permanent delete only applies to `archived` media.
- Active media is skipped by batch permanent delete.
- Homepage-referenced media is skipped by batch permanent delete.

Supported categories:

- `home_interactive`
- `home_video`
- `case_image`
- `article_cover`
- `solution_image`
- `solution_video`
- `page_editor`
- `word_import`
- `qrcode`
- `temporary`

If no category is provided on upload, the file is stored as `temporary`.

Uploaded images are stored in:

```text
server/uploads/images/
```

Uploaded videos are stored in:

```text
server/uploads/videos/
```

Local media metadata is stored in:

```text
server/data/media-library.json
```

Business ownership fields:

- `ownerType`: `home`, `case`, `article`, `solution`, `page`, `word_import`, `system`, `temporary`
- `ownerId`: future database ID
- `ownerSlug`: stable business slug, for example `family-day`
- `groupKey`: image group key, for example `hyundai-family-day-2025`
- `slotNo`: position inside a group
- `sortOrder`: display order
- `enabled`: future frontend rendering should ignore disabled media
- `status`: `active` or `archived`; archived media is hidden from default media lists and pickers
- `width` / `height`: image dimensions read during upload or list fallback
- `duration`: reserved for videos; currently returned as `null`
- `displayName`: admin-facing asset name

Admin reminder fields:

- Empty `alt` should be treated as "missing GEO image description".
- `category=temporary` should be treated as unclassified media and should be categorized later.
- Temporary media older than 30 days should be reviewed for archive or delete.
- Archived media older than 30 days can be reviewed for permanent delete.

Image optimization note:

Round 9.7 does not compress images, generate thumbnails, or modify original files. It only returns large-file and large-dimension hints so admins can prepare assets before formal publishing. Future production media storage should add a deliberate image optimization and thumbnail pipeline.

Video storage note:

Round 9.7 only adds minimal local video upload for media-library readiness. For production, videos should move to Tencent Cloud COS or a video platform instead of long-term local server disk.

Homepage interactive image slots:

```text
GET http://localhost:4000/api/home/interactive-images
PUT http://localhost:4000/api/home/interactive-images
```

The config is stored in:

```text
server/data/home-interactive-images.json
```

The payload must always contain exactly 12 slots:

```json
{
  "slotNo": 1,
  "mediaUrl": "/uploads/images/example.png",
  "mediaFileName": "example.png",
  "alt": "NEED homepage image",
  "sortOrder": 1,
  "enabled": true
}
```

Homepage video config:

```text
GET http://localhost:4000/api/home/video
PUT http://localhost:4000/api/home/video
```

The config is stored in:

```text
server/data/home-video.json
```

Payload shape:

```json
{
  "videoUrl": "/uploads/videos/example.mp4",
  "videoFileName": "example.mp4",
  "videoDisplayName": "NEED homepage video",
  "posterUrl": "/uploads/images/example-poster.jpg",
  "posterFileName": "example-poster.jpg",
  "posterDisplayName": "NEED homepage video poster",
  "title": "NEED 创意现场",
  "description": "Homepage video description",
  "enabled": true,
  "updatedAt": "2026-04-29T00:00:00.000Z"
}
```

Admin homepage uploads are point-to-point convenience flows. They still call `POST /api/media/upload`, so uploaded homepage videos, video posters, and interactive images are registered in the media library with `ownerType=home` and `ownerSlug=homepage`.

Validation:

```bash
npm.cmd run typecheck:server
npm.cmd run lint
```

Database note:

This server still does not connect to MySQL or create real tables.

The local archive feature is a first-pass soft delete. Usage tracking currently covers the homepage 12-image config and homepage video config. Future database integration should extend usage tracking across cases, articles, solutions, and page editor content before adding broader safe physical cleanup.

Round 7 added draft-only database files:

- `server/src/db/migrations/001_initial_schema.sql`
- `server/src/db/schema/schema-v1.md`
- `server/src/db/seeds/001_seed_defaults.sql`
- `server/src/db/migrate.ts`

The migration runner is intentionally a placeholder. It only prints a message and a safe database config preview:

```bash
npx tsx server/src/db/migrate.ts
```

Expected output includes:

```text
database migration runner placeholder
```

Real database connection, migration execution, and migration history tracking should be added in the next database implementation round.
