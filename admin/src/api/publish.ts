import { getJson, postJson } from './client';

const errorOptions = {
  fallbackMessage: '发布接口请求失败，请稍后再试。',
};

export interface PublishLogSummary {
  publishId: string;
  fileName: string;
  startedAt: string;
  finishedAt: string;
  status: string;
  totalRoutes: number;
  generatedCount: number;
  failedCount: number;
  skippedCount: number;
  triggeredBy: string;
  sourceStats?: PublishSourceStats;
  error?: string;
}

export interface PublishSourceStat {
  discovered: number;
  generated: number;
  skipped: number;
  failed?: number;
}

export type PublishSourceStats = Record<string, PublishSourceStat>;

export interface PublishSkippedRoute {
  path?: string;
  sourceType: string;
  sourceId?: string;
  slug?: string;
  skipReason: string;
  errors?: string[];
}

export interface PublishFailedRoute {
  path: string;
  sourceType?: string;
  sourceId?: string;
  errors?: string[];
  error?: string;
}

export interface PublishLog {
  publishId: string;
  startedAt: string;
  finishedAt: string;
  status: string;
  triggeredBy: string;
  totalRoutes: number;
  generatedRoutes?: unknown[];
  failedRoutes?: PublishFailedRoute[];
  skippedRoutes?: PublishSkippedRoute[];
  sourceStats?: PublishSourceStats;
  sitemapPath?: string;
  robotsPath?: string;
  manifestPath?: string;
  errors?: unknown[];
  manifestSnapshot?: unknown;
  [key: string]: unknown;
}

export interface PublishTriggerResult {
  status: string;
  exitCode: number | null;
  stdoutTail: string;
  stderrTail: string;
  latestLog: PublishLog | null;
}

export async function getLatestPublishLog() {
  const data = await getJson<{ log: PublishLog | null }>('/api/publish/latest', errorOptions);

  return data.log;
}

export async function listPublishLogs() {
  const data = await getJson<{ logs: PublishLogSummary[] }>('/api/publish/logs', errorOptions);

  return data.logs;
}

export async function triggerPrerenderPublish() {
  return postJson<PublishTriggerResult>('/api/publish/prerender', undefined, errorOptions);
}
