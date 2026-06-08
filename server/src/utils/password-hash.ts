import * as bcrypt from 'bcrypt';

export const DEFAULT_PASSWORD_HASH_COST = 12;
const MIN_PASSWORD_HASH_COST = 10;
const MAX_PASSWORD_HASH_COST = 15;

export function getPasswordHashCost(): number {
  const rawCost = process.env.ADMIN_PASSWORD_BCRYPT_COST?.trim();

  if (!rawCost) {
    return DEFAULT_PASSWORD_HASH_COST;
  }

  const cost = Number(rawCost);

  if (!Number.isInteger(cost) || cost < MIN_PASSWORD_HASH_COST || cost > MAX_PASSWORD_HASH_COST) {
    throw new Error(
      `ADMIN_PASSWORD_BCRYPT_COST must be an integer between ${MIN_PASSWORD_HASH_COST} and ${MAX_PASSWORD_HASH_COST}.`,
    );
  }

  return cost;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, getPasswordHashCost());
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
