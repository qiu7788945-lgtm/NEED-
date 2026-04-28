# NEED Admin

This is the future graphical management interface for the NEED website.

Current round scope:

- Static admin shell
- Placeholder left navigation
- Homepage 12 interactive image slot management
- Media library placeholder page
- Local image upload through the server API
- Media category filter and keyword search
- Reusable MediaPicker modal for image selection
- Uploaded image preview and returned URL display
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
4. Choose an upload category, then filter or search the list.

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

The saved config is stored in:

```text
server/data/home-interactive-images.json
```
