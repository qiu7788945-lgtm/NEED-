import 'dotenv/config';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { closeDbPool, getDbPool, getSafeDatabaseConfig } from '../client.js';

type UnknownRecord = Record<string, unknown>;

type HomeVideoRow = RowDataPacket & {
  video_url: unknown;
  poster_url: unknown;
  title: unknown;
  description: unknown;
  is_enabled: unknown;
};

type ColumnCountRow = RowDataPacket & {
  column_count: unknown;
};

type RawJsonRow = RowDataPacket & {
  raw_json: unknown;
};

type RawJsonPresentRow = RowDataPacket & {
  raw_json_present: unknown;
};

type ScalarComparisonStatus = 'matched' | 'warning' | 'blocker' | 'missing_row' | 'mysql_unavailable';

type ScalarComparisonField = {
  fieldName: string;
  sourceField: string;
  mysqlField: string;
  sourceValue: unknown;
  mysqlValue: unknown;
  status: ScalarComparisonStatus;
  message: string;
};

type BackfillReport = {
  moduleName: 'home-video';
  stage: 'raw_json-backfill';
  dryRun: boolean;
  writeModeRequested: boolean;
  writeModeEnabled: boolean;
  wroteMysql: boolean;
  wroteServerData: false;
  sourceJsonPath: string;
  targetTable: 'home_video';
  targetColumn: 'raw_json';
  singletonKey: 'home_video';
  jsonShapeKeys: string[];
  sourceUpdatedAt: string;
  sourceVideoUrl: string;
  sourcePosterUrl: string;
  existingRowFound: boolean;
  mysqlConfigured: boolean;
  mysqlAvailable: boolean;
  mysqlMissing: string[];
  rawJsonColumnExists: boolean;
  scalarComparison: {
    status: ScalarComparisonStatus;
    fields: ScalarComparisonField[];
  };
  plannedRawJson: UnknownRecord | null;
  beforeRawJsonPresent: boolean;
  afterRawJsonPresent: boolean;
  warnings: string[];
  blockers: string[];
  createdAt: string;
  gitHead: string;
  command: string;
  outputDir: string;
  reportPath: string;
  nextSteps: string[];
};

const execFileAsync = promisify(execFile);

const requiredShapeKeys = [
  'videoUrl',
  'videoFileName',
  'videoDisplayName',
  'posterUrl',
  'posterFileName',
  'posterDisplayName',
  'title',
  'description',
  'enabled',
  'updatedAt',
] as const;

function printUsage(): void {
  console.log(`Usage:
  npm.cmd run backfill:home-video-raw-json
  npm.cmd run backfill:home-video-raw-json:dry-run
  npm.cmd run backfill:home-video-raw-json -- --write
  npm.cmd run backfill:home-video-raw-json:dry-run -- --dry-run

Options:
  --dry-run      Default mode. Generates a report only.
  --write        Restricted mode. Only updates home_video.raw_json for singleton_key='home_video'.
  --help, -h     Show this help.`);
}

function parseCliArgs(args: string[]) {
  let writeRequested = false;

  for (const arg of args) {
    if (arg === '--dry-run') {
      continue;
    }

    if (arg === '--write') {
      writeRequested = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { writeRequested };
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asMysqlBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'enabled', 'published'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'disabled', 'draft', 'archived'].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function formatTimestampForPath(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

async function readGitHead(projectRoot: string): Promise<string> {
  try {
    const result = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], { cwd: projectRoot });
    return result.stdout.trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

async function readHomeVideoJson(sourceJsonPath: string, blockers: string[]): Promise<UnknownRecord | null> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(await fs.readFile(sourceJsonPath, 'utf8'));
  } catch (error) {
    blockers.push(`Unable to read or parse home-video JSON: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }

  if (!isRecord(parsed)) {
    blockers.push('server/data/home-video.json must contain a top-level object.');
    return null;
  }

  return parsed;
}

function validateShape(record: UnknownRecord | null, warnings: string[], blockers: string[]): void {
  if (!record) {
    return;
  }

  for (const key of requiredShapeKeys) {
    if (!(key in record)) {
      blockers.push(`home-video JSON is missing required shape key: ${key}.`);
      continue;
    }

    if (key === 'enabled') {
      if (typeof record[key] !== 'boolean') {
        blockers.push('home-video JSON key enabled must be boolean.');
      }
      continue;
    }

    if (typeof record[key] !== 'string') {
      blockers.push(`home-video JSON key ${key} must be a string.`);
    }
  }

  if ('subtitle' in record) {
    warnings.push('home-video JSON currently contains subtitle; the dry-run preserves it but does not introduce it.');
  }
}

function hasCompleteRequiredShape(record: UnknownRecord | null): boolean {
  if (!record) {
    return false;
  }

  return requiredShapeKeys.every((key) => {
    if (!(key in record)) {
      return false;
    }

    if (key === 'enabled') {
      return typeof record[key] === 'boolean';
    }

    return typeof record[key] === 'string';
  });
}

function createUnavailableScalarComparison(status: 'mysql_unavailable' | 'missing_row'): BackfillReport['scalarComparison'] {
  return {
    status,
    fields: [
      ['videoUrl', 'videoUrl', 'video_url'],
      ['posterUrl', 'posterUrl', 'poster_url'],
      ['title', 'title', 'title'],
      ['description', 'description', 'description'],
      ['enabled', 'enabled', 'is_enabled'],
    ].map(([fieldName, sourceField, mysqlField]) => ({
      fieldName,
      sourceField,
      mysqlField,
      sourceValue: null,
      mysqlValue: null,
      status,
      message: status === 'mysql_unavailable'
        ? 'MySQL was unavailable; scalar comparison was skipped.'
        : 'No active home_video singleton row was found; scalar comparison was skipped.',
    })),
  };
}

function compareScalarFields(source: UnknownRecord, row: HomeVideoRow): BackfillReport['scalarComparison'] {
  const comparisons: ScalarComparisonField[] = [
    compareStringField({
      fieldName: 'videoUrl',
      sourceField: 'videoUrl',
      mysqlField: 'video_url',
      sourceValue: source.videoUrl,
      mysqlValue: row.video_url,
      mismatchStatus: 'blocker',
    }),
    compareStringField({
      fieldName: 'posterUrl',
      sourceField: 'posterUrl',
      mysqlField: 'poster_url',
      sourceValue: source.posterUrl,
      mysqlValue: row.poster_url,
      mismatchStatus: 'warning',
    }),
    compareStringField({
      fieldName: 'title',
      sourceField: 'title',
      mysqlField: 'title',
      sourceValue: source.title,
      mysqlValue: row.title,
      mismatchStatus: 'warning',
    }),
    compareStringField({
      fieldName: 'description',
      sourceField: 'description',
      mysqlField: 'description',
      sourceValue: source.description,
      mysqlValue: row.description,
      mismatchStatus: 'warning',
    }),
    compareEnabledField(source.enabled, row.is_enabled),
  ];

  const status = comparisons.some((item) => item.status === 'blocker')
    ? 'blocker'
    : comparisons.some((item) => item.status === 'warning')
      ? 'warning'
      : 'matched';

  return { status, fields: comparisons };
}

function compareStringField(input: {
  fieldName: string;
  sourceField: string;
  mysqlField: string;
  sourceValue: unknown;
  mysqlValue: unknown;
  mismatchStatus: 'warning' | 'blocker';
}): ScalarComparisonField {
  const sourceValue = asString(input.sourceValue);
  const mysqlValue = asString(input.mysqlValue);
  const matched = sourceValue === mysqlValue;

  return {
    fieldName: input.fieldName,
    sourceField: input.sourceField,
    mysqlField: input.mysqlField,
    sourceValue,
    mysqlValue,
    status: matched ? 'matched' : input.mismatchStatus,
    message: matched
      ? `${input.sourceField} matches home_video.${input.mysqlField}.`
      : `${input.sourceField} differs from home_video.${input.mysqlField}.`,
  };
}

function compareEnabledField(sourceValue: unknown, mysqlValue: unknown): ScalarComparisonField {
  const sourceEnabled = typeof sourceValue === 'boolean' ? sourceValue : null;
  const mysqlEnabled = asMysqlBoolean(mysqlValue);
  const matched = sourceEnabled !== null && mysqlEnabled !== null && sourceEnabled === mysqlEnabled;

  return {
    fieldName: 'enabled',
    sourceField: 'enabled',
    mysqlField: 'is_enabled',
    sourceValue: sourceEnabled,
    mysqlValue: mysqlEnabled,
    status: matched ? 'matched' : 'blocker',
    message: matched
      ? 'enabled matches home_video.is_enabled.'
      : 'enabled differs from home_video.is_enabled or cannot be compared.',
  };
}

async function readMysqlSnapshot(source: UnknownRecord | null, warnings: string[], blockers: string[]) {
  let mysqlConfigured = false;
  let mysqlAvailable = false;
  let mysqlMissing: string[] = [];
  let existingRowFound = false;
  let beforeRawJsonPresent = false;
  let rawJsonColumnExists = false;
  let scalarComparison = createUnavailableScalarComparison('mysql_unavailable');

  let safeConfig: ReturnType<typeof getSafeDatabaseConfig>;
  try {
    safeConfig = getSafeDatabaseConfig();
  } catch (error) {
    warnings.push(`MySQL config is invalid; JSON-only dry-run report was generated. ${error instanceof Error ? error.message : String(error)}`);
    return {
      mysqlConfigured,
      mysqlAvailable,
      mysqlMissing,
      existingRowFound,
      beforeRawJsonPresent,
      rawJsonColumnExists,
      scalarComparison,
    };
  }

  mysqlConfigured = safeConfig.configured;
  mysqlMissing = safeConfig.missing;

  if (!safeConfig.configured) {
    warnings.push(`MySQL is not configured; JSON-only dry-run report was generated. Missing: ${safeConfig.missing.join(', ')}`);
    return {
      mysqlConfigured,
      mysqlAvailable,
      mysqlMissing,
      existingRowFound,
      beforeRawJsonPresent,
      rawJsonColumnExists,
      scalarComparison,
    };
  }

  try {
    const pool = getDbPool();
    await pool.query('SELECT 1');
    mysqlAvailable = true;

    const [rows] = await pool.query<HomeVideoRow[]>(
      `SELECT video_url, poster_url, title, description, is_enabled
       FROM home_video
       WHERE singleton_key = ? AND deleted_at IS NULL
       ORDER BY id ASC
       LIMIT 1`,
      ['home_video'],
    );
    const row = rows[0];

    if (!row) {
      warnings.push('No active home_video singleton row was found; raw_json backfill would need a row before write mode can proceed.');
      scalarComparison = createUnavailableScalarComparison('missing_row');
      return {
        mysqlConfigured,
        mysqlAvailable,
        mysqlMissing,
        existingRowFound,
        beforeRawJsonPresent,
        rawJsonColumnExists,
        scalarComparison,
      };
    }

    existingRowFound = true;
    scalarComparison = source ? compareScalarFields(source, row) : createUnavailableScalarComparison('missing_row');
    for (const field of scalarComparison.fields) {
      if (field.status === 'warning') {
        warnings.push(field.message);
      }
      if (field.status === 'blocker') {
        blockers.push(field.message);
      }
    }

    const [columnRows] = await pool.query<ColumnCountRow[]>(
      `SELECT COUNT(*) AS column_count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'home_video'
         AND COLUMN_NAME = 'raw_json'`,
    );
    rawJsonColumnExists = Number(columnRows[0]?.column_count ?? 0) > 0;

    if (rawJsonColumnExists) {
      const [rawRows] = await pool.query<RawJsonRow[]>(
        `SELECT raw_json
         FROM home_video
         WHERE singleton_key = ? AND deleted_at IS NULL
         ORDER BY id ASC
         LIMIT 1`,
        ['home_video'],
      );
      const rawJsonValue = rawRows[0]?.raw_json;
      beforeRawJsonPresent = rawJsonValue !== null && rawJsonValue !== undefined && String(rawJsonValue).trim() !== '';
    }
  } catch (error) {
    mysqlAvailable = false;
    warnings.push(`MySQL read failed; JSON-only dry-run report was generated. ${error instanceof Error ? error.message : String(error)}`);
    scalarComparison = createUnavailableScalarComparison('mysql_unavailable');
  }

  return {
    mysqlConfigured,
    mysqlAvailable,
    mysqlMissing,
    existingRowFound,
    beforeRawJsonPresent,
    rawJsonColumnExists,
    scalarComparison,
  };
}

function addWritePreconditionBlockers(input: {
  blockers: string[];
  warnings: string[];
  mysqlSnapshot: Awaited<ReturnType<typeof readMysqlSnapshot>>;
  plannedRawJson: UnknownRecord | null;
}): void {
  if (!input.mysqlSnapshot.mysqlConfigured) {
    input.blockers.push('Write blocked: MySQL must be configured.');
  }
  if (!input.mysqlSnapshot.mysqlAvailable) {
    input.blockers.push('Write blocked: MySQL must be available.');
  }
  if (!input.mysqlSnapshot.existingRowFound) {
    input.blockers.push('Write blocked: active home_video singleton row was not found.');
  }
  if (!input.mysqlSnapshot.rawJsonColumnExists) {
    input.blockers.push('Write blocked: home_video.raw_json column does not exist.');
  }
  if (input.mysqlSnapshot.beforeRawJsonPresent) {
    input.blockers.push('Write blocked: home_video.raw_json already has a value; this script will not overwrite it.');
  }
  if (input.mysqlSnapshot.scalarComparison.status !== 'matched') {
    input.blockers.push(`Write blocked: scalarComparison.status is ${input.mysqlSnapshot.scalarComparison.status}.`);
  }
  if (!hasCompleteRequiredShape(input.plannedRawJson)) {
    input.blockers.push('Write blocked: plannedRawJson is incomplete.');
  }
  if (input.warnings.length > 0) {
    input.blockers.push('Write blocked: warnings must be resolved before write mode.');
  }
}

async function readRawJsonPresent(): Promise<boolean> {
  const pool = getDbPool();
  const [rows] = await pool.query<RawJsonPresentRow[]>(
    `SELECT raw_json IS NOT NULL AS raw_json_present
     FROM home_video
     WHERE singleton_key = ? AND deleted_at IS NULL
     ORDER BY id ASC
     LIMIT 1`,
    ['home_video'],
  );

  return asMysqlBoolean(rows[0]?.raw_json_present) === true;
}

async function writeHomeVideoRawJson(plannedRawJson: UnknownRecord): Promise<void> {
  const pool = getDbPool();
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE home_video
     SET raw_json = ?
     WHERE singleton_key = ?
       AND deleted_at IS NULL`,
    [JSON.stringify(plannedRawJson), 'home_video'],
  );

  if (result.affectedRows !== 1) {
    throw new Error(`Expected to update exactly 1 home_video.raw_json row, but affected ${result.affectedRows}.`);
  }
}

async function writeReport(report: BackfillReport): Promise<void> {
  await fs.mkdir(report.outputDir, { recursive: true });
  await fs.writeFile(report.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const args = parseCliArgs(process.argv.slice(2));
  const createdAt = new Date().toISOString();
  const outputDir = path.join(
    projectRoot,
    'server',
    'data-exports',
    'home-video-raw-json-backfill',
    formatTimestampForPath(),
  );
  const reportPath = path.join(outputDir, 'home-video-raw-json-backfill-report.json');
  const sourceJsonPath = path.join(projectRoot, 'server', 'data', 'home-video.json');
  const warnings: string[] = [];
  const blockers: string[] = [];

  const source = await readHomeVideoJson(sourceJsonPath, blockers);
  validateShape(source, warnings, blockers);

  const mysqlSnapshot = await readMysqlSnapshot(source, warnings, blockers);
  const gitHead = await readGitHead(projectRoot);
  const plannedRawJson = source ? { ...source } : null;
  let writeModeEnabled = false;
  let wroteMysql = false;
  let afterRawJsonPresent = mysqlSnapshot.beforeRawJsonPresent;

  if (args.writeRequested) {
    const preWriteBlockerCount = blockers.length;
    addWritePreconditionBlockers({
      blockers,
      warnings,
      mysqlSnapshot,
      plannedRawJson,
    });

    if (preWriteBlockerCount === 0 && blockers.length === 0 && plannedRawJson) {
      writeModeEnabled = true;
      try {
        await writeHomeVideoRawJson(plannedRawJson);
        wroteMysql = true;
        try {
          afterRawJsonPresent = await readRawJsonPresent();
        } catch (error) {
          blockers.push(`Write verification failed: ${error instanceof Error ? error.message : String(error)}`);
        }

        if (!afterRawJsonPresent) {
          blockers.push('Write failed verification: home_video.raw_json is still empty after write.');
        }
      } catch (error) {
        if (!wroteMysql) {
          writeModeEnabled = false;
        }
        afterRawJsonPresent = await readRawJsonPresent().catch(() => mysqlSnapshot.beforeRawJsonPresent);
        blockers.push(`Write failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  const report: BackfillReport = {
    moduleName: 'home-video',
    stage: 'raw_json-backfill',
    dryRun: !args.writeRequested,
    writeModeRequested: args.writeRequested,
    writeModeEnabled,
    wroteMysql,
    wroteServerData: false,
    sourceJsonPath: path.relative(projectRoot, sourceJsonPath).replace(/\\/g, '/'),
    targetTable: 'home_video',
    targetColumn: 'raw_json',
    singletonKey: 'home_video',
    jsonShapeKeys: plannedRawJson ? Object.keys(plannedRawJson) : [],
    sourceUpdatedAt: asString(plannedRawJson?.updatedAt),
    sourceVideoUrl: asString(plannedRawJson?.videoUrl),
    sourcePosterUrl: asString(plannedRawJson?.posterUrl),
    existingRowFound: mysqlSnapshot.existingRowFound,
    mysqlConfigured: mysqlSnapshot.mysqlConfigured,
    mysqlAvailable: mysqlSnapshot.mysqlAvailable,
    mysqlMissing: mysqlSnapshot.mysqlMissing,
    rawJsonColumnExists: mysqlSnapshot.rawJsonColumnExists,
    scalarComparison: mysqlSnapshot.scalarComparison,
    plannedRawJson,
    beforeRawJsonPresent: mysqlSnapshot.beforeRawJsonPresent,
    afterRawJsonPresent,
    warnings,
    blockers,
    createdAt,
    gitHead,
    command: process.argv.join(' '),
    outputDir: path.relative(projectRoot, outputDir).replace(/\\/g, '/'),
    reportPath: path.relative(projectRoot, reportPath).replace(/\\/g, '/'),
    nextSteps: args.writeRequested
      ? [
          'Review this write report.',
          'Run read-only MySQL verification for home_video.raw_json.',
          'Keep exporter raw_json priority adjustment as the next separate step.',
          'Keep home-video primary write in a later step.',
        ]
      : [
          'Review this dry-run report.',
          'Use --write only after boundary confirmation.',
          'Keep exporter raw_json priority adjustment and home-video primary write in later steps.',
        ],
  };

  await writeReport(report);

  console.log(JSON.stringify({
    mode: args.writeRequested ? 'home-video-raw-json-backfill-write' : 'home-video-raw-json-backfill-dry-run',
    status: report.blockers.length > 0 ? 'blocked' : 'completed',
    dryRun: report.dryRun,
    writeModeRequested: report.writeModeRequested,
    writeModeEnabled: report.writeModeEnabled,
    wroteMysql: report.wroteMysql,
    wroteServerData: report.wroteServerData,
    mysqlConfigured: report.mysqlConfigured,
    mysqlAvailable: report.mysqlAvailable,
    existingRowFound: report.existingRowFound,
    reportPath: report.reportPath,
    warningCount: report.warnings.length,
    blockerCount: report.blockers.length,
  }, null, 2));

  if (report.blockers.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      mode: 'home-video-raw-json-backfill-dry-run',
      status: 'failed',
      wroteMysql: false,
      wroteServerData: false,
      error: error instanceof Error ? error.message : 'Home-video raw_json dry-run failed.',
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbPool();
  });
