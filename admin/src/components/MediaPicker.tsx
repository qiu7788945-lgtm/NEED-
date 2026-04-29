import { useEffect, useState } from 'react';
import { mediaCategories, mediaOwnerTypes, getMediaCategoryLabel } from '../constants/mediaCategories';
import { listImages, type AdminMediaFile } from '../api/media';

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

interface MediaPickerProps {
  defaultCategory?: string;
  defaultOwnerType?: string;
  defaultOwnerSlug?: string;
  defaultGroupKey?: string;
  allowVideo?: boolean;
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
  allowVideo = false,
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
    setStatus('正在加载媒体...');
    try {
      const nextImages = await listImages({ category, ownerType, ownerSlug, groupKey, keyword, status: 'active', fileType: allowVideo ? undefined : 'image' });
      setImages(nextImages);
      setStatus(nextImages.length ? '' : '没有找到匹配图片。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '加载失败。');
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
        选择图片
      </button>

      {isOpen ? (
        <div className="media-picker-overlay" role="dialog" aria-modal="true">
          <div className="media-picker-modal">
            <div className="media-picker-header">
              <div>
                <p className="admin-eyebrow">Media Picker</p>
                <h2>选择图片</h2>
              </div>
              <button type="button" onClick={() => setIsOpen(false)}>
                关闭
              </button>
            </div>

            <div className="media-picker-filters">
              <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="素材分类">
                {mediaCategories.map((item) => (
                  <option key={item.value || 'all'} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select value={ownerType} onChange={(event) => setOwnerType(event.target.value)} aria-label="归属类型">
                {mediaOwnerTypes.map((item) => (
                  <option key={item.value || 'all'} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select value={ownerSlug} onChange={(event) => setOwnerSlug(event.target.value)} aria-label="所属场景">
                {ownerSlugOptions.map((item) => (
                  <option key={item.value || 'none'} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input
                value={groupKey}
                onChange={(event) => setGroupKey(event.target.value)}
                placeholder="所属项目/图组"
              />
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
              <button type="button" onClick={refreshImages}>
                搜索
              </button>
            </div>

            {status ? <p className="media-status">{status}</p> : null}

            <div className="media-picker-grid">
              {images.map((image) => (
                <button type="button" className="media-picker-card" key={image.fileName} onClick={() => handleSelect(image)}>
                  {image.fileType === 'video' ? (
                    <video src={image.url} preload="metadata" />
                  ) : (
                    <img src={image.url} alt={image.alt || getMediaTitle(image)} />
                  )}
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
