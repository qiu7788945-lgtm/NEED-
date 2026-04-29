# NEED Admin

This is the future graphical management interface for the NEED website.

Current round scope:

- Static admin shell
- Placeholder left navigation
- Homepage 12 interactive image slot management
- Media library placeholder page
- Local image upload through the server API
- Media category filter and keyword search
- Media ownership filters: ownerType, ownerSlug, groupKey, enabled
- Media status filter: active, archived, all
- Media archive and restore actions
- Reusable MediaPicker modal for image selection
- Uploaded image preview and returned URL display
- Upload fields for display name and optional safe storage name
- Media card display for original name, display name, storage filename, dimensions, size, upload time, ownership, caption, alt/GEO, and status
- Missing alt/GEO reminder
- Temporary-media categorization reminder
- No page editor implementation

Development command:

```bash
npm.cmd run dev:admin
```

Media library test:

1. Start the API server:

```bash
npm.cmd run dev:server
```

2. Start the admin UI:

```bash
npm.cmd run dev:admin
```

3. Open the admin URL shown by Vite, click the Media Library menu item, choose a jpg/jpeg/png/webp image under 10MB, and upload it.
4. Fill an optional asset name. This is `displayName`, the human-readable media name.
5. Fill an optional storage filename. This is `storageName`; only letters, numbers, hyphens, and underscores are allowed, and the server keeps the extension.
6. Choose an upload category and optional ownership fields, then filter or search the list.
7. Keyword search checks file name, original name, display name, alt, description, and caption.
8. Click Archive on a media card, confirm the dialog, then switch the status filter to Archived to view it.
9. Click Restore on an archived media card to return it to normal media.
10. Click Permanently Delete on an archived card, confirm the warning, and the server will remove both the index record and real file.

Archive is a soft delete in this first version. The admin UI updates the media `status` to `archived`; the image file remains under `server/uploads/images/`.

Permanent delete is only available after archive. Active media cannot be permanently deleted.

Chinese filename note:

- New uploads try to display Chinese `originalName` correctly.
- Old mojibake names do not need automatic migration; use `displayName` to provide a clean visible name.

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

Future database-backed media management should add full usage tracking and safe physical cleanup after confirming a file is not referenced anywhere.
