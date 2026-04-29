# NEED Admin

This is the graphical management interface for the NEED website.

Current round scope:

- Static admin shell
- Homepage 12 interactive image slot management
- Homepage video and poster management
- Point-to-point homepage uploads that automatically register media-library metadata
- Local image upload through the server API
- Media category, ownership, enabled-state, status, and keyword filters
- Media metadata editing for uploaded assets
- Media usage display for homepage 12 interactive image slots
- Rule-based upload category suggestions
- Duplicate upload warnings
- Large image and cleanup reminders
- Minimal video upload support in the media library
- Media archive, restore, and permanent delete actions
- Batch media selection, archive, restore, and permanent delete actions
- Reusable MediaPicker modal for image selection
- Simplified media library UI with normal upload fields and folded advanced settings
- Layered media cards with core information, common information, and folded details
- Missing alt/GEO reminder
- Temporary-media categorization reminder
- No page editor implementation

Development command:

```bash
npm.cmd run dev:admin
```

Media library upload fields:

The normal upload area is for daily use and shows:

1. Choose image
2. Asset name
3. Asset category
4. Display order
5. Image alt/GEO description
6. Image caption
7. Upload button

The file picker accepts jpg/jpeg/png/webp images and mp4/webm videos. Images default to a 10MB limit. Videos default to a 500MB limit.

Use advanced settings only when the media needs precise storage or ownership metadata:

- `storageName`: optional safe storage basename. Leave it empty to let the system generate a filename. Only letters, numbers, hyphens, and underscores are allowed.
- `ownerType`: usually unnecessary for manual uploads.
- `ownerSlug`: used for solution-scene ownership.
- `groupKey`: used to distinguish projects or image groups under the same scene.
- `slotNo`: the position in a group, such as image 1 or image 2. A group can contain fewer than 7 images.
- `description`: internal note for the admin team.
- `enabled`: enabled by default.

Upload automation:

- Category suggestion is simple rule matching against filename, asset name, alt, caption, scene, and group fields. It is not AI classification.
- User-selected categories are not overwritten. If the file remains `temporary`, the upload result can show a suggested category.
- Duplicate warnings do not block upload. They warn about possible same original name, same asset name, same size, original name plus size, or storage-name auto-renaming.
- If a requested storage filename already exists, the server appends a suffix to avoid overwriting the existing file.

Archive, restore, and permanent delete:

- Archive is a soft delete. The media `status` becomes `archived`; the real image file remains under `server/uploads/images/`.
- Restore moves an archived media item back to normal active media.
- Permanent delete is only available after archive. It removes both the index record and the real file.
- Batch archive only applies to active media.
- Batch restore only applies to archived media.
- Batch permanent delete only applies to archived media; active media is skipped.
- Media referenced by the homepage 12-image config is protected from permanent delete and is skipped in batch permanent delete.

Filename fields:

- `displayName` is the human-readable asset name shown first in the admin UI. Use it to hide old mojibake filenames.
- `originalName` is the original uploaded filename for source tracking.
- `fileName` is the safe storage filename under the upload directory.

Metadata editing:

Media cards include an Edit Info action. The editable admin fields are asset name, category, alt/GEO description, caption, internal note, ownership type, ownership ID, scene, project/image group, group position, display order, and enabled state.

The edit form intentionally does not expose file renaming. It cannot change storage filename, original filename, or URL. Use asset name to repair old mojibake titles without touching the physical file.

Usage display:

Media cards show either "使用中：X 处" or "未被使用". Expanding details shows the known usage positions. Round 9.6 only tracks homepage 12 interactive images from `server/data/home-interactive-images.json`; cases, articles, scenes, and page editor usage are planned for later rounds.

Image optimization reminders:

- Images over 2MB show "图片较大，建议压缩后用于正式页面".
- Images wider or taller than 2500px show "尺寸较大，正式上线前建议压缩".
- Round 9.7 does not compress original images or generate thumbnails. Cards still use the uploaded URL for preview.

Cleanup reminders:

- `temporary` media shows "临时素材，建议归类".
- `temporary` media older than 30 days shows "临时素材已超过 30 天，建议归档或删除".
- `archived` media older than 30 days shows "已归档超过 30 天，可考虑永久删除".
- The cleanup filter only filters and reminds. It never deletes files automatically.

Media library test:

1. Start the API server:

```bash
npm.cmd run dev:server
```

2. Start the admin UI:

```bash
npm.cmd run dev:admin
```

3. Open the admin URL shown by Vite and click the Media Library menu item.
4. Choose a jpg/jpeg/png/webp image under 10MB, or an mp4/webm video under 500MB.
5. Fill the normal upload fields and upload it.
6. Expand advanced settings only when testing storage name, ownership, group position, internal note, or enabled state.
7. Use filters and keyword search. Keyword search checks file name, original name, display name, alt, description, and caption.
8. Click Archive on a media card, confirm the dialog, then switch the status filter to Archived to view it.
9. Click Restore on an archived media card to return it to normal media.
10. Click Permanently Delete on an archived card, confirm the warning, and the server will remove both the index record and real file.
11. Click Edit Info, change the asset name or alt/GEO description, save, and confirm the current list refreshes.
12. Click View Details on a media card to see original filename, storage filename, URL, ownership fields, internal note, enabled state, and usage positions.
13. Select several cards, then test batch archive, batch restore, and batch permanent delete. The completion message summarizes success, skipped, and failed counts with reasons.

Media quality reminders:

- If alt/GEO is empty, the card shows "缺少 GEO 图片描述".
- If category is `temporary`, the card shows "临时素材，建议归类".
- Large images and older temporary/archived media show review reminders.

The preview URL points to:

```text
http://localhost:4000/uploads/images/:filename
http://localhost:4000/uploads/videos/:filename
```

Homepage management test:

1. Start `npm.cmd run dev:server`.
2. Start `npm.cmd run dev:admin`.
3. Open the admin URL shown by Vite.
4. Click the Home Management menu item.
5. In the Home Video section, upload or replace the homepage video, optionally upload a poster, edit title/description/enabled state, and save.
6. In the Interactive Images section, upload directly into any slot or click the image picker button to choose existing images, then save the 12 slots.

The MediaPicker opens with `home_interactive` as the default category for homepage slots.

MediaPicker only requests `active` image media by default, so archived media and videos do not appear in homepage image selectors. A future caller can opt into video selection with an explicit `allowVideo` prop.

Homepage point-to-point uploads:

- Homepage video uploads use `category=home_video`, `ownerType=home`, and `ownerSlug=homepage`.
- Homepage video poster uploads also use `category=home_video`, `ownerType=home`, and `ownerSlug=homepage`.
- Homepage interactive image slot uploads use `category=home_interactive`, `ownerType=home`, `ownerSlug=homepage`, `groupKey=home-interactive`, and the current `slotNo`.
- Users do not need to visit the media library first. The upload still goes through the media API, so the asset appears in the media library and remains searchable/manageable there.

Future solution pages can reuse MediaPicker with:

```text
defaultCategory=solution_image
defaultOwnerType=solution
defaultOwnerSlug=family-day
defaultGroupKey=hyundai-family-day-2025
```

The saved config is stored in:

```text
server/data/home-interactive-images.json
server/data/home-video.json
```

This round still does not connect the saved config to the public frontend homepage.

Future database-backed media management should extend usage tracking to cases, articles, scenes, and page editor content before broadening safe physical cleanup. Production video storage should use Tencent Cloud COS or a video service instead of long-term local disk.
