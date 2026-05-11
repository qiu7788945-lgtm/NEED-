# Round 22 Data Source Ownership

This document defines the data source ownership rules for the round22 JSON to MySQL migration.

Round22 allows JSON and MySQL to exist in parallel only during migration, verification, and rollback preparation. Parallel operation is a temporary transition state. It is not an acceptable long-term architecture and must not become two daily-maintained sources of truth.

## Core Rules

1. Round22 must not create long-term dual primary data sources.
2. A module can have only one runtime primary source at a time.
3. A module must not mix reads from JSON and MySQL in the same runtime response path.
4. a module must not write to JSON and MySQL at the same time as two active maintenance targets.
5. `publish`, `prerender`, and `sitemap` must continue to depend on existing API output, not direct database table reads.
6. MySQL failure must not break the JSON-backed website before a module is explicitly switched.
7. After a module switches to MySQL, its JSON file becomes backup, export output, migration snapshot, or emergency fallback only.
8. After a module switches to MySQL, humans must not keep editing that module's JSON while the admin workflow edits MySQL.
9. Upload files are not moved into MySQL. MySQL stores metadata and public paths; files remain in `server/uploads` or the future storage provider.
10. Publish log JSON files must remain available through the migration. MySQL publish log rows may mirror and index logs, but must not replace the current traceability path until the final cutover is validated.

## Round22 Stage Ownership

### 22-2 Database Connection Layer

JSON is the only primary data source.

MySQL is used only for connection verification, health checks, and explicit schema runner validation. No business service reads from MySQL. No business data is migrated. Missing MySQL configuration must not affect the existing server, frontend, prerender, sitemap, or publish flow.

### 22-3 Migration Scripts

JSON remains the only primary data source.

MySQL becomes a shadow database populated by repeatable migration scripts. Scripts may support dry-run and explicit write mode, and must write migration logs. API responses still come from JSON. The website must remain fully operational if MySQL is unavailable.

### 22-4 Dual-Read Comparison

JSON remains the official API output.

MySQL is read only for comparison: counts, IDs, slugs, status, enabled flags, sort order, SEO fields, FAQ items, alt text, image paths, video paths, and publish metadata. The comparison path must not change frontend UI, route output, sitemap output, or generated HTML.

### 22-5 Module-by-Module Service Cutover

Each module switches independently. Before a module switches, JSON is primary. After that module switches, MySQL is primary for that module only, and JSON becomes backup, export output, migration snapshot, or emergency fallback.

Cutover order should remain low risk:

1. `pages`
2. `contact-info`
3. `company-assets`
4. `home-video`
5. `home-interactive-images`
6. `articles`
7. `cases`
8. `solutions`
9. `media metadata`
10. `publish logs`

No step may switch all modules at once. Each module needs its own verification pass.

### 22-6 MySQL to JSON Export and Rollback Drill

MySQL to JSON export must be validated.

The project must prove that a switched module can export data back to the old JSON shape and can temporarily switch back to the JSON adapter in an emergency. This is a rollback drill, not a return to long-term JSON maintenance.

### 22-7 Final Ownership Closure

Runtime ownership is closed: MySQL is the only primary data source for migrated modules.

JSON remains only for backup, export, migration snapshots, and emergency fallback. JSON is no longer the daily maintenance entry point and is no longer the normal runtime read path. Any fallback to JSON must be explicit, temporary, logged, and followed by reconciliation.

## Module Ownership Matrix

| Module | 22-2 | 22-3 | 22-4 | 22-5 | 22-6 | 22-7 |
| --- | --- | --- | --- | --- | --- | --- |
| `pages` | JSON primary; MySQL connection only | JSON primary; MySQL shadow | JSON API output; MySQL compare only | Switch first; MySQL primary after cutover | Export to JSON and rollback drill | MySQL primary; JSON backup/fallback only |
| `contact-info` | JSON primary; MySQL connection only | JSON primary; MySQL shadow | JSON API output; MySQL compare only | Switch after pages; MySQL primary after cutover | Export to JSON and rollback drill | MySQL primary; JSON backup/fallback only |
| `company-assets` | JSON primary; MySQL connection only | JSON primary; MySQL shadow | JSON API output; MySQL compare only | Switch after contact; MySQL primary after cutover | Export to JSON and rollback drill | MySQL primary; JSON backup/fallback only |
| `home-video` | JSON primary; MySQL connection only | JSON primary; MySQL shadow | JSON API output; MySQL compare only | Switch after contact assets; MySQL primary after cutover | Export to JSON and rollback drill | MySQL primary; JSON backup/fallback only |
| `home-interactive-images` | JSON primary; MySQL connection only | JSON primary; MySQL shadow | JSON API output; MySQL compare only | Switch after home video; MySQL primary after cutover | Export to JSON and rollback drill | MySQL primary; JSON backup/fallback only |
| `articles` | JSON primary; MySQL connection only | JSON primary; MySQL shadow | JSON API output; MySQL compare only | Switch after home modules; MySQL primary after cutover | Export to JSON and rollback drill | MySQL primary; JSON backup/fallback only |
| `cases` | JSON primary; MySQL connection only | JSON primary; MySQL shadow | JSON API output; MySQL compare only | Switch after articles; MySQL primary after cutover | Export to JSON and rollback drill | MySQL primary; JSON backup/fallback only |
| `solutions` | JSON primary; MySQL connection only | JSON primary; MySQL shadow | JSON API output; MySQL compare only | Switch after cases; MySQL primary after cutover | Export to JSON and rollback drill | MySQL primary; JSON backup/fallback only |
| `media metadata` | JSON/index/files primary; MySQL connection only | JSON/index/files primary; MySQL shadow metadata | Existing media API output; MySQL compare only | Switch metadata only; files stay in uploads/storage | Export metadata to JSON and rollback drill | MySQL metadata primary; files remain external |
| `publish logs` | JSON publish logs primary | JSON logs primary; MySQL shadow/index only | JSON logs official; MySQL compare/index only | Switch only after content modules are stable | Export logs and verify traceability | MySQL may be primary, but JSON exports remain available |
| `uploads` | Files stay in `server/uploads` | Files stay in `server/uploads` | Files stay in `server/uploads` | Files stay in `server/uploads` or future storage provider | File paths verified in export | Files remain outside MySQL |

## Publish, Prerender, and Sitemap Boundary

`publish`, `prerender`, and `sitemap` must not query MySQL tables directly in round22.

They should continue to consume public API responses or existing service outputs. When a module switches to MySQL, that module's service adapter may read MySQL, but the publishing pipeline still sees the same API shape and the same route/slug semantics.

This protects GEO HTML generation, sitemap inclusion, route manifest behavior, and publish log traceability from database migration churn.

## Final State

The final state is single primary ownership:

- MySQL is the runtime primary source for migrated content modules.
- JSON is backup, export, migration snapshot, and emergency fallback only.
- Upload files remain file/object-storage assets, referenced by MySQL metadata.
- API response shapes stay stable.
- Frontend UI stays unchanged.
- The publish/prerender/sitemap chain continues through the existing API/service boundary.
