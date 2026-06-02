import type { RowDataPacket } from 'mysql2/promise';
import { getDbPool, getSafeDatabaseConfig } from '../client.js';
import type { ExportModuleDefinition, MysqlReadResult, MysqlTableCount } from './types.js';

type CountRow = RowDataPacket & {
  count: number;
};

async function readTableCount(tableName: string): Promise<MysqlTableCount> {
  try {
    const [rows] = await getDbPool().query<CountRow[]>(`SELECT COUNT(*) AS count FROM \`${tableName}\``);
    return {
      tableName,
      count: Number(rows[0]?.count ?? 0),
      readOk: true,
    };
  } catch (error) {
    return {
      tableName,
      count: null,
      readOk: false,
      error: error instanceof Error ? error.message : 'Unable to read MySQL table count.',
    };
  }
}

export async function readMysqlModuleCounts(definition: ExportModuleDefinition): Promise<MysqlReadResult> {
  let safeConfig;

  try {
    safeConfig = getSafeDatabaseConfig();
  } catch (error) {
    return {
      configured: false,
      available: false,
      missing: [],
      status: 'mysql_unavailable',
      error: error instanceof Error ? error.message : 'Invalid MySQL configuration.',
      tableCounts: [],
    };
  }

  if (!safeConfig.configured) {
    return {
      configured: false,
      available: false,
      missing: safeConfig.missing,
      status: 'mysql_unavailable',
      tableCounts: definition.mysqlTables.map((tableName) => ({
        tableName,
        count: null,
        readOk: false,
        error: `MySQL is not configured. Missing: ${safeConfig.missing.join(', ')}`,
      })),
    };
  }

  try {
    await getDbPool().query('SELECT 1');
  } catch (error) {
    return {
      configured: true,
      available: false,
      missing: [],
      status: 'mysql_unavailable',
      error: error instanceof Error ? error.message : 'Unable to connect to MySQL.',
      tableCounts: definition.mysqlTables.map((tableName) => ({
        tableName,
        count: null,
        readOk: false,
        error: 'MySQL connection failed before table counts could be read.',
      })),
    };
  }

  const tableCounts: MysqlTableCount[] = [];
  for (const tableName of definition.mysqlTables) {
    tableCounts.push(await readTableCount(tableName));
  }

  return {
    configured: true,
    available: tableCounts.every((count) => count.readOk),
    missing: [],
    status: tableCounts.every((count) => count.readOk) ? 'configured' : 'mysql_unavailable',
    tableCounts,
  };
}
