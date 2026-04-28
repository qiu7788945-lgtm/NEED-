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
- Static image access under `/uploads/images`
- Local homepage interactive image slot config
- Audit service placeholder
- No database connection
- No migration execution
- No database-backed media library
- No video upload
- No COS integration
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
allowed: jpg, jpeg, png, webp
limit: 10MB
```

Expected response shape:

```json
{
  "ok": true,
  "message": "OK",
  "data": {
    "fileName": "image-0000000000000-abcd1234.jpg",
    "originalName": "example.jpg",
    "url": "/uploads/images/image-0000000000000-abcd1234.jpg",
    "size": 12345,
    "mimeType": "image/jpeg"
  }
}
```

Media list:

```text
GET http://localhost:4000/api/media/list
```

Uploaded images are stored in:

```text
server/uploads/images/
```

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

Validation:

```bash
npm.cmd run typecheck:server
npm.cmd run lint
```

Database note:

This server still does not connect to MySQL or create real tables.

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
