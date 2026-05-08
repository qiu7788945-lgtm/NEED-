import { useEffect, useMemo, useState } from 'react';
import {
  getLatestPublishLog,
  listPublishLogs,
  triggerPrerenderPublish,
  type PublishFailedRoute,
  type PublishLog,
  type PublishLogSummary,
  type PublishSkippedRoute,
  type PublishSourceStats,
} from '../api/publish';

const sourceTypeLabels: Record<string, string> = {
  fixed: '固定页面',
  article: '文章',
  case: '案例解析',
  solution: '场景解决方案',
  page: '页面编辑器',
  home: '首页管理',
  media: '媒体库',
  scenario: '场景详情',
};

const sourceTypeOrder = ['fixed', 'article', 'case', 'solution', 'page', 'home', 'media', 'scenario'];

function formatDateTime(value?: string) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function countItems(value: unknown[] | undefined, fallback = 0) {
  return Array.isArray(value) ? value.length : fallback;
}

function getGeneratedCount(log: PublishLog | null) {
  return countItems(log?.generatedRoutes);
}

function getFailedCount(log: PublishLog | null) {
  return countItems(log?.failedRoutes);
}

function getSkippedCount(log: PublishLog | null) {
  return countItems(log?.skippedRoutes);
}

function truncateOutput(value: string, maxLength = 1200) {
  if (value.length <= maxLength) {
    return value;
  }

  return `...${value.slice(-maxLength)}`;
}

function formatPublishError(result: { stderrTail?: string; stdoutTail?: string }) {
  return truncateOutput(result.stderrTail || result.stdoutTail || '发布失败，但没有返回更多错误信息。');
}

function getSourceTypeLabel(sourceType: string) {
  return sourceTypeLabels[sourceType] || sourceType;
}

function getSourceStatsEntries(sourceStats?: PublishSourceStats) {
  if (!sourceStats) {
    return [];
  }

  return Object.entries(sourceStats).sort(([left], [right]) => {
    const leftIndex = sourceTypeOrder.indexOf(left);
    const rightIndex = sourceTypeOrder.indexOf(right);
    const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

    return normalizedLeft - normalizedRight || left.localeCompare(right);
  });
}

function summarizeSourceStats(sourceStats?: PublishSourceStats) {
  const entries = getSourceStatsEntries(sourceStats);

  if (!entries.length) {
    return '无模块统计';
  }

  return entries
    .map(([sourceType, stat]) => `${getSourceTypeLabel(sourceType)} ${stat.generated}/${stat.discovered}`)
    .join(' / ');
}

function formatErrorSummary(errors?: string[], fallback?: string) {
  const visibleErrors = Array.isArray(errors) ? errors.filter(Boolean) : [];

  if (visibleErrors.length > 0) {
    return truncateOutput(visibleErrors.slice(0, 2).join('；'), 220);
  }

  return fallback ? truncateOutput(fallback, 220) : '-';
}

function routeIdentity(route: PublishSkippedRoute | PublishFailedRoute, index: number) {
  return `${route.path || route.sourceId || 'route'}-${index}`;
}

export function PublishManagementPage() {
  const [latestLog, setLatestLog] = useState<PublishLog | null>(null);
  const [logs, setLogs] = useState<PublishLogSummary[]>([]);
  const [status, setStatus] = useState('正在读取发布记录...');
  const [errorSummary, setErrorSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const latestCounts = useMemo(() => ({
    generated: getGeneratedCount(latestLog),
    failed: getFailedCount(latestLog),
    skipped: getSkippedCount(latestLog),
  }), [latestLog]);

  const sourceStatsEntries = useMemo(
    () => getSourceStatsEntries(latestLog?.sourceStats),
    [latestLog?.sourceStats],
  );
  const skippedRoutes = latestLog?.skippedRoutes ?? [];
  const failedRoutes = latestLog?.failedRoutes ?? [];
  const visibleSkippedRoutes = skippedRoutes.slice(0, 10);
  const visibleFailedRoutes = failedRoutes.slice(0, 10);

  async function refreshPublishData(nextStatus = '发布记录已刷新。') {
    setIsLoading(true);
    try {
      const [nextLatestLog, nextLogs] = await Promise.all([
        getLatestPublishLog(),
        listPublishLogs(),
      ]);
      setLatestLog(nextLatestLog);
      setLogs(nextLogs);
      setStatus(nextLogs.length ? nextStatus : '还没有发布日志。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '发布记录读取失败。');
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePublish() {
    setIsPublishing(true);
    setErrorSummary('');
    setStatus('正在生成静态 HTML...');

    try {
      const result = await triggerPrerenderPublish();
      if (result.latestLog) {
        setLatestLog(result.latestLog);
      }

      if (result.status === 'success') {
        setStatus('静态 HTML 生成完成。');
      } else {
        setStatus('静态 HTML 生成失败。');
        setErrorSummary(formatPublishError(result));
      }

      await refreshPublishData(result.status === 'success' ? '静态 HTML 生成完成，发布记录已刷新。' : '发布失败，发布记录已刷新。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '发布请求失败。');
    } finally {
      setIsPublishing(false);
    }
  }

  useEffect(() => {
    void refreshPublishData();
  }, []);

  return (
    <div className="admin-quality-page">
      <div className="admin-section-heading">
        <p className="admin-eyebrow">Publish Center</p>
        <h1>发布管理</h1>
        <p>各后台模块负责内容保存；本页负责全站 GEO HTML、sitemap、robots 与发布日志统一生成。</p>
      </div>

      <div className="quality-summary-grid">
        <article className="quality-summary-card">
          <span>发布状态</span>
          <strong>{latestLog?.status ?? '-'}</strong>
        </article>
        <article className="quality-summary-card">
          <span>总路由</span>
          <strong>{latestLog?.totalRoutes ?? '-'}</strong>
        </article>
        <article className="quality-summary-card">
          <span>已生成</span>
          <strong>{latestCounts.generated}</strong>
        </article>
        <article className="quality-summary-card quality-summary-card--medium">
          <span>已跳过</span>
          <strong>{latestCounts.skipped}</strong>
        </article>
        <article className="quality-summary-card quality-summary-card--high">
          <span>失败</span>
          <strong>{latestCounts.failed}</strong>
        </article>
      </div>

      <section className="quality-list-panel">
        <div className="quality-list-header">
          <h2>最近一次发布</h2>
          <button type="button" onClick={() => void handlePublish()} disabled={isPublishing || isLoading}>
            {isPublishing ? '发布中...' : '生成静态 HTML'}
          </button>
        </div>

        <div className="quality-list">
          <article className="quality-item">
            <div className="quality-item-main">
              <div className="quality-item-heading">
                <span>{latestLog?.status ?? '暂无记录'}</span>
                <strong>{latestLog?.publishId ?? '-'}</strong>
              </div>
              <p>开始：{formatDateTime(latestLog?.startedAt)} / 完成：{formatDateTime(latestLog?.finishedAt)}</p>
              <small>触发来源：{latestLog?.triggeredBy || '-'}</small>
            </div>
            <div className="quality-item-side">
              <span>路由统计</span>
              <span className="quality-flag">总计 {latestLog?.totalRoutes ?? 0}</span>
              <span className="quality-flag">生成 {latestCounts.generated}</span>
              <span className="quality-flag">失败 {latestCounts.failed}</span>
              <span className="quality-flag">跳过 {latestCounts.skipped}</span>
            </div>
          </article>
        </div>
      </section>

      <section className="quality-list-panel">
        <div className="quality-list-header">
          <h2>模块统计 / Source Stats</h2>
          <span>{sourceStatsEntries.length ? `共 ${sourceStatsEntries.length} 个来源` : '当前发布日志未包含模块统计'}</span>
        </div>

        {sourceStatsEntries.length ? (
          <div className="quality-summary-grid">
            {sourceStatsEntries.map(([sourceType, stat]) => (
              <article className="quality-summary-card" key={sourceType}>
                <span>{getSourceTypeLabel(sourceType)}</span>
                <strong>{stat.generated}/{stat.discovered}</strong>
                <small>
                  生成 {stat.generated} / 跳过 {stat.skipped} / 失败 {stat.failed ?? 0}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <div className="quality-empty-state">当前发布日志未包含模块统计。</div>
        )}
      </section>

      <section className="quality-list-panel">
        <div className="quality-list-header">
          <h2>跳过路由</h2>
          <span>{skippedRoutes.length ? `显示前 ${visibleSkippedRoutes.length} / 共 ${skippedRoutes.length} 条` : '暂无跳过路由'}</span>
        </div>

        {visibleSkippedRoutes.length ? (
          <div className="quality-list">
            {visibleSkippedRoutes.map((route, index) => (
              <article className="quality-item" key={routeIdentity(route, index)}>
                <div className="quality-item-main">
                  <div className="quality-item-heading">
                    <span>{getSourceTypeLabel(route.sourceType)}</span>
                    <strong>{route.path || route.slug || route.sourceId || '-'}</strong>
                  </div>
                  <p>{route.skipReason || '-'}</p>
                  <small>{formatErrorSummary(route.errors)}</small>
                </div>
                <div className="quality-item-side">
                  <span>来源</span>
                  <span className="quality-flag">{route.sourceType}</span>
                  <span className="quality-flag">{route.sourceId || '-'}</span>
                  <span className="quality-flag">errors {route.errors?.length ?? 0}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="quality-empty-state">暂无跳过路由。</div>
        )}
      </section>

      <section className="quality-list-panel">
        <div className="quality-list-header">
          <h2>失败路由</h2>
          <span>{failedRoutes.length ? `显示前 ${visibleFailedRoutes.length} / 共 ${failedRoutes.length} 条` : '暂无失败路由'}</span>
        </div>

        {visibleFailedRoutes.length ? (
          <div className="quality-list">
            {visibleFailedRoutes.map((route, index) => (
              <article className="quality-item quality-item--high" key={routeIdentity(route, index)}>
                <div className="quality-item-main">
                  <div className="quality-item-heading">
                    <span>{route.sourceType ? getSourceTypeLabel(route.sourceType) : 'route'}</span>
                    <strong>{route.path || route.sourceId || '-'}</strong>
                  </div>
                  <p>{formatErrorSummary(route.errors, route.error)}</p>
                </div>
                <div className="quality-item-side">
                  <span>来源</span>
                  <span className="quality-flag">{route.sourceType || '-'}</span>
                  <span className="quality-flag">{route.sourceId || '-'}</span>
                  <span className="quality-flag">errors {route.errors?.length ?? (route.error ? 1 : 0)}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="quality-empty-state">暂无失败路由。</div>
        )}
      </section>

      <div className="quality-status-row">
        <p className="media-status">{status}</p>
        <button type="button" onClick={() => void refreshPublishData()} disabled={isLoading || isPublishing}>
          {isLoading ? '刷新中...' : '刷新记录'}
        </button>
      </div>

      {errorSummary ? (
        <section className="quality-list-panel">
          <div className="quality-list-header">
            <h2>错误摘要</h2>
            <span>仅显示尾部摘要</span>
          </div>
          <pre style={{ margin: 0, maxHeight: 220, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {errorSummary}
          </pre>
        </section>
      ) : null}

      <section className="quality-list-panel">
        <div className="quality-list-header">
          <h2>发布日志</h2>
          <span>共 {logs.length} 条</span>
        </div>

        {logs.length === 0 ? (
          <div className="quality-empty-state">暂无发布日志</div>
        ) : (
          <div className="quality-list">
            {logs.map((log) => (
              <article className="quality-item" key={`${log.fileName}-${log.publishId}`}>
                <div className="quality-item-main">
                  <div className="quality-item-heading">
                    <span>{log.status}</span>
                    <strong>{log.publishId}</strong>
                  </div>
                  <p>开始：{formatDateTime(log.startedAt)} / 完成：{formatDateTime(log.finishedAt)}</p>
                  <small>文件：{log.fileName}</small>
                  <small>模块：{summarizeSourceStats(log.sourceStats)}</small>
                </div>
                <div className="quality-item-side">
                  <span>摘要</span>
                  <span className="quality-flag">生成 {log.generatedCount}</span>
                  <span className="quality-flag">失败 {log.failedCount}</span>
                  <span className="quality-flag">跳过 {log.skippedCount}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
