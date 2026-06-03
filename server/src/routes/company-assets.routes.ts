import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { writeCompanyAssetsToMysqlPrimary } from '../services/data-source/company-assets-primary-write.js';
import { readCompanyAssetsWithMysqlFallback } from '../services/data-source/low-risk-content-source.js';
import { asyncHandler } from '../utils/async-handler.js';
import { success } from '../utils/api-response.js';
import { logger } from '../utils/logger.js';

type UnknownRecord = Record<string, unknown>;

interface CompanyAsset {
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

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dataDir = path.join(serverRoot, 'data');
const companyAssetsPath = path.join(dataDir, 'company-assets.json');
const MODULE_NAME = 'company-assets';

function createValidationError(message: string) {
  return Object.assign(new Error(message), {
    statusCode: 400,
    code: 'INVALID_COMPANY_ASSETS',
  });
}

function createJsonShadowWriteError(error: unknown) {
  return Object.assign(
    new Error('Company-assets MySQL primary write succeeded, but JSON shadow write-back failed.'),
    {
      statusCode: 500,
      code: 'COMPANY_ASSETS_JSON_SHADOW_WRITE_FAILED',
      cause: error,
    },
  );
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: UnknownRecord, key: string) {
  const value = record[key];

  if (typeof value !== 'string') {
    throw createValidationError(`${key} must be a string`);
  }

  return value.trim();
}

function requireBoolean(record: UnknownRecord, key: string) {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw createValidationError(`${key} must be a boolean`);
  }

  return value;
}

function requireNumber(record: UnknownRecord, key: string) {
  const value = record[key];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw createValidationError(`${key} must be a number`);
  }

  return value;
}

function normalizeCompanyAsset(value: unknown): CompanyAsset {
  if (!isRecord(value)) {
    throw createValidationError('Each company asset must be an object');
  }

  const asset = {
    id: requireString(value, 'id'),
    title: requireString(value, 'title'),
    summary: requireString(value, 'summary'),
    description: requireString(value, 'description'),
    location: requireString(value, 'location'),
    imageUrl: requireString(value, 'imageUrl'),
    imageAlt: requireString(value, 'imageAlt'),
    sortOrder: requireNumber(value, 'sortOrder'),
    enabled: requireBoolean(value, 'enabled'),
  };

  if (!asset.id) {
    throw createValidationError('id must be a non-empty string');
  }

  if (asset.enabled && (!asset.title || !asset.imageUrl || !asset.imageAlt)) {
    throw createValidationError('enabled company assets must have title, imageUrl, and imageAlt');
  }

  return asset;
}

function normalizeCompanyAssets(value: unknown): CompanyAsset[] {
  if (!Array.isArray(value)) {
    throw createValidationError('Company assets must be an array');
  }

  const ids = new Set<string>();
  const assets = value.map((asset, index) => ({
    asset: normalizeCompanyAsset(asset),
    index,
  }));

  for (const { asset } of assets) {
    if (ids.has(asset.id)) {
      throw createValidationError('id must be unique');
    }

    ids.add(asset.id);
  }

  return assets
    .sort((a, b) => a.asset.sortOrder - b.asset.sortOrder || a.index - b.index)
    .map(({ asset }) => asset);
}

async function readCompanyAssetsFromJson() {
  const raw = await fs.readFile(companyAssetsPath, 'utf8');

  return normalizeCompanyAssets(JSON.parse(raw));
}

async function readCompanyAssets() {
  return readCompanyAssetsWithMysqlFallback(readCompanyAssetsFromJson, normalizeCompanyAssets);
}

async function writeCompanyAssetsJson(companyAssets: CompanyAsset[]) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(companyAssetsPath, `${JSON.stringify(companyAssets, null, 2)}\n`, 'utf8');
}

async function writeCompanyAssets(value: unknown) {
  const companyAssets = normalizeCompanyAssets(value);

  await writeCompanyAssetsToMysqlPrimary(companyAssets);

  try {
    await writeCompanyAssetsJson(companyAssets);
  } catch (error) {
    logger.error('Company-assets JSON shadow write-back failed after MySQL primary write succeeded.', {
      moduleName: MODULE_NAME,
      operation: 'json-shadow-write-back',
      jsonPath: companyAssetsPath,
      message: error instanceof Error ? error.message : String(error),
    });

    throw createJsonShadowWriteError(error);
  }

  return companyAssets;
}

const companyAssetsRouter = Router();

companyAssetsRouter.get('/', asyncHandler(async (_req, res) => {
  const companyAssets = await readCompanyAssets();

  res.json(success(companyAssets));
}));

companyAssetsRouter.put('/', asyncHandler(async (req, res) => {
  const companyAssets = await writeCompanyAssets(req.body);

  res.json(success(companyAssets));
}));

export { companyAssetsRouter };
