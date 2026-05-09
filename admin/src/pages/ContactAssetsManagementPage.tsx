import { useEffect, useState } from 'react';
import {
  getCompanyAssets,
  getContactInfo,
  saveCompanyAssets,
  saveContactInfo,
  type CompanyAsset,
  type ContactInfo,
  type ContactSocial,
} from '../api/contactAssets';

const emptyContactInfo: ContactInfo = {
  companyName: '',
  brandName: '',
  address: {
    label: '',
    value: '',
    alt: '',
  },
  email: {
    label: '',
    value: '',
    enabled: true,
  },
  phone: {
    label: '',
    value: '',
    enabled: false,
  },
  socials: [],
};

function toNumber(value: string, fallback: number) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

export function ContactAssetsManagementPage() {
  const [contactInfo, setContactInfo] = useState<ContactInfo>(emptyContactInfo);
  const [companyAssets, setCompanyAssets] = useState<CompanyAsset[]>([]);
  const [status, setStatus] = useState('正在加载联系我们与自有资产配置...');
  const [contactStatus, setContactStatus] = useState('');
  const [assetStatus, setAssetStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setStatus('正在加载联系我们与自有资产配置...');

      const [contactResult, assetsResult] = await Promise.allSettled([
        getContactInfo(),
        getCompanyAssets(),
      ]);

      if (!isMounted) {
        return;
      }

      if (contactResult.status === 'fulfilled') {
        setContactInfo(contactResult.value);
        setContactStatus('联系信息已加载。');
      } else {
        setContactStatus(contactResult.reason instanceof Error ? contactResult.reason.message : '联系信息加载失败。');
      }

      if (assetsResult.status === 'fulfilled') {
        setCompanyAssets(assetsResult.value);
        setAssetStatus('自有资产已加载。');
      } else {
        setAssetStatus(assetsResult.reason instanceof Error ? assetsResult.reason.message : '自有资产加载失败。');
      }

      setStatus('配置加载完成，可编辑后保存。');
      setIsLoading(false);
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  function updateContactInfo(patch: Partial<ContactInfo>) {
    setContactInfo((current) => ({
      ...current,
      ...patch,
    }));
  }

  function updateSocial(id: string, patch: Partial<ContactSocial>) {
    setContactInfo((current) => ({
      ...current,
      socials: current.socials.map((social) => (
        social.id === id ? { ...social, ...patch } : social
      )),
    }));
  }

  function updateCompanyAsset(id: string, patch: Partial<CompanyAsset>) {
    setCompanyAssets((currentAssets) => currentAssets.map((asset) => (
      asset.id === id ? { ...asset, ...patch } : asset
    )));
  }

  async function handleSaveAll() {
    setIsSaving(true);
    setStatus('正在保存联系我们与自有资产配置...');
    setContactStatus('');
    setAssetStatus('');

    try {
      const savedContactInfo = await saveContactInfo(contactInfo);
      setContactInfo(savedContactInfo);
      setContactStatus('联系信息保存成功。');
    } catch (error) {
      setContactStatus(error instanceof Error ? error.message : '联系信息保存失败。');
      setIsSaving(false);
      setStatus('保存过程中出现错误，请查看分组提示。');
      return;
    }

    try {
      const savedCompanyAssets = await saveCompanyAssets(companyAssets);
      setCompanyAssets(savedCompanyAssets);
      setAssetStatus('自有资产保存成功。');
      setStatus('联系我们与自有资产配置已保存。');
    } catch (error) {
      setAssetStatus(error instanceof Error ? error.message : '自有资产保存失败。');
      setStatus('保存过程中出现错误，请查看分组提示。');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="admin-solution-page">
      <div className="admin-section-heading">
        <p className="admin-eyebrow">Contact Assets</p>
        <h1>联系我们 / 自有资产管理</h1>
        <p>用于维护官网联系我们信息、社媒二维码与自有交付资产展示内容。</p>
      </div>

      <div className="solution-group-toolbar">
        <p className="media-status">{status}</p>
        <button type="button" disabled={isLoading || isSaving} onClick={() => void handleSaveAll()}>
          {isSaving ? '保存中...' : '保存全部配置'}
        </button>
      </div>

      <section className="solution-main">
        <div className="solution-scene-header">
          <div>
            <p className="admin-eyebrow">Basic Contact</p>
            <h2>基础联系信息</h2>
            <p>维护公司名称、品牌名、地址、邮箱和电话占位；电话可以保持为空并关闭启用。</p>
          </div>
        </div>

        {contactStatus ? <p className="media-status">{contactStatus}</p> : null}

        <div className="solution-group-form">
          <label>
            <span>公司名称</span>
            <input value={contactInfo.companyName} onChange={(event) => updateContactInfo({ companyName: event.target.value })} />
          </label>
          <label>
            <span>品牌名称</span>
            <input value={contactInfo.brandName} onChange={(event) => updateContactInfo({ brandName: event.target.value })} />
          </label>
          <label>
            <span>地址标签</span>
            <input value={contactInfo.address.label} onChange={(event) => updateContactInfo({ address: { ...contactInfo.address, label: event.target.value } })} />
          </label>
          <label className="solution-full-row">
            <span>地址</span>
            <input value={contactInfo.address.value} onChange={(event) => updateContactInfo({ address: { ...contactInfo.address, value: event.target.value } })} />
          </label>
          <label>
            <span>地址 alt</span>
            <input value={contactInfo.address.alt} onChange={(event) => updateContactInfo({ address: { ...contactInfo.address, alt: event.target.value } })} />
          </label>
          <label>
            <span>邮箱标签</span>
            <input value={contactInfo.email.label} onChange={(event) => updateContactInfo({ email: { ...contactInfo.email, label: event.target.value } })} />
          </label>
          <label>
            <span>邮箱</span>
            <input value={contactInfo.email.value} onChange={(event) => updateContactInfo({ email: { ...contactInfo.email, value: event.target.value } })} />
          </label>
          <label className="home-switch">
            <input
              type="checkbox"
              checked={contactInfo.email.enabled}
              onChange={(event) => updateContactInfo({ email: { ...contactInfo.email, enabled: event.target.checked } })}
            />
            邮箱启用
          </label>
          <label>
            <span>电话标签</span>
            <input value={contactInfo.phone.label} onChange={(event) => updateContactInfo({ phone: { ...contactInfo.phone, label: event.target.value } })} />
          </label>
          <label>
            <span>电话</span>
            <input value={contactInfo.phone.value} onChange={(event) => updateContactInfo({ phone: { ...contactInfo.phone, value: event.target.value } })} />
          </label>
          <label className="home-switch">
            <input
              type="checkbox"
              checked={contactInfo.phone.enabled}
              onChange={(event) => updateContactInfo({ phone: { ...contactInfo.phone, enabled: event.target.checked } })}
            />
            电话启用
          </label>
        </div>
      </section>

      <section className="solution-main">
        <div className="solution-scene-header">
          <div>
            <p className="admin-eyebrow">Social QR Codes</p>
            <h2>社媒二维码</h2>
            <p>本轮编辑现有社媒条目，二维码图片先维护 URL 文本，alt 必须可编辑。</p>
          </div>
        </div>

        <div className="solution-groups">
          {contactInfo.socials.map((social) => (
            <article className="solution-group-card" key={social.id}>
              <div className="solution-group-top">
                <div>
                  <strong>{social.displayName || social.label}</strong>
                  <span>{social.enabled ? '已启用' : '已停用'} · {social.id}</span>
                </div>
                <label>
                  <span>排序</span>
                  <input
                    type="number"
                    value={social.sortOrder}
                    onChange={(event) => updateSocial(social.id, { sortOrder: toNumber(event.target.value, social.sortOrder) })}
                  />
                </label>
              </div>
              <div className="solution-group-form">
                <label>
                  <span>标签</span>
                  <input value={social.label} onChange={(event) => updateSocial(social.id, { label: event.target.value })} />
                </label>
                <label>
                  <span>显示名称</span>
                  <input value={social.displayName} onChange={(event) => updateSocial(social.id, { displayName: event.target.value })} />
                </label>
                <label>
                  <span>平台值</span>
                  <input value={social.value} onChange={(event) => updateSocial(social.id, { value: event.target.value })} />
                </label>
                <label className="solution-full-row">
                  <span>二维码 URL</span>
                  <input value={social.qrImageUrl} onChange={(event) => updateSocial(social.id, { qrImageUrl: event.target.value })} />
                </label>
                <label className="solution-full-row">
                  <span>二维码 alt</span>
                  <input value={social.qrImageAlt} onChange={(event) => updateSocial(social.id, { qrImageAlt: event.target.value })} />
                </label>
                <label className="home-switch">
                  <input
                    type="checkbox"
                    checked={social.enabled}
                    onChange={(event) => updateSocial(social.id, { enabled: event.target.checked })}
                  />
                  启用
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="solution-main">
        <div className="solution-scene-header">
          <div>
            <p className="admin-eyebrow">Company Assets</p>
            <h2>自有资产</h2>
            <p>维护四类自有交付资产的标题、参数、描述、地点、图片 URL、图片 alt、排序和启用状态。</p>
          </div>
        </div>

        {assetStatus ? <p className="media-status">{assetStatus}</p> : null}

        <div className="solution-groups">
          {companyAssets.map((asset) => (
            <article className="solution-group-card" key={asset.id}>
              <div className="solution-group-top">
                <div>
                  <strong>{asset.title}</strong>
                  <span>{asset.enabled ? '已启用' : '已停用'} · {asset.id}</span>
                </div>
                <label>
                  <span>排序</span>
                  <input
                    type="number"
                    value={asset.sortOrder}
                    onChange={(event) => updateCompanyAsset(asset.id, { sortOrder: toNumber(event.target.value, asset.sortOrder) })}
                  />
                </label>
              </div>
              <div className="solution-group-form">
                <label className="solution-full-row">
                  <span>标题</span>
                  <input value={asset.title} onChange={(event) => updateCompanyAsset(asset.id, { title: event.target.value })} />
                </label>
                <label className="solution-full-row">
                  <span>参数 / 摘要</span>
                  <textarea value={asset.summary} onChange={(event) => updateCompanyAsset(asset.id, { summary: event.target.value })} />
                </label>
                <label className="solution-full-row">
                  <span>描述</span>
                  <textarea value={asset.description} onChange={(event) => updateCompanyAsset(asset.id, { description: event.target.value })} />
                </label>
                <label>
                  <span>地点</span>
                  <input value={asset.location} onChange={(event) => updateCompanyAsset(asset.id, { location: event.target.value })} />
                </label>
                <label>
                  <span>图片 URL</span>
                  <input value={asset.imageUrl} onChange={(event) => updateCompanyAsset(asset.id, { imageUrl: event.target.value })} />
                </label>
                <label>
                  <span>图片 alt</span>
                  <input value={asset.imageAlt} onChange={(event) => updateCompanyAsset(asset.id, { imageAlt: event.target.value })} />
                </label>
                <label className="home-switch">
                  <input
                    type="checkbox"
                    checked={asset.enabled}
                    onChange={(event) => updateCompanyAsset(asset.id, { enabled: event.target.checked })}
                  />
                  启用
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
