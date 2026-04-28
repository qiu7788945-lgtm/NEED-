# Database Model V1

Current status:

- Target database: MySQL 8.
- Current files are schema and seed drafts only.
- No real MySQL connection is created in round 7.
- No migration is executed in round 7.
- Soft delete is represented by `deleted_at`.
- Most content tables include `created_at` and `updated_at`.
- Content status should start with `draft`, `published`, `offline`, and `archived`.

Draft files:

- `server/src/db/migrations/001_initial_schema.sql`
- `server/src/db/schema/schema-v1.md`
- `server/src/db/seeds/001_seed_defaults.sql`

Planned core tables:

- `admin_users`
- `media_files`
- `home_interactive_images`
- `home_video`
- `pages`
- `page_blocks`
- `cases`
- `case_blocks`
- `case_images`
- `articles`
- `article_blocks`
- `article_categories`
- `solutions`
- `solution_pages`
- `solution_page_blocks`
- `faq_items`
- `seo_settings`
- `publish_logs`
- `site_settings`
- `redirects`
- `audit_logs`

Important table notes:

- `home_interactive_images` supports the fixed 12 homepage slots through `slot_number`.
- `seo_settings` is shared by content through `owner_type` and `owner_id`.
- `faq_items` is shared by content through `owner_type` and `owner_id`.
- `page_blocks`, `case_blocks`, `article_blocks`, and `solution_page_blocks` store module data in `block_data_json`.
- `publish_logs` records publish versions, target pages, status, and rollback references.
- `redirects` stores old path to new path mappings for slug changes and SEO continuity.
- `audit_logs` records future admin actions without storing sensitive passwords.

Recommended implementation order:

1. Add a real MySQL client and migration history table.
2. Execute `admin_users`, `media_files`, `site_settings`, and `audit_logs` first.
3. Add homepage, cases, articles, and solutions tables.
4. Add publishing tables and preview/release metadata.
5. Add validation around slug uniqueness, status transitions, and media delete protection.
