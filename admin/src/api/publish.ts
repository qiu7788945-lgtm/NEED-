const apiBaseUrl = 'http://localhost:4000';

interface ApiResponse<TData> {
  ok: boolean;
  message: string;
  data?: TData;
  code?: string;
}

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

async function readJson<TData>(response: Response): Promise<TData> {
  const body = await response.json() as ApiResponse<TData>;

  if (!response.ok || !body.ok || !body.data) {
    throw new Error(body.message || '发布接口请求失败，请稍后再试。');
  }

  return body.data;
}

export async function getLatestPublishLog() {
  const data = await readJson<{ log: PublishLog | null }>(
    await fetch(`${apiBaseUrl}/api/publish/latest`),
  );

  return data.log;
}

export async function listPublishLogs() {
  const data = await readJson<{ logs: PublishLogSummary[] }>(
    await fetch(`${apiBaseUrl}/api/publish/logs`),
  );

  return data.logs;
}

export async function triggerPrerenderPublish() {
  return readJson<PublishTriggerResult>(
    await fetch(`${apiBaseUrl}/api/publish/prerender`, {
      method: 'POST',
    }),
  );
}
