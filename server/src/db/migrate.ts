import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDbPool, getDbPool, getSafeDatabaseConfig } from './client.js';

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

export async function runSchemaMigrations(): Promise<void> {
  const config = getSafeDatabaseConfig();

  if (!config.configured) {
    throw new Error(`MySQL is not configured. Missing: ${config.missing.join(', ')}`);
  }

  const dbDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationsDir = path.join(dbDir, 'migrations');
  const migrationFiles = (await readdir(migrationsDir))
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const pool = getDbPool();

  for (const fileName of migrationFiles) {
    const sql = await readFile(path.join(migrationsDir, fileName), 'utf8');
    const statements = splitSqlStatements(sql);

    for (const statement of statements) {
      await pool.query(statement);
    }

    console.log(`Applied ${fileName} (${statements.length} statements).`);
  }
}

async function main() {
  try {
    await runSchemaMigrations();
    console.log('Database migrations completed.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await closeDbPool();
  }
}

void main();
