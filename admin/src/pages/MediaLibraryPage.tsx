import { useEffect, useState } from 'react';
import { mediaCategories, mediaOwnerTypes, getMediaCategoryLabel } from '../constants/mediaCategories';
import { listImages, type AdminMediaFile, uploadImage } from '../api/media';

const ownerSlugOptions = [
  { value: '', label: '\u4e0d\u6307\u5b9a' },
  { value: 'family-day', label: '\u4f01\u4e1a\u5bb6\u5ead\u65e5/\u5f00\u653e\u65e5 family-day' },
  { value: 'salon', label: '\u5ba2\u6237\u7b54\u8c22&\u7cbe\u54c1\u6c99\u9f99 salon' },
  { value: 'annual', label: '\u5e74\u4f1a\u6d3b\u52a8\u4e0e\u4f01\u4e1a\u6587\u5316 annual' },
  { value: 'exhibition', label: '\u5546\u4e1a\u7f8e\u9648\u4e0e\u5c55\u89c8 exhibition' },
  { value: 'video', label: '\u89c6\u9891\u4e0e\u6570\u5b57\u8d44\u4ea7 video' },
  { value: 'forum', label: '\u5b66\u672f\u4e0e\u4e13\u4e1a\u8bba\u575b forum' },
  { value: 'other', label: '\u5176\u4ed6 other' },
];

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function MediaLibraryPage() {
  const [images, setImages] = useState<AdminMediaFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState('temporary');
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
  const [keyword, setKeyword] = useState('');
  const [latestImage, setLatestImage] = useState<AdminMediaFile | null>(null);
  const [status, setStatus] = useState('\u8bf7\u9009\u62e9\u4e00\u5f20 jpg\u3001jpeg\u3001png \u6216 webp \u56fe\u7247\u3002');
  const [isUploading, setIsUploading] = useState(false);

  async function refreshImages() {
    const nextImages = await listImages({
      category: filterCategory,
      ownerType: filterOwnerType,
      ownerSlug: filterOwnerSlug,
      groupKey: filterGroupKey,
      enabled: filterEnabled,
      keyword,
    });
    setImages(nextImages);
  }

  useEffect(() => {
    refreshImages().catch((error: Error) => {
      setStatus(error.message);
    });
  }, [filterCategory, filterOwnerType, filterEnabled]);

  async function handleUpload() {
    if (!selectedFile) {
      setStatus('\u8bf7\u5148\u9009\u62e9\u56fe\u7247\u3002');
      return;
    }

    setIsUploading(true);
    setStatus('\u6b63\u5728\u4e0a\u4f20...');

    try {
      const uploaded = await uploadImage(selectedFile, {
        category: uploadCategory,
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
      setStatus('\u4e0a\u4f20\u6210\u529f\u3002');
      setSelectedFile(null);
      await refreshImages();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '\u4e0a\u4f20\u5931\u8d25\u3002');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="admin-media-page">
      <div className="admin-section-heading">
        <p className="admin-eyebrow">Media Library</p>
        <h1>{'\u5a92\u4f53\u5e93'}</h1>
        <p>{'\u652f\u6301\u672c\u5730\u56fe\u7247\u4e0a\u4f20\u3001\u5206\u7c7b\u548c\u5173\u952e\u8bcd\u68c0\u7d22\uff0c\u5148\u4e3a\u9996\u9875\u4ea4\u4e92\u56fe\u548c\u540e\u7eed\u5185\u5bb9\u7ba1\u7406\u505a\u51c6\u5907\u3002'}</p>
      </div>

      <div className="media-upload-panel">
        <div className="media-upload-fields">
          <label className="media-file-label" htmlFor="media-file">
            {'\u9009\u62e9\u56fe\u7247'}
          </label>
          <input
            id="media-file"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
          <label className="media-field">
            <span>{'\u7d20\u6750\u5206\u7c7b'}</span>
            <select value={uploadCategory} onChange={(event) => setUploadCategory(event.target.value)}>
              {mediaCategories.filter((item) => item.value).map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="media-field">
            <span>{'\u5f52\u5c5e\u7c7b\u578b'}</span>
            <select value={uploadOwnerType} onChange={(event) => setUploadOwnerType(event.target.value)}>
              {mediaOwnerTypes.map((item) => (
                <option key={item.value || 'all'} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="media-field">
            <span>{'\u6240\u5c5e\u573a\u666f'}</span>
            <select value={uploadOwnerSlug} onChange={(event) => setUploadOwnerSlug(event.target.value)}>
              {ownerSlugOptions.map((item) => (
                <option key={item.value || 'none'} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="media-field">
            <span>{'\u6240\u5c5e\u9879\u76ee/\u56fe\u7ec4'}</span>
            <input value={uploadGroupKey} onChange={(event) => setUploadGroupKey(event.target.value)} placeholder="例如：hyundai-family-day-2025，用来区分同一场景下的不同项目图组" />
          </label>
          <label className="media-field">
            <span>{'\u56fe\u7ec4\u4f4d\u7f6e'}</span>
            <input value={uploadSlotNo} onChange={(event) => setUploadSlotNo(event.target.value)} placeholder="1-7，表示这组图中的展示位置；可少于7张" type="number" />
          </label>
          <label className="media-field">
            <span>{'\u5c55\u793a\u6392\u5e8f'}</span>
            <input value={uploadSortOrder} onChange={(event) => setUploadSortOrder(event.target.value)} placeholder="数字越小越靠前" type="number" />
          </label>
          <label className="media-field">
            <span>{'\u56fe\u7247\u66ff\u4ee3\u6587\u5b57/GEO\u63cf\u8ff0'}</span>
            <input value={uploadAlt} onChange={(event) => setUploadAlt(event.target.value)} placeholder="给搜索引擎看的图片说明，例如：企业家庭日亲子互动区" />
          </label>
          <label className="media-field">
            <span>{'\u56fe\u7247\u8bf4\u660e'}</span>
            <input value={uploadCaption} onChange={(event) => setUploadCaption(event.target.value)} placeholder="前台可展示的图片说明，例如：家庭日主视觉打卡区" />
          </label>
          <label className="media-field">
            <span>{'\u5185\u90e8\u5907\u6ce8'}</span>
            <input value={uploadDescription} onChange={(event) => setUploadDescription(event.target.value)} placeholder="仅后台内部备注" />
          </label>
          <label className="media-inline-check">
            <input type="checkbox" checked={uploadEnabled} onChange={(event) => setUploadEnabled(event.target.checked)} />
            <span>{'\u662f\u5426\u542f\u7528'}</span>
          </label>
          {selectedFile ? (
            <p className="media-selected-file">
              {selectedFile.name} - {formatFileSize(selectedFile.size)}
            </p>
          ) : null}
        </div>
        <button type="button" onClick={handleUpload} disabled={isUploading}>
          {isUploading ? '\u4e0a\u4f20\u4e2d' : '\u4e0a\u4f20'}
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
          <option value="">{'\u542f\u7528\u72b6\u6001'}</option>
          <option value="true">{'\u5df2\u542f\u7528'}</option>
          <option value="false">{'\u5df2\u7981\u7528'}</option>
        </select>
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void refreshImages();
            }
          }}
          placeholder="搜索文件名/说明"
        />
        <button type="button" onClick={refreshImages}>
          {'\u641c\u7d22'}
        </button>
      </div>

      <p className="media-status">{status}</p>

      {latestImage ? (
        <div className="media-latest">
          <img src={latestImage.url} alt={latestImage.originalName ?? latestImage.fileName} />
          <div>
            <h2>{'\u6700\u65b0\u4e0a\u4f20'}</h2>
            <p>{latestImage.fileName}</p>
            <input readOnly value={latestImage.url} aria-label="image URL" />
          </div>
        </div>
      ) : null}

      <div className="media-grid">
        {images.map((image) => (
          <article className="media-card" key={image.fileName}>
            <img src={image.url} alt={image.alt || image.originalName || image.fileName} />
            <div>
              <strong>{image.fileName}</strong>
              <span>{'\u5206\u7c7b'}：{getMediaCategoryLabel(image.category)}</span>
              <span>{'\u6240\u5c5e\u573a\u666f'}：{image.ownerSlug || '-'}</span>
              <span>{'\u9879\u76ee/\u56fe\u7ec4'}：{image.groupKey || '-'}</span>
              <span>{'\u4f4d\u7f6e'}：{image.slotNo ?? '-'}</span>
              <span>{'\u56fe\u7247\u8bf4\u660e'}：{image.caption || '-'}</span>
              <span>{'\u662f\u5426\u542f\u7528'}：{image.enabled ? '\u662f' : '\u5426'}</span>
              <input readOnly value={image.url} aria-label="image URL" />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
