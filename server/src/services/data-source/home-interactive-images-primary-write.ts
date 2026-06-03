import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import type { HomeInteractiveImageSlot } from '../../../../shared/types/home.js';
import { getDbPool, getSafeDatabaseConfig } from '../../db/client.js';
import { logger } from '../../utils/logger.js';

const MODULE_NAME = 'home-interactive-images';

type ApiError = Error & {
  statusCode: number;
  code: string;
  cause?: unknown;
};

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
      logger.error('Home-interactive-images primary write blocked because MySQL is not configured.', {
        moduleName: MODULE_NAME,
        missing: config.missing,
      });

      throw createPrimaryWriteError(
        `MySQL not configured for home-interactive-images primary write. Missing: ${config.missing.join(', ')}`,
        'HOME_INTERACTIVE_IMAGES_MYSQL_NOT_CONFIGURED_FOR_PRIMARY_WRITE',
        503,
      );
    }
  } catch (error) {
    if (isApiError(error)) {
      throw error;
    }

    logger.error('Home-interactive-images primary write blocked because MySQL config is invalid.', {
      moduleName: MODULE_NAME,
      message: error instanceof Error ? error.message : String(error),
    });

    throw createPrimaryWriteError(
      'MySQL config invalid for home-interactive-images primary write.',
      'HOME_INTERACTIVE_IMAGES_MYSQL_CONFIG_INVALID_FOR_PRIMARY_WRITE',
      503,
      error,
    );
  }
}

export async function writeHomeInteractiveImagesToMysqlPrimary(slots: HomeInteractiveImageSlot[]) {
  assertMysqlConfiguredForPrimaryWrite();

  let connection: PoolConnection | undefined;

  try {
    connection = await getDbPool().getConnection();
    await connection.beginTransaction();

    for (const slot of slots) {
      await connection.execute<ResultSetHeader>(
        `INSERT INTO home_interactive_images (
          slot_number,
          media_id,
          image_url,
          alt_text,
          sort_order,
          is_enabled,
          created_at,
          updated_at,
          deleted_at
        ) VALUES (
          :slotNumber,
          NULL,
          :imageUrl,
          :altText,
          :sortOrder,
          :isEnabled,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          NULL
        )
        ON DUPLICATE KEY UPDATE
          media_id = COALESCE(home_interactive_images.media_id, VALUES(media_id)),
          image_url = VALUES(image_url),
          alt_text = VALUES(alt_text),
          sort_order = VALUES(sort_order),
          is_enabled = VALUES(is_enabled),
          updated_at = CURRENT_TIMESTAMP,
          deleted_at = NULL`,
        {
          slotNumber: slot.slotNo,
          imageUrl: slot.mediaUrl,
          altText: slot.alt,
          sortOrder: slot.sortOrder,
          isEnabled: slot.enabled ? 1 : 0,
        },
      );
    }

    await connection.commit();
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        logger.warn('Home-interactive-images MySQL primary write rollback failed.', {
          moduleName: MODULE_NAME,
          operation: 'mysql-primary-write-rollback',
          message: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        });
      }
    }

    logger.error('Home-interactive-images MySQL primary write failed.', {
      moduleName: MODULE_NAME,
      operation: 'mysql-primary-write',
      slotCount: slots.length,
      message: error instanceof Error ? error.message : String(error),
    });

    throw createPrimaryWriteError(
      'Home-interactive-images MySQL primary write failed.',
      'HOME_INTERACTIVE_IMAGES_MYSQL_PRIMARY_WRITE_FAILED',
      500,
      error,
    );
  } finally {
    connection?.release();
  }
}
