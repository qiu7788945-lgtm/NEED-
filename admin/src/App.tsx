const menuItems = [
  '首页管理',
  '页面编辑器',
  '案例管理',
  'Word 案例导入',
  '文章管理',
  '场景解决方案',
  '媒体库',
  'SEO / GEO 管理',
  '发布管理',
  '系统设置',
];

export default function App() {
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark">NEED</span>
          <span className="admin-brand-subtitle">官网管理后台</span>
        </div>
        <nav className="admin-menu" aria-label="后台菜单">
          {menuItems.map((item) => (
            <button key={item} className="admin-menu-item" type="button">
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <section className="admin-content">
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
      </section>
    </main>
  );
}
