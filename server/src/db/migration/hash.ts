import { createHash } from 'node:crypto';

export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(',')}]`;
  }

  const objectValue = value as Record<string, unknown>;
  const keys = Object.keys(objectValue).sort((a, b) => a.localeCompare(b));
  const entries = keys.map((key) => `${JSON.stringify(key)}:${canonicalStringify(objectValue[key])}`);

  return `{${entries.join(',')}}`;
}

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function hashJsonValue(value: unknown): string {
  return sha256(canonicalStringify(value));
}
