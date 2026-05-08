import { useState } from 'react';
import { HomeManagementPage } from './pages/HomeManagementPage';
import { MediaLibraryPage } from './pages/MediaLibraryPage';
import { ArticleManagementPage } from './pages/ArticleManagementPage';
import { CaseManagementPage } from './pages/CaseManagementPage';
import { SolutionManagementPage } from './pages/SolutionManagementPage';
import { QualityCheckPage } from './pages/QualityCheckPage';
import { PublishManagementPage } from './pages/PublishManagementPage';
import { PageEditorPage } from './pages/PageEditorPage';

const homeMenu = '首页管理';
const mediaMenu = '媒体库';
const articleMenu = '文章管理';
const caseMenu = '案例解析';
const solutionMenu = '场景解决方案';
const qualityMenu = 'GEO 检查';
const publishMenu = '发布管理';
const pageEditorMenu = '页面编辑器';

const menuItems = [
  homeMenu,
  pageEditorMenu,
  caseMenu,
  articleMenu,
  solutionMenu,
  mediaMenu,
  qualityMenu,
  'SEO / GEO 管理',
  publishMenu,
  '系统设置',
];

export default function App() {
  const [activeMenu, setActiveMenu] = useState(homeMenu);

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark">NEED</span>
          <span className="admin-brand-subtitle">官网管理后台</span>
        </div>
        <nav className="admin-menu" aria-label="后台菜单">
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
        ) : activeMenu === pageEditorMenu ? (
          <PageEditorPage />
        ) : activeMenu === articleMenu ? (
          <ArticleManagementPage />
        ) : activeMenu === caseMenu ? (
          <CaseManagementPage />
        ) : activeMenu === solutionMenu ? (
          <SolutionManagementPage />
        ) : activeMenu === mediaMenu ? (
          <MediaLibraryPage />
        ) : activeMenu === qualityMenu ? (
          <QualityCheckPage />
        ) : activeMenu === publishMenu ? (
          <PublishManagementPage />
        ) : (
          <div className="admin-panel">
            <p className="admin-eyebrow">NEED CMS</p>
            <h1>NEED 官网管理后台</h1>
            <p>
              这里将用于维护首页、案例、文章、场景解决方案、媒体库和 GEO 静态发布流程。
            </p>
            <div className="admin-actions">
              <button type="button">内容总览</button>
              <button type="button">发布中心</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
