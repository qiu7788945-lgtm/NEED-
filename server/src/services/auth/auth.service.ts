import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getAuthConfig } from '../../config/auth.js';
import { getDbPool } from '../../db/client.js';
import { verifyPassword } from '../../utils/password-hash.js';
import { createSessionHash, createSessionToken } from './session.js';

export type AuthUser = {
  username: string;
  status: string;
};

type LoginInput = {
  username: string;
  password: string;
};

type AdminUserRow = RowDataPacket & {
  id: number;
  username: string;
  password_hash: string;
  status: string;
};

type SessionUserRow = RowDataPacket & {
  username: string;
  status: string;
};

export class AuthServiceError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

export function isAuthServiceError(error: unknown): error is AuthServiceError {
  return error instanceof AuthServiceError;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeLoginInput(value: unknown): LoginInput {
  if (!isRecord(value) || typeof value.username !== 'string' || typeof value.password !== 'string') {
    throw new AuthServiceError(400, 'INVALID_AUTH_REQUEST', 'Username and password are required.');
  }

  const username = value.username.trim();
  const password = value.password;

  if (!username || !password) {
    throw new AuthServiceError(400, 'INVALID_AUTH_REQUEST', 'Username and password are required.');
  }

  return { username, password };
}

function toAuthUser(row: { username: string; status: string }): AuthUser {
  return {
    username: row.username,
    status: row.status,
  };
}

async function createSession(
  connection: PoolConnection,
  adminUserId: number,
): Promise<{ sessionToken: string }> {
  const authConfig = getAuthConfig();
  const sessionToken = createSessionToken();
  const sessionHash = createSessionHash(sessionToken);

  await connection.execute(
    `INSERT INTO admin_sessions (admin_user_id, session_hash, expires_at)
     VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? SECOND))`,
    [adminUserId, sessionHash, authConfig.sessionTtlSeconds],
  );

  return { sessionToken };
}

export async function loginAdmin(value: unknown): Promise<{ user: AuthUser; sessionToken: string }> {
  const input = normalizeLoginInput(value);
  const pool = getDbPool();
  const [rows] = await pool.execute<AdminUserRow[]>(
    `SELECT id, username, password_hash, status
     FROM admin_users
     WHERE username = ?
     LIMIT 1`,
    [input.username],
  );
  const adminUser = rows[0];

  if (!adminUser) {
    throw new AuthServiceError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
  }

  if (adminUser.status !== 'active') {
    throw new AuthServiceError(403, 'FORBIDDEN', 'Forbidden.');
  }

  const passwordMatches = await verifyPassword(input.password, adminUser.password_hash);

  if (!passwordMatches) {
    throw new AuthServiceError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const { sessionToken } = await createSession(connection, adminUser.id);

    await connection.execute(
      `UPDATE admin_users
       SET last_login_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [adminUser.id],
    );

    await connection.commit();

    return {
      user: toAuthUser(adminUser),
      sessionToken,
    };
  } catch {
    await connection.rollback();
    throw new AuthServiceError(500, 'AUTH_SESSION_CREATE_FAILED', 'Failed to create admin session.');
  } finally {
    connection.release();
  }
}

export async function logoutAdmin(sessionToken: string | undefined): Promise<void> {
  if (!sessionToken) {
    return;
  }

  const sessionHash = createSessionHash(sessionToken);
  const pool = getDbPool();

  await pool.execute(
    `UPDATE admin_sessions
     SET revoked_at = CURRENT_TIMESTAMP
     WHERE session_hash = ?
       AND revoked_at IS NULL`,
    [sessionHash],
  );
}

export async function getCurrentAdmin(sessionToken: string | undefined): Promise<AuthUser> {
  if (!sessionToken) {
    throw new AuthServiceError(401, 'UNAUTHORIZED', 'Authentication required.');
  }

  const sessionHash = createSessionHash(sessionToken);
  const pool = getDbPool();
  const [rows] = await pool.execute<SessionUserRow[]>(
    `SELECT admin_users.username, admin_users.status
     FROM admin_sessions
     INNER JOIN admin_users ON admin_users.id = admin_sessions.admin_user_id
     WHERE admin_sessions.session_hash = ?
       AND admin_sessions.expires_at > CURRENT_TIMESTAMP
       AND admin_sessions.revoked_at IS NULL
     LIMIT 1`,
    [sessionHash],
  );
  const adminUser = rows[0];

  if (!adminUser) {
    throw new AuthServiceError(401, 'UNAUTHORIZED', 'Authentication required.');
  }

  if (adminUser.status !== 'active') {
    throw new AuthServiceError(403, 'FORBIDDEN', 'Forbidden.');
  }

  return toAuthUser(adminUser);
}
