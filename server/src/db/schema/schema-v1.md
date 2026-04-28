# NEED Database Schema V1

This folder records the planned MySQL 8 schema shape for the future NEED backend.

Current status:

- Schema is a draft only.
- Migrations are not connected to a real database.
- `migrate.ts` is only a placeholder runner.
- Real MySQL connection, migration history tracking, and rollback execution are reserved for a later round.

Primary migration draft:

- `../migrations/001_initial_schema.sql`

Primary seed draft:

- `../seeds/001_seed_defaults.sql`
