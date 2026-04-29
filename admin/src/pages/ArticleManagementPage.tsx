import { useEffect, useState } from 'react';
import type { Article, ArticleCategory, ArticleFaqItem, ArticleInput, ArticleStatus } from '../../../shared/types/article';
import {
  createArticle,
  deleteArticle,
  listArticles,
  reorderArticles,
  updateArticle,
  updateArticleStatus,
} from '../api/articles';
import { articleCategories, articleStatuses, getArticleCategoryLabel, getArticleStatusLabel } from '../constants/articleOptions';

interface ArticleFormState {
  id: string;
  title: string;
  slug: string;
  category: ArticleCategory;
  summary: string;
  content: string;
  sortOrder: string;
  status: ArticleStatus;
  seoTitle: string;
  seoDescription: string;
  keywords: string;
  faqItems: ArticleFaqItem[];
}

const emptyForm: ArticleFormState = {
  id: '',
  title: '',
  slug: '',
  category: 'how_to_choose',
  summary: '',
  content: '',
  sortOrder: '0',
  status: 'draft',
  seoTitle: '',
  seoDescription: '',
  keywords: '',
  faqItems: [],
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

function toForm(article: Article): ArticleFormState {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    category: article.category,
    summary: article.summary,
    content: article.content,
    sortOrder: String(article.sortOrder),
    status: article.status,
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    keywords: article.keywords,
    faqItems: article.faqItems.length ? article.faqItems : [],
  };
}

function toInput(form: ArticleFormState): ArticleInput {
  return {
    title: form.title,
    slug: form.slug,
    category: form.category,
    summary: form.summary,
    content: form.content,
    sortOrder: Number(form.sortOrder),
    status: form.status,
    seoTitle: form.seoTitle,
    seoDescription: form.seoDescription,
    keywords: form.keywords,
    faqItems: form.faqItems,
  };
}

export function ArticleManagementPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [filterCategory, setFilterCategory] = useState<ArticleCategory | ''>('');
  const [filterStatus, setFilterStatus] = useState<ArticleStatus | ''>('');
  const [keyword, setKeyword] = useState('');
  const [form, setForm] = useState<ArticleFormState>(emptyForm);
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState('正在加载文章...');
  const [isSaving, setIsSaving] = useState(false);

  async function refreshArticles() {
    const nextArticles = await listArticles({
      category: filterCategory,
      status: filterStatus,
      keyword,
    });
    setArticles(nextArticles);
    setStatus(nextArticles.length ? `已加载 ${nextArticles.length} 篇文章。` : '还没有符合条件的文章。');
  }

  useEffect(() => {
    refreshArticles().catch((error: Error) => {
      setStatus(error.message);
    });
  }, [filterCategory, filterStatus]);

  function resetForm() {
    setForm({
      ...emptyForm,
      sortOrder: String(articles.length + 1),
    });
    setIsEditing(false);
  }

  function editArticle(article: Article) {
    setForm(toForm(article));
    setIsEditing(true);
    setStatus(`正在编辑：${article.title}`);
  }

  async function handleSaveArticle() {
    setIsSaving(true);
    setStatus(isEditing ? '正在保存文章...' : '正在新建文章...');

    try {
      const savedArticle = isEditing
        ? await updateArticle(form.id, toInput(form))
        : await createArticle(toInput(form));
      setStatus(isEditing ? '文章已保存。' : '文章已新建。');
      setForm(toForm(savedArticle));
      setIsEditing(true);
      await refreshArticles();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '文章保存失败。');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteArticle(article: Article) {
    const confirmed = window.confirm(`确认删除《${article.title}》吗？删除后会从本地 JSON 移除。`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteArticle(article.id);
      setStatus('文章已删除。');
      if (form.id === article.id) {
        resetForm();
      }
      await refreshArticles();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '文章删除失败。');
    }
  }

  async function handleToggleStatus(article: Article) {
    const nextStatus: ArticleStatus = article.status === 'published' ? 'offline' : 'published';

    try {
      await updateArticleStatus(article.id, nextStatus);
      setStatus(nextStatus === 'published' ? '文章已上架。' : '文章已下架。');
      await refreshArticles();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '文章状态更新失败。');
    }
  }

  function updateArticleSortOrder(id: string, sortOrder: string) {
    setArticles((current) => current.map((article) => (
      article.id === id ? { ...article, sortOrder: Number(sortOrder) } : article
    )));
  }

  async function handleSaveOrder() {
    try {
      const savedArticles = await reorderArticles(articles.map((article) => ({
        id: article.id,
        sortOrder: article.sortOrder,
      })));
      setArticles(savedArticles);
      setStatus('排序已保存。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '排序保存失败。');
    }
  }

  function updateFaqItem(index: number, patch: Partial<ArticleFaqItem>) {
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
    <div className="admin-article-page">
      <div className="admin-section-heading">
        <p className="admin-eyebrow">Article Management</p>
        <h1>文章管理</h1>
        <p>维护“怎么选活动公司”“二选一怎么选”“方法与判断”三个纯文字栏目。当前只保存后台数据，不接入正式前台页面。</p>
      </div>

      <div className="article-toolbar">
        <label>
          <span>栏目</span>
          <select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value as ArticleCategory | '')}>
            {articleCategories.map((category) => (
              <option key={category.value || 'all'} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>状态</span>
          <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as ArticleStatus | '')}>
            {articleStatuses.map((item) => (
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
                void refreshArticles();
              }
            }}
            placeholder="搜索标题、摘要、正文、SEO 信息"
          />
        </label>
        <button type="button" onClick={() => void refreshArticles()}>
          搜索
        </button>
        <button type="button" onClick={resetForm}>
          新建文章
        </button>
      </div>

      <p className="media-status">{status}</p>

      <div className="article-layout">
        <section className="article-list-panel">
          <div className="article-list-header">
            <h2>文章列表</h2>
            <button type="button" onClick={() => void handleSaveOrder()}>
              保存排序
            </button>
          </div>

          <div className="article-list">
            {articles.map((article) => (
              <article className="article-list-item" key={article.id}>
                <div>
                  <strong>{article.title}</strong>
                  <span>{getArticleCategoryLabel(article.category)} · {getArticleStatusLabel(article.status)} · 更新 {formatDateTime(article.updatedAt)}</span>
                </div>
                <label>
                  <span>排序</span>
                  <input
                    type="number"
                    value={article.sortOrder}
                    onChange={(event) => updateArticleSortOrder(article.id, event.target.value)}
                  />
                </label>
                <div className="article-actions">
                  <button type="button" onClick={() => editArticle(article)}>
                    编辑
                  </button>
                  <button type="button" onClick={() => void handleToggleStatus(article)}>
                    {article.status === 'published' ? '下架' : '上架'}
                  </button>
                  <button className="is-danger" type="button" onClick={() => void handleDeleteArticle(article)}>
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="article-editor-panel">
          <div className="article-list-header">
            <h2>{isEditing ? '编辑文章' : '新建文章'}</h2>
            <button type="button" onClick={() => void handleSaveArticle()} disabled={isSaving}>
              {isSaving ? '保存中' : '保存文章'}
            </button>
          </div>

          <div className="article-form">
            <label>
              <span>标题</span>
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="例如：怎么判断活动公司是否靠谱" />
            </label>
            <label>
              <span>Slug</span>
              <input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="可不填，系统自动生成" />
            </label>
            <label>
              <span>所属栏目</span>
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ArticleCategory })}>
                {articleCategories.filter((category) => category.value).map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>状态</span>
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ArticleStatus })}>
                {articleStatuses.filter((item) => item.value).map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>展示排序</span>
              <input type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} />
            </label>
            <label className="article-full-row">
              <span>摘要</span>
              <textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder="用一两句话说明文章解决什么问题" />
            </label>
            <label className="article-full-row">
              <span>正文</span>
              <textarea className="article-content-textarea" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="纯文字正文，后续可接 GEO 静态发布" />
            </label>
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
