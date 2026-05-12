import type { PoolConnection } from 'mysql2/promise';
import { getDbPool } from '../client.js';
import { moduleDefinitions } from '../migrators/registry.js';
import { migrateLowRiskModule } from '../migrators/low-risk-content.js';
import type { ContentSnapshotResult } from '../snapshot/content-snapshot.js';
import { writeMigrationLogs, type MigrationLogWriteResult } from './migration-log-writer.js';
import type { MigrationPlan, ModuleMigrationResult } from './types.js';

export type ContentWriteRunResult = {
  businessWritesEnabled: true;
  results: ModuleMigrationResult[];
  migrationLogs: MigrationLogWriteResult;
  summary: {
    moduleCount: number;
    successCount: number;
    skippedCount: number;
    notImplementedCount: number;
    failedCount: number;
    insertedCount: number;
    updatedCount: number;
    rowSkippedCount: number;
  };
};

async function assertDatabaseConnection(): Promise<void> {
  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

function assertSchemaCompatible(plan: MigrationPlan): void {
  const incompatibleModules = plan.modules.filter((modulePlan) => !modulePlan.schemaCompatibility.ok);

  if (incompatibleModules.length > 0) {
    throw new Error(
      `--write requires schema compatibility before snapshot creation. Incompatible modules: ${incompatibleModules
        .map((modulePlan) => modulePlan.moduleName)
        .join(', ')}`,
    );
  }
}

function buildSummary(results: ModuleMigrationResult[]): ContentWriteRunResult['summary'] {
  return {
    moduleCount: results.length,
    successCount: results.filter((result) => result.status === 'success').length,
    skippedCount: results.filter((result) => result.status === 'skipped').length,
    notImplementedCount: results.filter((result) => result.status === 'not_implemented').length,
    failedCount: results.filter((result) => result.status === 'failed').length,
    insertedCount: results.reduce((sum, result) => sum + result.insertedCount, 0),
    updatedCount: results.reduce((sum, result) => sum + result.updatedCount, 0),
    rowSkippedCount: results.reduce((sum, result) => sum + result.skippedCount, 0),
  };
}

async function runModuleWrites(
  connection: PoolConnection,
  plan: MigrationPlan,
): Promise<ModuleMigrationResult[]> {
  const results: ModuleMigrationResult[] = [];

  for (const [index, modulePlan] of plan.modules.entries()) {
    const definition = moduleDefinitions.find((item) => item.moduleName === modulePlan.moduleName);
    const savepointName = `module_${index}`;

    if (!definition) {
      throw new Error(`Missing module definition for ${modulePlan.moduleName}.`);
    }

    await connection.query(`SAVEPOINT ${savepointName}`);

    const result = await migrateLowRiskModule({
      pool: connection,
      definition,
      plan: modulePlan,
    });

    if (result.status === 'failed') {
      await connection.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
    }

    await connection.query(`RELEASE SAVEPOINT ${savepointName}`);
    results.push(result);
  }

  return results;
}

export async function prepareContentWrite(plan: MigrationPlan): Promise<void> {
  await assertDatabaseConnection();
  assertSchemaCompatible(plan);
}

export async function runContentWrite(
  plan: MigrationPlan,
  snapshot: ContentSnapshotResult,
): Promise<ContentWriteRunResult> {
  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const results = await runModuleWrites(connection, plan);
    const migrationLogs = await writeMigrationLogs(connection, plan.modules, results, snapshot);
    const summary = buildSummary(results);

    await connection.commit();

    return {
      businessWritesEnabled: true,
      results,
      migrationLogs,
      summary,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
