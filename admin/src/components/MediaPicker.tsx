import { useEffect, useState } from 'react';
import { mediaCategories, mediaOwnerTypes, getMediaCategoryLabel } from '../constants/mediaCategories';
import { listImages, type AdminMediaFile } from '../api/media';

const ownerSlugOptions = [
  { value: '', label: '\u4e0d\u6307\u5b9a\u573a\u666f' },
  { value: 'family-day', label: '\u4f01\u4e1a\u5bb6\u5ead\u65e5/\u5f00\u653e\u65e5 family-day' },
  { value: 'salon', label: '\u5ba2\u6237\u7b54\u8c22&\u7cbe\u54c1\u6c99\u9f99 salon' },
  { value: 'annual', label: '\u5e74\u4f1a\u6d3b\u52a8\u4e0e\u4f01\u4e1a\u6587\u5316 annual' },
  { value: 'exhibition', label: '\u5546\u4e1a\u7f8e\u9648\u4e0e\u5c55\u89c8 exhibition' },
  { value: 'video', label: '\u89c6\u9891\u4e0e\u6570\u5b57\u8d44\u4ea7 video' },
  { value: 'forum', label: '\u5b66\u672f\u4e0e\u4e13\u4e1a\u8bba\u575b forum' },
  { value: 'other', label: '\u5176\u4ed6 other' },
];

interface MediaPickerProps {
  defaultCategory?: string;
  defaultOwnerType?: string;
  defaultOwnerSlug?: string;
  defaultGroupKey?: string;
  onSelect: (image: AdminMediaFile) => void;
}

function getMediaTitle(image: AdminMediaFile) {
  return image.displayName || image.originalName || image.fileName;
}

export function MediaPicker({
  defaultCategory = '',
  defaultOwnerType = '',
  defaultOwnerSlug = '',
  defaultGroupKey = '',
  onSelect,
}: MediaPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [images, setImages] = useState<AdminMediaFile[]>([]);
  const [category, setCategory] = useState(defaultCategory);
  const [ownerType, setOwnerType] = useState(defaultOwnerType);
  const [ownerSlug, setOwnerSlug] = useState(defaultOwnerSlug);
  const [groupKey, setGroupKey] = useState(defaultGroupKey);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');

  async function refreshImages() {
    setStatus('\u6b63\u5728\u52a0\u8f7d\u5a92\u4f53...');
    try {
      const nextImages = await listImages({ category, ownerType, ownerSlug, groupKey, keyword, status: 'active' });
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
  }, [isOpen, category, ownerType, ownerSlug, groupKey]);

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
              <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="\u7d20\u6750\u5206\u7c7b">
                {mediaCategories.map((item) => (
                  <option key={item.value || 'all'} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select value={ownerType} onChange={(event) => setOwnerType(event.target.value)} aria-label="\u5f52\u5c5e\u7c7b\u578b">
                {mediaOwnerTypes.map((item) => (
                  <option key={item.value || 'all'} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select value={ownerSlug} onChange={(event) => setOwnerSlug(event.target.value)} aria-label="\u6240\u5c5e\u573a\u666f">
                {ownerSlugOptions.map((item) => (
                  <option key={item.value || 'none'} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input
                value={groupKey}
                onChange={(event) => setGroupKey(event.target.value)}
                placeholder="\u6240\u5c5e\u9879\u76ee/\u56fe\u7ec4"
              />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void refreshImages();
                  }
                }}
                placeholder="\u641c\u7d22\u7d20\u6750\u540d\u79f0\u3001\u6587\u4ef6\u540d\u3001\u56fe\u7247\u8bf4\u660e"
              />
              <button type="button" onClick={refreshImages}>
                {'\u641c\u7d22'}
              </button>
            </div>

            {status ? <p className="media-status">{status}</p> : null}

            <div className="media-picker-grid">
              {images.map((image) => (
                <button type="button" className="media-picker-card" key={image.fileName} onClick={() => handleSelect(image)}>
                  <img src={image.url} alt={image.alt || getMediaTitle(image)} />
                  <strong>{getMediaTitle(image)}</strong>
                  <span>{getMediaCategoryLabel(image.category)}</span>
                  <span>{image.ownerSlug || '-'}</span>
                  <span>{image.groupKey || '-'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
