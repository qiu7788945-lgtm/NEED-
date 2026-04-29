import { useEffect, useState } from 'react';
import { mediaCategories, mediaOwnerTypes, getMediaCategoryLabel } from '../constants/mediaCategories';
import { archiveImage, deleteImage, listImages, restoreImage, type AdminMediaFile, uploadImage } from '../api/media';

const ownerSlugOptions = [
  { value: '', label: '不指定' },
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
  }, [filterCategory, filterOwnerType, filterEnabled, filterStatus]);

  async function handleArchive(fileName: string) {
    const confirmed = window.confirm('确认归档这张图片吗？归档后默认不会出现在媒体选择器里，但文件不会被物理删除。');
    if (!confirmed) {
      return;
    }

    try {
      await archiveImage(fileName);
      setStatus('归档成功。');
      await refreshImages();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '归档失败。');
    }
  }

  async function handleRestore(fileName: string) {
    try {
      await restoreImage(fileName);
      setStatus('恢复成功。');
      await refreshImages();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '恢复失败。');
    }
  }

  async function handleDelete(fileName: string) {
    const confirmed = window.confirm('永久删除后无法恢复，并会删除服务器上的真实文件。确认永久删除这张图片吗？');
    if (!confirmed) {
      return;
    }

    try {
      const result = await deleteImage(fileName);
      setStatus(result.fileMissing ? '删除成功：索引已清理，真实文件此前已不存在。' : '永久删除成功。');
      await refreshImages();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '永久删除失败。');
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
      await refreshImages();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '上传失败。');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="admin-media-page">
      <div className="admin-section-heading">
        <p className="admin-eyebrow">Media Library</p>
        <h1>媒体库</h1>
        <p>支持本地图片上传、分层归属、搜索、归档与已归档素材永久删除。</p>
      </div>

      <div className="media-upload-panel">
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
              placeholder="给自己看的名字，例如：家庭日主视觉打卡区"
            />
          </label>
          <label className="media-field">
            <span>存储文件名</span>
            <input
              value={uploadStorageName}
              onChange={(event) => setUploadStorageName(event.target.value)}
              placeholder="可选，例如 family-day-main-visual-01；不填则系统自动生成"
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
            <input value={uploadGroupKey} onChange={(event) => setUploadGroupKey(event.target.value)} placeholder="例如 hyundai-family-day-2025" />
          </label>
          <label className="media-field">
            <span>图组位置</span>
            <input value={uploadSlotNo} onChange={(event) => setUploadSlotNo(event.target.value)} placeholder="1-7" type="number" />
          </label>
          <label className="media-field">
            <span>展示排序</span>
            <input value={uploadSortOrder} onChange={(event) => setUploadSortOrder(event.target.value)} placeholder="数字越小越靠前" type="number" />
          </label>
          <label className="media-field">
            <span>图片替代文字/GEO 描述</span>
            <input value={uploadAlt} onChange={(event) => setUploadAlt(event.target.value)} placeholder="给搜索引擎看的图片说明" />
          </label>
          <label className="media-field">
            <span>图片说明</span>
            <input value={uploadCaption} onChange={(event) => setUploadCaption(event.target.value)} placeholder="前台可展示的图片说明" />
          </label>
          <label className="media-field">
            <span>内部备注</span>
            <input value={uploadDescription} onChange={(event) => setUploadDescription(event.target.value)} placeholder="仅后台内部备注" />
          </label>
          <label className="media-inline-check">
            <input type="checkbox" checked={uploadEnabled} onChange={(event) => setUploadEnabled(event.target.checked)} />
            <span>是否启用</span>
          </label>
          {selectedFile ? (
            <p className="media-selected-file">
              {selectedFile.name} - {formatFileSize(selectedFile.size)}
            </p>
          ) : null}
        </div>
        <button type="button" onClick={handleUpload} disabled={isUploading}>
          {isUploading ? '上传中' : '上传'}
        </button>
      </div>

      <div className="media-filter-panel">
        <select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}>
          {mediaCategories.map((item) => (
            <option key={item.value || 'all'} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <select value={filterOwnerType} onChange={(event) => setFilterOwnerType(event.target.value)}>
          {mediaOwnerTypes.map((item) => (
            <option key={item.value || 'all'} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <select value={filterOwnerSlug} onChange={(event) => setFilterOwnerSlug(event.target.value)}>
          {ownerSlugOptions.map((item) => (
            <option key={item.value || 'none'} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <input value={filterGroupKey} onChange={(event) => setFilterGroupKey(event.target.value)} placeholder="所属项目/图组" />
        <select value={filterEnabled} onChange={(event) => setFilterEnabled(event.target.value)}>
          <option value="">启用状态</option>
          <option value="true">已启用</option>
          <option value="false">已禁用</option>
        </select>
        <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as 'active' | 'archived' | 'all')}>
          <option value="active">正常素材</option>
          <option value="archived">已归档</option>
          <option value="all">全部素材</option>
        </select>
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void refreshImages();
            }
          }}
          placeholder="搜索素材名/文件名/说明"
        />
        <button type="button" onClick={refreshImages}>
          搜索
        </button>
      </div>

      <p className="media-status">{status}</p>

      {latestImage ? (
        <div className="media-latest">
          <img src={latestImage.url} alt={latestImage.originalName ?? latestImage.fileName} />
          <div>
            <h2>最新上传</h2>
            <p>{latestImage.displayName || latestImage.originalName || latestImage.fileName}</p>
            <input readOnly value={latestImage.url} aria-label="image URL" />
          </div>
        </div>
      ) : null}

      <div className="media-grid">
        {images.map((image) => (
          <article className="media-card" key={image.fileName}>
            <img src={image.url} alt={image.alt || image.originalName || image.fileName} />
            <div>
              <strong>{image.displayName || image.originalName || image.fileName}</strong>
              {!image.alt ? <span className="media-warning">缺少 GEO 图片描述</span> : null}
              {image.category === 'temporary' ? <span className="media-warning">临时素材，建议归类</span> : null}
              <span>素材名称：{image.displayName || '-'}</span>
              <span>原始文件名：{image.originalName || '-'}</span>
              <span>存储文件名：{image.fileName}</span>
              <span>图片尺寸：{formatDimensions(image.width, image.height)}</span>
              <span>文件大小：{formatFileSize(image.size)}</span>
              <span>上传时间：{formatDateTime(image.createdAt)}</span>
              <span>分类：{getMediaCategoryLabel(image.category)}</span>
              <span>所属场景：{image.ownerSlug || '-'}</span>
              <span>项目/图组：{image.groupKey || '-'}</span>
              <span>图组位置：{image.slotNo ?? '-'}</span>
              <span>图片说明：{image.caption || '-'}</span>
              <span>alt/GEO 描述：{image.alt || '-'}</span>
              <span>是否启用：{image.enabled ? '是' : '否'}</span>
              <span>状态：{image.status === 'archived' ? '已归档' : '正常'}</span>
              <input readOnly value={image.url} aria-label="image URL" />
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
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
