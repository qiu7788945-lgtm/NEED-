import type { RowDataPacket } from 'mysql2/promise';
import { getDbPool } from '../client.js';
import type { MigrationModuleName } from '../migration/types.js';
import type { MysqlTargetSnapshot } from './types.js';

type CountRow = RowDataPacket & {
  count: number;
};

type KeyRow = RowDataPacket & {
  stable_key: string | null;
};

type ModuleTargetConfig = {
  tableName: string;
  countSql: string;
  stableKeySql?: string;
  extraCountSql?: Record<string, string>;
  sharedTableWarning?: string;
};

const moduleTargetConfigs: Record<MigrationModuleName, ModuleTargetConfig> = {
  pages: {
    tableName: 'pages',
    countSql: 'SELECT COUNT(*) AS count FROM pages',
    stableKeySql: `SELECT CONCAT('slug:', slug) AS stable_key FROM pages WHERE slug IS NOT NULL AND slug <> ''
      UNION
      SELECT CONCAT('source_id:', source_id) AS stable_key FROM pages WHERE source_id IS NOT NULL AND source_id <> ''`,
  },
  'contact-info': {
    tableName: 'contact_info',
    countSql: 'SELECT COUNT(*) AS count FROM contact_info',
    stableKeySql: `SELECT CONCAT('singleton:', singleton_key) AS stable_key FROM contact_info WHERE singleton_key IS NOT NULL`,
  },
  'company-assets': {
    tableName: 'company_assets',
    countSql: 'SELECT COUNT(*) AS count FROM company_assets',
    stableKeySql: `SELECT CONCAT('asset_key:', asset_key) AS stable_key FROM company_assets WHERE asset_key IS NOT NULL AND asset_key <> ''`,
  },
  'home-video': {
    tableName: 'home_video',
    countSql: 'SELECT COUNT(*) AS count FROM home_video',
    stableKeySql: `SELECT CONCAT('singleton:', singleton_key) AS stable_key FROM home_video WHERE singleton_key IS NOT NULL`,
  },
  'home-interactive-images': {
    tableName: 'home_interactive_images',
    countSql: 'SELECT COUNT(*) AS count FROM home_interactive_images',
    stableKeySql: `SELECT CONCAT('slot:', slot_number) AS stable_key FROM home_interactive_images`,
  },
  articles: {
    tableName: 'articles',
    countSql: 'SELECT COUNT(*) AS count FROM articles',
    stableKeySql: `SELECT CONCAT('slug:', slug) AS stable_key FROM articles WHERE slug IS NOT NULL AND slug <> ''
      UNION
      SELECT CONCAT('source_id:', source_id) AS stable_key FROM articles WHERE source_id IS NOT NULL AND source_id <> ''`,
  },
  'media-library': {
    tableName: 'media_files',
    countSql: 'SELECT COUNT(*) AS count FROM media_files',
    stableKeySql: `SELECT CONCAT('public_url:', public_url) AS stable_key FROM media_files WHERE public_url IS NOT NULL AND public_url <> ''
      UNION
      SELECT CONCAT('file_path:', file_path) AS stable_key FROM media_files WHERE file_path IS NOT NULL AND file_path <> ''`,
    sharedTableWarning: 'media_files is shared by media-library, cases, solutions, and opened page modules; count equality is informational in 22-4A.',
  },
  cases: {
    tableName: 'cases',
    countSql: 'SELECT COUNT(*) AS count FROM cases',
    stableKeySql: `SELECT CONCAT('slug:', slug) AS stable_key FROM cases WHERE slug IS NOT NULL AND slug <> ''
      UNION
      SELECT CONCAT('source_id:', source_id) AS stable_key FROM cases WHERE source_id IS NOT NULL AND source_id <> ''`,
    extraCountSql: {
      case_images: 'SELECT COUNT(*) AS count FROM case_images',
    },
  },
  solutions: {
    tableName: 'solutions',
    countSql: 'SELECT COUNT(*) AS count FROM solutions',
    stableKeySql: `SELECT CONCAT('slug:', slug) AS stable_key FROM solutions WHERE slug IS NOT NULL AND slug <> ''
      UNION
      SELECT CONCAT('source_id:', source_id) AS stable_key FROM solutions WHERE source_id IS NOT NULL AND source_id <> ''`,
    extraCountSql: {
      solution_groups: 'SELECT COUNT(*) AS count FROM solution_groups',
      solution_media_items: 'SELECT COUNT(*) AS count FROM solution_media_items',
    },
  },
  'scenario-detail-pages': {
    tableName: 'solution_pages',
    countSql: 'SELECT COUNT(*) AS count FROM solution_pages',
    stableKeySql: `SELECT CONCAT('source_id:', source_id) AS stable_key FROM solution_pages WHERE source_id IS NOT NULL AND source_id <> ''
      UNION
      SELECT CONCAT('route_path:', route_path) AS stable_key FROM solution_pages WHERE route_path IS NOT NULL AND route_path <> ''
      UNION
      SELECT CONCAT('slug:', slug) AS stable_key FROM solution_pages WHERE slug IS NOT NULL AND slug <> ''`,
    extraCountSql: {
      solution_page_blocks: 'SELECT COUNT(*) AS count FROM solution_page_blocks',
    },
  },
  'publish-logs': {
    tableName: 'publish_logs',
    countSql: 'SELECT COUNT(*) AS count FROM publish_logs',
    stableKeySql: `SELECT CONCAT('publish_version:', publish_version) AS stable_key FROM publish_logs WHERE publish_version IS NOT NULL AND publish_version <> ''`,
  },
};

async function readCount(sql: string): Promise<number> {
  const pool = getDbPool();
  const [rows] = await pool.execute<CountRow[]>(sql);
  return Number(rows[0]?.count ?? 0);
}

async function readStableKeys(sql: string | undefined): Promise<string[]> {
  if (!sql) {
    return [];
  }

  const pool = getDbPool();
  const [rows] = await pool.execute<KeyRow[]>(sql);

  return Array.from(new Set(
    rows
      .map((row) => row.stable_key)
      .filter((key): key is string => Boolean(key)),
  )).sort();
}

export async function readMysqlTarget(moduleName: MigrationModuleName): Promise<MysqlTargetSnapshot> {
  const config = moduleTargetConfigs[moduleName];
  const extraCounts: Record<string, number> = {};

  for (const [key, sql] of Object.entries(config.extraCountSql ?? {})) {
    extraCounts[key] = await readCount(sql);
  }

  return {
    moduleName,
    tableName: config.tableName,
    rowCount: await readCount(config.countSql),
    stableKeys: await readStableKeys(config.stableKeySql),
    extraCounts,
    warnings: config.sharedTableWarning
      ? [
          {
            code: 'compare_shared_mysql_table',
            level: 'info',
            message: config.sharedTableWarning,
          },
        ]
      : [],
  };
}

export function isCountEqualityInformational(moduleName: MigrationModuleName): boolean {
  return moduleName === 'media-library';
}
