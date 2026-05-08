# NEED 官网第21轮页面模型与 API 骨架说明

## 1. 本步目标

第21-2 只建立 pages / 页面编辑器 V1 的数据模型与 API 骨架，作为后续接入后台页面编辑器、前台真实渲染、route manifest 和 sitemap 的基础。

本步不接前台渲染，不接 route manifest，不接 sitemap，不触发 build:prerender，不进入 MySQL，也不补正式官网资料。

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

## 5. requiredChecks 预留

Page 模型预留以下检查项：

- `hasTitle`
- `hasSeoTitle`
- `hasSeoDescription`
- `hasRenderablePath`
- `hasMeaningfulContent`
- `hasNoPlaceholder`
- `canPrerender`

第21-2 只在 service 层提供基础校验函数，不让这些检查影响 route manifest。后续只有当页面具备 React 真实渲染能力、requiredChecks 通过并完成发布验收后，才允许进入 HTML 与 sitemap。

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

`server/data/pages.json` 初始为空数组。第21-2 不新增 published 页面，不接 route manifest，不让任何 page 自动进入 sitemap。

后续任何 page 即使改为 `published`，也必须同时满足：

1. React 能真实渲染该 path。
2. route manifest 能发现并识别来源。
3. requiredChecks 通过。
4. build:prerender 成功。
5. sitemap 正确包含。
6. publish log 记录成功。

不能为了让页面进入 sitemap 而放松 requiredChecks，也不能把 draft、placeholder 或无法真实渲染的页面硬塞进 HTML。

## 8. 后续衔接

建议第21-3 实现后台页面编辑器 V1 的最小 UI，先支持列表、创建、编辑基础字段、状态切换、复制、删除和排序。

第21-4 再接前台 `publicContent` 与 React 渲染。

第21-5 再接 route manifest、prerender 校验和 sitemap。

第21-6 才开始正式补官网页面资料。
