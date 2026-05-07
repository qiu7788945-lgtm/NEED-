import { useEffect, useMemo, useState } from 'react';
import {
  getLatestPublishLog,
  listPublishLogs,
  triggerPrerenderPublish,
  type PublishLog,
  type PublishLogSummary,
} from '../api/publish';

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

function truncateOutput(value: string) {
  const maxLength = 1200;
  if (value.length <= maxLength) {
    return value;
  }

  return `...${value.slice(-maxLength)}`;
}

function formatPublishError(result: { stderrTail?: string; stdoutTail?: string }) {
  return truncateOutput(result.stderrTail || result.stdoutTail || '发布失败，但没有返回更多错误信息。');
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
        <p>管理官网静态 HTML 生成、GEO 输出检查与发布日志。</p>
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
