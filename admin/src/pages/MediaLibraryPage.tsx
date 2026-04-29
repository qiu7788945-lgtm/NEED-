import { useEffect, useState } from 'react';
import { archiveImage, deleteImage, listImages, restoreImage, type AdminMediaFile, uploadImage } from '../api/media';
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

  async function handleDelete(fileName: string) {
    const confirmed = window.confirm('永久删除后无法恢复，并会删除服务器上的真实文件。确认永久删除这张素材吗？');
    if (!confirmed) {
      return;
    }

    try {
      const result = await deleteImage(fileName);
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

  return (
    <div className="admin-media-page">
      <div className="admin-section-heading">
        <p className="admin-eyebrow">Media Library</p>
        <h1>媒体库</h1>
        <p>统一管理图片素材，支持上传、分类、搜索、归档、恢复与已归档素材永久删除。</p>
      </div>

      <div className="media-upload-panel">
        <div className="media-upload-header">
          <div>
            <h2>上传图片</h2>
            <p>默认只填写团队日常最常用的信息；归属和存储细节放在高级设置里。</p>
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
                <small>一般无需手动填写。</small>
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
                <small>用于场景解决方案素材归属。</small>
              </label>
              <label className="media-field">
                <span>所属项目/图组</span>
                <input value={uploadGroupKey} onChange={(event) => setUploadGroupKey(event.target.value)} placeholder="用于区分同一场景下不同项目图片" />
              </label>
              <label className="media-field">
                <span>图组位置</span>
                <input value={uploadSlotNo} onChange={(event) => setUploadSlotNo(event.target.value)} placeholder="例如某组图中的第 1 张、第 2 张；可少于 7 张" type="number" />
              </label>
              <label className="media-field">
                <span>内部备注 / description</span>
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

          return (
            <article className="media-card" key={image.fileName}>
              <img src={image.url} alt={image.alt || getMediaTitle(image)} />
              <div className="media-card-body">
                <div className="media-card-core">
                  <strong>{getMediaTitle(image)}</strong>
                  <div className="media-card-tags">
                    <span>{getMediaCategoryLabel(image.category)}</span>
                    <span>{image.status === 'archived' ? '已归档' : '正常'}</span>
                  </div>
                  {!image.alt ? <span className="media-warning">缺少 GEO 图片描述</span> : null}
                  {image.category === 'temporary' ? <span className="media-warning">临时素材，建议归类</span> : null}
                </div>

                <div className="media-card-summary">
                  <span>尺寸：{formatDimensions(image.width, image.height)}</span>
                  <span>大小：{formatFileSize(image.size)}</span>
                  <span>上传：{formatDateTime(image.createdAt)}</span>
                  <span>说明：{image.caption || '-'}</span>
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
                    <span>内部备注 / description：{image.description || '-'}</span>
                    <span>enabled 状态：{image.enabled ? '已启用' : '已停用'}</span>
                  </div>
                ) : null}

                <div className="media-card-actions">
                  {image.status === 'archived' ? (
                    <>
                      <button type="button" onClick={() => void handleRestore(image.fileName)}>
                        恢复
                      </button>
                      <button className="is-danger" type="button" onClick={() => void handleDelete(image.fileName)}>
                        永久删除
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => void handleArchive(image.fileName)}>
                      归档
                    </button>
                  )}
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
