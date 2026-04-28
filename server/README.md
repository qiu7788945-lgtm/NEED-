# NEED API Server

This directory is the future Node.js + Express + TypeScript API layer for the NEED website system.

Current round scope:

- Express app skeleton
- `GET /api/health`
- Unified API response helpers
- Unified 404 and error middleware
- Environment config placeholder
- Database client placeholder
- Audit service placeholder
- No database connection
- No media upload
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

Validation:

```bash
npm.cmd run typecheck:server
npm.cmd run lint
```

Database note:

This round intentionally does not connect to MySQL or create real tables. The `server/src/db/client.ts` file is only a placeholder. Database schema and migrations should be introduced in round 7.
