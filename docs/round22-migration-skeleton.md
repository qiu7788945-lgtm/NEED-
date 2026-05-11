# Round 22 Migration Skeleton

This document describes the 22-3B-1 migration skeleton only.

The skeleton can read JSON sources, compute canonical SHA256 hashes, identify migration modules, print dry-run plans, and check planned tables and fields against `server/src/db/migrations/001_initial_schema.sql`.

It does not migrate business data.
It does not write MySQL business tables.
It does not write `migration_logs`.
It does not create real JSON backup snapshots.
It does not switch any service to MySQL.

JSON remains the only primary data source in 22-3B-1. MySQL remains a shadow database target for later steps.

## Commands

```powershell
npm.cmd run migrate:content:dry-run
npm.cmd run migrate:content
npm.cmd run migrate:content -- --module articles
npm.cmd run migrate:content -- --module all --fail-fast
```

`migrate:content` defaults to dry-run.

`--write` is recognized but intentionally disabled in 22-3B-1. It exits without writing MySQL business tables, without writing `migration_logs`, and without creating a backup snapshot.

## Boundaries

The skeleton must not change frontend UI, admin UI, business services, API output, JSON data, uploads, prerender scripts, sitemap scripts, route slugs, or existing publish log generation.

`publish-logs` is plan-only in this step. Existing JSON publish logs remain primary and must not become MySQL-only.
