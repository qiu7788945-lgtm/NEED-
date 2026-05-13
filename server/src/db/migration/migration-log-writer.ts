import type { ResultSetHeader } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import type { ContentSnapshotResult } from '../snapshot/content-snapshot.js';
import type { ModuleMigrationResult, ModulePlan } from './types.js';

export type MigrationLogWriteResult = {
  attempted: number;
  affectedRows: number;
};

type MigrationLogConnection = Pick<PoolConnection, 'execute'>;

function buildDetailsJson(
  modulePlan: ModulePlan,
  result: ModuleMigrationResult,
  snapshot: ContentSnapshotResult,
): string {
  const moduleStats = result.details ?? {};

  return JSON.stringify({
    businessWritesEnabled: result.status === 'success',
    moduleName: modulePlan.moduleName,
    snapshotDir: snapshot.snapshotDir,
    plannedWrites: modulePlan.plannedWrites,
    actualWrites: result.actualWrites,
    warnings: result.warnings,
    schemaCompatibility: modulePlan.schemaCompatibility,
    skippedReason: result.skippedReason,
    ...moduleStats,
    moduleStats,
  });
}

export async function writeMigrationLogs(
  connection: MigrationLogConnection,
  modulePlans: ModulePlan[],
  results: ModuleMigrationResult[],
  snapshot: ContentSnapshotResult,
): Promise<MigrationLogWriteResult> {
  let affectedRows = 0;

  for (const resultItem of results) {
    const modulePlan = modulePlans.find((plan) => plan.moduleName === resultItem.moduleName);

    if (!modulePlan) {
      continue;
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO migration_logs (
        migration_key,
        batch_id,
        source_file,
        source_hash,
        status,
        source_count,
        inserted_count,
        updated_count,
        skipped_count,
        warning_count,
        error_message,
        details_json,
        started_at,
        finished_at
      ) VALUES (
        :migrationKey,
        :batchId,
        :sourceFile,
        :sourceHash,
        :status,
        :sourceCount,
        :insertedCount,
        :updatedCount,
        :skippedCount,
        :warningCount,
        :errorMessage,
        :detailsJson,
        :startedAt,
        :finishedAt
      )
      ON DUPLICATE KEY UPDATE
        batch_id = VALUES(batch_id),
        source_file = VALUES(source_file),
        status = VALUES(status),
        source_count = VALUES(source_count),
        inserted_count = VALUES(inserted_count),
        updated_count = VALUES(updated_count),
        skipped_count = VALUES(skipped_count),
        warning_count = VALUES(warning_count),
        error_message = VALUES(error_message),
        details_json = VALUES(details_json),
        started_at = VALUES(started_at),
        finished_at = VALUES(finished_at)`,
      {
        migrationKey: resultItem.migrationKey,
        batchId: snapshot.batchId,
        sourceFile: resultItem.sourceFile,
        sourceHash: resultItem.sourceHash,
        status: resultItem.status === 'skipped' && resultItem.skippedReason === 'source_hash_already_successfully_migrated'
          ? 'skipped_success_hash'
          : resultItem.status,
        sourceCount: resultItem.sourceCount,
        insertedCount: resultItem.insertedCount,
        updatedCount: resultItem.updatedCount,
        skippedCount: resultItem.skippedCount,
        warningCount: resultItem.warningCount,
        errorMessage: resultItem.errorMessage,
        detailsJson: buildDetailsJson(modulePlan, resultItem, snapshot),
        startedAt: resultItem.startedAt,
        finishedAt: resultItem.finishedAt,
      },
    );

    affectedRows += result.affectedRows;
  }

  return {
    attempted: results.length,
    affectedRows,
  };
}
