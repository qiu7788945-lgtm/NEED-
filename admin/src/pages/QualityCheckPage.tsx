import { useEffect, useMemo, useState } from 'react';
import type {
  QualityCheckItem,
  QualityCheckModule,
  QualityCheckResult,
  QualityCheckSeverity,
} from '../../../shared/types/quality-check';
import { getQualityCheck } from '../api/qualityCheck';

type ModuleFilter = QualityCheckModule | '';
type SeverityFilter = QualityCheckSeverity | '';
type BooleanFilter = 'all' | 'yes' | 'no';

const moduleOptions: Array<{ value: ModuleFilter; label: string }> = [
  { value: '', label: '全部模块' },
  { value: 'home', label: '首页' },
  { value: 'articles', label: '文章' },
  { value: 'cases', label: '案例' },
  { value: 'solutions', label: '场景' },
  { value: 'media', label: '媒体' },
  { value: 'seo', label: 'SEO/GEO' },
];

const severityOptions: Array<{ value: SeverityFilter; label: string }> = [
  { value: '', label: '全部优先级' },
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
];

const booleanOptions: Array<{ value: BooleanFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'yes', label: '是' },
  { value: 'no', label: '否' },
];

const moduleLabels: Record<QualityCheckModule, string> = {
  home: '首页',
  articles: '文章',
  cases: '案例',
  solutions: '场景',
  media: '媒体',
  seo: 'SEO/GEO',
};

const severityLabels: Record<QualityCheckSeverity, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || '-';
  }

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTargetHint(item: QualityCheckItem) {
  const target = item.target;
  if (target.type === 'homeVideo' || target.type === 'homeInteractive') {
    return '建议入口：首页管理';
  }
  if (target.type === 'article') {
    return `建议入口：文章管理${target.category ? ` / ${target.category}` : ''}`;
  }
  if (target.type === 'case') {
    return `建议入口：案例解析${target.slug ? ` / ${target.slug}` : ''}`;
  }
  if (target.type === 'solution' || target.type === 'solutionGroup') {
    return `建议入口：场景解决方案${target.category ? ` / ${target.category}` : target.slug ? ` / ${target.slug}` : ''}`;
  }
  return '建议入口：媒体库或 seed 导入记录';
}

function matchesBooleanFilter(value: boolean, filter: BooleanFilter) {
  if (filter === 'all') {
    return true;
  }
  return filter === 'yes' ? value : !value;
}

export function QualityCheckPage() {
  const [result, setResult] = useState<QualityCheckResult | null>(null);
  const [status, setStatus] = useState('正在读取内容健康检查...');
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('');
  const [blockingFilter, setBlockingFilter] = useState<BooleanFilter>('all');
  const [humanFilter, setHumanFilter] = useState<BooleanFilter>('all');
  const [isLoading, setIsLoading] = useState(false);

  async function refreshQualityCheck() {
    setIsLoading(true);
    setStatus('正在刷新检查结果...');
    try {
      const nextResult = await getQualityCheck();
      setResult(nextResult);
      setStatus(`检查完成：共发现 ${nextResult.summary.total} 个问题。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '内容健康检查失败，请稍后再试。');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refreshQualityCheck();
  }, []);

  const filteredItems = useMemo(() => (
    (result?.items ?? []).filter((item) => (
      (!moduleFilter || item.module === moduleFilter)
      && (!severityFilter || item.severity === severityFilter)
      && matchesBooleanFilter(item.blockingPublish, blockingFilter)
      && matchesBooleanFilter(item.needsHumanConfirmation, humanFilter)
    ))
  ), [blockingFilter, humanFilter, moduleFilter, result, severityFilter]);

  return (
    <div className="admin-quality-page">
      <div className="admin-section-heading">
        <p className="admin-eyebrow">GEO Quality Check</p>
        <h1>内容健康检查 / GEO 检查</h1>
        <p>本页只做检查，不会自动修改数据。检查结果用于判断哪些内容暂时不适合进入静态发布。</p>
      </div>

      <div className="quality-summary-grid">
        <article className="quality-summary-card">
          <span>总问题数</span>
          <strong>{result?.summary.total ?? '-'}</strong>
        </article>
        <article className="quality-summary-card quality-summary-card--high">
          <span>高优先级</span>
          <strong>{result?.summary.high ?? '-'}</strong>
        </article>
        <article className="quality-summary-card quality-summary-card--medium">
          <span>中优先级</span>
          <strong>{result?.summary.medium ?? '-'}</strong>
        </article>
        <article className="quality-summary-card quality-summary-card--low">
          <span>低优先级</span>
          <strong>{result?.summary.low ?? '-'}</strong>
        </article>
        <article className="quality-summary-card quality-summary-card--blocking">
          <span>阻碍发布</span>
          <strong>{result?.summary.blockingPublish ?? '-'}</strong>
        </article>
      </div>

      <div className="quality-filter-panel">
        <label>
          <span>模块</span>
          <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value as ModuleFilter)}>
            {moduleOptions.map((item) => (
              <option key={item.value || 'all'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>优先级</span>
          <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)}>
            {severityOptions.map((item) => (
              <option key={item.value || 'all'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>阻碍发布</span>
          <select value={blockingFilter} onChange={(event) => setBlockingFilter(event.target.value as BooleanFilter)}>
            {booleanOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>人工确认</span>
          <select value={humanFilter} onChange={(event) => setHumanFilter(event.target.value as BooleanFilter)}>
            {booleanOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void refreshQualityCheck()} disabled={isLoading}>
          {isLoading ? '检查中...' : '刷新检查'}
        </button>
      </div>

      <div className="quality-status-row">
        <p className="media-status">{status}</p>
        {result ? <span>更新时间：{formatDateTime(result.updatedAt)}</span> : null}
      </div>

      <section className="quality-list-panel">
        <div className="quality-list-header">
          <h2>问题列表</h2>
          <span>当前筛选 {filteredItems.length} 条</span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="quality-empty-state">当前未发现明显问题</div>
        ) : (
          <div className="quality-list">
            {filteredItems.map((item) => (
              <article className={`quality-item quality-item--${item.severity}`} key={item.id}>
                <div className="quality-item-main">
                  <div className="quality-item-heading">
                    <span className={`quality-severity quality-severity--${item.severity}`}>
                      {severityLabels[item.severity]}
                    </span>
                    <span>{moduleLabels[item.module]}</span>
                    <strong>{item.objectTitle}</strong>
                  </div>
                  <p>{item.issue}</p>
                  <small>{item.suggestion}</small>
                </div>
                <div className="quality-item-side">
                  <span>{item.objectType}</span>
                  <span className={item.blockingPublish ? 'quality-flag quality-flag--danger' : 'quality-flag'}>
                    {item.blockingPublish ? '阻碍发布' : '不阻碍发布'}
                  </span>
                  <span className={item.needsHumanConfirmation ? 'quality-flag quality-flag--warn' : 'quality-flag'}>
                    {item.needsHumanConfirmation ? '需人工确认' : '无需人工确认'}
                  </span>
                  <button type="button" title={getTargetHint(item)} onClick={() => setStatus(getTargetHint(item))}>
                    查看目标信息
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
