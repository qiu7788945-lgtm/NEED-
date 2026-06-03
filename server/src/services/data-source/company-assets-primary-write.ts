import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { getDbPool, getSafeDatabaseConfig } from '../../db/client.js';
import { logger } from '../../utils/logger.js';

const MODULE_NAME = 'company-assets';

type ApiError = Error & {
  statusCode: number;
  code: string;
  cause?: unknown;
};

export interface CompanyAssetPrimaryWriteInput {
  id: string;
  title: string;
  summary: string;
  description: string;
  location: string;
  imageUrl: string;
  imageAlt: string;
  sortOrder: number;
  enabled: boolean;
}

function createPrimaryWriteError(
  message: string,
  code: string,
  statusCode: number,
  cause?: unknown,
): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.code = code;
  if (cause !== undefined) {
    error.cause = cause;
  }

  return error;
}

function isApiError(error: unknown): error is ApiError {
  return error instanceof Error
    && typeof (error as Partial<ApiError>).statusCode === 'number'
    && typeof (error as Partial<ApiError>).code === 'string';
}

function assertMysqlConfiguredForPrimaryWrite() {
  try {
    const config = getSafeDatabaseConfig();

    if (!config.configured) {
      logger.error('Company-assets primary write blocked because MySQL is not configured.', {
        moduleName: MODULE_NAME,
        missing: config.missing,
      });

      throw createPrimaryWriteError(
        `MySQL not configured for company-assets primary write. Missing: ${config.missing.join(', ')}`,
        'COMPANY_ASSETS_MYSQL_NOT_CONFIGURED_FOR_PRIMARY_WRITE',
        503,
      );
    }
  } catch (error) {
    if (isApiError(error)) {
      throw error;
    }

    logger.error('Company-assets primary write blocked because MySQL config is invalid.', {
      moduleName: MODULE_NAME,
      message: error instanceof Error ? error.message : String(error),
    });

    throw createPrimaryWriteError(
      'MySQL config invalid for company-assets primary write.',
      'COMPANY_ASSETS_MYSQL_CONFIG_INVALID_FOR_PRIMARY_WRITE',
      503,
      error,
    );
  }
}

async function softDeleteRowsOutsideBody(
  connection: PoolConnection,
  assetKeys: string[],
) {
  if (assetKeys.length === 0) {
    await connection.execute<ResultSetHeader>(
      `UPDATE company_assets
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE deleted_at IS NULL`,
    );
    return;
  }

  const placeholders = assetKeys.map((_, index) => `:assetKey${index}`).join(', ');
  const params = Object.fromEntries(assetKeys.map((assetKey, index) => [`assetKey${index}`, assetKey]));

  await connection.execute<ResultSetHeader>(
    `UPDATE company_assets
     SET deleted_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE deleted_at IS NULL
       AND asset_key NOT IN (${placeholders})`,
    params,
  );
}

export async function writeCompanyAssetsToMysqlPrimary(assets: CompanyAssetPrimaryWriteInput[]) {
  assertMysqlConfiguredForPrimaryWrite();

  let connection: PoolConnection | undefined;

  try {
    connection = await getDbPool().getConnection();
    await connection.beginTransaction();

    for (const asset of assets) {
      await connection.execute<ResultSetHeader>(
        `INSERT INTO company_assets (
          asset_key,
          media_id,
          media_url,
          alt_text,
          description,
          sort_order,
          is_enabled,
          raw_json,
          created_at,
          updated_at,
          deleted_at
        ) VALUES (
          :assetKey,
          NULL,
          :mediaUrl,
          :altText,
          :description,
          :sortOrder,
          :isEnabled,
          :rawJson,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          NULL
        )
        ON DUPLICATE KEY UPDATE
          media_id = company_assets.media_id,
          media_url = VALUES(media_url),
          alt_text = VALUES(alt_text),
          description = VALUES(description),
          sort_order = VALUES(sort_order),
          is_enabled = VALUES(is_enabled),
          raw_json = VALUES(raw_json),
          updated_at = CURRENT_TIMESTAMP,
          deleted_at = NULL`,
        {
          assetKey: asset.id,
          mediaUrl: asset.imageUrl,
          altText: asset.imageAlt,
          description: asset.description,
          sortOrder: asset.sortOrder,
          isEnabled: asset.enabled ? 1 : 0,
          rawJson: JSON.stringify(asset),
        },
      );
    }

    await softDeleteRowsOutsideBody(connection, assets.map((asset) => asset.id));
    await connection.commit();
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        logger.warn('Company-assets MySQL primary write rollback failed.', {
          moduleName: MODULE_NAME,
          operation: 'mysql-primary-write-rollback',
          message: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        });
      }
    }

    logger.error('Company-assets MySQL primary write failed.', {
      moduleName: MODULE_NAME,
      operation: 'mysql-primary-write',
      assetCount: assets.length,
      message: error instanceof Error ? error.message : String(error),
    });

    throw createPrimaryWriteError(
      'Company-assets MySQL primary write failed.',
      'COMPANY_ASSETS_MYSQL_PRIMARY_WRITE_FAILED',
      500,
      error,
    );
  } finally {
    connection?.release();
  }
}
