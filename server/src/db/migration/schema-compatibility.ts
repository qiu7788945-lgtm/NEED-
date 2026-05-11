import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  PlannedTableWrite,
  SchemaCompatibilityIssue,
  SchemaCompatibilityResult,
  SchemaTable,
} from './types.js';

const migrationDir = path.dirname(fileURLToPath(import.meta.url));
const dbRoot = path.resolve(migrationDir, '..');
const schemaPath = path.join(dbRoot, 'migrations', '001_initial_schema.sql');

const nonColumnPrefixes = new Set([
  'PRIMARY',
  'UNIQUE',
  'KEY',
  'CONSTRAINT',
  'CHECK',
  'FOREIGN',
  'INDEX',
]);

function parseSchemaTables(sql: string): Map<string, SchemaTable> {
  const tables = new Map<string, SchemaTable>();
  const tablePattern = /CREATE TABLE(?: IF NOT EXISTS)?\s+`?([a-zA-Z_][\w]*)`?\s*\(([\s\S]*?)\)\s*ENGINE/gi;
  let match: RegExpExecArray | null;

  while ((match = tablePattern.exec(sql)) !== null) {
    const [, table, body] = match;
    const fields = body
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/,$/, ''))
      .filter(Boolean)
      .map((line) => {
        const firstToken = line.split(/\s+/)[0]?.replace(/`/g, '');
        return firstToken ?? '';
      })
      .filter((firstToken) => firstToken && !nonColumnPrefixes.has(firstToken.toUpperCase()));

    tables.set(table, {
      table,
      fields,
    });
  }

  return tables;
}

export async function loadSchemaTables(): Promise<Map<string, SchemaTable>> {
  const sql = await readFile(schemaPath, 'utf8');
  return parseSchemaTables(sql);
}

export function checkPlannedWritesAgainstSchema(
  plannedWrites: PlannedTableWrite[],
  tables: Map<string, SchemaTable>,
): SchemaCompatibilityResult {
  const missingTables: SchemaCompatibilityIssue[] = [];
  const missingFields: SchemaCompatibilityIssue[] = [];
  const checkedTables = [...new Set(plannedWrites.map((write) => write.table))].sort((a, b) =>
    a.localeCompare(b),
  );

  for (const plannedWrite of plannedWrites) {
    const table = tables.get(plannedWrite.table);

    if (!table) {
      missingTables.push({
        table: plannedWrite.table,
        message: `Table "${plannedWrite.table}" is planned but missing from 001_initial_schema.sql.`,
      });
      continue;
    }

    const fieldSet = new Set(table.fields);

    for (const field of plannedWrite.fields) {
      if (!fieldSet.has(field)) {
        missingFields.push({
          table: plannedWrite.table,
          field,
          message: `Field "${plannedWrite.table}.${field}" is planned but missing from 001_initial_schema.sql.`,
        });
      }
    }
  }

  return {
    ok: missingTables.length === 0 && missingFields.length === 0,
    checkedTables,
    missingTables,
    missingFields,
  };
}
