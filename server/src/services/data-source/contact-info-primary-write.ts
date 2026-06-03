import type { ResultSetHeader } from 'mysql2/promise';
import { getDbPool, getSafeDatabaseConfig } from '../../db/client.js';
import { logger } from '../../utils/logger.js';

const CONTACT_INFO_SINGLETON_KEY = 'contact_info';
const MODULE_NAME = 'contact-info';

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
      logger.error('Contact-info primary write blocked because MySQL is not configured.', {
        moduleName: MODULE_NAME,
        missing: config.missing,
      });

      throw createPrimaryWriteError(
        `MySQL not configured for contact-info primary write. Missing: ${config.missing.join(', ')}`,
        'CONTACT_INFO_MYSQL_NOT_CONFIGURED_FOR_PRIMARY_WRITE',
        503,
      );
    }
  } catch (error) {
    if (isApiError(error)) {
      throw error;
    }

    logger.error('Contact-info primary write blocked because MySQL config is invalid.', {
      moduleName: MODULE_NAME,
      message: error instanceof Error ? error.message : String(error),
    });

    throw createPrimaryWriteError(
      'MySQL config invalid for contact-info primary write.',
      'CONTACT_INFO_MYSQL_CONFIG_INVALID_FOR_PRIMARY_WRITE',
      503,
      error,
    );
  }
}

export async function writeContactInfoToMysqlPrimary(contactInfo: unknown) {
  assertMysqlConfiguredForPrimaryWrite();

  try {
    await getDbPool().execute<ResultSetHeader>(
      `INSERT INTO contact_info (
        singleton_key,
        content_json,
        is_enabled,
        created_at,
        updated_at,
        deleted_at
      ) VALUES (
        :singletonKey,
        :contentJson,
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        NULL
      )
      ON DUPLICATE KEY UPDATE
        content_json = VALUES(content_json),
        is_enabled = VALUES(is_enabled),
        updated_at = CURRENT_TIMESTAMP,
        deleted_at = NULL`,
      {
        singletonKey: CONTACT_INFO_SINGLETON_KEY,
        contentJson: JSON.stringify(contactInfo),
      },
    );
  } catch (error) {
    logger.error('Contact-info MySQL primary write failed.', {
      moduleName: MODULE_NAME,
      singletonKey: CONTACT_INFO_SINGLETON_KEY,
      message: error instanceof Error ? error.message : String(error),
    });

    throw createPrimaryWriteError(
      'Contact-info MySQL primary write failed.',
      'CONTACT_INFO_MYSQL_PRIMARY_WRITE_FAILED',
      500,
      error,
    );
  }
}
