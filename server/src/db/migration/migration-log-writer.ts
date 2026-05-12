import type { ResultSetHeader } from 'mysql2';
import { getDbPool } from '../client.js';
import type { MigrationPlan, ModulePlan } from './types.js';
import type { ContentSnapshotResult } from '../snapshot/content-snapshot.js';

export type MigrationLogWriteResult = {
  attempted: number;
  affectedRows: number;
};

function buildDetailsJson(modulePlan: ModulePlan, snapshot: ContentSnapshotResult): string {
  return JSON.stringify({
    businessWritesEnabled: false,
    snapshotDir: snapshot.snapshotDir,
    moduleName: modulePlan.moduleName,
    plannedWrites: modulePlan.plannedWrites,
    warnings: modulePlan.warnings,
    schemaCompatibility: modulePlan.schemaCompatibility,
  });
}

export async function writeMigrationLogs(
  plan: MigrationPlan,
  snapshot: ContentSnapshotResult,
): Promise<MigrationLogWriteResult> {
  const pool = getDbPool();
  const startedAt = new Date();
  let affectedRows = 0;

  for (const modulePlan of plan.modules) {
    const finishedAt = new Date();
    const [result] = await pool.execute<ResultSetHeader>(
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
        migrationKey: modulePlan.migrationKey,
        batchId: snapshot.batchId,
        sourceFile: modulePlan.sourceFile,
        sourceHash: modulePlan.sourceHash,
        status: 'snapshot_logged',
        sourceCount: modulePlan.sourceCount,
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: modulePlan.sourceCount,
        warningCount: modulePlan.warnings.length,
        errorMessage: null,
        detailsJson: buildDetailsJson(modulePlan, snapshot),
        startedAt,
        finishedAt,
      },
    );

    affectedRows += result.affectedRows;
  }

  return {
    attempted: plan.modules.length,
    affectedRows,
  };
}
