import { useEffect, useMemo, useState } from 'react';
import type {
  Page,
  PageFaqItem,
  PageInput,
  PageMediaRef,
  PageSection,
  PageStatus,
  PageType,
} from '../../../shared/types/pages';
import {
  createPage,
  deletePage,
  duplicatePage,
  listPages,
  reorderPages,
  updatePage,
  updatePageStatus,
} from '../api/pages';

interface PageFormState {
  id: string;
  title: string;
  path: string;
  slug: string;
  pageType: PageType;
  status: PageStatus;
  seoTitle: string;
  seoDescription: string;
  keywords: string;
  heroTitle: string;
  heroSubtitle: string;
  summary: string;
  sections: PageSection[];
  faqItems: PageFaqItem[];
  mediaRefs: PageMediaRef[];
  shouldIndex: boolean;
  sortOrder: string;
}

const pageTypes: Array<{ value: PageType | ''; label: string }> = [
  { value: '', label: '全部类型' },
  { value: 'service', label: 'service' },
  { value: 'scenario', label: 'scenario' },
  { value: 'city', label: 'city' },
  { value: 'faq', label: 'faq' },
  { value: 'topic', label: 'topic' },
  { value: 'budget', label: 'budget' },
  { value: 'vendor_selection', label: 'vendor_selection' },
  { value: 'family_day', label: 'family_day' },
  { value: 'annual_meeting', label: 'annual_meeting' },
  { value: 'contact', label: 'contact' },
  { value: 'home_section', label: 'home_section' },
];

const pageStatuses: Array<{ value: PageStatus | ''; label: string }> = [
  { value: '', label: '全部状态' },
  { value: 'draft', label: 'draft 草稿' },
  { value: 'published', label: 'published 后台已发布' },
  { value: 'archived', label: 'archived 归档' },
];

const emptyForm: PageFormState = {
  id: '',
  title: '',
  path: '',
  slug: '',
  pageType: 'topic',
  status: 'draft',
  seoTitle: '',
  seoDescription: '',
  keywords: '',
  heroTitle: '',
  heroSubtitle: '',
  summary: '',
  sections: [],
  faqItems: [],
  mediaRefs: [],
  shouldIndex: false,
  sortOrder: '0',
};

function createDraftId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function normalizeSortOrders<TItem extends { sortOrder: number }>(items: TItem[]) {
  return items.map((item, index) => ({
    ...item,
    sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index + 1,
  }));
}

function moveItem<TItem extends { sortOrder: number }>(items: TItem[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }

  const nextItems = [...items];
  const current = nextItems[index];
  nextItems[index] = nextItems[nextIndex];
  nextItems[nextIndex] = current;

  return nextItems.map((item, itemIndex) => ({
    ...item,
    sortOrder: itemIndex + 1,
  }));
}

function sortBySortOrder<TItem extends { sortOrder: number }>(items: TItem[]) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

function toForm(page: Page): PageFormState {
  return {
    id: page.id,
    title: page.title,
    path: page.path,
    slug: page.slug,
    pageType: page.pageType,
    status: page.status,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    keywords: page.keywords,
    heroTitle: page.heroTitle,
    heroSubtitle: page.heroSubtitle,
    summary: page.summary,
    sections: sortBySortOrder(page.sections),
    faqItems: sortBySortOrder(page.faqItems),
    mediaRefs: sortBySortOrder(page.mediaRefs),
    shouldIndex: page.shouldIndex,
    sortOrder: String(page.sortOrder),
  };
}

function toInput(form: PageFormState): PageInput {
  return {
    title: form.title,
    path: form.path,
    slug: form.slug,
    pageType: form.pageType,
    status: form.status,
    seoTitle: form.seoTitle,
    seoDescription: form.seoDescription,
    keywords: form.keywords,
    heroTitle: form.heroTitle,
    heroSubtitle: form.heroSubtitle,
    summary: form.summary,
    sections: normalizeSortOrders(form.sections),
    faqItems: normalizeSortOrders(form.faqItems),
    mediaRefs: normalizeSortOrders(form.mediaRefs),
    shouldIndex: form.shouldIndex,
    sortOrder: Number(form.sortOrder),
  };
}

export function PageEditorPage() {
  const [pages, setPages] = useState<Page[]>([]);
  const [allPages, setAllPages] = useState<Page[]>([]);
  const [filterStatus, setFilterStatus] = useState<PageStatus | ''>('');
  const [filterPageType, setFilterPageType] = useState<PageType | ''>('');
  const [keyword, setKeyword] = useState('');
  const [form, setForm] = useState<PageFormState>(emptyForm);
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState('正在加载页面数据...');
  const [isSaving, setIsSaving] = useState(false);

  const sortedPages = useMemo(() => sortBySortOrder(pages), [pages]);

  async function refreshPages() {
    const [nextPages, nextAllPages] = await Promise.all([
      listPages({
        status: filterStatus,
        pageType: filterPageType,
        keyword,
      }),
      listPages(),
    ]);

    setPages(nextPages);
    setAllPages(nextAllPages);
    setStatus(nextPages.length ? `已加载 ${nextPages.length} 个页面。` : '暂无符合筛选条件的页面。');
  }

  useEffect(() => {
    refreshPages().catch((error: Error) => {
      setStatus(error.message);
    });
  }, [filterStatus, filterPageType]);

  function resetForm() {
    const nextSortOrder = allPages.reduce((maxSortOrder, page) => Math.max(maxSortOrder, page.sortOrder), 0) + 1;
    setForm({
      ...emptyForm,
      sortOrder: String(nextSortOrder),
    });
    setIsEditing(false);
    setStatus('正在新建 draft 页面。');
  }

  function editPage(page: Page) {
    setForm(toForm(page));
    setIsEditing(true);
    setStatus(`正在编辑：${page.title}`);
  }

  async function handleSavePage() {
    setIsSaving(true);
    setStatus(isEditing ? '正在保存页面...' : '正在创建 draft 页面...');

    try {
      const savedPage = isEditing ? await updatePage(form.id, toInput(form)) : await createPage(toInput(form));
      setForm(toForm(savedPage));
      setIsEditing(true);
      setStatus(isEditing ? '页面已保存。' : 'draft 页面已创建。');
      await refreshPages();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '页面保存失败。');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSetStatus(nextStatus: PageStatus) {
    if (!isEditing) {
      setForm((current) => ({ ...current, status: nextStatus }));
      return;
    }

    setStatus(`正在切换后台状态为 ${nextStatus}...`);
    try {
      const updatedPage = await updatePageStatus(form.id, nextStatus);
      setForm(toForm(updatedPage));
      setStatus(`后台状态已切换为 ${nextStatus}。此操作不会触发 HTML / sitemap。`);
      await refreshPages();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '状态切换失败。');
    }
  }

  async function handleDuplicatePage(page: Page) {
    setStatus(`正在复制：${page.title}`);
    try {
      const duplicatedPage = await duplicatePage(page.id);
      setForm(toForm(duplicatedPage));
      setIsEditing(true);
      setStatus('已复制为新的 draft 页面。');
      await refreshPages();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '页面复制失败。');
    }
  }

  async function handleDeletePage(page: Page) {
    const confirmed = window.confirm(`确认删除《${page.title}》吗？测试页删除后会从 pages.json 移除。`);
    if (!confirmed) {
      return;
    }

    setStatus(`正在删除：${page.title}`);
    try {
      await deletePage(page.id);
      if (form.id === page.id) {
        resetForm();
      }
      setStatus('页面已删除。');
      await refreshPages();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '页面删除失败。');
    }
  }

  function updatePageSortOrder(id: string, sortOrder: string) {
    const nextSortOrder = Number(sortOrder);
    setPages((current) => current.map((page) => (
      page.id === id ? { ...page, sortOrder: Number.isFinite(nextSortOrder) ? nextSortOrder : 0 } : page
    )));
  }

  async function handleSavePageOrder() {
    setStatus('正在保存页面排序...');
    try {
      await reorderPages(sortedPages.map((page) => ({
        id: page.id,
        sortOrder: page.sortOrder,
      })));
      setStatus('页面排序已保存。');
      await refreshPages();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '页面排序保存失败。');
    }
  }

  function addSection() {
    setForm((current) => ({
      ...current,
      sections: [
        ...current.sections,
        {
          id: createDraftId('section'),
          type: 'text',
          title: '',
          subtitle: '',
          body: '',
          items: [],
          mediaRefs: [],
          sortOrder: current.sections.length + 1,
          enabled: true,
        },
      ],
    }));
  }

  function updateSection(index: number, patch: Partial<PageSection>) {
    setForm((current) => ({
      ...current,
      sections: current.sections.map((section, sectionIndex) => (
        sectionIndex === index ? { ...section, ...patch } : section
      )),
    }));
  }

  function removeSection(index: number) {
    setForm((current) => ({
      ...current,
      sections: current.sections.filter((_, sectionIndex) => sectionIndex !== index).map((section, sectionIndex) => ({
        ...section,
        sortOrder: sectionIndex + 1,
      })),
    }));
  }

  function moveSection(index: number, direction: -1 | 1) {
    setForm((current) => ({
      ...current,
      sections: moveItem(current.sections, index, direction),
    }));
  }

  function addFaqItem() {
    setForm((current) => ({
      ...current,
      faqItems: [
        ...current.faqItems,
        {
          id: createDraftId('faq'),
          question: '',
          answer: '',
          sortOrder: current.faqItems.length + 1,
          enabled: true,
        },
      ],
    }));
  }

  function updateFaqItem(index: number, patch: Partial<PageFaqItem>) {
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
      faqItems: current.faqItems.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({
        ...item,
        sortOrder: itemIndex + 1,
      })),
    }));
  }

  function addMediaRef() {
    setForm((current) => ({
      ...current,
      mediaRefs: [
        ...current.mediaRefs,
        {
          id: createDraftId('media'),
          mediaId: '',
          url: '',
          alt: '',
          caption: '',
          usage: 'hero',
          sortOrder: current.mediaRefs.length + 1,
        },
      ],
    }));
  }

  function updateMediaRef(index: number, patch: Partial<PageMediaRef>) {
    setForm((current) => ({
      ...current,
      mediaRefs: current.mediaRefs.map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...patch } : item
      )),
    }));
  }

  function removeMediaRef(index: number) {
    setForm((current) => ({
      ...current,
      mediaRefs: current.mediaRefs.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({
        ...item,
        sortOrder: itemIndex + 1,
      })),
    }));
  }

  return (
    <div className="admin-article-page admin-page-editor-page">
      <div className="admin-section-heading page-editor-notice">
        <p className="admin-eyebrow">Page Editor V1</p>
        <h1>页面编辑器</h1>
        <p>
          当前为第21-3后台编辑能力，页面数据尚未接入前台渲染、route manifest 和 sitemap。
          正式发布 HTML 将在第21-4 / 第21-5 完成。
        </p>
      </div>

      <div className="article-toolbar">
        <label>
          <span>状态</span>
          <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as PageStatus | '')}>
            {pageStatuses.map((item) => (
              <option key={item.value || 'all'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>页面类型</span>
          <select value={filterPageType} onChange={(event) => setFilterPageType(event.target.value as PageType | '')}>
            {pageTypes.map((item) => (
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
                void refreshPages();
              }
            }}
            placeholder="搜索 title / path / slug / SEO"
          />
        </label>
        <button type="button" onClick={() => void refreshPages()}>
          搜索
        </button>
        <button type="button" onClick={resetForm}>
          新建页面
        </button>
      </div>

      <p className="media-status">{status}</p>

      <div className="article-layout page-editor-layout">
        <section className="article-list-panel">
          <div className="article-list-header">
            <h2>页面列表</h2>
            <button type="button" onClick={() => void handleSavePageOrder()} disabled={sortedPages.length === 0}>
              保存排序
            </button>
          </div>

          <div className="article-list">
            {sortedPages.map((page) => (
              <article className="article-list-item page-list-item" key={page.id}>
                <div>
                  <strong>{page.title}</strong>
                  <span>{page.path}</span>
                  <span>
                    {page.pageType} / {page.status} / 更新 {formatDateTime(page.updatedAt)}
                  </span>
                </div>
                <label>
                  <span>排序</span>
                  <input
                    type="number"
                    value={page.sortOrder}
                    onChange={(event) => updatePageSortOrder(page.id, event.target.value)}
                  />
                </label>
                <div className="article-actions">
                  <button type="button" onClick={() => editPage(page)}>
                    编辑
                  </button>
                  <button type="button" onClick={() => void handleDuplicatePage(page)}>
                    复制
                  </button>
                  <button type="button" onClick={() => void handleSetStatusFromList(page, 'draft')}>
                    draft
                  </button>
                  <button type="button" onClick={() => void handleSetStatusFromList(page, 'published')}>
                    published
                  </button>
                  <button type="button" onClick={() => void handleSetStatusFromList(page, 'archived')}>
                    archived
                  </button>
                  <button className="is-danger" type="button" onClick={() => void handleDeletePage(page)}>
                    删除
                  </button>
                </div>
              </article>
            ))}
            {sortedPages.length === 0 ? <p className="media-status">暂无页面。可以先新建一个 draft 测试页。</p> : null}
          </div>
        </section>

        <section className="article-editor-panel">
          <div className="article-list-header">
            <h2>{isEditing ? '编辑页面' : '新建 draft 页面'}</h2>
            <button type="button" onClick={() => void handleSavePage()} disabled={isSaving}>
              {isSaving ? '保存中...' : '保存页面'}
            </button>
          </div>

          <div className="page-status-actions">
            {(['draft', 'published', 'archived'] as PageStatus[]).map((item) => (
              <button
                key={item}
                className={form.status === item ? 'is-active' : ''}
                type="button"
                onClick={() => void handleSetStatus(item)}
              >
                {item}
              </button>
            ))}
            <span>状态仅写入后台 pages.json，不触发 HTML / route manifest / sitemap。</span>
          </div>

          <div className="article-form">
            <label>
              <span>Title</span>
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </label>
            <label>
              <span>Path</span>
              <input value={form.path} onChange={(event) => setForm({ ...form, path: event.target.value })} placeholder="/new-page" />
            </label>
            <label>
              <span>Slug</span>
              <input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
            </label>
            <label>
              <span>Page Type</span>
              <select value={form.pageType} onChange={(event) => setForm({ ...form, pageType: event.target.value as PageType })}>
                {pageTypes.filter((item) => item.value).map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Sort Order</span>
              <input type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} />
            </label>
            <label className="page-inline-check">
              <input
                type="checkbox"
                checked={form.shouldIndex}
                onChange={(event) => setForm({ ...form, shouldIndex: event.target.checked })}
              />
              <span>shouldIndex</span>
            </label>
            <label>
              <span>SEO Title</span>
              <input value={form.seoTitle} onChange={(event) => setForm({ ...form, seoTitle: event.target.value })} />
            </label>
            <label>
              <span>Keywords</span>
              <input value={form.keywords} onChange={(event) => setForm({ ...form, keywords: event.target.value })} />
            </label>
            <label>
              <span>Hero Title</span>
              <input value={form.heroTitle} onChange={(event) => setForm({ ...form, heroTitle: event.target.value })} />
            </label>
            <label>
              <span>Hero Subtitle</span>
              <input value={form.heroSubtitle} onChange={(event) => setForm({ ...form, heroSubtitle: event.target.value })} />
            </label>
            <label className="article-full-row">
              <span>SEO Description</span>
              <textarea value={form.seoDescription} onChange={(event) => setForm({ ...form, seoDescription: event.target.value })} />
            </label>
            <label className="article-full-row">
              <span>Summary</span>
              <textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} />
            </label>
          </div>

          <div className="article-seo-panel">
            <div className="article-list-header">
              <h3>Sections</h3>
              <button type="button" onClick={addSection}>
                新增 Section
              </button>
            </div>
            <div className="page-editor-stack">
              {form.sections.map((section, index) => (
                <div className="page-editor-card" key={section.id}>
                  <div className="page-editor-card-actions">
                    <button type="button" onClick={() => moveSection(index, -1)} disabled={index === 0}>
                      上移
                    </button>
                    <button type="button" onClick={() => moveSection(index, 1)} disabled={index === form.sections.length - 1}>
                      下移
                    </button>
                    <button className="is-danger" type="button" onClick={() => removeSection(index)}>
                      删除
                    </button>
                  </div>
                  <div className="article-form">
                    <label>
                      <span>Type</span>
                      <input value={section.type} onChange={(event) => updateSection(index, { type: event.target.value })} />
                    </label>
                    <label>
                      <span>Sort Order</span>
                      <input
                        type="number"
                        value={section.sortOrder}
                        onChange={(event) => updateSection(index, { sortOrder: Number(event.target.value) })}
                      />
                    </label>
                    <label className="page-inline-check">
                      <input
                        type="checkbox"
                        checked={section.enabled}
                        onChange={(event) => updateSection(index, { enabled: event.target.checked })}
                      />
                      <span>enabled</span>
                    </label>
                    <label>
                      <span>Title</span>
                      <input value={section.title} onChange={(event) => updateSection(index, { title: event.target.value })} />
                    </label>
                    <label className="article-full-row">
                      <span>Subtitle</span>
                      <textarea value={section.subtitle} onChange={(event) => updateSection(index, { subtitle: event.target.value })} />
                    </label>
                    <label className="article-full-row">
                      <span>Body</span>
                      <textarea value={section.body} onChange={(event) => updateSection(index, { body: event.target.value })} />
                    </label>
                  </div>
                </div>
              ))}
              {form.sections.length === 0 ? <p className="media-status">暂无 sections。</p> : null}
            </div>
          </div>

          <div className="article-seo-panel">
            <div className="article-list-header">
              <h3>FAQ</h3>
              <button type="button" onClick={addFaqItem}>
                新增 FAQ
              </button>
            </div>
            <div className="page-editor-stack">
              {form.faqItems.map((item, index) => (
                <div className="page-editor-card" key={item.id}>
                  <div className="page-editor-card-actions">
                    <button className="is-danger" type="button" onClick={() => removeFaqItem(index)}>
                      删除
                    </button>
                  </div>
                  <div className="article-form">
                    <label className="article-full-row">
                      <span>Question</span>
                      <input value={item.question} onChange={(event) => updateFaqItem(index, { question: event.target.value })} />
                    </label>
                    <label>
                      <span>Sort Order</span>
                      <input
                        type="number"
                        value={item.sortOrder}
                        onChange={(event) => updateFaqItem(index, { sortOrder: Number(event.target.value) })}
                      />
                    </label>
                    <label className="page-inline-check">
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={(event) => updateFaqItem(index, { enabled: event.target.checked })}
                      />
                      <span>enabled</span>
                    </label>
                    <label className="article-full-row">
                      <span>Answer</span>
                      <textarea value={item.answer} onChange={(event) => updateFaqItem(index, { answer: event.target.value })} />
                    </label>
                  </div>
                </div>
              ))}
              {form.faqItems.length === 0 ? <p className="media-status">暂无 FAQ。</p> : null}
            </div>
          </div>

          <div className="article-seo-panel">
            <div className="article-list-header">
              <h3>Media Refs</h3>
              <button type="button" onClick={addMediaRef}>
                新增 Media Ref
              </button>
            </div>
            <div className="page-editor-stack">
              {form.mediaRefs.map((item, index) => (
                <div className="page-editor-card" key={item.id}>
                  <div className="page-editor-card-actions">
                    <button className="is-danger" type="button" onClick={() => removeMediaRef(index)}>
                      删除
                    </button>
                  </div>
                  <div className="article-form">
                    <label className="article-full-row">
                      <span>URL</span>
                      <input value={item.url} onChange={(event) => updateMediaRef(index, { url: event.target.value })} />
                    </label>
                    <label>
                      <span>Alt</span>
                      <input value={item.alt} onChange={(event) => updateMediaRef(index, { alt: event.target.value })} />
                    </label>
                    <label>
                      <span>Caption</span>
                      <input value={item.caption} onChange={(event) => updateMediaRef(index, { caption: event.target.value })} />
                    </label>
                    <label>
                      <span>Usage</span>
                      <input value={item.usage} onChange={(event) => updateMediaRef(index, { usage: event.target.value })} />
                    </label>
                    <label>
                      <span>Sort Order</span>
                      <input
                        type="number"
                        value={item.sortOrder}
                        onChange={(event) => updateMediaRef(index, { sortOrder: Number(event.target.value) })}
                      />
                    </label>
                  </div>
                </div>
              ))}
              {form.mediaRefs.length === 0 ? <p className="media-status">暂无 mediaRefs，可手动填写 URL。</p> : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );

  async function handleSetStatusFromList(page: Page, nextStatus: PageStatus) {
    setStatus(`正在切换《${page.title}》后台状态为 ${nextStatus}...`);
    try {
      const updatedPage = await updatePageStatus(page.id, nextStatus);
      if (form.id === page.id) {
        setForm(toForm(updatedPage));
      }
      setStatus(`后台状态已切换为 ${nextStatus}。此操作不会触发 HTML / sitemap。`);
      await refreshPages();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '状态切换失败。');
    }
  }
}
