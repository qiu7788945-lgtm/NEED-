import mysql from 'mysql2/promise';

export type DatabaseConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
};

export type SafeDatabaseConfig = {
  host?: string;
  port: number;
  database?: string;
  user?: string;
  passwordConfigured: boolean;
  ssl: boolean;
  configured: boolean;
  missing: string[];
};

let pool: mysql.Pool | undefined;

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readPort(): number {
  const rawPort = readEnv('MYSQL_PORT');
  if (!rawPort) {
    return 3306;
  }

  const port = Number(rawPort);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('MYSQL_PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function readSsl(): boolean {
  const value = readEnv('MYSQL_SSL')?.toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}

export function getSafeDatabaseConfig(): SafeDatabaseConfig {
  const host = readEnv('MYSQL_HOST');
  const database = readEnv('MYSQL_DATABASE');
  const user = readEnv('MYSQL_USER');
  const password = readEnv('MYSQL_PASSWORD');
  const requiredValues: Array<[string, string | undefined]> = [
    ['MYSQL_HOST', host],
    ['MYSQL_DATABASE', database],
    ['MYSQL_USER', user],
    ['MYSQL_PASSWORD', password],
  ];
  const missing = requiredValues
    .filter(([, value]) => !value)
    .map(([name]) => name);

  return {
    host,
    port: readPort(),
    database,
    user,
    passwordConfigured: Boolean(password),
    ssl: readSsl(),
    configured: missing.length === 0,
    missing,
  };
}

export function getDatabaseConfig(): DatabaseConfig {
  const safeConfig = getSafeDatabaseConfig();

  if (!safeConfig.configured) {
    throw new Error(`MySQL is not configured. Missing: ${safeConfig.missing.join(', ')}`);
  }

  return {
    host: safeConfig.host as string,
    port: safeConfig.port,
    database: safeConfig.database as string,
    user: safeConfig.user as string,
    password: readEnv('MYSQL_PASSWORD') as string,
    ssl: safeConfig.ssl,
  };
}

export function getDbPool(): mysql.Pool {
  if (!pool) {
    const config = getDatabaseConfig();
    pool = mysql.createPool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? {} : undefined,
      waitForConnections: true,
      connectionLimit: 5,
      namedPlaceholders: true,
    });
  }

  return pool;
}

export async function closeDbPool(): Promise<void> {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = undefined;
}
