import React from 'react';
import { MapPin } from 'lucide-react';

// 联系矩阵数据
const contactMatrix = {
  hqAddress: "天津市东丽区英诺美迪产业园1号楼2F",
  email: "needpr@163.com",
  socials: [
    { name: "官方微信", platform: "WeChat", qrCode: "/qr-wechat.png", desc: "" },
    { name: "NEED尼德公关", platform: "XiaoHongShu", qrCode: "/qr-xhs-main.png", desc: "" },
    { name: "然汽造", platform: "XiaoHongShu-Sub", qrCode: "/qr-xhs-sub.png", desc: "" }
  ]
};

// 交付底气资产数据
const hardcoreAssets = [
  {
    id: "warehouse",
    title: "自有设备仓库",
    location: "天津市东丽区先锋路",
    scale: "占地 2000㎡ / 800平方P2、P3及室外防雨屏及配套服务系统；300台舞美专业灯光；声扬音响系统全套（线阵音响、单/双十五音响、数字控台）",
    slogan: "全天候响应的硬件大本营，确保每一次现场交付的绝对控盘。",
    imagePlaceholder: "/factory-1.png" 
  },
  {
    id: "print-factory",
    title: "自有印厂",
    location: "天津市津南区联动U谷",
    scale: "占地 1800㎡ / 6层；核心引进海德堡系列UV平板/卷材机-室内/户外写真机、经纬切割仪等设备",
    slogan: "从设计稿到实物的无色差落地，把控最高视觉标准。",
    imagePlaceholder: "/factory-2.png"
  },
  {
    id: "digital-print",
    title: "自有数码印刷",
    location: "天津市南开区金融界南开中心B座",
    scale: "爱普生系列数码印刷机 / 峰值生产速度 2000张/小时",
    slogan: "柔性生产，极速出街，满足高定数字视觉资产的即时物理转化。",
    imagePlaceholder: "/factory-3.png"
  },
  {
    id: "special-construction",
    title: "自有木作、3D打印、泡沫雕刻特装工厂",
    location: "天津市北辰区佳业道",
    scale: "占地 3000㎡ / 工业级 3D 打印阵列及五轴数控雕刻机",
    slogan: "异形结构的孵化舱，将天马行空的 3D 渲染图绝对一比一还原进现实。",
    imagePlaceholder: "/factory-4.png"
  }
];

export default function ContactAndAssetsPage() {
  return (
    <main className="min-h-screen bg-[#fafafa] text-black selection:bg-[#ccff00] selection:text-black pt-32 pb-32">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        
        {/* Contact Header */}
        <div className="border-b-[4px] border-black pb-10 mb-16">
          <h1 className="text-7xl md:text-[9rem] lg:text-[11rem] font-display font-black tracking-tighter uppercase leading-none">
            CONTACT<span className="text-[#a3cc00]">.</span>
          </h1>
        </div>

        {/* Contact Grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 border-b border-gray-200 pb-24 mb-24">
          
          {/* Left Info */}
          <div className="lg:col-span-5 flex flex-col gap-12">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-gray-400 uppercase mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> HQ Location
              </p>
              <p className="text-2xl md:text-4xl font-black tracking-tight leading-snug">
                {contactMatrix.hqAddress}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-gray-400 uppercase mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                Email Address
              </p>
              <a href={`mailto:${contactMatrix.email}`} className="text-2xl md:text-4xl font-black tracking-tight hover:text-[#a3cc00] transition-colors relative inline-block group">
                {contactMatrix.email}
                <span className="absolute -bottom-2 left-0 w-0 h-1 bg-[#a3cc00] transition-all group-hover:w-full"></span>
              </a>
            </div>
          </div>

          {/* Right Socials */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {contactMatrix.socials.map((social) => (
              <div key={social.platform} className="bg-white border border-gray-200 hover:border-black p-8 rounded-3xl flex flex-col items-center shadow-sm hover:shadow-2xl transition-all duration-300 group">
                <div className="w-32 h-32 mb-8 relative">
                  <img 
                    src={social.qrCode} 
                    alt={social.name} 
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

        {/* Hardcore Assets - Editorial Layout */}
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
            {hardcoreAssets.map((asset) => (
              <div key={asset.id} className="group cursor-default flex flex-col">
                <div className="w-full aspect-[16/10] rounded-[2rem] overflow-hidden bg-gray-100 mb-8 border border-gray-200 relative">
                  <img 
                    src={asset.imagePlaceholder} 
                    alt={asset.title} 
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
                  {/* Subtle hover overlay instead of heavy gradient */}
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
