# Tencent Cloud Deployment Plan

Target production shape:

- Tencent Cloud CVM for Nginx and Node API.
- Nginx serving the generated static HTML site.
- Nginx reverse proxy for `/api`.
- MySQL 8 for production data.
- Tencent Cloud COS for media files.
- HTTPS certificate configured on Nginx.
- ICP filing number rendered from system settings.
- Backups for MySQL, release directories, and critical configuration.
