import { useEffect, useState } from 'react';
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
  const [latestImage, setLatestImage] = useState<AdminMediaFile | null>(null);
  const [status, setStatus] = useState('\u8bf7\u9009\u62e9\u4e00\u5f20 jpg\u3001jpeg\u3001png \u6216 webp \u56fe\u7247\u3002');
  const [isUploading, setIsUploading] = useState(false);

  async function refreshImages() {
    const nextImages = await listImages();
    setImages(nextImages);
  }

  useEffect(() => {
    refreshImages().catch((error: Error) => {
      setStatus(error.message);
    });
  }, []);

  async function handleUpload() {
    if (!selectedFile) {
      setStatus('\u8bf7\u5148\u9009\u62e9\u56fe\u7247\u3002');
      return;
    }

    setIsUploading(true);
    setStatus('\u6b63\u5728\u4e0a\u4f20...');

    try {
      const uploaded = await uploadImage(selectedFile);
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
        <p>{'\u5148\u7528\u4e8e\u672c\u5730\u56fe\u7247\u4e0a\u4f20\uff0c\u540e\u7eed\u4f1a\u63a5\u5165\u817e\u8baf\u4e91 COS\u3001\u4f7f\u7528\u4f4d\u7f6e\u8ffd\u8e2a\u548c\u5a92\u4f53\u66ff\u6362\u3002'}</p>
      </div>

      <div className="media-upload-panel">
        <div>
          <label className="media-file-label" htmlFor="media-file">
            {'\u9009\u62e9\u56fe\u7247'}
          </label>
          <input
            id="media-file"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
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
            <img src={image.url} alt={image.originalName ?? image.fileName} />
            <div>
              <strong>{image.fileName}</strong>
              <span>{formatFileSize(image.size)} - {image.mimeType}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
