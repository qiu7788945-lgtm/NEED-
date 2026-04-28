import { useEffect, useState } from 'react';
import { mediaCategories, getMediaCategoryLabel } from '../constants/mediaCategories';
import { listImages, type AdminMediaFile } from '../api/media';

interface MediaPickerProps {
  defaultCategory?: string;
  onSelect: (image: AdminMediaFile) => void;
}

export function MediaPicker({ defaultCategory = '', onSelect }: MediaPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [images, setImages] = useState<AdminMediaFile[]>([]);
  const [category, setCategory] = useState(defaultCategory);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');

  async function refreshImages() {
    setStatus('\u6b63\u5728\u52a0\u8f7d\u5a92\u4f53...');
    try {
      const nextImages = await listImages({ category, keyword });
      setImages(nextImages);
      setStatus(nextImages.length ? '' : '\u6ca1\u6709\u627e\u5230\u5339\u914d\u56fe\u7247\u3002');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '\u52a0\u8f7d\u5931\u8d25\u3002');
    }
  }

  useEffect(() => {
    if (isOpen) {
      void refreshImages();
    }
  }, [isOpen, category]);

  function handleSelect(image: AdminMediaFile) {
    onSelect(image);
    setIsOpen(false);
  }

  return (
    <>
      <button className="media-picker-trigger" type="button" onClick={() => setIsOpen(true)}>
        {'\u9009\u62e9\u56fe\u7247'}
      </button>

      {isOpen ? (
        <div className="media-picker-overlay" role="dialog" aria-modal="true">
          <div className="media-picker-modal">
            <div className="media-picker-header">
              <div>
                <p className="admin-eyebrow">Media Picker</p>
                <h2>{'\u9009\u62e9\u56fe\u7247'}</h2>
              </div>
              <button type="button" onClick={() => setIsOpen(false)}>
                {'\u5173\u95ed'}
              </button>
            </div>

            <div className="media-picker-filters">
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
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

            {status ? <p className="media-status">{status}</p> : null}

            <div className="media-picker-grid">
              {images.map((image) => (
                <button type="button" className="media-picker-card" key={image.fileName} onClick={() => handleSelect(image)}>
                  <img src={image.url} alt={image.alt || image.originalName || image.fileName} />
                  <strong>{image.fileName}</strong>
                  <span>{getMediaCategoryLabel(image.category)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
