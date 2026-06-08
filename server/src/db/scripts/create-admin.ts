import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { closeDbPool, getDbPool, getSafeDatabaseConfig } from '../client.js';
import { hashPassword } from '../../utils/password-hash.js';

const MIN_PASSWORD_LENGTH = 12;
const MAX_USERNAME_LENGTH = 191;

type TableRow = RowDataPacket & {
  tableName: string;
};

type ActiveAdminCountRow = RowDataPacket & {
  activeAdminCount: number;
};

function printHelp(): void {
  console.log(`Usage:
  npm.cmd run admin:create -- [--help]
  npm.cmd run admin:create -- [--dry-run]

Default mode:
  Prompts for username, password, and password confirmation.
  Creates the first active admin user in admin_users.
  Does not create sessions or cookies.

Options:
  --help     Print this help text without connecting to MySQL.
  --dry-run  Check MySQL config, auth tables, and active admin count without prompting or writing.`);
}

function parseArgs(args: string[]): { help: boolean; dryRun: boolean } {
  const allowedArgs = new Set(['--help', '-h', '--dry-run']);
  const unknownArgs = args.filter((arg) => !allowedArgs.has(arg));

  if (unknownArgs.length > 0) {
    throw new Error(`Unknown option: ${unknownArgs.join(', ')}`);
  }

  return {
    help: args.includes('--help') || args.includes('-h'),
    dryRun: args.includes('--dry-run'),
  };
}

function requireInteractiveTty(): void {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Interactive TTY is required for create-admin. Use --help for usage.');
  }
}

async function readVisibleLine(prompt: string): Promise<string> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return await readline.question(prompt);
  } finally {
    readline.close();
  }
}

function readHiddenLine(prompt: string): Promise<string> {
  const stdin = process.stdin;
  const stdout = process.stdout;

  if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== 'function') {
    return Promise.reject(new Error('Interactive TTY is required for hidden password input.'));
  }

  return new Promise((resolve, reject) => {
    let value = '';
    let settled = false;
    const wasRaw = stdin.isRaw;

    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(wasRaw);
      stdin.pause();
    };

    const finish = (error?: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      stdout.write('\n');

      if (error) {
        reject(error);
        return;
      }

      resolve(value);
    };

    const onData = (chunk: Buffer | string) => {
      const text = String(chunk);

      for (const char of text) {
        if (char === '\u0003') {
          finish(new Error('Input cancelled.'));
          return;
        }

        if (char === '\r' || char === '\n') {
          finish();
          return;
        }

        if (char === '\u0008' || char === '\u007f') {
          value = value.slice(0, -1);
          continue;
        }

        const codePoint = char.codePointAt(0) ?? 0;

        if (codePoint >= 32 && codePoint !== 127) {
          value += char;
        }
      }
    };

    stdout.write(prompt);
    stdin.setEncoding('utf8');
    stdin.resume();
    stdin.setRawMode(true);
    stdin.on('data', onData);
  });
}

function assertMysqlConfigured(): void {
  const config = getSafeDatabaseConfig();

  if (!config.configured) {
    throw new Error(`MySQL is not configured. Missing: ${config.missing.join(', ')}`);
  }
}

async function checkConnection(): Promise<void> {
  const pool = getDbPool();
  await pool.query('SELECT 1 AS ok');
}

async function requireAuthTables(): Promise<void> {
  const pool = getDbPool();
  const [rows] = await pool.query<TableRow[]>(
    `SELECT TABLE_NAME AS tableName
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN ('admin_users', 'admin_sessions')`,
  );
  const existingTables = new Set(rows.map((row) => row.tableName));
  const missingTables = ['admin_users', 'admin_sessions'].filter((tableName) => !existingTables.has(tableName));

  if (missingTables.length > 0) {
    throw new Error(`Auth tables are missing: ${missingTables.join(', ')}. Run auth migration before create-admin.`);
  }
}

async function countActiveAdmins(): Promise<number> {
  const pool = getDbPool();
  const [rows] = await pool.query<ActiveAdminCountRow[]>(
    `SELECT COUNT(*) AS activeAdminCount
     FROM admin_users
     WHERE status = 'active'`,
  );

  return Number(rows[0]?.activeAdminCount ?? 0);
}

async function insertAdminUser(username: string, passwordHash: string): Promise<void> {
  const pool = getDbPool();
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO admin_users (username, password_hash, status)
     VALUES (?, ?, 'active')`,
    [username, passwordHash],
  );

  if (result.affectedRows !== 1) {
    throw new Error('Admin user insert did not create a row.');
  }
}

async function runCreateAdmin(dryRun: boolean): Promise<void> {
  assertMysqlConfigured();
  await checkConnection();
  await requireAuthTables();

  const activeAdminCount = await countActiveAdmins();

  if (activeAdminCount > 0) {
    throw new Error('An active admin already exists. create-admin refuses to overwrite existing admins.');
  }

  if (dryRun) {
    console.log('Dry run passed: MySQL is configured, auth tables exist, and no active admin exists.');
    console.log('No password was requested, no hash was generated, and no admin was created.');
    return;
  }

  requireInteractiveTty();

  const username = (await readVisibleLine('Admin username: ')).trim();

  if (!username) {
    throw new Error('Username is required.');
  }

  if (username.length > MAX_USERNAME_LENGTH) {
    throw new Error(`Username must be ${MAX_USERNAME_LENGTH} characters or fewer.`);
  }

  let password = await readHiddenLine('Admin password: ');
  let confirmPassword = await readHiddenLine('Confirm admin password: ');

  if (!password) {
    throw new Error('Password is required.');
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  if (password !== confirmPassword) {
    throw new Error('Password confirmation does not match.');
  }

  const passwordHash = await hashPassword(password);
  password = '';
  confirmPassword = '';

  await insertAdminUser(username, passwordHash);

  console.log(`Admin user "${username}" created with status=active.`);
  console.log('No admin session or cookie was created.');
}

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
      printHelp();
      return;
    }

    await runCreateAdmin(options.dryRun);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : 'create-admin failed.'}`);
    process.exitCode = 1;
  } finally {
    await closeDbPool();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
