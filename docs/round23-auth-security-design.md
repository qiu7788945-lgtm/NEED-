# Round 23 Auth / Admin Security Design

This document records the Round 23-3 auth and admin security design landing.

It is a documentation-only step. It does not implement login, logout, `me`, auth middleware, migrations, admin tables, seeds, MySQL writes, admin UI changes, API write tests, JSON changes, uploads changes, export `--write`, rollback, fallback closure, JSON freeze, or JSON deletion.

## 1. Purpose

Round 23 focuses on backend admin login and security permissions.

The purpose of this design is to define the first-stage minimum security closure before any implementation starts. The project must stop exposing admin write operations without authentication, while preserving public frontend reads and all Round 22 data migration boundaries.

## 2. Current risk

The current admin app is a separate Vite app. It calls the backend directly through `/api/...` endpoints.

Current risk summary:

- There is no login flow.
- There is no auth middleware.
- There is no session, JWT, token, or cookie-based login state.
- There is no implemented user or admin table.
- The backend does not have a dedicated `/api/admin` route group.
- Admin write APIs are currently reachable as ordinary `/api/...` routes.
- `cors()` is currently broad and does not define an admin origin whitelist.

The highest-risk exposed operations are uploads, media archive / restore / delete / batch operations, publish / prerender, and all content create / update / delete / reorder / status operations.

## 3. First-stage security goal

The first-stage goal is a minimum usable admin security closure.

It should include:

- Admin login page.
- Single administrator model.
- Hashed password storage.
- `login`, `logout`, and `me` endpoints.
- Auth middleware.
- Protection for admin write APIs.
- Public frontend GET access preserved.
- CORS origin whitelist.
- Unified 401 and 403 response shape.
- Priority protection for upload, delete, and publish APIs.

The first stage must not implement complex RBAC, a multi-user permission system, a full audit-log system, or any Round 22 data migration changes.

## 4. Why Session + HttpOnly Cookie

The first-stage auth strategy should use Session + HttpOnly Cookie.

Rules:

- Login success sets an HttpOnly cookie from the server.
- The admin frontend does not store tokens.
- Admin requests use `credentials: 'include'`.
- The admin app calls `/api/auth/me` during startup.
- If `/api/auth/me` returns 401, the admin app shows the login page.
- Logout calls `/api/auth/logout`.
- Logout destroys the server-side session and clears the cookie.
- Backend write APIs are protected by auth middleware.
- Public frontend GET routes are not affected.

This matches NEED's current shape because the admin is a browser CMS, not an open API platform. HttpOnly cookies keep the session credential away from frontend JavaScript and provide a clearer server-side logout path than a pure browser-stored token.

## 5. Why JWT / Bearer Token is not first choice

JWT / Bearer Token is not the first-stage choice.

Reasons:

- Storing tokens in `localStorage` or `sessionStorage` increases XSS impact.
- Frontend logout usually only deletes the local token unless a separate token revocation model exists.
- Token revocation and rotation add complexity that is not needed for the first admin-only browser phase.
- JWT is better suited to mobile apps, public API consumers, multi-service calls, or stateless API platforms.
- NEED currently needs a protected browser admin, not an open API platform.

JWT can be reconsidered later if NEED adds multi-device clients, external integrations, mobile apps, or public API consumers.

## 6. Why env fixed password is only a temporary fallback

An environment-variable fixed password or Basic-like gate may be useful only as a very short temporary blocker.

It is not a formal backend login closure because:

- Password rotation is weak.
- Disable / revoke behavior is weak.
- Auditability is weak.
- It does not model an admin identity cleanly.
- It can easily lead to plain password handling if used carelessly.

Do not write `ADMIN_PASSWORD` as plain text in `.env`, Git, docs, code, or chat records.

If a temporary environment-variable fallback is ever approved, it may only use values such as:

- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`

The formal first-stage direction remains Session + HttpOnly Cookie with hashed admin credentials.

## 7. Admin user model

The first stage should use a single administrator model.

It should not implement:

- Complex RBAC.
- Multi-role permission systems.
- Per-module permission matrices.
- Team management.
- Full audit-log workflows.

The formal storage recommendation is a MySQL `admin_users` table. A later implementation step must separately confirm migration and seed boundaries before creating it.

Recommended fields:

- `id`
- `username`
- `password_hash`
- `status`
- `created_at`
- `updated_at`
- `last_login_at` optional

The first seed path should be either a seed admin or a one-time initialization command. The real administrator password must never be committed to Git or written into docs, code, generated artifacts, or chat records.

## 8. Password hashing requirements

Passwords must be hashed.

Rules:

- Never store plain text passwords.
- Never log submitted passwords.
- Never return password hashes in API responses.
- Prefer `argon2id` when available.
- `bcrypt` is acceptable if it better matches the project dependency and deployment constraints.
- Password verification must use the hash verification API from the chosen library.
- Password hashing parameters must be documented in the implementation step.

Implementation must separately decide whether to add a dependency such as `argon2` or `bcrypt` before code is changed.

## 9. Auth endpoints

The first-stage API should define these endpoints.

### POST /api/auth/login

Input:

```json
{
  "username": "admin",
  "password": "submitted password"
}
```

Success behavior:

- Verify username and password.
- Set an HttpOnly session cookie.
- Return the current user identity.

Success response:

```json
{
  "ok": true,
  "message": "OK",
  "data": {
    "user": {
      "username": "admin"
    }
  }
}
```

### POST /api/auth/logout

Behavior:

- Destroy the current session.
- Clear the auth cookie.

Success response:

```json
{
  "ok": true,
  "message": "OK",
  "data": null
}
```

### GET /api/auth/me

Behavior:

- Return the current user when authenticated.
- Return 401 when unauthenticated.

Authenticated response:

```json
{
  "ok": true,
  "message": "OK",
  "data": {
    "user": {
      "username": "admin"
    }
  }
}
```

## 10. Auth middleware

The auth middleware should:

- Read the session from the HttpOnly cookie.
- Verify that the session is valid.
- Attach the authenticated admin identity to the request context.
- Return 401 for unauthenticated requests.
- Leave public frontend GET routes unaffected.

The middleware must be applied to protected admin API surfaces, not blindly to every public content route.

The first stage may use one admin role internally, but should keep the request context shape compatible with future role or permission expansion.

## 11. Protected API scope

The protected scope must include all admin writes and admin-only reads.

Protected methods and operations:

- All `POST`, `PUT`, `PATCH`, and `DELETE`.
- Media upload.
- Media archive.
- Media restore.
- Media delete.
- Media batch operations.
- Publish / prerender.
- Article create, update, delete, status, and reorder.
- Case create, update, delete, status, reorder, and Word import.
- Solution group / item create, update, delete, and reorder.
- Page management create, update, delete, status, duplicate, and reorder.
- Scenario detail page management create, update, delete, status, duplicate, and reorder.
- `home/video` PUT.
- `home/interactive-images` PUT.
- `contact-info` PUT.
- `company-assets` PUT.

Protected admin-only GET examples:

- Draft content.
- Unpublished content.
- Admin lists that include non-public records.
- PageEditor management data.
- Publish logs.
- Quality check reports.
- Media list.

Protection must prioritize uploads, deletes, batch deletes, and publish operations first because they have the highest blast radius.

## 12. Public API scope

Public frontend access must remain available.

Public scope:

- Public frontend GET content APIs.
- Homepage public reads.
- Contact-info public read.
- Company-assets public read.
- Published article / case / solution reads.
- `/api/health` safe summary.
- Static `/uploads/images` resources.
- Static `/uploads/videos` resources.
- Public static assets.
- Public reads needed by frontend prerender.

Rules:

- Public GET must only return data required by the frontend.
- Public GET must not expose drafts.
- Public GET must not expose unpublished admin content.
- Public GET must not expose backend-only status fields.
- Public GET must not expose internal audit data.
- Public GET must not expose complete publish logs.

If a current GET endpoint mixes public and admin data, a later implementation step should split public and admin read surfaces instead of hiding public frontend data behind login.

## 13. Admin frontend login-state flow

The admin frontend should not store tokens.

Recommended flow:

1. Admin app starts.
2. Admin app calls `GET /api/auth/me` with `credentials: 'include'`.
3. If `me` succeeds, render the admin shell.
4. If `me` returns 401, render the login page.
5. Login form calls `POST /api/auth/login` with username and password.
6. Login success sets the HttpOnly cookie and returns `{ user }`.
7. Subsequent admin API calls use `credentials: 'include'`.
8. Logout calls `POST /api/auth/logout`.
9. Logout success clears local UI state and shows the login page.

Admin API helpers should be centralized later so `credentials: 'include'` and 401 handling do not need to be duplicated in every admin module.

## 14. CORS strategy

CORS must be restricted in the first implementation phase.

Rules:

- Use an origin whitelist.
- Development may allow `http://localhost:3001`.
- Production may allow only the formal admin domain.
- Cookie-based auth requires `credentials=true`.
- Do not keep naked broad `cors()` for the admin write surface.
- Reject unexpected origins for protected admin requests.

The public frontend domain and admin domain may have different CORS needs. A later implementation step should define exact dev and production origins before code changes.

## 15. CSRF strategy

Session + Cookie auth requires CSRF consideration.

Minimum first-stage strategy:

- Use a strict or appropriate `SameSite` cookie setting when deployment allows it.
- Validate `Origin` or `Referer` for protected state-changing requests.
- Require auth middleware for every protected write.
- Keep high-risk write APIs behind both auth and origin guard.

If admin and API are deployed cross-site in a way that weakens SameSite protection, add a CSRF token in a later step.

CSRF token support can be deferred only if the first implementation has an explicit SameSite plus Origin / Referer guard and the deployment topology is compatible with it.

## 16. Rate-limit strategy

The first stage should include rate limiting for login.

Minimum rules:

- Protect `POST /api/auth/login`.
- Limit by IP and username.
- Return a consistent failure response without revealing whether the username exists.
- Keep more detailed write-operation rate limits as a later enhancement.

Rate limiting for media upload, delete, and publish operations can be designed after the first auth gate is active.

## 17. 401 / 403 response shape

Responses should keep the existing `{ ok, message, data }` style where possible.

401 unauthenticated:

```json
{
  "ok": false,
  "message": "Authentication required",
  "code": "UNAUTHORIZED"
}
```

403 authenticated but not allowed:

```json
{
  "ok": false,
  "message": "Forbidden",
  "code": "FORBIDDEN"
}
```

First-stage single-admin auth should mostly use 401. The 403 shape is reserved for later role or permission expansion.

Successful auth responses should use the existing success response pattern:

```json
{
  "ok": true,
  "message": "OK",
  "data": {}
}
```

## 18. Minimal implementation sequence

Recommended small-step sequence:

- 23-3: Auth / admin security design documentation landing.
- 23-4: Auth data structure / migration / seed boundary confirmation.
- 23-5: Auth code skeleton with `login`, `logout`, and `me`; no business API protection yet.
- 23-6: Auth middleware and 401 / 403 response behavior.
- 23-7: Protect highest-risk APIs first: media upload / delete / batch and publish / prerender.
- 23-8: Protect all `POST`, `PUT`, `PATCH`, and `DELETE`.
- 23-9: Protect admin-only GET routes.
- 23-10: Admin frontend login page and `me` startup check.
- 23-11: CORS whitelist and credentials.
- 23-12: Login rate limit.
- 23-13: Public frontend GET and prerender regression validation.
- 23-14: Round 23 stage acceptance.

Each step must be small, separately reviewable, and independently verifiable. Do not combine schema, auth middleware, admin UI, and API protection in one large change.

## 19. Round 22 boundaries that must not be touched

Round 23 auth work must not modify Round 22 data migration boundaries.

Do not change:

- Primary write / fallback behavior.
- MySQL to JSON export.
- Backup / rollback rehearsal.
- `build:prerender` behavior.
- Export `--write` disabled state.
- JSON freeze / delete state.
- `media-library.json` retention.
- Uploads retention.
- Publish logs retention strategy.
- Media-library / uploads deferred-risk status.
- JSON retention strategy.
- Fallback retention strategy.

Round 23 security may protect admin access, but it must not claim full single-source completion or change data ownership.

## 20. Explicitly forbidden actions

This document does not allow:

- Login code implementation.
- Auth middleware implementation.
- Login / logout / `me` route implementation.
- Migration creation.
- `admin_users` table creation.
- Seed execution.
- MySQL writes.
- Admin UI changes.
- API write tests.
- Primary write changes.
- Fallback closure.
- JSON freeze or JSON deletion.
- Upload modification.
- Export `--write`.
- Formal rollback.
- Generated artifact commits.

Any implementation requires a separate later step.

## 21. Follow-up steps

Recommended next step:

- 23-4: Auth data structure / migration / seed boundary confirmation.

23-4 should still be a boundary confirmation step. It should define the future `admin_users` migration, password hash strategy, seed or initialization command, session storage strategy, and rollback considerations before any migration or code is created.
