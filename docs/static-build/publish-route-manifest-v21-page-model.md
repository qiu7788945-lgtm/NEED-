# NEED 官网第21轮页面模型与发布链路说明

## 1. 本步目标

第21-2 建立 pages / 页面编辑器 V1 的数据模型与 API 骨架，作为后续接入后台页面编辑器、前台真实渲染、route manifest 和 sitemap 的基础。

第21-4A 已加入 `/preview/pages/:id` 安全预览渲染。第21-4B 开始让合格 pages 具备进入 route manifest、prerender HTML、sitemap 与 publish log 的能力。

本阶段不进入 MySQL，不补正式官网资料，不做登录、安全、权限，也不做腾讯云部署。

## 2. 当前新增范围

新增 JSON 阶段数据文件：

- `server/data/pages.json`

新增共享类型：

- `shared/types/pages.ts`

新增后端模块：

- `server/src/services/pages/pages.service.ts`
- `server/src/controllers/pages.controller.ts`
- `server/src/routes/pages.routes.ts`

新增后台 API 适配：

- `admin/src/api/pages.ts`

修改后端路由挂载：

- `server/src/routes/index.ts`

## 3. Page 模型

Page 字段包括：

- `id`
- `path`
- `slug`
- `pageType`
- `title`
- `status`
- `seoTitle`
- `seoDescription`
- `keywords`
- `heroTitle`
- `heroSubtitle`
- `summary`
- `sections`
- `faqItems`
- `mediaRefs`
- `requiredChecks`
- `sortOrder`
- `shouldIndex`
- `createdAt`
- `updatedAt`
- `publishedAt`

`status` 支持：

- `draft`
- `published`
- `archived`

`pageType` 支持：

- `service`
- `scenario`
- `city`
- `faq`
- `topic`
- `budget`
- `vendor_selection`
- `family_day`
- `annual_meeting`
- `contact`
- `home_section`

## 4. 子模型

`sections` 用于后续页面编辑器的正文块，包含：

- `id`
- `type`
- `title`
- `subtitle`
- `body`
- `items`
- `mediaRefs`
- `sortOrder`
- `enabled`

`faqItems` 用于页面 FAQ，包含：

- `id`
- `question`
- `answer`
- `sortOrder`
- `enabled`

`mediaRefs` 用于绑定媒体库素材，包含：

- `id`
- `mediaId`
- `url`
- `alt`
- `caption`
- `usage`
- `sortOrder`

## 5. requiredChecks

Page 模型包含以下检查项：

- `hasTitle`
- `hasSeoTitle`
- `hasSeoDescription`
- `hasRenderablePath`
- `hasMeaningfulContent`
- `hasNoPlaceholder`
- `canPrerender`

第21-4B 起，route manifest 会使用这些检查项判断页面是否具备进入正式发布链路的资格。不能为了让页面进入 sitemap 而放松 requiredChecks。

`hasMeaningfulContent` 要求 `heroTitle` / `summary` / enabled `sections` / enabled `faqItems` 至少有一类具备有效内容；只有空标题、空 section、空 FAQ 不算有效内容。

`hasNoPlaceholder` 会过滤 placeholder、lorem ipsum、test page、test、TODO、待补充、占位、测试等占位内容。

## 6. API 清单

已预留 pages API：

- `GET /api/pages`
- `GET /api/pages/:id`
- `POST /api/pages`
- `PUT /api/pages/:id`
- `PATCH /api/pages/:id/status`
- `DELETE /api/pages/:id`
- `POST /api/pages/:id/duplicate`
- `POST /api/pages/reorder`

后台 API 适配导出：

- `listPages`
- `getPage`
- `createPage`
- `updatePage`
- `updatePageStatus`
- `deletePage`
- `duplicatePage`
- `reorderPages`

## 7. 发布边界

`server/data/pages.json` 初始为空数组。本项目不新增测试 published 页面，不为了验收补正式官网资料。

任何 page 即使改为 `published`，也必须同时满足以下条件才允许进入 `shouldGenerate`：

1. `status === 'published'`
2. `shouldIndex !== false`
3. `path` 有效、以 `/` 开头、不以 `/preview` 开头
4. `path` 不与现有固定 17 个正式页面冲突，除非属于受控 takeover 白名单
5. `hasTitle` 通过
6. `hasSeoTitle` 通过
7. `hasSeoDescription` 通过
8. `hasRenderablePath` 通过
9. `hasMeaningfulContent` 通过
10. `hasNoPlaceholder` 通过
11. `canPrerender` 通过

不合格 page 会进入 `skippedRoutes`，并记录 `skipReason` 与 `errors`。`draft`、`archived`、`preview`、placeholder、测试、TODO、占位内容和 requiredChecks 未通过页面都不会进入 `shouldGenerate`，也不会进入 sitemap。

`/preview/pages/:id` 只用于后台安全预览，永远不进入 route manifest 和 sitemap。

### Solution detail takeover 试点

第21-6A-3 起，solution detail page 的 pages takeover 只开放以下试点路径：

- `/solutions/salon`
- `/solutions/annual`

- 当 `pages.json` 中存在上述 path 的合格 published page，且通过 requiredChecks 时，route manifest 由该 page 接管对应 solution detail route，`sourceType` 为 `page`。
- 被 page 接管时，对应 legacy solution route 不再同时进入 `routes`，避免同一路径重复生成 HTML 或 sitemap。
- 当 takeover page 不存在、不是 published、`shouldIndex=false` 或 requiredChecks 未通过时，page 会进入 `skippedRoutes` 或不参与生成，前台与 route manifest 均 fallback 到 legacy solution 详情页。
- 当前不开放 `/solutions/exhibition`、`/solutions/video`、`/solutions/forum`、`/solutions/other`、`/solutions/family-day` 的 pages takeover。后续需通过单页验收后再扩展。

## 8. route manifest / sitemap / publish log

第21-4B 起，route manifest 支持 `sourceType: 'page'`：

- 合格 page 进入 `routes`，并参与 prerender HTML。
- 不合格 page 进入 `skippedRoutes`。
- sitemap 只来自 `manifest.routes.filter(route => route.shouldGenerate)`。
- preview 路由不进入 sitemap。
- publish log 会记录各 sourceType 的 `discovered` / `generated` / `skipped` 数量，并保留 skipped page 的 `skipReason`。

## 9. 后续衔接

第21-3 已实现后台页面编辑器 V1 的最小 UI，支持列表、创建、编辑基础字段、状态切换、复制、删除和排序。

第21-4A 已接前台 `publicContent` 与 React 预览渲染。

第21-4B 已接 route manifest、prerender 校验、sitemap 与 publish log 统计能力。

第21-5 建议做端到端验收和发布前检查。

第21-6 才开始正式补官网页面资料。
