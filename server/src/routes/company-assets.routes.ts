import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { success } from '../utils/api-response.js';

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

function createValidationError(message: string) {
  return Object.assign(new Error(message), {
    statusCode: 400,
    code: 'INVALID_COMPANY_ASSETS',
  });
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: UnknownRecord, key: string) {
  const value = record[key];

  if (typeof value !== 'string') {
    throw createValidationError(`${key} must be a string`);
  }

  return value;
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

  return {
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
}

function normalizeCompanyAssets(value: unknown): CompanyAsset[] {
  if (!Array.isArray(value)) {
    throw createValidationError('Company assets must be an array');
  }

  return value.map(normalizeCompanyAsset).sort((a, b) => a.sortOrder - b.sortOrder);
}

async function readCompanyAssets() {
  const raw = await fs.readFile(companyAssetsPath, 'utf8');

  return normalizeCompanyAssets(JSON.parse(raw));
}

async function writeCompanyAssets(value: unknown) {
  const companyAssets = normalizeCompanyAssets(value);

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(companyAssetsPath, `${JSON.stringify(companyAssets, null, 2)}\n`, 'utf8');

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
