import { useEffect, useState } from 'react';
import type { HomeInteractiveImageSlot, HomeVideoConfig } from '../../../shared/types/home';
import { getHomeInteractiveImages, getHomeVideo, saveHomeInteractiveImages, saveHomeVideo } from '../api/home';
import { uploadImage, type AdminMediaFile } from '../api/media';
import { MediaPicker } from '../components/MediaPicker';

const emptyHomeVideo: HomeVideoConfig = {
  videoUrl: '',
  videoFileName: '',
  videoDisplayName: '',
  posterUrl: '',
  posterFileName: '',
  posterDisplayName: '',
  title: '',
  description: '',
  enabled: false,
  updatedAt: '',
};

function toAbsoluteUrl(url: string) {
  if (!url) {
    return '';
  }

  if (url.startsWith('http')) {
    return url;
  }

  return `http://localhost:4000${url}`;
}

function toRelativeUrl(url: string) {
  return url.replace('http://localhost:4000', '');
}

function getMediaTitle(image: AdminMediaFile) {
  return image.displayName || image.originalName || image.fileName;
}

export function HomeManagementPage() {
  const [slots, setSlots] = useState<HomeInteractiveImageSlot[]>([]);
  const [homeVideo, setHomeVideo] = useState<HomeVideoConfig>(emptyHomeVideo);
  const [status, setStatus] = useState('正在加载首页配置...');
  const [videoStatus, setVideoStatus] = useState('');
  const [slotStatus, setSlotStatus] = useState('');
  const [isSavingVideo, setIsSavingVideo] = useState(false);
  const [isSavingSlots, setIsSavingSlots] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [uploadingSlotNo, setUploadingSlotNo] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([getHomeInteractiveImages(), getHomeVideo()])
      .then(([nextSlots, nextVideo]) => {
        setSlots(nextSlots);
        setHomeVideo(nextVideo);
        setStatus('首页配置已加载。');
      })
      .catch((error: Error) => {
        setStatus(error.message || '首页配置加载失败。');
      });
  }, []);

  function updateSlot(slotNo: number, patch: Partial<HomeInteractiveImageSlot>) {
    setSlots((currentSlots) => currentSlots.map((slot) => (
      slot.slotNo === slotNo ? { ...slot, ...patch } : slot
    )));
  }

  function bindImage(slotNo: number, image: AdminMediaFile) {
    updateSlot(slotNo, {
      mediaUrl: toRelativeUrl(image.url),
      mediaFileName: image.fileName,
      alt: image.alt || `首页交互图 ${slotNo}`,
    });
    setSlotStatus(`槽位 ${slotNo} 已绑定素材：${getMediaTitle(image)}。`);
  }

  function bindHomeVideoVideo(video: AdminMediaFile) {
    setHomeVideo((current) => ({
      ...current,
      videoUrl: toRelativeUrl(video.url),
      videoFileName: video.fileName,
      videoDisplayName: getMediaTitle(video),
    }));
    setVideoStatus(`首页视频已上传并绑定：${getMediaTitle(video)}。`);
  }

  function bindHomeVideoPoster(poster: AdminMediaFile) {
    setHomeVideo((current) => ({
      ...current,
      posterUrl: toRelativeUrl(poster.url),
      posterFileName: poster.fileName,
      posterDisplayName: getMediaTitle(poster),
    }));
    setVideoStatus(`视频封面已上传并绑定：${getMediaTitle(poster)}。`);
  }

  async function handleSaveSlots() {
    setIsSavingSlots(true);
    setSlotStatus('正在保存首页交互图配置...');

    try {
      const savedSlots = await saveHomeInteractiveImages(slots);
      setSlots(savedSlots);
      setSlotStatus('首页交互图保存成功，刷新后仍会保留配置。');
    } catch (error) {
      setSlotStatus(error instanceof Error ? error.message : '首页交互图保存失败。');
    } finally {
      setIsSavingSlots(false);
    }
  }

  async function handleSaveVideo() {
    setIsSavingVideo(true);
    setVideoStatus('正在保存首页视频配置...');

    try {
      const savedVideo = await saveHomeVideo(homeVideo);
      setHomeVideo(savedVideo);
      setVideoStatus('首页视频保存成功，刷新后仍会保留配置。');
    } catch (error) {
      setVideoStatus(error instanceof Error ? error.message : '首页视频保存失败。');
    } finally {
      setIsSavingVideo(false);
    }
  }

  async function handleUploadVideo(file: File | undefined) {
    if (!file) {
      return;
    }

    setUploadingVideo(true);
    setVideoStatus('正在上传首页视频...');

    try {
      const uploaded = await uploadImage(file, {
        category: 'home_video',
        ownerType: 'home',
        ownerSlug: 'homepage',
        displayName: homeVideo.title || file.name,
      });
      bindHomeVideoVideo(uploaded);
    } catch (error) {
      setVideoStatus(error instanceof Error ? error.message : '首页视频上传失败。');
    } finally {
      setUploadingVideo(false);
    }
  }

  async function handleUploadPoster(file: File | undefined) {
    if (!file) {
      return;
    }

    setUploadingPoster(true);
    setVideoStatus('正在上传视频封面...');

    try {
      const uploaded = await uploadImage(file, {
        category: 'home_video',
        ownerType: 'home',
        ownerSlug: 'homepage',
        displayName: homeVideo.title ? `${homeVideo.title} 封面` : file.name,
        alt: homeVideo.title,
        caption: homeVideo.description,
      });
      bindHomeVideoPoster(uploaded);
    } catch (error) {
      setVideoStatus(error instanceof Error ? error.message : '视频封面上传失败。');
    } finally {
      setUploadingPoster(false);
    }
  }

  async function handleUploadSlotImage(slotNo: number, file: File | undefined) {
    if (!file) {
      return;
    }

    setUploadingSlotNo(slotNo);
    setSlotStatus(`正在上传槽位 ${slotNo} 图片...`);

    try {
      const uploaded = await uploadImage(file, {
        category: 'home_interactive',
        ownerType: 'home',
        ownerSlug: 'homepage',
        groupKey: 'home-interactive',
        slotNo: String(slotNo),
        sortOrder: String(slotNo),
        displayName: `首页交互图 ${slotNo}`,
        alt: `首页交互图 ${slotNo}`,
      });
      bindImage(slotNo, uploaded);
    } catch (error) {
      setSlotStatus(error instanceof Error ? error.message : `槽位 ${slotNo} 图片上传失败。`);
    } finally {
      setUploadingSlotNo(null);
    }
  }

  return (
    <div className="admin-home-page">
      <div className="admin-section-heading">
        <p className="admin-eyebrow">Home Management</p>
        <h1>首页管理</h1>
        <p>点对点管理首页视频、视频封面，以及“创意 / 案例 / 现场”12 个交互图槽位。本轮只保存后台配置，不接入正式前台首页。</p>
      </div>

      <p className="media-status">{status}</p>

      <section className="home-video-panel">
        <div className="home-toolbar">
          <div>
            <p className="admin-eyebrow">Home Video</p>
            <h2>首页视频</h2>
            <p>直接上传或替换首页视频与封面，素材会自动登记到媒体库。</p>
          </div>
          <button type="button" onClick={() => void handleSaveVideo()} disabled={isSavingVideo}>
            {isSavingVideo ? '保存中' : '保存首页视频'}
          </button>
        </div>

        <div className="home-video-grid">
          <div className="home-video-preview">
            {homeVideo.videoUrl ? (
              <video src={toAbsoluteUrl(homeVideo.videoUrl)} poster={toAbsoluteUrl(homeVideo.posterUrl)} controls preload="metadata" />
            ) : (
              <span>未选择首页视频</span>
            )}
          </div>

          <div className="home-video-form">
            <label className="home-switch">
              <input
                type="checkbox"
                checked={homeVideo.enabled}
                onChange={(event) => setHomeVideo((current) => ({ ...current, enabled: event.target.checked }))}
              />
              <span>{homeVideo.enabled ? '启用首页视频' : '禁用首页视频'}</span>
            </label>

            <label>
              <span>视频标题</span>
              <input
                value={homeVideo.title}
                onChange={(event) => setHomeVideo((current) => ({ ...current, title: event.target.value }))}
                placeholder="例如：NEED 创意现场"
              />
            </label>

            <label>
              <span>视频说明</span>
              <textarea
                value={homeVideo.description}
                onChange={(event) => setHomeVideo((current) => ({ ...current, description: event.target.value }))}
                placeholder="用于后台识别或未来前台展示"
              />
            </label>

            <div className="home-upload-row">
              <label className="home-file-button">
                <span>{uploadingVideo ? '上传中' : '上传/替换视频'}</span>
                <input
                  type="file"
                  accept=".mp4,.webm,video/mp4,video/webm"
                  disabled={uploadingVideo}
                  onChange={(event) => void handleUploadVideo(event.target.files?.[0])}
                />
              </label>
              <label className="home-file-button">
                <span>{uploadingPoster ? '上传中' : '上传/替换封面'}</span>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  disabled={uploadingPoster}
                  onChange={(event) => void handleUploadPoster(event.target.files?.[0])}
                />
              </label>
            </div>

            <div className="home-video-meta">
              <span>视频素材：{homeVideo.videoDisplayName || homeVideo.videoFileName || '未绑定'}</span>
              <span>封面素材：{homeVideo.posterDisplayName || homeVideo.posterFileName || '未绑定'}</span>
              <span>更新时间：{homeVideo.updatedAt || '-'}</span>
            </div>

            {videoStatus ? <p className="media-status">{videoStatus}</p> : null}
          </div>
        </div>
      </section>

      <section className="home-slots-panel">
        <div className="home-toolbar">
          <div>
            <p className="admin-eyebrow">Interactive Images</p>
            <h2>创意案例现场图组</h2>
            <p>每个槽位都可以直接上传替换，也可以从媒体库选择已有首页交互图。</p>
          </div>
          <button type="button" onClick={() => void handleSaveSlots()} disabled={isSavingSlots || slots.length !== 12}>
            {isSavingSlots ? '保存中' : '保存 12 个槽位'}
          </button>
        </div>

        {slotStatus ? <p className="media-status">{slotStatus}</p> : null}

        <div className="home-slot-grid">
          {slots.map((slot) => (
            <article className="home-slot-card" key={slot.slotNo}>
              <div className="home-slot-preview">
                {slot.mediaUrl ? (
                  <img src={toAbsoluteUrl(slot.mediaUrl)} alt={slot.alt || `首页交互图 ${slot.slotNo}`} />
                ) : (
                  <span>未选择图片</span>
                )}
              </div>

              <div className="home-slot-body">
                <div className="home-slot-title-row">
                  <h2>槽位 {slot.slotNo}</h2>
                  <label className="home-switch">
                    <input
                      type="checkbox"
                      checked={slot.enabled}
                      onChange={(event) => updateSlot(slot.slotNo, { enabled: event.target.checked })}
                    />
                    <span>{slot.enabled ? '启用' : '禁用'}</span>
                  </label>
                </div>

                <div className="home-slot-picker-row">
                  <label className="home-file-button">
                    <span>{uploadingSlotNo === slot.slotNo ? '上传中' : '上传/替换本槽图片'}</span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      disabled={uploadingSlotNo === slot.slotNo}
                      onChange={(event) => void handleUploadSlotImage(slot.slotNo, event.target.files?.[0])}
                    />
                  </label>
                  <MediaPicker
                    defaultCategory="home_interactive"
                    onSelect={(image) => bindImage(slot.slotNo, image)}
                  />
                  {slot.mediaFileName ? (
                    <button
                      className="media-picker-clear"
                      type="button"
                      onClick={() => updateSlot(slot.slotNo, { mediaUrl: '', mediaFileName: '' })}
                    >
                      清除
                    </button>
                  ) : null}
                </div>

                {slot.mediaFileName ? (
                  <p className="home-slot-file-name">{slot.mediaFileName}</p>
                ) : null}

                <label>
                  <span>Alt/GEO 描述</span>
                  <input
                    value={slot.alt}
                    onChange={(event) => updateSlot(slot.slotNo, { alt: event.target.value })}
                    placeholder={`首页交互图 ${slot.slotNo}`}
                  />
                </label>

                <label>
                  <span>展示排序</span>
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
      </section>
    </div>
  );
}
