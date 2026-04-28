import { useEffect, useState } from 'react';
import type { HomeInteractiveImageSlot } from '../../../shared/types/home';
import { getHomeInteractiveImages, saveHomeInteractiveImages } from '../api/home';
import { listImages, type AdminMediaFile } from '../api/media';

function toAbsoluteUrl(url: string) {
  if (!url) {
    return '';
  }

  if (url.startsWith('http')) {
    return url;
  }

  return `http://localhost:4000${url}`;
}

export function HomeManagementPage() {
  const [slots, setSlots] = useState<HomeInteractiveImageSlot[]>([]);
  const [images, setImages] = useState<AdminMediaFile[]>([]);
  const [status, setStatus] = useState('\u6b63\u5728\u52a0\u8f7d\u9996\u9875\u914d\u7f6e...');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    Promise.all([getHomeInteractiveImages(), listImages()])
      .then(([nextSlots, nextImages]) => {
        setSlots(nextSlots);
        setImages(nextImages);
        setStatus('\u5df2\u52a0\u8f7d 12 \u4e2a\u56fe\u7247\u69fd\u4f4d\u3002');
      })
      .catch((error: Error) => {
        setStatus(error.message);
      });
  }, []);

  function updateSlot(slotNo: number, patch: Partial<HomeInteractiveImageSlot>) {
    setSlots((currentSlots) => currentSlots.map((slot) => (
      slot.slotNo === slotNo ? { ...slot, ...patch } : slot
    )));
  }

  function bindImage(slotNo: number, fileName: string) {
    const image = images.find((item) => item.fileName === fileName);

    if (!image) {
      updateSlot(slotNo, {
        mediaUrl: '',
        mediaFileName: '',
      });
      return;
    }

    updateSlot(slotNo, {
      mediaUrl: image.url.replace('http://localhost:4000', ''),
      mediaFileName: image.fileName,
    });
  }

  async function handleSave() {
    setIsSaving(true);
    setStatus('\u6b63\u5728\u4fdd\u5b58...');

    try {
      const savedSlots = await saveHomeInteractiveImages(slots);
      setSlots(savedSlots);
      setStatus('\u4fdd\u5b58\u6210\u529f\uff0c\u5237\u65b0\u540e\u4ecd\u4f1a\u4fdd\u7559\u914d\u7f6e\u3002');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '\u4fdd\u5b58\u5931\u8d25\u3002');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="admin-home-page">
      <div className="admin-section-heading">
        <p className="admin-eyebrow">Home Management</p>
        <h1>{'\u9996\u9875\u7ba1\u7406'}</h1>
        <p>{'\u7ba1\u7406\u9996\u9875\u201c\u521b\u610f / \u6848\u4f8b / \u73b0\u573a\u201d\u4ea4\u4e92\u56fe\u7247\u5e8f\u5217\u7684 12 \u4e2a\u56fa\u5b9a\u69fd\u4f4d\u3002\u672c\u8f6e\u53ea\u4fdd\u5b58\u540e\u53f0\u914d\u7f6e\uff0c\u4e0d\u63a5\u5165\u524d\u53f0\u9996\u9875\u3002'}</p>
      </div>

      <div className="home-toolbar">
        <p>{status}</p>
        <button type="button" onClick={handleSave} disabled={isSaving || slots.length !== 12}>
          {isSaving ? '\u4fdd\u5b58\u4e2d' : '\u4fdd\u5b58 12 \u4e2a\u69fd\u4f4d'}
        </button>
      </div>

      <div className="home-slot-grid">
        {slots.map((slot) => (
          <article className="home-slot-card" key={slot.slotNo}>
            <div className="home-slot-preview">
              {slot.mediaUrl ? (
                <img src={toAbsoluteUrl(slot.mediaUrl)} alt={slot.alt || `slot ${slot.slotNo}`} />
              ) : (
                <span>{'\u672a\u9009\u62e9\u56fe\u7247'}</span>
              )}
            </div>

            <div className="home-slot-body">
              <div className="home-slot-title-row">
                <h2>{'\u69fd\u4f4d'} {slot.slotNo}</h2>
                <label className="home-switch">
                  <input
                    type="checkbox"
                    checked={slot.enabled}
                    onChange={(event) => updateSlot(slot.slotNo, { enabled: event.target.checked })}
                  />
                  <span>{slot.enabled ? '\u542f\u7528' : '\u7981\u7528'}</span>
                </label>
              </div>

              <label>
                <span>{'\u4ece\u5a92\u4f53\u5e93\u9009\u62e9'}</span>
                <select
                  value={slot.mediaFileName}
                  onChange={(event) => bindImage(slot.slotNo, event.target.value)}
                >
                  <option value="">{'\u6682\u4e0d\u7ed1\u5b9a\u56fe\u7247'}</option>
                  {images.map((image) => (
                    <option key={image.fileName} value={image.fileName}>
                      {image.fileName}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Alt</span>
                <input
                  value={slot.alt}
                  onChange={(event) => updateSlot(slot.slotNo, { alt: event.target.value })}
                  placeholder="NEED homepage image"
                />
              </label>

              <label>
                <span>Sort Order</span>
                <input
                  type="number"
                  value={slot.sortOrder}
                  onChange={(event) => updateSlot(slot.slotNo, { sortOrder: Number(event.target.value) })}
                />
              </label>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
