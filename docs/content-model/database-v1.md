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

Media ownership logic:

- The media library is the global repository.
- Business pages should eventually manage media in-place while still writing to the shared media library.
- `category` describes the primary usage, such as `home_interactive`, `case_image`, `article_cover`, `solution_image`, `solution_video`, `page_editor`, `word_import`, `qrcode`, or `temporary`.
- `ownerType` describes the business module, such as `home`, `case`, `article`, `solution`, `page`, `word_import`, `system`, or `temporary`.
- `ownerId` is reserved for the future database ID.
- `ownerSlug` is the stable business slug, for example `family-day`, `salon`, `annual`, `exhibition`, `forum`, `other`, or `video`.
- `groupKey` identifies a specific image group, for example `hyundai-family-day-2025`.
- `slotNo` and `sortOrder` define display order inside a group.
- `enabled=false` means future frontend publishing should not show that media item.
- `originalName` stores the user's original uploaded filename for source tracking.
- `displayName` is the human-readable admin asset name and can be used to hide old mojibake filenames.
- `fileName` is the safe storage filename under the upload directory; optional upload `storageName` can choose its basename with letters, numbers, hyphens, and underscores only.
- `width` and `height` store image dimensions when they can be detected.
- `fileType` distinguishes `image` and `video`.
- `duration` is reserved for video duration and can be `null` in the local implementation.
- `status=active` is normal media; `status=archived` is soft-deleted media hidden from default lists and MediaPicker.
- Permanent delete is only allowed after archive and should remove both the metadata row and real file.
- Empty alt/GEO descriptions should be surfaced as an admin reminder.
- `category=temporary` should be surfaced as an unclassified-media reminder.

Round 9.6 local media maintenance rules:

- Uploaded media metadata can be edited for `displayName`, `category`, `alt`, `caption`, `description`, ownership fields, group fields, ordering, and `enabled`.
- Metadata editing must not change `fileName`, `storageName`, `originalName`, or `url`, and must not physically rename files.
- Local usage tracking first checks only `server/data/home-interactive-images.json`, matching `mediaFileName` or the filename inside `mediaUrl`.
- `GET /api/media/list` includes `usageCount` and `usages` so admin cards can display usage positions.
- Batch archive applies only to active media.
- Batch restore applies only to archived media.
- Batch permanent delete applies only to archived media and skips active media.
- Batch permanent delete skips media referenced by the homepage 12-image config.
- Future usage tracking should add cases, articles, scene solution pages, and page editor blocks before broader cleanup automation.

Round 9.7 local media optimization rules:

- Upload category suggestions are rule-based hints only. They are not AI classification and do not overwrite a manually selected category.
- Duplicate warnings do not block upload. They flag same original name, same asset name, same size, original name plus size, or storage-name auto-renaming.
- Storage-name conflicts should be resolved by appending a suffix rather than overwriting an existing file.
- Large-image handling is advisory only. The local server does not compress original images, generate thumbnails, or require optimization before upload.
- Images default to a 10MB limit through `MEDIA_MAX_IMAGE_SIZE_MB`.
- Videos default to a 500MB limit through `MEDIA_MAX_VIDEO_SIZE_MB`.
- Local videos are stored under `server/uploads/videos/`, and video duration/thumbnail extraction is intentionally deferred.
- Cleanup reminders for temporary and archived media are advisory only and never auto-delete files.
- MediaPicker defaults to active images only so videos do not enter image slots.
- Production video storage should move to Tencent Cloud COS or a video service rather than relying on local disk.

Round 10 homepage point-to-point rules:

- Homepage video config is stored locally in `server/data/home-video.json`.
- Homepage interactive image config remains in `server/data/home-interactive-images.json`.
- Admin homepage uploads are business-module uploads, not a bypass around the media library.
- Homepage video uploads write media metadata with `category=home_video`, `ownerType=home`, and `ownerSlug=homepage`.
- Homepage video poster uploads use the same homepage ownership metadata and are optional.
- Homepage interactive image slot uploads write `category=home_interactive`, `ownerType=home`, `ownerSlug=homepage`, `groupKey=home-interactive`, and the current `slotNo`.
- MediaPicker remains available for choosing existing active homepage images and defaults to image-only selection.
- The saved homepage JSON config is still admin-only in this round and is not connected to the public frontend homepage.
- Future database integration should move these JSON configs into `home_video` and `home_interactive_images` tables.

Round 11 article management rules:

- Article records are stored locally in `server/data/articles.json`.
- The first article categories are `how_to_choose` for 怎么选活动公司, `choose_between_two` for 二选一怎么选, and `method_judgment` for 方法与判断.
- Article statuses are `draft`, `published`, and `offline`.
- Article content is text-first: title, slug, summary, content, SEO title, SEO description, keywords, and FAQ items.
- Slugs should be lowercase letters, numbers, and hyphens. Empty or Chinese-only slugs can fall back to `article-时间戳`, and duplicate slugs should receive suffixes.
- Round 11 does not connect articles to public frontend routes.
- Future GEO static publishing can read these records to generate pages, and future MySQL migration can map them to `articles`, `article_blocks`, and related SEO/FAQ tables.

Round 12 case analysis management rules:

- Case records are stored locally in `server/data/cases.json`.
- The first status values are `draft`, `published`, and `offline`.
- Case fields include title, slug, summary, client type, event type, event date, location, cover image metadata, Word source metadata, parsed HTML, parsed text, extracted images, sort order, SEO title, SEO description, keywords, FAQ items, and timestamps.
- Word import supports `.docx` only. It does not accept `.doc` or PDF.
- Word import uses `mammoth` to parse fixed-format HTML and raw text. It does not run AI rewriting and does not try to preserve 100% of Word layout.
- Word images are extracted to `server/uploads/images/` and registered in the media library with `category=case_image`, `ownerType=case`, `ownerSlug=<case slug>`, and `groupKey=word-import`.
- Cover images are uploaded separately through the media upload API and registered with `category=case_image`, `ownerType=case`, `ownerSlug=<case slug>`, and `groupKey=cover`.
- Deleting a case currently removes the JSON record only. Uploaded and extracted media are left for media-library cleanup.
- Round 12 does not connect cases to the public frontend, does not publish static HTML, does not create MySQL tables, and does not add a page editor.
- Future static publishing can read these records to generate case pages, and future MySQL migration can map them to `cases`, `case_blocks`, `case_images`, SEO, and FAQ tables.

Round 13 scene solution management rules:

- Scene solution records are stored locally in `server/data/solutions.json`.
- The fixed scene slugs are `family-day`, `client-appreciation`, `annual-meeting`, `commercial-display`, `video-digital-assets`, `academic-forum`, and `other`.
- Each scene owns case groups with title, slug, summary, sort order, enabled state, and media items.
- Normal scenes allow up to 7 image items per group. Groups can contain fewer than 7 images.
- `video-digital-assets` allows up to 1 item per group, either a video or an image.
- Scene uploads are point-to-point admin flows but still write to the shared media library.
- Normal scene uploads use `category=solution_image`, `ownerType=solution`, `ownerSlug=<sceneSlug>`, and `groupKey=<group slug or id>`.
- Video and digital asset video uploads use `category=solution_video`; image uploads use solution ownership metadata as well.
- Deleting a group item only removes the reference from `solutions.json`; it does not delete the real file.
- Round 13 does not connect scene solutions to public frontend routes, does not publish static HTML, and does not create MySQL tables.
- Future publishing can map these records to solution pages, and future MySQL migration can map them to `solutions`, `solution_pages`, `solution_page_blocks`, and media relation tables.

Solution media rule:

- Normal solution scenes use `category=solution_image`, `ownerType=solution`, and `ownerSlug=family-day | salon | annual | exhibition | forum | other`.
- Normal solution image groups can contain up to 7 images, but do not need to be filled to 7. Images can be added, deleted, sorted, enabled, disabled, and given alt/caption text.
- The future frontend should render only the enabled images that actually exist.
- Video and digital asset pages use `ownerSlug=video` and should use `category=solution_video` or `solution_image`; they do not follow the 7-image group rule.

Recommended implementation order:

1. Add a real MySQL client and migration history table.
2. Execute `admin_users`, `media_files`, `site_settings`, and `audit_logs` first.
3. Add homepage, cases, articles, and solutions tables.
4. Add publishing tables and preview/release metadata.
5. Add validation around slug uniqueness, status transitions, and media delete protection.
