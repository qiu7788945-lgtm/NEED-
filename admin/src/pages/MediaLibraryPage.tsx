import { useEffect, useMemo, useState } from 'react';
import {
  archiveImage,
  batchArchiveImages,
  batchDeleteImages,
  batchRestoreImages,
  deleteImage,
  listImages,
  restoreImage,
  updateImage,
  type AdminMediaFile,
  type BatchMediaResult,
  type MediaUpdateMetadata,
  uploadImage,
} from '../api/media';
import { getMediaCategoryLabel, mediaCategories, mediaOwnerTypes } from '../constants/mediaCategories';

const ownerSlugOptions = [
  { value: '', label: '不指定场景' },
  { value: 'family-day', label: '企业家庭日/开放日 family-day' },
  { value: 'salon', label: '客户答谢&精品沙龙 salon' },
  { value: 'annual', label: '年会活动与企业文化 annual' },
  { value: 'exhibition', label: '商业美陈与展览 exhibition' },
  { value: 'video', label: '视频与数字资产 video' },
  { value: 'forum', label: '学术与专业论坛 forum' },
  { value: 'other', label: '其他 other' },
];

const reasonLabels: Record<string, string> = {
  INVALID_MEDIA_FILE_NAME: '文件名不合法',
  MEDIA_FILE_NOT_FOUND: '素材不存在',
  MEDIA_NOT_ACTIVE: '不是正常素材',
  MEDIA_NOT_ARCHIVED: '不是已归档素材',
  MEDIA_OPERATION_FAILED: '操作失败',
  MEDIA_USED_BY_HOME: '正在被首页使用',
};

interface EditFormState {
  displayName: string;
  category: string;
  alt: string;
  caption: string;
  description: string;
  ownerType: string;
  ownerId: string;
  ownerSlug: string;
  groupKey: string;
  slotNo: string;
  sortOrder: string;
  enabled: boolean;
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

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

function formatDimensions(width: number | null, height: number | null) {
  if (!width || !height) {
    return '-';
  }

  return `${width} x ${height}`;
}

function getMediaTitle(image: AdminMediaFile) {
  return image.displayName || image.originalName || image.fileName;
}

function getOwnerTypeLabel(value: string) {
  return mediaOwnerTypes.find((item) => item.value === value)?.label ?? value;
}

function toEditForm(image: AdminMediaFile): EditFormState {
  return {
    displayName: image.displayName || '',
    category: image.category || 'temporary',
    alt: image.alt || '',
    caption: image.caption || '',
    description: image.description || '',
    ownerType: image.ownerType || '',
    ownerId: image.ownerId === null ? '' : String(image.ownerId),
    ownerSlug: image.ownerSlug || '',
    groupKey: image.groupKey || '',
    slotNo: image.slotNo === null ? '' : String(image.slotNo),
    sortOrder: String(image.sortOrder ?? 0),
    enabled: image.enabled,
  };
}

function toUpdateMetadata(form: EditFormState): MediaUpdateMetadata {
  return {
    displayName: form.displayName,
    category: form.category,
    alt: form.alt,
    caption: form.caption,
    description: form.description,
    ownerType: form.ownerType,
    ownerId: form.ownerId,
    ownerSlug: form.ownerSlug,
    groupKey: form.groupKey,
    slotNo: form.slotNo,
    sortOrder: form.sortOrder,
    enabled: form.enabled,
  };
}

function summarizeBatch(result: BatchMediaResult) {
  const details = result.results
    .filter((item) => item.status !== 'success')
    .slice(0, 5)
    .map((item) => `${item.fileName}: ${reasonLabels[item.reason ?? ''] ?? item.reason ?? '未知原因'}`)
    .join('；');

  return `完成：成功 ${result.success}，跳过 ${result.skipped}，失败 ${result.failed}${details ? `。${details}` : '。'}`;
}

export function MediaLibraryPage() {
  const [images, setImages] = useState<AdminMediaFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState('temporary');
  const [uploadDisplayName, setUploadDisplayName] = useState('');
  const [uploadStorageName, setUploadStorageName] = useState('');
  const [uploadAlt, setUploadAlt] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadOwnerType, setUploadOwnerType] = useState('');
  const [uploadOwnerSlug, setUploadOwnerSlug] = useState('');
  const [uploadGroupKey, setUploadGroupKey] = useState('');
  const [uploadSlotNo, setUploadSlotNo] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadEnabled, setUploadEnabled] = useState(true);
  const [uploadSortOrder, setUploadSortOrder] = useState('');
  const [showAdvancedUpload, setShowAdvancedUpload] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [editingFileName, setEditingFileName] = useState('');
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterOwnerType, setFilterOwnerType] = useState('');
  const [filterOwnerSlug, setFilterOwnerSlug] = useState('');
  const [filterGroupKey, setFilterGroupKey] = useState('');
  const [filterEnabled, setFilterEnabled] = useState('');
  const [filterStatus, setFilterStatus] = useState<'active' | 'archived' | 'all'>('active');
  const [keyword, setKeyword] = useState('');
  const [latestImage, setLatestImage] = useState<AdminMediaFile | null>(null);
  const [status, setStatus] = useState('请选择一张 jpg、jpeg、png 或 webp 图片。');
  const [isUploading, setIsUploading] = useState(false);

  const selectedImages = useMemo(
    () => images.filter((image) => selectedFileNames.includes(image.fileName)),
    [images, selectedFileNames],
  );
  const allCurrentPageSelected = images.length > 0 && images.every((image) => selectedFileNames.includes(image.fileName));

  async function refreshImages() {
    const nextImages = await listImages({
      category: filterCategory,
      ownerType: filterOwnerType,
      ownerSlug: filterOwnerSlug,
      groupKey: filterGroupKey,
      enabled: filterEnabled,
      status: filterStatus,
      keyword,
    });
    setImages(nextImages);
    setSelectedFileNames((current) => current.filter((fileName) => nextImages.some((image) => image.fileName === fileName)));
  }

  useEffect(() => {
    refreshImages().catch((error: Error) => {
      setStatus(error.message);
    });
  }, [filterCategory, filterOwnerType, filterOwnerSlug, filterGroupKey, filterEnabled, filterStatus]);

  async function handleArchive(fileName: string) {
    const confirmed = window.confirm('确认归档这张素材吗？归档后它默认不会出现在媒体选择器里，但文件不会被永久删除。');
    if (!confirmed) {
      return;
    }

    try {
      await archiveImage(fileName);
      setStatus('归档成功。');
      await refreshImages();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '归档失败，请稍后再试。');
    }
  }

  async function handleRestore(fileName: string) {
    try {
      await restoreImage(fileName);
      setStatus('恢复成功。');
      await refreshImages();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '恢复失败，请稍后再试。');
    }
  }

  async function handleDelete(image: AdminMediaFile) {
    if (image.usageCount > 0) {
      setStatus('这张素材正在被首页使用，不能永久删除。');
      return;
    }

    const confirmed = window.confirm('永久删除后无法恢复，并会删除服务器上的真实文件。确认永久删除这张素材吗？');
    if (!confirmed) {
      return;
    }

    try {
      const result = await deleteImage(image.fileName);
      setStatus(result.fileMissing ? '删除成功：素材记录已清理，真实文件此前已不存在。' : '永久删除成功。');
      await refreshImages();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '永久删除失败，请稍后再试。');
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      setStatus('请先选择图片。');
      return;
    }

    setIsUploading(true);
    setStatus('正在上传...');

    try {
      const uploaded = await uploadImage(selectedFile, {
        category: uploadCategory,
        displayName: uploadDisplayName,
        storageName: uploadStorageName,
        alt: uploadAlt,
        description: uploadDescription,
        ownerType: uploadOwnerType,
        ownerSlug: uploadOwnerSlug,
        groupKey: uploadGroupKey,
        slotNo: uploadSlotNo,
        caption: uploadCaption,
        enabled: uploadEnabled,
        sortOrder: uploadSortOrder,
      });
      setLatestImage(uploaded);
      setStatus('上传成功。');
      setSelectedFile(null);
      setUploadDisplayName('');
      setUploadStorageName('');
      setUploadAlt('');
      setUploadDescription('');
      setUploadOwnerType('');
      setUploadOwnerSlug('');
      setUploadGroupKey('');
      setUploadSlotNo('');
      setUploadCaption('');
      setUploadEnabled(true);
      setUploadSortOrder('');
      await refreshImages();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '上传失败，请检查图片格式和大小。');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCopyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('图片链接已复制。');
    } catch {
      setStatus('复制失败，请手动复制详细信息里的图片 URL。');
    }
  }

  function toggleDetails(fileName: string) {
    setExpandedDetails((current) => ({
      ...current,
      [fileName]: !current[fileName],
    }));
  }

  function startEdit(image: AdminMediaFile) {
    setEditingFileName(image.fileName);
    setEditForm(toEditForm(image));
    setExpandedDetails((current) => ({
      ...current,
      [image.fileName]: true,
    }));
  }

  async function handleSaveEdit() {
    if (!editForm || !editingFileName) {
      return;
    }

    try {
      await updateImage(editingFileName, toUpdateMetadata(editForm));
      setStatus('素材信息已保存。');
      setEditingFileName('');
      setEditForm(null);
      await refreshImages();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '保存失败，请稍后再试。');
    }
  }

  function toggleSelected(fileName: string, checked: boolean) {
    setSelectedFileNames((current) => (
      checked ? Array.from(new Set([...current, fileName])) : current.filter((item) => item !== fileName)
    ));
  }

  function selectCurrentPage() {
    setSelectedFileNames((current) => Array.from(new Set([...current, ...images.map((image) => image.fileName)])));
  }

  function clearSelection() {
    setSelectedFileNames([]);
  }

  async function runBatch(label: string, action: (fileNames: string[]) => Promise<BatchMediaResult>) {
    if (selectedFileNames.length === 0) {
      setStatus('请先选择素材。');
      return;
    }

    const confirmed = window.confirm(`确认${label}已选择的 ${selectedFileNames.length} 个素材吗？`);
    if (!confirmed) {
      return;
    }

    try {
      const result = await action(selectedFileNames);
      setStatus(summarizeBatch(result));
      await refreshImages();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `${label}失败，请稍后再试。`);
    }
  }

  function updateEditForm(nextValues: Partial<EditFormState>) {
    setEditForm((current) => (current ? { ...current, ...nextValues } : current));
  }

  return (
    <div className="admin-media-page">
      <div className="admin-section-heading">
        <p className="admin-eyebrow">Media Library</p>
        <h1>媒体库</h1>
        <p>统一管理图片素材，支持上传、分类、搜索、信息维护、使用位置查看、归档、恢复与已归档素材永久删除。</p>
      </div>

      <div className="media-upload-panel">
        <div className="media-upload-header">
          <div>
            <h2>上传图片</h2>
            <p>日常只填写素材名称、分类、排序和图片说明；归属和存储细节放在高级设置里。</p>
          </div>
          <button type="button" onClick={handleUpload} disabled={isUploading}>
            {isUploading ? '上传中' : '上传'}
          </button>
        </div>

        <div className="media-upload-fields">
          <label className="media-file-label" htmlFor="media-file">
            选择图片
          </label>
          <input
            id="media-file"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
          <label className="media-field">
            <span>素材名称</span>
            <input
              value={uploadDisplayName}
              onChange={(event) => setUploadDisplayName(event.target.value)}
              placeholder="后台里给自己看的名字，例如：家庭日主视觉打卡区"
            />
          </label>
          <label className="media-field">
            <span>素材分类</span>
            <select value={uploadCategory} onChange={(event) => setUploadCategory(event.target.value)}>
              {mediaCategories.filter((item) => item.value).map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="media-field">
            <span>展示排序</span>
            <input value={uploadSortOrder} onChange={(event) => setUploadSortOrder(event.target.value)} placeholder="数字越小越靠前" type="number" />
          </label>
          <label className="media-field">
            <span>图片替代文字/GEO描述</span>
            <input value={uploadAlt} onChange={(event) => setUploadAlt(event.target.value)} placeholder="给搜索引擎看的图片说明" />
          </label>
          <label className="media-field">
            <span>图片说明</span>
            <input value={uploadCaption} onChange={(event) => setUploadCaption(event.target.value)} placeholder="前台或团队可读的图片说明" />
          </label>
          {selectedFile ? (
            <p className="media-selected-file">
              已选择：{selectedFile.name}，{formatFileSize(selectedFile.size)}
            </p>
          ) : null}
        </div>

        <div className="media-advanced-panel">
          <button className="media-secondary-button" type="button" onClick={() => setShowAdvancedUpload((value) => !value)}>
            {showAdvancedUpload ? '收起高级设置' : '展开高级设置'}
          </button>

          {showAdvancedUpload ? (
            <div className="media-upload-fields media-upload-advanced">
              <label className="media-field">
                <span>存储文件名</span>
                <input
                  value={uploadStorageName}
                  onChange={(event) => setUploadStorageName(event.target.value)}
                  placeholder="可选，不填则系统自动生成；只允许英文、数字、短横线、下划线"
                />
              </label>
              <label className="media-field">
                <span>归属类型</span>
                <select value={uploadOwnerType} onChange={(event) => setUploadOwnerType(event.target.value)}>
                  {mediaOwnerTypes.map((item) => (
                    <option key={item.value || 'all'} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="media-field">
                <span>所属场景</span>
                <select value={uploadOwnerSlug} onChange={(event) => setUploadOwnerSlug(event.target.value)}>
                  {ownerSlugOptions.map((item) => (
                    <option key={item.value || 'none'} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="media-field">
                <span>所属项目/图组</span>
                <input value={uploadGroupKey} onChange={(event) => setUploadGroupKey(event.target.value)} placeholder="用于区分同一场景下不同项目的图组" />
              </label>
              <label className="media-field">
                <span>图组位置</span>
                <input value={uploadSlotNo} onChange={(event) => setUploadSlotNo(event.target.value)} placeholder="例如第 1 张、第 2 张" type="number" />
              </label>
              <label className="media-field">
                <span>内部备注</span>
                <input value={uploadDescription} onChange={(event) => setUploadDescription(event.target.value)} placeholder="仅后台内部备注" />
              </label>
              <label className="media-inline-check">
                <input type="checkbox" checked={uploadEnabled} onChange={(event) => setUploadEnabled(event.target.checked)} />
                <span>是否启用，默认启用</span>
              </label>
            </div>
          ) : null}
        </div>
      </div>

      <div className="media-filter-panel">
        <label>
          <span>分类</span>
          <select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}>
            {mediaCategories.map((item) => (
              <option key={item.value || 'all'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>归属类型</span>
          <select value={filterOwnerType} onChange={(event) => setFilterOwnerType(event.target.value)}>
            {mediaOwnerTypes.map((item) => (
              <option key={item.value || 'all'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>所属场景</span>
          <select value={filterOwnerSlug} onChange={(event) => setFilterOwnerSlug(event.target.value)}>
            {ownerSlugOptions.map((item) => (
              <option key={item.value || 'none'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>所属项目/图组</span>
          <input value={filterGroupKey} onChange={(event) => setFilterGroupKey(event.target.value)} placeholder="项目或图组 key" />
        </label>
        <label>
          <span>启用状态</span>
          <select value={filterEnabled} onChange={(event) => setFilterEnabled(event.target.value)}>
            <option value="">全部启用状态</option>
            <option value="true">已启用</option>
            <option value="false">已停用</option>
          </select>
        </label>
        <label>
          <span>素材状态</span>
          <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as 'active' | 'archived' | 'all')}>
            <option value="active">正常素材</option>
            <option value="archived">已归档</option>
            <option value="all">全部素材</option>
          </select>
        </label>
        <label className="media-filter-search">
          <span>搜索</span>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void refreshImages();
              }
            }}
            placeholder="搜索素材名称、文件名、图片说明"
          />
        </label>
        <button type="button" onClick={refreshImages}>
          搜索
        </button>
      </div>

      <div className="media-batch-toolbar">
        <div>
          <strong>已选择 {selectedFileNames.length} 个素材</strong>
          <span>正常 {selectedImages.filter((image) => image.status === 'active').length}，已归档 {selectedImages.filter((image) => image.status === 'archived').length}</span>
        </div>
        <div className="media-batch-actions">
          <button type="button" onClick={allCurrentPageSelected ? clearSelection : selectCurrentPage}>
            {allCurrentPageSelected ? '取消选择' : '全选当前页'}
          </button>
          <button type="button" onClick={() => void runBatch('批量归档', batchArchiveImages)}>
            批量归档
          </button>
          <button type="button" onClick={() => void runBatch('批量恢复', batchRestoreImages)}>
            批量恢复
          </button>
          <button className="is-danger" type="button" onClick={() => void runBatch('批量永久删除', batchDeleteImages)}>
            批量永久删除
          </button>
        </div>
      </div>

      <p className="media-status">{status}</p>

      {latestImage ? (
        <div className="media-latest">
          <img src={latestImage.url} alt={latestImage.alt || getMediaTitle(latestImage)} />
          <div>
            <h2>最新上传</h2>
            <p>{getMediaTitle(latestImage)}</p>
            <input readOnly value={latestImage.url} aria-label="image URL" />
          </div>
        </div>
      ) : null}

      <div className="media-grid">
        {images.map((image) => {
          const isExpanded = Boolean(expandedDetails[image.fileName]);
          const isEditing = editingFileName === image.fileName && editForm;

          return (
            <article className="media-card" key={image.fileName}>
              <label className="media-card-select">
                <input
                  type="checkbox"
                  checked={selectedFileNames.includes(image.fileName)}
                  onChange={(event) => toggleSelected(image.fileName, event.target.checked)}
                />
                <span>选择</span>
              </label>
              <img src={image.url} alt={image.alt || getMediaTitle(image)} />
              <div className="media-card-body">
                <div className="media-card-core">
                  <strong>{getMediaTitle(image)}</strong>
                  <div className="media-card-tags">
                    <span>{getMediaCategoryLabel(image.category)}</span>
                    <span>{image.status === 'archived' ? '已归档' : '正常'}</span>
                    <span>{image.enabled ? '已启用' : '已停用'}</span>
                  </div>
                  {!image.alt ? <span className="media-warning">缺少 GEO 图片描述</span> : null}
                  {image.category === 'temporary' ? <span className="media-warning">临时素材，建议归类</span> : null}
                </div>

                <div className="media-card-summary">
                  <span>尺寸：{formatDimensions(image.width, image.height)}</span>
                  <span>大小：{formatFileSize(image.size)}</span>
                  <span>上传：{formatDateTime(image.createdAt)}</span>
                  <span>说明：{image.caption || '-'}</span>
                  <span className={image.usageCount > 0 ? 'media-usage-active' : undefined}>
                    {image.usageCount > 0 ? `使用中：${image.usageCount} 处` : '未被使用'}
                  </span>
                </div>

                {isExpanded ? (
                  <div className="media-card-details">
                    <span>原始文件名：{image.originalName || '-'}</span>
                    <span>存储文件名：{image.fileName}</span>
                    <span>图片 URL：{image.url}</span>
                    <span>归属类型：{image.ownerType ? getOwnerTypeLabel(image.ownerType) : '-'}</span>
                    <span>所属场景：{image.ownerSlug || '-'}</span>
                    <span>所属项目/图组：{image.groupKey || '-'}</span>
                    <span>图组位置：{image.slotNo ?? '-'}</span>
                    <span>内部备注：{image.description || '-'}</span>
                    <span>展示排序：{image.sortOrder}</span>
                    {image.usages.length > 0 ? (
                      <div className="media-usage-list">
                        <strong>使用位置</strong>
                        {image.usages.map((usage, index) => (
                          <span key={`${usage.type}-${usage.detail}-${index}`}>{usage.label}：{usage.detail}</span>
                        ))}
                      </div>
                    ) : (
                      <span>使用位置：未被使用</span>
                    )}
                  </div>
                ) : null}

                {isEditing ? (
                  <div className="media-edit-form">
                    <label className="media-field">
                      <span>素材名称</span>
                      <input value={editForm.displayName} onChange={(event) => updateEditForm({ displayName: event.target.value })} />
                    </label>
                    <label className="media-field">
                      <span>素材分类</span>
                      <select value={editForm.category} onChange={(event) => updateEditForm({ category: event.target.value })}>
                        {mediaCategories.filter((item) => item.value).map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="media-field">
                      <span>图片替代文字/GEO描述</span>
                      <input value={editForm.alt} onChange={(event) => updateEditForm({ alt: event.target.value })} />
                    </label>
                    <label className="media-field">
                      <span>图片说明</span>
                      <input value={editForm.caption} onChange={(event) => updateEditForm({ caption: event.target.value })} />
                    </label>
                    <label className="media-field">
                      <span>内部备注</span>
                      <textarea value={editForm.description} onChange={(event) => updateEditForm({ description: event.target.value })} />
                    </label>
                    <label className="media-field">
                      <span>归属类型</span>
                      <select value={editForm.ownerType} onChange={(event) => updateEditForm({ ownerType: event.target.value })}>
                        {mediaOwnerTypes.map((item) => (
                          <option key={item.value || 'all'} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="media-field">
                      <span>归属 ID</span>
                      <input value={editForm.ownerId} type="number" onChange={(event) => updateEditForm({ ownerId: event.target.value })} />
                    </label>
                    <label className="media-field">
                      <span>所属场景</span>
                      <select value={editForm.ownerSlug} onChange={(event) => updateEditForm({ ownerSlug: event.target.value })}>
                        {ownerSlugOptions.map((item) => (
                          <option key={item.value || 'none'} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="media-field">
                      <span>所属项目/图组</span>
                      <input value={editForm.groupKey} onChange={(event) => updateEditForm({ groupKey: event.target.value })} />
                    </label>
                    <label className="media-field">
                      <span>图组位置</span>
                      <input value={editForm.slotNo} type="number" onChange={(event) => updateEditForm({ slotNo: event.target.value })} />
                    </label>
                    <label className="media-field">
                      <span>展示排序</span>
                      <input value={editForm.sortOrder} type="number" onChange={(event) => updateEditForm({ sortOrder: event.target.value })} />
                    </label>
                    <label className="media-inline-check">
                      <input type="checkbox" checked={editForm.enabled} onChange={(event) => updateEditForm({ enabled: event.target.checked })} />
                      <span>是否启用</span>
                    </label>
                    <div className="media-card-actions">
                      <button type="button" onClick={() => void handleSaveEdit()}>
                        保存信息
                      </button>
                      <button className="media-secondary-button" type="button" onClick={() => { setEditingFileName(''); setEditForm(null); }}>
                        取消编辑
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="media-card-actions">
                  {image.status === 'archived' ? (
                    <>
                      <button type="button" onClick={() => void handleRestore(image.fileName)}>
                        恢复
                      </button>
                      <button className="is-danger" type="button" onClick={() => void handleDelete(image)}>
                        永久删除
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => void handleArchive(image.fileName)}>
                      归档
                    </button>
                  )}
                  <button type="button" onClick={() => startEdit(image)}>
                    编辑信息
                  </button>
                  <button type="button" onClick={() => void handleCopyLink(image.url)}>
                    复制链接
                  </button>
                  <button className="media-secondary-button" type="button" onClick={() => toggleDetails(image.fileName)}>
                    {isExpanded ? '收起详细信息' : '查看详细信息'}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
