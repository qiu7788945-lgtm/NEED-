# NEED Admin

This is the future graphical management interface for the NEED website.

Current round scope:

- Static admin shell
- Placeholder left navigation
- Media library placeholder page
- Local image upload through the server API
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

The preview URL points to:

```text
http://localhost:4000/uploads/images/:filename
```
