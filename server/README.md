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
- Static access to project `public/` assets, for example `/hero-video.mp4`
- Local homepage interactive image slot config
- Local homepage video config
- Local article management JSON API
- Local case management JSON API
- Case .docx Word import with mammoth
- Case Word image extraction into the media library
- Local scene solution management JSON API
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

The media index reader tolerates UTF-8 BOM and empty files. If the JSON is corrupted, the server backs it up as `media-library.corrupt-<timestamp>.json`, logs a warning, and falls back to an empty index so media list, upload, and Word import do not fail only because of a damaged local index. Writes are atomic: the server writes a unique `media-library.json.<timestamp>.<random>.tmp` file first and then renames it over `media-library.json`. Media index mutations run through an in-memory write queue so concurrent uploads or Word image imports do not overwrite each other.

`media-library.json` stores only persistent metadata. Runtime fields such as `usageCount`, `usages`, `suggestedCategory`, `categoryWarning`, `duplicateWarnings`, `isLargeFile`, and `isLargeDimension` are calculated for API responses and are not written into the index file.

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

Articles:

```text
GET http://localhost:4000/api/articles
GET http://localhost:4000/api/articles?category=how_to_choose
GET http://localhost:4000/api/articles?status=published
GET http://localhost:4000/api/articles?keyword=活动公司
GET http://localhost:4000/api/articles/:id
POST http://localhost:4000/api/articles
PATCH http://localhost:4000/api/articles/:id
DELETE http://localhost:4000/api/articles/:id
PATCH http://localhost:4000/api/articles/:id/status
PATCH http://localhost:4000/api/articles/reorder
```

Local article data is stored in:

```text
server/data/articles.json
```

Supported article categories:

- `how_to_choose`: 怎么选活动公司
- `choose_between_two`: 二选一怎么选
- `method_judgment`: 方法与判断

Supported article statuses:

- `draft`: 草稿
- `published`: 已上架
- `offline`: 已下架

Article slugs are normalized to lowercase letters, numbers, and hyphens. When a slug is empty or not usable, the server falls back to `article-时间戳`; duplicate slugs get an automatic numeric suffix.

Round 11 only provides the admin JSON API. Articles are not connected to the public frontend yet. Future rounds can feed these records into the GEO static publishing flow and later migrate them to MySQL.

Cases:

```text
GET http://localhost:4000/api/cases
GET http://localhost:4000/api/cases?status=draft
GET http://localhost:4000/api/cases?keyword=发布会
GET http://localhost:4000/api/cases/:id
POST http://localhost:4000/api/cases
PATCH http://localhost:4000/api/cases/:id
DELETE http://localhost:4000/api/cases/:id
PATCH http://localhost:4000/api/cases/:id/status
PATCH http://localhost:4000/api/cases/reorder
POST http://localhost:4000/api/cases/import-word
```

Local case data is stored in:

```text
server/data/cases.json
```

`POST /api/cases/import-word` accepts multipart form-data with field `file`. It only accepts `.docx`, rejects `.doc` and PDF, and limits the first version to 30MB. The server uses `mammoth` to parse Word text into `contentHtml` and `contentText`. Word images are extracted into `server/uploads/images/` and registered in the media library with `category=case_image`, `ownerType=case`, the generated case slug as `ownerSlug`, and `groupKey=word-import`.

Case cover images are uploaded through `POST /api/media/upload` by the admin UI and are registered with `category=case_image`, `ownerType=case`, the case slug as `ownerSlug`, and `groupKey=cover`.

Case statuses are:

- `draft`
- `published`
- `offline`

This round does not connect cases to the public frontend, does not publish static HTML, does not use AI rewriting, and does not aim for 100% Word style reproduction. Future rounds can connect cases to static publishing and migrate the JSON records to MySQL.

Scene solutions:

```text
GET http://localhost:4000/api/solutions
GET http://localhost:4000/api/solutions/:sceneSlug
POST http://localhost:4000/api/solutions/:sceneSlug/groups
PATCH http://localhost:4000/api/solutions/:sceneSlug/groups/:groupId
DELETE http://localhost:4000/api/solutions/:sceneSlug/groups/:groupId
PATCH http://localhost:4000/api/solutions/:sceneSlug/groups/reorder
POST http://localhost:4000/api/solutions/:sceneSlug/groups/:groupId/items
PATCH http://localhost:4000/api/solutions/:sceneSlug/groups/:groupId/items/:itemId
DELETE http://localhost:4000/api/solutions/:sceneSlug/groups/:groupId/items/:itemId
PATCH http://localhost:4000/api/solutions/:sceneSlug/groups/:groupId/items/reorder
```

Local scene solution data is stored in:

```text
server/data/solutions.json
```

If the file does not exist, the server initializes seven fixed scenes: `family-day`, `client-appreciation`, `annual-meeting`, `commercial-display`, `video-digital-assets`, `academic-forum`, and `other`.

Normal scenes allow up to 7 image items in each group. `video-digital-assets` allows up to 1 item per group, and that item may be an image or a video. Group item deletion only removes the reference from `solutions.json`; it never physically deletes uploaded files.

Admin uploads still go through `POST /api/media/upload`, so solution images/videos enter the media library automatically. Normal scene uploads use `category=solution_image`, `ownerType=solution`, and `ownerSlug=<sceneSlug>`. Video/digital asset uploads use `category=solution_video` for videos and the same ownership fields.

Round 13 does not connect scene solutions to the public frontend, does not publish static HTML, and does not use MySQL. Future rounds can feed this JSON into static publishing and later migrate it to MySQL solution tables.

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

Quality check:

```text
GET http://localhost:4000/api/quality-check
```

This read-only endpoint checks local homepage, article, case, solution, and public media seed JSON data. It returns high, medium, and low priority issues plus a `blockingPublish` flag for static-publishing risks. The endpoint never writes to `server/data/*.json`, never auto-fixes SEO, and never changes publish status.

Static HTML build:

```bash
npm.cmd run build:static
```

The static build reads the local JSON content files and writes a standalone HTML site to `dist-static/`. It generates homepage, article list/detail pages, case list/detail pages, solution pages, contact page, `404.html`, `sitemap.xml`, `robots.txt`, and `assets/static.css`.

By default, article and case detail pages are generated only for `published` records. For local previews, run:

```bash
npm.cmd run build:static -- --include-draft
```

Draft preview pages are never included in `sitemap.xml`. The build does not modify `server/data/*.json`, does not copy or delete `public/`, and does not deploy anything.
