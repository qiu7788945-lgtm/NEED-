import { useEffect, useState } from 'react';
import type { CaseFaqItem, CaseInput, CaseStatus, CaseStudy } from '../../../shared/types/case';
import {
  createCase,
  deleteCase,
  importCaseWord,
  listCases,
  reorderCases,
  updateCase,
  updateCaseStatus,
} from '../api/cases';
import { uploadImage, type AdminMediaFile } from '../api/media';
import { caseStatuses, getCaseStatusLabel } from '../constants/caseOptions';

interface CaseFormState {
  id: string;
  title: string;
  slug: string;
  summary: string;
  clientType: string;
  eventType: string;
  eventDate: string;
  location: string;
  coverUrl: string;
  coverFileName: string;
  coverDisplayName: string;
  wordFileName: string;
  wordOriginalName: string;
  contentHtml: string;
  contentText: string;
  extractedImages: CaseStudy['extractedImages'];
  sortOrder: string;
  status: CaseStatus;
  seoTitle: string;
  seoDescription: string;
  keywords: string;
  faqItems: CaseFaqItem[];
}

const emptyForm: CaseFormState = {
  id: '',
  title: '',
  slug: '',
  summary: '',
  clientType: '',
  eventType: '',
  eventDate: '',
  location: '',
  coverUrl: '',
  coverFileName: '',
  coverDisplayName: '',
  wordFileName: '',
  wordOriginalName: '',
  contentHtml: '',
  contentText: '',
  extractedImages: [],
  sortOrder: '0',
  status: 'draft',
  seoTitle: '',
  seoDescription: '',
  keywords: '',
  faqItems: [],
};

function toAbsoluteUrl(url: string) {
  if (!url) {
    return '';
  }
  return url.startsWith('http') ? url : `http://localhost:4000${url}`;
}

function toRelativeUrl(url: string) {
  return url.replace('http://localhost:4000', '');
}

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

function getMediaTitle(image: AdminMediaFile) {
  return image.displayName || image.originalName || image.fileName;
}

function toForm(item: CaseStudy): CaseFormState {
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    summary: item.summary,
    clientType: item.clientType,
    eventType: item.eventType,
    eventDate: item.eventDate,
    location: item.location,
    coverUrl: item.coverUrl,
    coverFileName: item.coverFileName,
    coverDisplayName: item.coverDisplayName,
    wordFileName: item.wordFileName,
    wordOriginalName: item.wordOriginalName,
    contentHtml: item.contentHtml,
    contentText: item.contentText,
    extractedImages: item.extractedImages,
    sortOrder: String(item.sortOrder),
    status: item.status,
    seoTitle: item.seoTitle,
    seoDescription: item.seoDescription,
    keywords: item.keywords,
    faqItems: item.faqItems,
  };
}

function toInput(form: CaseFormState): CaseInput {
  return {
    title: form.title,
    slug: form.slug,
    summary: form.summary,
    clientType: form.clientType,
    eventType: form.eventType,
    eventDate: form.eventDate,
    location: form.location,
    coverUrl: form.coverUrl,
    coverFileName: form.coverFileName,
    coverDisplayName: form.coverDisplayName,
    wordFileName: form.wordFileName,
    wordOriginalName: form.wordOriginalName,
    contentHtml: form.contentHtml,
    contentText: form.contentText,
    extractedImages: form.extractedImages,
    sortOrder: Number(form.sortOrder),
    status: form.status,
    seoTitle: form.seoTitle,
    seoDescription: form.seoDescription,
    keywords: form.keywords,
    faqItems: form.faqItems,
  };
}

export function CaseManagementPage() {
  const [cases, setCases] = useState<CaseStudy[]>([]);
  const [filterStatus, setFilterStatus] = useState<CaseStatus | ''>('');
  const [keyword, setKeyword] = useState('');
  const [form, setForm] = useState<CaseFormState>(emptyForm);
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState('正在加载案例...');
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  async function refreshCases() {
    const nextCases = await listCases({ status: filterStatus, keyword });
    setCases(nextCases);
    setStatus(nextCases.length ? `已加载 ${nextCases.length} 个案例。` : '还没有符合条件的案例。');
  }

  useEffect(() => {
    refreshCases().catch((error: Error) => {
      setStatus(error.message);
    });
  }, [filterStatus]);

  function resetForm() {
    setForm({
      ...emptyForm,
      sortOrder: String(cases.length + 1),
    });
    setIsEditing(false);
  }

  function editCase(item: CaseStudy) {
    setForm(toForm(item));
    setIsEditing(true);
    setStatus(`正在编辑：${item.title}`);
  }

  async function handleSaveCase() {
    setIsSaving(true);
    setStatus(isEditing ? '正在保存案例...' : '正在新建案例...');

    try {
      const savedCase = isEditing
        ? await updateCase(form.id, toInput(form))
        : await createCase(toInput(form));
      setForm(toForm(savedCase));
      setIsEditing(true);
      setStatus(isEditing ? '案例已保存。' : '案例已新建。');
      await refreshCases();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '案例保存失败。');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleImportWord(file: File | undefined) {
    if (!file) {
      return;
    }

    setIsImporting(true);
    setStatus('正在导入 Word，请稍候...');

    try {
      const importedCase = await importCaseWord(file);
      setForm(toForm(importedCase));
      setIsEditing(true);
      setStatus(`Word 导入成功，已生成草稿：${importedCase.title}`);
      await refreshCases();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Word 导入失败。');
    } finally {
      setIsImporting(false);
    }
  }

  async function handleUploadCover(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!form.slug) {
      setStatus('请先保存案例，生成 slug 后再上传封面图。');
      return;
    }

    setIsUploadingCover(true);
    setStatus('正在上传封面图...');

    try {
      const uploaded = await uploadImage(file, {
        category: 'case_image',
        ownerType: 'case',
        ownerSlug: form.slug,
        groupKey: 'cover',
        displayName: form.title ? `${form.title} 封面` : file.name,
        alt: form.title,
      });
      setForm((current) => ({
        ...current,
        coverUrl: toRelativeUrl(uploaded.url),
        coverFileName: uploaded.fileName,
        coverDisplayName: getMediaTitle(uploaded),
      }));
      if (isEditing && form.id) {
        const savedCase = await updateCase(form.id, {
          coverUrl: toRelativeUrl(uploaded.url),
          coverFileName: uploaded.fileName,
          coverDisplayName: getMediaTitle(uploaded),
        });
        setForm(toForm(savedCase));
        await refreshCases();
        setStatus('封面图已上传并绑定到案例。');
        return;
      }

      setStatus('封面图已上传，请保存案例。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '封面图上传失败。');
    } finally {
      setIsUploadingCover(false);
    }
  }

  async function handleDeleteCase(item: CaseStudy) {
    const confirmed = window.confirm(`确认删除《${item.title}》吗？删除后会从本地 JSON 移除，已提取图片暂不自动删除。`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteCase(item.id);
      setStatus('案例已删除。');
      if (form.id === item.id) {
        resetForm();
      }
      await refreshCases();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '案例删除失败。');
    }
  }

  async function handleToggleStatus(item: CaseStudy) {
    const nextStatus: CaseStatus = item.status === 'published' ? 'offline' : 'published';

    try {
      await updateCaseStatus(item.id, nextStatus);
      setStatus(nextStatus === 'published' ? '案例已上架。' : '案例已下架。');
      await refreshCases();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '案例状态更新失败。');
    }
  }

  function updateCaseSortOrder(id: string, sortOrder: string) {
    setCases((current) => current.map((item) => (
      item.id === id ? { ...item, sortOrder: Number(sortOrder) } : item
    )));
  }

  async function handleSaveOrder() {
    try {
      const savedCases = await reorderCases(cases.map((item) => ({
        id: item.id,
        sortOrder: item.sortOrder,
      })));
      setCases(savedCases);
      setStatus('排序已保存。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '排序保存失败。');
    }
  }

  function updateFaqItem(index: number, patch: Partial<CaseFaqItem>) {
    setForm((current) => ({
      ...current,
      faqItems: current.faqItems.map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...patch } : item
      )),
    }));
  }

  function removeFaqItem(index: number) {
    setForm((current) => ({
      ...current,
      faqItems: current.faqItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function addFaqItem() {
    setForm((current) => ({
      ...current,
      faqItems: [...current.faqItems, { question: '', answer: '' }],
    }));
  }

  return (
    <div className="admin-case-page">
      <div className="admin-section-heading">
        <p className="admin-eyebrow">Case Analysis</p>
        <h1>案例解析</h1>
        <p>上传 .docx Word 自动生成案例草稿，封面图可单独上传。当前只保存后台数据，不接入正式前台案例页。</p>
      </div>

      <div className="article-toolbar">
        <label>
          <span>状态</span>
          <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as CaseStatus | '')}>
            {caseStatuses.map((item) => (
              <option key={item.value || 'all'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="article-search">
          <span>搜索</span>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void refreshCases();
              }
            }}
            placeholder="搜索标题、摘要、客户类型、活动类型、正文"
          />
        </label>
        <button type="button" onClick={() => void refreshCases()}>
          搜索
        </button>
        <button type="button" onClick={resetForm}>
          新建案例
        </button>
        <label className="home-file-button">
          <span>{isImporting ? '导入中' : '上传 Word 生成草稿'}</span>
          <input
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={isImporting}
            onChange={(event) => void handleImportWord(event.target.files?.[0])}
          />
        </label>
      </div>

      <p className="media-status">{status}</p>

      <div className="article-layout">
        <section className="article-list-panel">
          <div className="article-list-header">
            <h2>案例列表</h2>
            <button type="button" onClick={() => void handleSaveOrder()}>
              保存排序
            </button>
          </div>

          <div className="article-list">
            {cases.map((item) => (
              <article className="case-list-item" key={item.id}>
                <div className="case-list-main">
                  <div className="case-list-cover">
                    {item.coverUrl ? <img src={toAbsoluteUrl(item.coverUrl)} alt={item.title} /> : <span>无封面</span>}
                  </div>
                  <div className="case-list-info">
                    <strong>{item.title}</strong>
                    <span>{getCaseStatusLabel(item.status)} · 更新 {formatDateTime(item.updatedAt)}</span>
                    <small>{item.coverUrl ? '有封面' : '无封面'}</small>
                  </div>
                </div>
                <label className="case-sort-control">
                  <span>排序</span>
                  <input type="number" value={item.sortOrder} onChange={(event) => updateCaseSortOrder(item.id, event.target.value)} />
                </label>
                <div className="article-actions case-list-actions">
                  <button type="button" onClick={() => editCase(item)}>
                    编辑
                  </button>
                  <button type="button" onClick={() => void handleToggleStatus(item)}>
                    {item.status === 'published' ? '下架' : '上架'}
                  </button>
                  <button className="is-danger" type="button" onClick={() => void handleDeleteCase(item)}>
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="article-editor-panel">
          <div className="article-list-header">
            <h2>{isEditing ? '编辑案例' : '新建案例'}</h2>
            <button type="button" onClick={() => void handleSaveCase()} disabled={isSaving}>
              {isSaving ? '保存中' : '保存案例'}
            </button>
          </div>

          <div className="article-form">
            <label>
              <span>标题</span>
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="例如：企业家庭日活动案例解析" />
            </label>
            <label>
              <span>Slug</span>
              <input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="可不填，系统自动生成" />
            </label>
            <label>
              <span>客户类型</span>
              <input value={form.clientType} onChange={(event) => setForm({ ...form, clientType: event.target.value })} placeholder="例如：车企 / 科技公司 / 商业地产" />
            </label>
            <label>
              <span>活动类型</span>
              <input value={form.eventType} onChange={(event) => setForm({ ...form, eventType: event.target.value })} placeholder="例如：家庭日 / 发布会 / 沙龙" />
            </label>
            <label>
              <span>时间</span>
              <input value={form.eventDate} onChange={(event) => setForm({ ...form, eventDate: event.target.value })} placeholder="例如：2026-04" />
            </label>
            <label>
              <span>地点</span>
              <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="例如：上海" />
            </label>
            <label>
              <span>展示排序</span>
              <input type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} />
            </label>
            <label>
              <span>状态</span>
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as CaseStatus })}>
                {caseStatuses.filter((item) => item.value).map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="article-full-row">
              <span>摘要</span>
              <textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} />
            </label>
          </div>

          <div className="article-seo-panel">
            <div className="article-list-header">
              <h3>封面图</h3>
              <label className="home-file-button">
                <span>{isUploadingCover ? '上传中' : '上传/替换封面'}</span>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  disabled={isUploadingCover}
                  onChange={(event) => void handleUploadCover(event.target.files?.[0])}
                />
              </label>
            </div>
            <div className="case-cover-preview">
              {form.coverUrl ? <img src={toAbsoluteUrl(form.coverUrl)} alt={form.title || '案例封面'} /> : <span>未上传封面图</span>}
              <p>{form.coverDisplayName || form.coverFileName || '封面图会自动进入媒体库'}</p>
            </div>
          </div>

          <div className="article-seo-panel">
            <h3>Word 内容</h3>
            <div className="case-word-meta">
              <span>Word 文件：{form.wordOriginalName || form.wordFileName || '未导入'}</span>
              <span>提取图片：{form.extractedImages.length} 张</span>
            </div>
            <label className="article-full-row">
              <span>正文文本</span>
              <textarea className="article-content-textarea" value={form.contentText} onChange={(event) => setForm({ ...form, contentText: event.target.value })} />
            </label>
            <div className="case-html-preview">
              <h4>HTML 预览</h4>
              {form.contentHtml ? <div dangerouslySetInnerHTML={{ __html: form.contentHtml }} /> : <p>暂无 Word 解析内容。</p>}
            </div>
            <div className="case-extracted-grid">
              {form.extractedImages.map((image) => (
                <figure key={image.fileName}>
                  <img src={toAbsoluteUrl(image.url)} alt={image.alt || image.displayName} />
                  <figcaption>{image.displayName}</figcaption>
                </figure>
              ))}
            </div>
          </div>

          <div className="article-seo-panel">
            <h3>SEO / GEO</h3>
            <div className="article-form">
              <label>
                <span>SEO 标题</span>
                <input value={form.seoTitle} onChange={(event) => setForm({ ...form, seoTitle: event.target.value })} />
              </label>
              <label>
                <span>关键词</span>
                <input value={form.keywords} onChange={(event) => setForm({ ...form, keywords: event.target.value })} placeholder="多个关键词可用逗号分隔" />
              </label>
              <label className="article-full-row">
                <span>SEO 描述</span>
                <textarea value={form.seoDescription} onChange={(event) => setForm({ ...form, seoDescription: event.target.value })} />
              </label>
            </div>
          </div>

          <div className="article-seo-panel">
            <div className="article-list-header">
              <h3>FAQ 问答</h3>
              <button type="button" onClick={addFaqItem}>
                添加问答
              </button>
            </div>
            <div className="article-faq-list">
              {form.faqItems.map((item, index) => (
                <div className="article-faq-item" key={`${index}-${item.question}`}>
                  <label>
                    <span>问题</span>
                    <input value={item.question} onChange={(event) => updateFaqItem(index, { question: event.target.value })} />
                  </label>
                  <label>
                    <span>回答</span>
                    <textarea value={item.answer} onChange={(event) => updateFaqItem(index, { answer: event.target.value })} />
                  </label>
                  <button className="is-danger" type="button" onClick={() => removeFaqItem(index)}>
                    删除问答
                  </button>
                </div>
              ))}
              {form.faqItems.length === 0 ? <p className="media-status">暂无 FAQ，可按需要添加。</p> : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
