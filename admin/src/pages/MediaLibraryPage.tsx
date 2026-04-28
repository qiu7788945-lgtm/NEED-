import { useEffect, useState } from 'react';
import { mediaCategories, getMediaCategoryLabel } from '../constants/mediaCategories';
import { listImages, type AdminMediaFile, uploadImage } from '../api/media';

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
  const [filterCategory, setFilterCategory] = useState('');
  const [keyword, setKeyword] = useState('');
  const [latestImage, setLatestImage] = useState<AdminMediaFile | null>(null);
  const [status, setStatus] = useState('\u8bf7\u9009\u62e9\u4e00\u5f20 jpg\u3001jpeg\u3001png \u6216 webp \u56fe\u7247\u3002');
  const [isUploading, setIsUploading] = useState(false);

  async function refreshImages() {
    const nextImages = await listImages({ category: filterCategory, keyword });
    setImages(nextImages);
  }

  useEffect(() => {
    refreshImages().catch((error: Error) => {
      setStatus(error.message);
    });
  }, [filterCategory]);

  async function handleUpload() {
    if (!selectedFile) {
      setStatus('\u8bf7\u5148\u9009\u62e9\u56fe\u7247\u3002');
      return;
    }

    setIsUploading(true);
    setStatus('\u6b63\u5728\u4e0a\u4f20...');

    try {
      const uploaded = await uploadImage(selectedFile, uploadCategory);
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
          <select value={uploadCategory} onChange={(event) => setUploadCategory(event.target.value)}>
            {mediaCategories.filter((item) => item.value).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
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
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void refreshImages();
            }
          }}
          placeholder="Search file name"
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
              <span>{getMediaCategoryLabel(image.category)}</span>
              <input readOnly value={image.url} aria-label="image URL" />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
