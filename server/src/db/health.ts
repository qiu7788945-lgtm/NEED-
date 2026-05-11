import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { closeDbPool, getDbPool, getSafeDatabaseConfig } from './client.js';

export type DatabaseHealthResult = {
  ok: boolean;
  configured: boolean;
  message: string;
  config: ReturnType<typeof getSafeDatabaseConfig>;
};

export async function checkDatabaseHealth(): Promise<DatabaseHealthResult> {
  const config = getSafeDatabaseConfig();

  if (!config.configured) {
    return {
      ok: false,
      configured: false,
      message: `MySQL is not configured. Missing: ${config.missing.join(', ')}`,
      config,
    };
  }

  try {
    const pool = getDbPool();
    await pool.query('SELECT 1 AS ok');

    return {
      ok: true,
      configured: true,
      message: 'MySQL connection succeeded.',
      config,
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      message: error instanceof Error ? error.message : 'MySQL connection failed.',
      config,
    };
  }
}

async function main() {
  const result = await checkDatabaseHealth();
  console.log(JSON.stringify(result, null, 2));
  await closeDbPool();
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
