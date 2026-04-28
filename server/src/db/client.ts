import { env } from '../config/env.js';

export type DatabaseConfig = {
  host?: string;
  port: number;
  user?: string;
  password?: string;
  name?: string;
};

export const db = {
  isConnected: false,
  provider: 'placeholder',
};

export function getDbClient() {
  return db;
}

export function getDatabaseConfig(): DatabaseConfig {
  return {
    host: env.database.host,
    port: env.database.port,
    user: env.database.user,
    password: env.database.password,
    name: env.database.name,
  };
}

export function getSafeDatabaseConfig() {
  const config = getDatabaseConfig();

  return {
    host: config.host,
    port: config.port,
    user: config.user,
    name: config.name,
    passwordConfigured: Boolean(config.password),
  };
}
