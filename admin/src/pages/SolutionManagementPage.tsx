import { useEffect, useMemo, useState } from 'react';
import type { SolutionGroup, SolutionItem, SolutionScene } from '../../../shared/types/solution';
import { uploadImage } from '../api/media';
import {
  addSolutionItem,
  createSolutionGroup,
  deleteSolutionGroup,
  deleteSolutionItem,
  listSolutions,
  reorderSolutionGroups,
  reorderSolutionItems,
  updateSolutionGroup,
  updateSolutionItem,
} from '../api/solutions';

const apiBaseUrl = 'http://localhost:4000';

interface GroupFormState {
  id: string;
  title: string;
  slug: string;
  summary: string;
  sortOrder: string;
  enabled: boolean;
}

const emptyGroupForm: GroupFormState = {
  id: '',
  title: '',
  slug: '',
  summary: '',
  sortOrder: '1',
  enabled: true,
};

function toAbsoluteUrl(url: string) {
  if (!url) {
    return '';
  }
  return url.startsWith('http') ? url : `${apiBaseUrl}${url}`;
}

function toRelativeUrl(url: string) {
  return url.replace(apiBaseUrl, '');
}

function toGroupForm(group: SolutionGroup): GroupFormState {
  return {
    id: group.id,
    title: group.title,
    slug: group.slug,
    summary: group.summary,
    sortOrder: String(group.sortOrder),
    enabled: group.enabled,
  };
}

function isVideoScene(scene: SolutionScene) {
  return scene.slug === 'video-digital-assets';
}

function inferFileTypeFromPath(item: SolutionItem) {
  const source = `${item.mediaFileName} ${item.mediaUrl}`.toLowerCase();
  if (/\.(jpe?g|png|webp)(\?|#|$)/i.test(source)) {
    return 'image';
  }
  if (/\.(mp4|webm)(\?|#|$)/i.test(source)) {
    return 'video';
  }
  return item.fileType;
}

function isVideoFile(file: File) {
  return file.type.startsWith('video/') || /\.(mp4|webm)$/i.test(file.name);
}

function getMaxItems(scene: SolutionScene) {
  return isVideoScene(scene) ? 1 : 7;
}

export function SolutionManagementPage() {
  const [scenes, setScenes] = useState<SolutionScene[]>([]);
  const [activeSceneSlug, setActiveSceneSlug] = useState('family-day');
  const [groupForm, setGroupForm] = useState<GroupFormState>(emptyGroupForm);
  const [editingGroupId, setEditingGroupId] = useState('');
  const [expandedGroupId, setExpandedGroupId] = useState('');
  const [status, setStatus] = useState('正在加载场景解决方案...');
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [uploadingGroupId, setUploadingGroupId] = useState('');

  const activeScene = useMemo(
    () => scenes.find((scene) => scene.slug === activeSceneSlug) ?? scenes[0],
    [activeSceneSlug, scenes],
  );

  async function refreshSolutions(nextActiveSlug = activeSceneSlug) {
    const nextScenes = await listSolutions();
    setScenes(nextScenes);
    if (!nextScenes.some((scene) => scene.slug === nextActiveSlug)) {
      setActiveSceneSlug(nextScenes[0]?.slug ?? 'family-day');
    }
    setStatus(`已加载 ${nextScenes.length} 个场景。`);
  }

  useEffect(() => {
    refreshSolutions().catch((error: Error) => setStatus(error.message));
  }, []);

  function resetGroupForm() {
    setGroupForm({
      ...emptyGroupForm,
      sortOrder: String((activeScene?.groups.length ?? 0) + 1),
    });
    setEditingGroupId('');
  }

  function editGroup(group: SolutionGroup) {
    setGroupForm(toGroupForm(group));
    setEditingGroupId(group.id);
    setExpandedGroupId(group.id);
    setStatus(`正在编辑案例组：${group.title}`);
  }

  async function handleSaveGroup() {
    if (!activeScene) {
      return;
    }

    setIsSavingGroup(true);
    setStatus(editingGroupId ? '正在保存案例组...' : '正在新建案例组...');
    try {
      const input = {
        title: groupForm.title,
        slug: groupForm.slug,
        summary: groupForm.summary,
        sortOrder: Number(groupForm.sortOrder),
        enabled: groupForm.enabled,
      };
      const savedGroup = editingGroupId
        ? await updateSolutionGroup(activeScene.slug, editingGroupId, input)
        : await createSolutionGroup(activeScene.slug, input);
      await refreshSolutions(activeScene.slug);
      setGroupForm(toGroupForm(savedGroup));
      setEditingGroupId(savedGroup.id);
      setExpandedGroupId(savedGroup.id);
      setStatus(editingGroupId ? '案例组已保存。' : '案例组已新建。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '案例组保存失败。');
    } finally {
      setIsSavingGroup(false);
    }
  }

  async function handleDeleteGroup(group: SolutionGroup) {
    if (!activeScene) {
      return;
    }
    const confirmed = window.confirm(`确认删除《${group.title}》吗？删除后只移除本地案例组记录，不删除真实媒体文件。`);
    if (!confirmed) {
      return;
    }
    try {
      await deleteSolutionGroup(activeScene.slug, group.id);
      if (editingGroupId === group.id) {
        resetGroupForm();
      }
      if (expandedGroupId === group.id) {
        setExpandedGroupId('');
      }
      await refreshSolutions(activeScene.slug);
      setStatus('案例组已删除。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '案例组删除失败。');
    }
  }

  function updateGroupSortOrder(groupId: string, sortOrder: string) {
    setScenes((current) => current.map((scene) => (
      scene.slug === activeScene?.slug
        ? {
          ...scene,
          groups: scene.groups.map((group) => (
            group.id === groupId ? { ...group, sortOrder: Number(sortOrder) } : group
          )),
        }
        : scene
    )));
  }

  async function handleSaveGroupOrder() {
    if (!activeScene) {
      return;
    }
    try {
      await reorderSolutionGroups(activeScene.slug, activeScene.groups.map((group) => ({
        id: group.id,
        sortOrder: group.sortOrder,
      })));
      await refreshSolutions(activeScene.slug);
      setStatus('案例组排序已保存。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '案例组排序保存失败。');
    }
  }

  function getUploadMeta(group: SolutionGroup, file: File | undefined, slotNo: number) {
    const videoScene = activeScene ? isVideoScene(activeScene) : false;
    const fileIsVideo = file ? isVideoFile(file) : false;
    return {
      category: fileIsVideo ? 'solution_video' : 'solution_image',
      ownerType: 'solution',
      ownerSlug: activeScene?.slug ?? '',
      groupKey: group.slug || group.id,
      slotNo: String(videoScene ? 1 : slotNo),
      sortOrder: String(videoScene ? 1 : slotNo),
      displayName: fileIsVideo ? `${group.title} 视频` : videoScene ? `${group.title} 主图` : `${group.title} 图片 ${slotNo}`,
      alt: fileIsVideo ? `${group.title} 视频` : videoScene ? `${group.title} 主图` : `${group.title} 图片 ${slotNo}`,
    };
  }

  async function handleUploadItems(group: SolutionGroup, fileList: FileList | null | undefined) {
    if (!activeScene || !fileList || fileList.length === 0) {
      return;
    }
    const files = Array.from(fileList);
    const video = isVideoScene(activeScene);
    const remainingSlots = 7 - group.items.length;
    if (!video && remainingSlots <= 0) {
      setStatus('普通案例组最多 7 张图，可删除后再上传。');
      return;
    }
    if (video && group.items.length >= 1) {
      setStatus('当前组已绑定 1 个素材，请先删除或替换。');
      return;
    }
    if (video && files.length > 1) {
      setStatus('视频与数字资产每组最多 1 个素材，请只选择 1 个文件。');
      return;
    }
    if (!video && files.length > remainingSlots) {
      setStatus(`当前还可上传 ${remainingSlots} 张，请重新选择。`);
      return;
    }
    if (!video && files.some((file) => isVideoFile(file))) {
      setStatus('普通场景案例组只能上传图片，请重新选择。');
      return;
    }

    setUploadingGroupId(group.id);
    setStatus(video ? '正在上传素材...' : `正在上传 ${files.length} 张图片...`);
    let successCount = 0;
    let failedCount = 0;
    for (const [index, file] of files.entries()) {
      try {
        const slotNo = group.items.length + index + 1;
        const uploadMeta = getUploadMeta(group, file, slotNo);
        const uploaded = await uploadImage(file, uploadMeta);
        await addSolutionItem(activeScene.slug, group.id, {
          fileType: uploaded.fileType,
          mediaUrl: toRelativeUrl(uploaded.url),
          mediaFileName: uploaded.fileName,
          mediaDisplayName: uploaded.displayName,
          alt: uploaded.alt || uploadMeta.alt,
          caption: uploaded.caption,
          sortOrder: uploaded.sortOrder,
          enabled: true,
        });
        successCount += 1;
        setStatus(video ? '素材已上传，正在刷新...' : `已上传 ${successCount} / ${files.length}`);
      } catch {
        failedCount += 1;
      }
    }

    try {
      await refreshSolutions(activeScene.slug);
      setExpandedGroupId(group.id);
      if (failedCount > 0) {
        setStatus(`上传完成：成功 ${successCount} 个，失败 ${failedCount} 个。`);
      } else {
        setStatus(video ? '素材已上传并加入案例组。' : `上传完成，共 ${successCount} 张图片。`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '素材上传后刷新失败。');
    } finally {
      setUploadingGroupId('');
    }
  }

  async function handleUpdateItem(group: SolutionGroup, item: SolutionItem, patch: Partial<SolutionItem>) {
    if (!activeScene) {
      return;
    }
    try {
      await updateSolutionItem(activeScene.slug, group.id, item.id, patch);
      await refreshSolutions(activeScene.slug);
      setExpandedGroupId(group.id);
      setStatus('素材信息已保存。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '素材信息保存失败。');
    }
  }

  async function handleDeleteItem(group: SolutionGroup, item: SolutionItem) {
    if (!activeScene) {
      return;
    }
    const confirmed = window.confirm(`确认从案例组移除「${item.mediaDisplayName || item.mediaFileName}」吗？真实媒体文件不会被删除。`);
    if (!confirmed) {
      return;
    }
    try {
      await deleteSolutionItem(activeScene.slug, group.id, item.id);
      await refreshSolutions(activeScene.slug);
      setExpandedGroupId(group.id);
      setStatus('素材已从案例组移除。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '素材移除失败。');
    }
  }

  function updateLocalItemSortOrder(groupId: string, itemId: string, sortOrder: string) {
    setScenes((current) => current.map((scene) => (
      scene.slug === activeScene?.slug
        ? {
          ...scene,
          groups: scene.groups.map((group) => (
            group.id === groupId
              ? {
                ...group,
                items: group.items.map((item) => (
                  item.id === itemId ? { ...item, sortOrder: Number(sortOrder) } : item
                )),
              }
              : group
          )),
        }
        : scene
    )));
  }

  async function handleSaveItemOrder(group: SolutionGroup) {
    if (!activeScene) {
      return;
    }
    try {
      await reorderSolutionItems(activeScene.slug, group.id, group.items.map((item) => ({
        id: item.id,
        sortOrder: item.sortOrder,
      })));
      await refreshSolutions(activeScene.slug);
      setExpandedGroupId(group.id);
      setStatus('组内素材排序已保存。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '组内素材排序保存失败。');
    }
  }

  return (
    <div className="admin-solution-page">
      <div className="admin-section-heading">
        <p className="admin-eyebrow">Solutions</p>
        <h1>场景解决方案</h1>
        <p>维护每个二级场景下的案例组和组内图片/视频素材。本轮只保存后台数据，不接入正式官网前台。</p>
      </div>

      <p className="media-status">{status}</p>

      <div className="solution-layout">
        <aside className="solution-scenes">
          {scenes.map((scene) => (
            <button
              type="button"
              key={scene.slug}
              className={scene.slug === activeScene?.slug ? 'is-active' : ''}
              onClick={() => {
                setActiveSceneSlug(scene.slug);
                resetGroupForm();
                setExpandedGroupId('');
              }}
            >
              <strong>{scene.name}</strong>
              <span>{scene.groups.length} 个案例组</span>
            </button>
          ))}
        </aside>

        <section className="solution-main">
          {activeScene ? (
            <>
              <div className="solution-scene-header">
                <div>
                  <p className="admin-eyebrow">{activeScene.slug}</p>
                  <h2>{activeScene.name}</h2>
                  <p>{isVideoScene(activeScene) ? '每组最多 1 个视频或 1 张主图。' : '普通场景每组最多 7 张图片，可少于 7 张。'}</p>
                </div>
                <button type="button" onClick={resetGroupForm}>新建案例组</button>
              </div>

              <div className="solution-group-form">
                <label>
                  <span>案例组标题</span>
                  <input value={groupForm.title} onChange={(event) => setGroupForm({ ...groupForm, title: event.target.value })} />
                </label>
                <label>
                  <span>Slug</span>
                  <input value={groupForm.slug} onChange={(event) => setGroupForm({ ...groupForm, slug: event.target.value })} placeholder="可留空自动生成" />
                </label>
                <label>
                  <span>排序</span>
                  <input type="number" value={groupForm.sortOrder} onChange={(event) => setGroupForm({ ...groupForm, sortOrder: event.target.value })} />
                </label>
                <label className="home-switch">
                  <input type="checkbox" checked={groupForm.enabled} onChange={(event) => setGroupForm({ ...groupForm, enabled: event.target.checked })} />
                  启用
                </label>
                <label className="solution-full-row">
                  <span>摘要</span>
                  <textarea value={groupForm.summary} onChange={(event) => setGroupForm({ ...groupForm, summary: event.target.value })} />
                </label>
                <button type="button" disabled={isSavingGroup} onClick={() => void handleSaveGroup()}>
                  {isSavingGroup ? '保存中' : editingGroupId ? '保存案例组' : '新建案例组'}
                </button>
              </div>

              <div className="solution-group-toolbar">
                <h3>案例组列表</h3>
                <button type="button" onClick={() => void handleSaveGroupOrder()}>保存案例组排序</button>
              </div>

              <div className="solution-groups">
                {activeScene.groups.map((group) => {
                  const maxItems = getMaxItems(activeScene);
                  const uploadDisabled = group.items.length >= maxItems;
                  return (
                    <article className="solution-group-card" key={group.id}>
                      <div className="solution-group-top">
                        <div>
                          <strong>{group.title}</strong>
                          <span>{group.enabled ? '已启用' : '已停用'} · {group.items.length}/{maxItems} 个素材 · {group.slug}</span>
                        </div>
                        <label>
                          <span>排序</span>
                          <input type="number" value={group.sortOrder} onChange={(event) => updateGroupSortOrder(group.id, event.target.value)} />
                        </label>
                      </div>
                      <p>{group.summary || '暂无摘要'}</p>
                      <div className="solution-card-actions">
                        <button type="button" onClick={() => editGroup(group)}>编辑</button>
                        <button type="button" onClick={() => setExpandedGroupId(expandedGroupId === group.id ? '' : group.id)}>
                          {expandedGroupId === group.id ? '收起素材' : '管理素材'}
                        </button>
                        <button className="is-danger" type="button" onClick={() => void handleDeleteGroup(group)}>删除</button>
                      </div>

                      {expandedGroupId === group.id ? (
                        <div className="solution-items-panel">
                          <div className="solution-item-upload">
                            <label className={uploadDisabled ? 'home-file-button is-disabled' : 'home-file-button'}>
                              <span>{uploadingGroupId === group.id ? '上传中' : isVideoScene(activeScene) ? '上传视频或主图' : '上传图片（可多选）'}</span>
                              <input
                                type="file"
                                multiple={!isVideoScene(activeScene)}
                                disabled={uploadDisabled || uploadingGroupId === group.id}
                                accept={isVideoScene(activeScene) ? '.jpg,.jpeg,.png,.webp,.mp4,.webm,image/jpeg,image/png,image/webp,video/mp4,video/webm' : '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'}
                                onChange={(event) => {
                                  void handleUploadItems(group, event.target.files);
                                  event.currentTarget.value = '';
                                }}
                              />
                            </label>
                            <span>
                              {isVideoScene(activeScene)
                                ? `已绑定 ${group.items.length} / 1`
                                : `已上传 ${group.items.length} / 7；每组最多 7 张，可一次选择多张`}
                            </span>
                            {uploadDisabled ? <span>{isVideoScene(activeScene) ? '当前组已绑定 1 个素材，请先删除或替换' : '普通案例组最多 7 张图，可删除后再上传'}</span> : null}
                            <button type="button" onClick={() => void handleSaveItemOrder(group)}>保存组内排序</button>
                          </div>

                          <div className="solution-items-grid">
                            {group.items.map((item) => (
                              <figure className="solution-item-card" key={item.id}>
                                {inferFileTypeFromPath(item) === 'video' ? (
                                  <video src={toAbsoluteUrl(item.mediaUrl)} controls />
                                ) : (
                                  <img src={toAbsoluteUrl(item.mediaUrl)} alt={item.alt || item.mediaDisplayName} />
                                )}
                                <figcaption>
                                  <strong>{item.mediaDisplayName || item.mediaFileName}</strong>
                                  <label>
                                    <span>排序</span>
                                    <input type="number" value={item.sortOrder} onChange={(event) => updateLocalItemSortOrder(group.id, item.id, event.target.value)} />
                                  </label>
                                  <label>
                                    <span>Alt / GEO 描述</span>
                                    <input
                                      value={item.alt}
                                      onChange={(event) => void handleUpdateItem(group, item, { alt: event.target.value })}
                                    />
                                  </label>
                                  <label>
                                    <span>说明</span>
                                    <textarea
                                      value={item.caption}
                                      onChange={(event) => void handleUpdateItem(group, item, { caption: event.target.value })}
                                    />
                                  </label>
                                  <button className="is-danger" type="button" onClick={() => void handleDeleteItem(group, item)}>移除素材</button>
                                </figcaption>
                              </figure>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
