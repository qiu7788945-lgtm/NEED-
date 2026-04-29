import { useState } from 'react';
import { HomeManagementPage } from './pages/HomeManagementPage';
import { MediaLibraryPage } from './pages/MediaLibraryPage';
import { ArticleManagementPage } from './pages/ArticleManagementPage';

const homeMenu = '\u9996\u9875\u7ba1\u7406';
const mediaMenu = '\u5a92\u4f53\u5e93';
const articleMenu = '文章管理';

const menuItems = [
  homeMenu,
  '\u9875\u9762\u7f16\u8f91\u5668',
  '\u6848\u4f8b\u7ba1\u7406',
  'Word \u6848\u4f8b\u5bfc\u5165',
  articleMenu,
  '\u573a\u666f\u89e3\u51b3\u65b9\u6848',
  mediaMenu,
  'SEO / GEO \u7ba1\u7406',
  '\u53d1\u5e03\u7ba1\u7406',
  '\u7cfb\u7edf\u8bbe\u7f6e',
];

export default function App() {
  const [activeMenu, setActiveMenu] = useState(homeMenu);

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark">NEED</span>
          <span className="admin-brand-subtitle">{'\u5b98\u7f51\u7ba1\u7406\u540e\u53f0'}</span>
        </div>
        <nav className="admin-menu" aria-label="\u540e\u53f0\u83dc\u5355">
          {menuItems.map((item) => (
            <button
              key={item}
              className={item === activeMenu ? 'admin-menu-item is-active' : 'admin-menu-item'}
              type="button"
              onClick={() => setActiveMenu(item)}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <section className="admin-content">
        {activeMenu === homeMenu ? (
          <HomeManagementPage />
        ) : activeMenu === articleMenu ? (
          <ArticleManagementPage />
        ) : activeMenu === mediaMenu ? (
          <MediaLibraryPage />
        ) : (
          <div className="admin-panel">
            <p className="admin-eyebrow">NEED CMS</p>
            <h1>NEED {'\u5b98\u7f51\u7ba1\u7406\u540e\u53f0'}</h1>
            <p>
              {'\u8fd9\u91cc\u5c06\u7528\u4e8e\u7ef4\u62a4\u9996\u9875\u3001\u6848\u4f8b\u3001\u6587\u7ae0\u3001\u573a\u666f\u89e3\u51b3\u65b9\u6848\u3001\u5a92\u4f53\u5e93\u548c GEO \u9759\u6001\u53d1\u5e03\u6d41\u7a0b\u3002'}
            </p>
            <div className="admin-actions">
              <button type="button">{'\u5185\u5bb9\u603b\u89c8'}</button>
              <button type="button">{'\u53d1\u5e03\u4e2d\u5fc3'}</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
