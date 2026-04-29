# NEED Admin

This is the graphical management interface for the NEED website.

Current round scope:

- Static admin shell
- Homepage 12 interactive image slot management
- Local image upload through the server API
- Media category, ownership, enabled-state, status, and keyword filters
- Media metadata editing for uploaded assets
- Media usage display for homepage 12 interactive image slots
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

Use advanced settings only when the media needs precise storage or ownership metadata:

- `storageName`: optional safe storage basename. Leave it empty to let the system generate a filename. Only letters, numbers, hyphens, and underscores are allowed.
- `ownerType`: usually unnecessary for manual uploads.
- `ownerSlug`: used for solution-scene ownership.
- `groupKey`: used to distinguish projects or image groups under the same scene.
- `slotNo`: the position in a group, such as image 1 or image 2. A group can contain fewer than 7 images.
- `description`: internal note for the admin team.
- `enabled`: enabled by default.

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
4. Choose a jpg/jpeg/png/webp image under 10MB.
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

The preview URL points to:

```text
http://localhost:4000/uploads/images/:filename
```

Homepage management test:

1. Start `npm.cmd run dev:server`.
2. Start `npm.cmd run dev:admin`.
3. Open the admin URL shown by Vite.
4. Click the Home Management menu item.
5. Edit the 12 image slots, click the image picker button, choose uploaded images from the modal, and save.

The MediaPicker opens with `home_interactive` as the default category for homepage slots.

MediaPicker only requests `active` media, so archived images do not appear in the selector by default.

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
```

Future database-backed media management should extend usage tracking to cases, articles, scenes, and page editor content before broadening safe physical cleanup.
