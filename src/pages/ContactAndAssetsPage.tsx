import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import {
  fetchCompanyAssets,
  fetchContactInfo,
  type PublicCompanyAsset,
  type PublicContactInfo,
  type PublicContactSocial,
} from '../services/publicContent';

interface ContactSocialView {
  id: string;
  name: string;
  platform: string;
  qrCode: string;
  qrAlt: string;
  desc: string;
  sortOrder: number;
  enabled: boolean;
}

interface AssetView {
  id: string;
  title: string;
  location: string;
  scale: string;
  slogan: string;
  imagePlaceholder: string;
  imageAlt: string;
  sortOrder: number;
  enabled: boolean;
}

const contactMatrix = {
  hqAddress: '天津市东丽区英诺美迪产业园1号楼2F',
  addressLabel: 'HQ Location',
  email: 'needpr@163.com',
  emailLabel: 'Email Address',
  emailEnabled: true,
  phone: '',
  phoneLabel: 'Phone',
  phoneEnabled: false,
  socials: [
    {
      id: 'wechat-official',
      name: '官方微信',
      platform: 'WeChat',
      qrCode: '/qr-wechat.png',
      qrAlt: '官方微信二维码',
      desc: '',
      sortOrder: 1,
      enabled: true,
    },
    {
      id: 'xiaohongshu-main',
      name: 'NEED尼德公关',
      platform: 'XiaoHongShu',
      qrCode: '/qr-xhs-main.png',
      qrAlt: 'NEED尼德公关小红书二维码',
      desc: '',
      sortOrder: 2,
      enabled: true,
    },
    {
      id: 'xiaohongshu-sub',
      name: '然汽造',
      platform: 'XiaoHongShu-Sub',
      qrCode: '/qr-xhs-sub.png',
      qrAlt: '然汽造小红书二维码',
      desc: '',
      sortOrder: 3,
      enabled: true,
    },
  ],
};

const hardcoreAssets: AssetView[] = [
  {
    id: 'warehouse',
    title: '自有设备仓库',
    location: '天津市东丽区先锋路',
    scale: '占地 2000㎡ / 800平方P2、P3及室外防雨屏及配套服务系统；300台舞美专业灯光；声扬音响系统全套（线阵音响、单/双十五音响、数字控台）',
    slogan: '全天候响应的硬件大本营，确保每一次现场交付的绝对控盘。',
    imagePlaceholder: '/factory-1.png',
    imageAlt: '自有设备仓库',
    sortOrder: 1,
    enabled: true,
  },
  {
    id: 'print-factory',
    title: '自有印厂',
    location: '天津市津南区联动U谷',
    scale: '占地 1800㎡ / 6层；核心引进海德堡系列UV平板/卷材机-室内/户外写真机、经纬切割仪等设备',
    slogan: '从设计稿到实物的无色差落地，把控最高视觉标准。',
    imagePlaceholder: '/factory-2.png',
    imageAlt: '自有印厂',
    sortOrder: 2,
    enabled: true,
  },
  {
    id: 'digital-print',
    title: '自有数码印刷',
    location: '天津市南开区金融界南开中心B座',
    scale: '爱普生系列数码印刷机 / 峰值生产速度 2000张/小时',
    slogan: '柔性生产，极速出街，满足高定数字视觉资产的即时物理转化。',
    imagePlaceholder: '/factory-3.png',
    imageAlt: '自有数码印刷',
    sortOrder: 3,
    enabled: true,
  },
  {
    id: 'special-construction',
    title: '自有木作、铁艺、泡沫雕刻、特装工厂',
    location: '天津市北辰区佳业道',
    scale: '占地 3000㎡ / 工业级 3D 打印阵列及五轴数控雕刻机',
    slogan: '异形结构的孵化舱，将天马行空的 3D 渲染图绝对一比一还原进现实。',
    imagePlaceholder: '/factory-4.png',
    imageAlt: '自有木作、铁艺、泡沫雕刻、特装工厂',
    sortOrder: 4,
    enabled: true,
  },
];

function mergeSocial(social: PublicContactSocial): ContactSocialView {
  const fallback = contactMatrix.socials.find((item) => item.id === social.id);

  return {
    id: social.id || fallback?.id || social.displayName || social.label,
    name: social.displayName || social.label || fallback?.name || '',
    platform: social.value || fallback?.platform || '',
    qrCode: social.qrImageUrl || fallback?.qrCode || '',
    qrAlt: social.qrImageAlt || social.displayName || social.label || fallback?.qrAlt || fallback?.name || '',
    desc: fallback?.desc || '',
    sortOrder: social.sortOrder ?? fallback?.sortOrder ?? Number.MAX_SAFE_INTEGER,
    enabled: social.enabled,
  };
}

function mergeAsset(asset: PublicCompanyAsset): AssetView {
  const fallback = hardcoreAssets.find((item) => item.id === asset.id);

  return {
    id: asset.id || fallback?.id || asset.title,
    title: asset.title || fallback?.title || '',
    location: asset.location || fallback?.location || '',
    scale: asset.summary || fallback?.scale || '',
    slogan: asset.description || fallback?.slogan || '',
    imagePlaceholder: asset.imageUrl || fallback?.imagePlaceholder || '',
    imageAlt: asset.imageAlt || asset.title || fallback?.imageAlt || fallback?.title || '',
    sortOrder: asset.sortOrder ?? fallback?.sortOrder ?? Number.MAX_SAFE_INTEGER,
    enabled: asset.enabled,
  };
}

function getVisibleFallbackSocials() {
  return contactMatrix.socials
    .filter((social) => social.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function getVisibleFallbackAssets() {
  return hardcoreAssets
    .filter((asset) => asset.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function normalizeAddressLabel(label: string) {
  return label.trim().toLowerCase() === 'hq location' ? contactMatrix.addressLabel : label;
}

function createContactView(contactInfo: PublicContactInfo | null) {
  const visibleSocials = contactInfo?.socials
    .map(mergeSocial)
    .filter((social) => social.enabled && social.name && social.qrCode)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  return {
    hqAddress: contactInfo?.address.value || contactMatrix.hqAddress,
    addressLabel: normalizeAddressLabel(contactInfo?.address.label || contactMatrix.addressLabel),
    email: contactInfo?.email.value || contactMatrix.email,
    emailLabel: contactInfo?.email.label || contactMatrix.emailLabel,
    emailEnabled: contactInfo?.email.enabled ?? contactMatrix.emailEnabled,
    phone: contactInfo?.phone.value || contactMatrix.phone,
    phoneLabel: contactInfo?.phone.label || contactMatrix.phoneLabel,
    phoneEnabled: contactInfo?.phone.enabled ?? contactMatrix.phoneEnabled,
    socials: visibleSocials && visibleSocials.length > 0 ? visibleSocials : getVisibleFallbackSocials(),
  };
}

function createAssetView(companyAssets: PublicCompanyAsset[]) {
  const visibleAssets = companyAssets
    .map(mergeAsset)
    .filter((asset) => asset.enabled && asset.title)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  return visibleAssets.length > 0 ? visibleAssets : getVisibleFallbackAssets();
}

export default function ContactAndAssetsPage() {
  const [contactInfo, setContactInfo] = useState<PublicContactInfo | null>(null);
  const [companyAssets, setCompanyAssets] = useState<PublicCompanyAsset[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadContactAssets() {
      const [nextContactInfo, nextCompanyAssets] = await Promise.all([
        fetchContactInfo(),
        fetchCompanyAssets(),
      ]);

      if (!isMounted) {
        return;
      }

      setContactInfo(nextContactInfo);
      setCompanyAssets(nextCompanyAssets);
    }

    void loadContactAssets();

    return () => {
      isMounted = false;
    };
  }, []);

  const contact = createContactView(contactInfo);
  const assets = createAssetView(companyAssets);

  return (
    <main className="min-h-screen bg-[#fafafa] text-black selection:bg-[#ccff00] selection:text-black pt-32 pb-32">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="border-b-[4px] border-black pb-10 mb-16">
          <h1 className="text-7xl md:text-[9rem] lg:text-[11rem] font-display font-black tracking-tighter uppercase leading-none">
            CONTACT<span className="text-[#a3cc00]">.</span>
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 border-b border-gray-200 pb-24 mb-24">
          <div className="lg:col-span-5 flex flex-col gap-12">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-gray-400 uppercase mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> {contact.addressLabel}
              </p>
              <p className="text-2xl md:text-4xl font-black tracking-tight leading-snug">
                {contact.hqAddress}
              </p>
            </div>
            {contact.emailEnabled && contact.email ? (
              <div>
                <p className="text-xs font-bold tracking-[0.2em] text-gray-400 uppercase mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  {contact.emailLabel}
                </p>
                <a href={`mailto:${contact.email}`} className="text-2xl md:text-4xl font-black tracking-tight hover:text-[#a3cc00] transition-colors relative inline-block group">
                  {contact.email}
                  <span className="absolute -bottom-2 left-0 w-0 h-1 bg-[#a3cc00] transition-all group-hover:w-full"></span>
                </a>
              </div>
            ) : null}
            {contact.phoneEnabled && contact.phone ? (
              <div>
                <p className="text-xs font-bold tracking-[0.2em] text-gray-400 uppercase mb-4">
                  {contact.phoneLabel}
                </p>
                <p className="text-2xl md:text-4xl font-black tracking-tight leading-snug">
                  {contact.phone}
                </p>
              </div>
            ) : null}
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {contact.socials.map((social) => (
              <div key={social.id} className="bg-white border border-gray-200 hover:border-black p-8 rounded-3xl flex flex-col items-center shadow-sm hover:shadow-2xl transition-all duration-300 group">
                <div className="w-32 h-32 mb-8 relative">
                  <img
                    src={social.qrCode}
                    alt={social.qrAlt}
                    className="w-full h-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-110"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement?.classList.add('bg-zinc-100', 'rounded-2xl');
                    }}
                  />
                </div>
                <div className="text-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] block mb-2">{social.platform}</span>
                  <h4 className="text-lg font-black text-black mb-1">{social.name}</h4>
                  {social.desc && <p className="text-sm text-gray-400 font-medium">{social.desc}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
            <div>
              <h2 className="text-5xl md:text-7xl font-display font-black tracking-tighter uppercase text-black">交付底气</h2>
              <p className="text-xl md:text-2xl font-black text-gray-300 tracking-widest uppercase mt-2">Hardcore Assets</p>
            </div>
            <p className="text-lg text-gray-500 max-w-md font-medium leading-relaxed">
              自营工厂与仓储系统，保证我们在创意与落地的全链路中，拥有不妥协的交付标准。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-20">
            {assets.map((asset) => (
              <div key={asset.id} className="group cursor-default flex flex-col">
                <div className="w-full aspect-[16/10] rounded-[2rem] overflow-hidden bg-gray-100 mb-8 border border-gray-200 relative">
                  <img
                    src={asset.imagePlaceholder}
                    alt={asset.imageAlt}
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.style.backgroundImage = 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")';
                        parent.style.opacity = '0.05';
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-500 pointer-events-none" />
                </div>

                <div className="flex items-center gap-3 mb-4 text-[#a3cc00]">
                  <MapPin className="w-5 h-5" />
                  <span className="text-xs font-bold tracking-[0.2em] uppercase text-black">{asset.location}</span>
                </div>

                <h3 className="text-3xl md:text-4xl lg:text-5xl font-black mb-6 tracking-tight text-black flex items-center gap-4 transition-colors">
                  {asset.title}
                </h3>

                <div className="self-start inline-flex items-center bg-white border-2 border-gray-100 text-gray-800 text-sm font-sans px-4 py-2 rounded-xl mb-6 font-bold shadow-sm group-hover:border-black transition-colors duration-500">
                  {asset.scale}
                </div>

                <p className="text-lg text-gray-600 leading-relaxed font-medium">
                  {asset.slogan}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
