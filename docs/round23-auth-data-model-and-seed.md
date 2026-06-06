# Round 23 Auth Data Model, Migration, and Seed Boundary

This document records the Round 23-4B auth data structure, migration, and seed documentation landing.

It is a documentation-only step. It does not create migrations, admin tables, seed scripts, create-admin scripts, login code, auth middleware, login/logout/me routes, admin UI changes, API write tests, MySQL writes, JSON changes, uploads changes, export `--write`, `build:prerender`, generated artifacts, or Round 22 data migration changes.

## 1. Purpose

Round 23 formal admin auth should use a small, reviewable data model before any migration or login implementation starts.

This document freezes the first-stage direction for:

- `admin_users` table design.
- `admin_sessions` table design.
- Session storage strategy.
- Password hash strategy.
- `create-admin` initialization strategy.
- Reset-password follow-up strategy.
- Auth environment variables.
- Migration split boundaries.
- Round 23 implementation order.
- Round 22 boundaries that remain forbidden to touch.

## 2. First-stage admin user model

The first-stage formal login closure should use a MySQL `admin_users` table.

Long-term reliance on an environment-variable administrator is not recommended. Environment-only gates may block access temporarily, but they do not provide a clean admin identity, reliable revocation, or a durable path to session management.

The first stage is a single-administrator model.

It must not implement:

- Complex RBAC.
- Multi-role permission systems.
- Per-module permission matrices.
- Multi-tenant administration.
- Team management.
- Full audit-log workflows.

### Minimum fields

The first `admin_users` migration should include these minimum fields:

- `id`
- `username`
- `password_hash`
- `status`
- `created_at`
- `updated_at`

### Optional first-stage field

This field is useful but not required for the first table creation:

- `last_login_at`

### Deferred fields

These fields should remain deferred unless a later implementation step explicitly opens their scope:

- `email`
- `display_name`
- `role`
- `password_updated_at`
- `failed_login_count`
- `locked_until`
- Audit fields

### User model rules

Rules:

- `username` should be unique.
- `status` should be retained so an admin account can be disabled without deleting it.
- The first stage should use a simple active/disabled status model.
- `role` is deferred because complex RBAC is out of scope.
- Audit logging is deferred.
- Failed-login account locking is deferred; first-stage brute-force protection should use login rate limiting.
- API responses must never include `password_hash`.

## 3. First-stage admin session model

The first-stage formal session storage should use a MySQL `admin_sessions` table.

This is preferred over long-term in-memory sessions or pure signed-cookie sessions because the backend can revoke sessions, expire sessions, implement logout, and later extend audit behavior.

### Minimum fields

The first `admin_sessions` migration should include these minimum fields:

- `id`
- `admin_user_id`
- `session_hash`
- `created_at`
- `expires_at`
- `last_seen_at`
- `revoked_at`

### Deferred fields

These fields should remain deferred unless a later implementation step explicitly opens their scope:

- `ip_hash`
- `user_agent`
- Detailed audit fields

### Session rules

Rules:

- The cookie stores only a session id.
- The session id should not be stored as plain text in MySQL.
- The database should store `session_hash`, derived from the session id.
- The cookie must be HttpOnly.
- The cookie must not store admin profile data.
- The cookie must not store `password_hash`.
- The cookie must not store a plain text token payload.
- Logout should mark the session revoked by setting `revoked_at`.
- Expired sessions must be rejected.
- Revoked sessions must be rejected.
- A later step may add session cleanup for expired or revoked rows.

## 4. Session storage comparison

### Option A: server memory session

Conclusion: only suitable for local temporary verification, not for the formal closure.

Reasons:

- Login state is lost when the server restarts.
- Multi-instance deployment is not supported cleanly.
- Production reliability is weak.
- Revocation state is not durable.

### Option B: MySQL `admin_sessions`

Conclusion: recommended as the formal first-stage session strategy.

Reasons:

- Sessions can be revoked server-side.
- Sessions can expire server-side.
- Logout has a durable backend effect.
- The model can later support audit and session cleanup.
- It fits the current MySQL-backed admin direction without touching Round 22 data migration boundaries.

### Option C: signed cookie session

Conclusion: not the first-stage preference.

Reasons:

- It avoids a session table, but revocation is weak.
- It is less suitable for future audit requirements.
- Cookie payload must stay extremely small.
- Sensitive information must not be stored in the cookie.

## 5. Password hash strategy

Passwords must be hashed.

The first-stage recommendation is `bcrypt`, with a documented cost factor in the implementation step.

### Option A: argon2id

Conclusion: strong modern password hashing option, but not the default first-stage recommendation unless deployment compatibility is confirmed.

Reasons:

- Security properties are strong.
- It is a modern recommendation.
- It may introduce native dependency and deployment compatibility costs.

If the deployment environment later confirms `argon2` compatibility, `argon2id` can be evaluated or adopted in a separate implementation step.

### Option B: bcrypt

Conclusion: recommended for Round 23 first-stage implementation.

Reasons:

- Mature and widely used.
- Straightforward in Node projects.
- Lower deployment risk for the first auth closure.
- Library verification APIs reduce custom password-checking mistakes.

### Option C: Node crypto scrypt / pbkdf2

Conclusion: usable, but not the first-stage preference.

Reasons:

- The project would need to define salt, parameters, and serialized hash format itself.
- Engineering consistency is weaker than using a mature password hashing library.
- Custom handling increases review burden.

### Password prohibitions

Forbidden:

- Plain text passwords.
- Fast hashes such as `sha256(password)`.
- Real passwords in `.env`.
- Real passwords in docs.
- Real passwords in source code.
- Real passwords in migrations.
- Real passwords in JSON.
- Real passwords in Git history.
- Real passwords in chat records.
- Returning or logging submitted passwords.
- Returning or logging `password_hash`.

Only `password_hash` may be stored.

## 6. `create-admin` initialization strategy

The migration should only create auth tables.

It should not seed a default administrator.

The first administrator should be created by a separate `create-admin` command in a later implementation step.

Recommended behavior:

- Prompt interactively for `username`.
- Prompt interactively for `password`.
- Hash the submitted password before inserting the admin row.
- Insert only `password_hash`, never the submitted password.
- Refuse to overwrite when an active admin already exists by default.
- Do not accept plain text `ADMIN_PASSWORD` as the formal path.
- May support read-only `ADMIN_PASSWORD_HASH` as an advanced temporary path, but not as the default path.
- Keep real passwords out of Git, docs, code, migration files, JSON, generated artifacts, and chat records.

Manual SQL insertion of a prepared hash should not be the normal recommendation. It may be documented later only as an emergency operation with strong warnings.

## 7. Reset-password follow-up

`reset-admin-password` is deferred.

It should be opened as a separate later task after the initial `create-admin`, login, logout, and session validation flow is implemented.

The reset path should follow the same password rules:

- No plain text password storage.
- No real password in `.env`.
- No real password in docs.
- No real password in migration files.
- Hash before writing to MySQL.
- Refuse ambiguous account selection.

## 8. Auth environment variables

Recommended environment variables:

- `ADMIN_SESSION_SECRET`
- `ADMIN_COOKIE_NAME`
- `ADMIN_COOKIE_SECURE`
- `ADMIN_COOKIE_SAME_SITE`
- `ADMIN_SESSION_TTL_SECONDS`
- `ADMIN_ALLOWED_ORIGINS`
- `ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS`
- `ADMIN_LOGIN_RATE_LIMIT_MAX`

Rules:

- `ADMIN_SESSION_SECRET` must be a random long secret.
- In production, missing `ADMIN_SESSION_SECRET` should fail startup or disable admin auth startup.
- `ADMIN_PASSWORD` is not recommended.
- `ADMIN_PASSWORD_HASH` may only be discussed as a temporary transition value, not the formal default closure.
- Development may provide safe defaults for cookie name and TTL.
- Production must explicitly define allowed origins.
- `ADMIN_COOKIE_SECURE` should be true in production.
- `ADMIN_COOKIE_SAME_SITE` should be `Lax` or `Strict` in the first stage, depending on the admin/API deployment topology.
- Cookie-based auth requires credentials-aware admin requests.

## 9. Migration split boundary

The next implementation step may add an independent migration named:

```text
003_add_admin_auth.sql
```

The migration boundary should be:

- Do not modify `001_initial_schema.sql`.
- Do not modify existing business tables.
- Do not touch Round 22 primary write / fallback / export / backup / prerender logic.
- Do not seed a default password.
- Do not create a default weak-password account.
- Do not write any real administrator password.
- Only create auth-related tables.
- Prefer creating both `admin_users` and `admin_sessions` in the same auth migration.
- Include repeat-safe guards where the project migration style supports them.
- Include manual recovery notes in the implementation or companion documentation.

## 10. Implementation prerequisites

Before code implementation starts, these decisions must be final:

- Session storage strategy.
- Password hash library.
- `admin_users` schema.
- `admin_sessions` schema.
- `create-admin` script boundary.
- Auth config environment variables.
- Cookie name, TTL, Secure, HttpOnly, and SameSite parameters.
- CORS credentials behavior.
- Origin / Referer guard behavior.
- Login rate limit behavior.
- Protected API rollout order.

## 11. Recommended Round 23 implementation route

Recommended small-step route:

- 23-4B: Auth data structure / migration / seed documentation landing.
- 23-5: Auth migration implementation, table creation only, no default admin seed.
- 23-6: `create-admin` initialization script implementation.
- 23-7: `login`, `logout`, and `me` implementation.
- 23-8: Auth middleware and 401 / 403 response behavior.
- 23-9: Protect highest-risk APIs first, prioritizing media upload/delete/batch and publish/prerender.
- 23-10: Protect all `POST`, `PUT`, `PATCH`, and `DELETE`.
- 23-11: Protect admin-only `GET`.
- 23-12: Admin frontend login page and `me` startup check.
- 23-13: CORS whitelist, credentials, and origin guard.
- 23-14: Login rate limit.
- 23-15: Public frontend `GET` and prerender regression acceptance.
- 23-16: Round 23 stage acceptance.

Numbers may be adjusted later, but the route must remain small-step, reviewable, and independently verifiable. Schema, scripts, login code, middleware, API protection, and admin UI should not be mixed into one large change.

## 12. Round 22 boundaries that remain forbidden

Round 23 auth work must not touch:

- Primary write / fallback behavior.
- MySQL to JSON export.
- Backup / rollback rehearsal.
- `build:prerender`.
- Export `--write`.
- JSON freeze / delete.
- `media-library.json`.
- Uploads.
- Publish logs retention strategy.
- Media-library / uploads deferred risk.
- Fallback retention strategy.
- JSON retention strategy.

Round 23 auth may protect admin access, but it must not change data ownership, claim full single-source completion, close fallback, delete JSON, or change Round 22 migration boundaries.

## 13. Forbidden actions in this documentation step

This step does not allow:

- Migration creation.
- `003_add_admin_auth.sql` creation.
- `admin_users` table creation.
- `admin_sessions` table creation.
- MySQL writes.
- Login code.
- Auth middleware.
- Login / logout / `me` routes.
- Seed scripts.
- `create-admin` scripts.
- Admin UI changes.
- API write tests.
- Round 22 primary write / fallback / export / backup / prerender changes.
- Fallback closure.
- JSON freeze or deletion.
- Export `--write`.
- Generated artifact commits.

Any implementation requires a separate later step.
