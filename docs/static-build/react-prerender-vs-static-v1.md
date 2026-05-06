# React Prerender 与旧 Static V1 职责边界

## 1. 当前结论

- 现有 React 前台是视觉、结构、交互真相源。
- 后台是内容维护真相源。
- 静态 HTML 是 GEO 输出层。
- 第19轮以后，正式页面 GEO 输出方向优先走 React prerender。
- 旧 `build-static-site.ts` 不再继续扩大视觉模板。

## 2. 两条命令的区别

### build:static

- 命令：`npm.cmd run build:static`
- 脚本：`server/src/scripts/build-static-site.ts`
- 输出：`dist-static/`
- 定位：第17轮旧静态模板底座。
- 能力：已有 sitemap、robots、多内容页、draft/published 规则。
- 限制：它是独立模板，不复用 React 前台，继续扩大容易造成“两张皮”。

### build:prerender

- 命令：`npm.cmd run build:prerender`
- 脚本：`server/src/scripts/prerender-react-site.ts`
- 输出：`dist-prerender/`
- 定位：第19轮 React 浏览器快照式 prerender。
- 能力：用 Playwright 打开现有 React 前台，导出渲染后 HTML。
- 当前覆盖：`/` 和 `/solutions`。
- 优点：保留 React 前台作为视觉和结构真相源，HTML 中能看到正文，并可补 `title`、`description`、`canonical`。

## 3. 当前不做的事

- 不删除 `build:static`。
- 不把 `build:static` 直接改指向 `build:prerender`。
- 不继续扩展 `build-static-site.ts` 的页面视觉。
- 不另写第二套静态模板替代 React 前台。
- 不在第19轮一次性迁移全站。

## 4. 后续演进方向

- React prerender 逐步扩展到文章、案例、场景详情、联系页等现有 React 路由。
- sitemap / robots 能力后续从旧 static V1 迁移或复用。
- 后台发布管理后续应优先调用 React prerender 输出。
- 旧 static V1 保留为迁移参考、兜底能力或 sitemap/robots 过渡来源。

## 5. 操作注意事项

运行 `build:prerender` 前必须先启动后台 API：

```bash
npm.cmd run dev:server
```

再启动前台 Vite：

```bash
npm.cmd run dev
```

然后运行：

```bash
npm.cmd run build:prerender
```

`dist-static/` 和 `dist-prerender/` 都是生成产物，不提交 Git。

如果前台或后台未启动，`build:prerender` 会给出提示。
