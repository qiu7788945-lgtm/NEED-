import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { readContactInfoWithMysqlFallback } from '../services/data-source/low-risk-content-source.js';
import { asyncHandler } from '../utils/async-handler.js';
import { success } from '../utils/api-response.js';

type UnknownRecord = Record<string, unknown>;

interface ContactInfo {
  companyName: string;
  brandName: string;
  address: {
    label?: string;
    value: string;
    alt?: string;
  };
  email: {
    label?: string;
    value: string;
    enabled?: boolean;
  };
  phone: {
    label?: string;
    value?: string;
    enabled: boolean;
  };
  socials: ContactSocial[];
}

interface ContactSocial {
  id: string;
  label: string;
  displayName: string;
  value?: string;
  qrImageUrl: string;
  qrImageAlt: string;
  sortOrder: number;
  enabled: boolean;
}

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dataDir = path.join(serverRoot, 'data');
const contactInfoPath = path.join(dataDir, 'contact-info.json');

function createValidationError(message: string) {
  return Object.assign(new Error(message), {
    statusCode: 400,
    code: 'INVALID_CONTACT_INFO',
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

function optionalString(record: UnknownRecord, key: string) {
  const value = record[key];

  if (value === undefined) {
    return undefined;
  }

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

function requireRecord(record: UnknownRecord, key: string) {
  const value = record[key];

  if (!isRecord(value)) {
    throw createValidationError(`${key} must be an object`);
  }

  return value;
}

function normalizeContactSocial(value: unknown): ContactSocial {
  if (!isRecord(value)) {
    throw createValidationError('Each social must be an object');
  }

  return {
    id: requireString(value, 'id'),
    label: requireString(value, 'label'),
    displayName: requireString(value, 'displayName'),
    value: optionalString(value, 'value'),
    qrImageUrl: requireString(value, 'qrImageUrl'),
    qrImageAlt: requireString(value, 'qrImageAlt'),
    sortOrder: requireNumber(value, 'sortOrder'),
    enabled: requireBoolean(value, 'enabled'),
  };
}

function normalizeContactInfo(value: unknown): ContactInfo {
  if (!isRecord(value)) {
    throw createValidationError('Contact info must be an object');
  }

  const address = requireRecord(value, 'address');
  const email = requireRecord(value, 'email');
  const phone = requireRecord(value, 'phone');
  const socials = value.socials;

  if (!Array.isArray(socials)) {
    throw createValidationError('socials must be an array');
  }

  return {
    companyName: requireString(value, 'companyName'),
    brandName: requireString(value, 'brandName'),
    address: {
      label: optionalString(address, 'label'),
      value: requireString(address, 'value'),
      alt: optionalString(address, 'alt'),
    },
    email: {
      label: optionalString(email, 'label'),
      value: requireString(email, 'value'),
      enabled: typeof email.enabled === 'boolean' ? email.enabled : undefined,
    },
    phone: {
      label: optionalString(phone, 'label'),
      value: optionalString(phone, 'value'),
      enabled: requireBoolean(phone, 'enabled'),
    },
    socials: socials.map(normalizeContactSocial).sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

async function readContactInfoFromJson() {
  const raw = await fs.readFile(contactInfoPath, 'utf8');

  return normalizeContactInfo(JSON.parse(raw));
}

async function readContactInfo() {
  return readContactInfoWithMysqlFallback(readContactInfoFromJson, normalizeContactInfo);
}

async function writeContactInfo(value: unknown) {
  const contactInfo = normalizeContactInfo(value);

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(contactInfoPath, `${JSON.stringify(contactInfo, null, 2)}\n`, 'utf8');

  return contactInfo;
}

const contactInfoRouter = Router();

contactInfoRouter.get('/', asyncHandler(async (_req, res) => {
  const contactInfo = await readContactInfo();

  res.json(success(contactInfo));
}));

contactInfoRouter.put('/', asyncHandler(async (req, res) => {
  const contactInfo = await writeContactInfo(req.body);

  res.json(success(contactInfo));
}));

export { contactInfoRouter };
