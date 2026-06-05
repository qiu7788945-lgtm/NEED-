import type { ResultSetHeader } from 'mysql2/promise';
import type { HomeVideoConfig } from '../../../../shared/types/home.js';
import { getDbPool, getSafeDatabaseConfig } from '../../db/client.js';
import { logger } from '../../utils/logger.js';

const HOME_VIDEO_SINGLETON_KEY = 'home_video';
const MODULE_NAME = 'home-video';

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
      logger.error('Home-video primary write blocked because MySQL is not configured.', {
        moduleName: MODULE_NAME,
        missing: config.missing,
      });

      throw createPrimaryWriteError(
        `MySQL not configured for home-video primary write. Missing: ${config.missing.join(', ')}`,
        'HOME_VIDEO_MYSQL_NOT_CONFIGURED_FOR_PRIMARY_WRITE',
        503,
      );
    }
  } catch (error) {
    if (isApiError(error)) {
      throw error;
    }

    logger.error('Home-video primary write blocked because MySQL config is invalid.', {
      moduleName: MODULE_NAME,
      message: error instanceof Error ? error.message : String(error),
    });

    throw createPrimaryWriteError(
      'MySQL config invalid for home-video primary write.',
      'HOME_VIDEO_MYSQL_CONFIG_INVALID_FOR_PRIMARY_WRITE',
      503,
      error,
    );
  }
}

export async function writeHomeVideoToMysqlPrimary(config: HomeVideoConfig) {
  assertMysqlConfiguredForPrimaryWrite();

  try {
    await getDbPool().execute<ResultSetHeader>(
      `INSERT INTO home_video (
        singleton_key,
        video_url,
        poster_url,
        title,
        description,
        is_enabled,
        raw_json,
        created_at,
        updated_at,
        deleted_at
      ) VALUES (
        :singletonKey,
        :videoUrl,
        :posterUrl,
        :title,
        :description,
        :isEnabled,
        :rawJson,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        NULL
      )
      ON DUPLICATE KEY UPDATE
        video_url = VALUES(video_url),
        poster_url = VALUES(poster_url),
        title = VALUES(title),
        description = VALUES(description),
        is_enabled = VALUES(is_enabled),
        raw_json = VALUES(raw_json),
        updated_at = CURRENT_TIMESTAMP,
        deleted_at = NULL`,
      {
        singletonKey: HOME_VIDEO_SINGLETON_KEY,
        videoUrl: config.videoUrl,
        posterUrl: config.posterUrl || null,
        title: config.title,
        description: config.description,
        isEnabled: config.enabled ? 1 : 0,
        rawJson: JSON.stringify(config),
      },
    );
  } catch (error) {
    logger.error('Home-video MySQL primary write failed.', {
      moduleName: MODULE_NAME,
      operation: 'mysql-primary-write',
      singletonKey: HOME_VIDEO_SINGLETON_KEY,
      message: error instanceof Error ? error.message : String(error),
    });

    throw createPrimaryWriteError(
      'Home-video MySQL primary write failed.',
      'HOME_VIDEO_MYSQL_PRIMARY_WRITE_FAILED',
      500,
      error,
    );
  }
}
