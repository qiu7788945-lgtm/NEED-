# Scenario Detail Page Model V21

## 1. 总体判断

第21-6A-4 只读盘点确认，场景解决方案三级页不应继续默认作为普通文章页处理。

`/solutions/family-day` 当前已经体现出更适合 NEED 官网的方向：它不是长文型 solution article，而是以项目、案例、图库、现场氛围和 CTA 组成的展示型页面。后续 `salon`、`annual`、`exhibition`、`forum`、`other` 等三级页，也应优先向这种“项目 / 案例展示型页面”靠拢。

因此，本轮建议将未来场景三级页抽象为两类：

- `scenarioShowcasePage`：普通场景展示型页面，用于承载项目图库、案例入口、策略说明和执行重点。
- `mediaShowcasePage`：视频与数字资产特殊媒体页，用于承载视频、图片、封面、截图、成片资产和分发场景说明。

当前 `pages` takeover 能力只证明了路由接管、manifest 去重、sitemap 唯一和 fallback 可行，不代表当前 `Page.sections` 模型已经适合正式业务内容。

## 2. 页面类型

建议未来新增页面模型层面的页面类型，而不是把所有内容继续塞进通用 `Page`。

```ts
export type ScenarioDetailPageType =
  | 'scenarioShowcasePage'
  | 'mediaShowcasePage';
```

`scenarioShowcasePage` 面向普通活动场景。它强调项目展示、现场图片、案例卡片、策略说明和 CTA。

`mediaShowcasePage` 面向视频与数字资产。它强调视频播放、poster / cover、数字资产截图、成片类型、案例短片和分发渠道。

## 3. 普通场景展示型页面适用范围

`scenarioShowcasePage` 建议适用于：

- `/solutions/family-day`
- `/solutions/salon`
- `/solutions/annual`
- `/solutions/exhibition`
- `/solutions/forum`
- `/solutions/other`

其中 `/solutions/family-day` 当前已有独立 legacy 结构，即 `FamilyDayPage` + 硬编码 `projectsData`。后续不应直接用新模型粗暴覆盖它，而应单独设计 adapter，把 legacy 数据逐步映射到统一模型，确保现有展示不被破坏。

各页面未来内容重心建议：

- `/solutions/salon`：客户答谢、精品沙龙项目图、现场氛围图、空间图。
- `/solutions/annual`：舞台、流程、员工参与、年会现场图。
- `/solutions/exhibition`：美陈、展览、空间装置、视觉物料图。
- `/solutions/forum`：论坛会场、嘉宾、签到、流程、主视觉图。
- `/solutions/other`：特殊场景案例组合图和跨界项目展示。

## 4. 视频与数字资产特殊页适用范围

`mediaShowcasePage` 建议适用于：

- `/solutions/video`

该页面不能只按普通图片页处理。它未来需要同时支持：

- `video`
- `image`
- `poster / cover`
- `thumbnail`
- `caseFilm`
- `recap`
- `screenshot`
- `finalAsset`
- `distribution channel / 使用场景说明`

视频与数字资产页还应支持对资产类型进行解释，例如活动回顾片、宣传片成片、案例短片、短视频切条、数字资产截图、传播渠道版本等。

## 5. 建议数据结构

以下 TypeScript interface 仅作为第21-6A-5 设计草案，不代表本轮需要改代码。

```ts
export type ScenarioDetailStatus = 'draft' | 'published' | 'archived';

export type ScenarioDetailPageType =
  | 'scenarioShowcasePage'
  | 'mediaShowcasePage';

export type ScenarioMediaFileType = 'image' | 'video';

export type ScenarioMediaUsage =
  | 'hero'
  | 'cover'
  | 'gallery'
  | 'projectGallery'
  | 'caseCard'
  | 'poster'
  | 'thumbnail'
  | 'caseFilm'
  | 'recap'
  | 'promo'
  | 'screenshot'
  | 'finalAsset'
  | 'other';

export type ScenarioCaseRelationType =
  | 'featured'
  | 'related'
  | 'sourceCase'
  | 'similarScene';

export type VideoAssetType =
  | 'recap'
  | 'promo'
  | 'caseFilm'
  | 'shortClip'
  | 'screenshot'
  | 'other';

export interface ScenarioDetailPage {
  id: string;
  path: string;
  pageType: ScenarioDetailPageType;
  status: ScenarioDetailStatus;
  title: string;
  seoTitle: string;
  seoDescription: string;
  heroTitle: string;
  heroSubtitle: string;
  heroMedia: ScenarioMediaItem | null;
  intro: string;
  audience: string[];
  goals: string[];
  projectItems: ScenarioProjectItem[];
  mediaGallery: ScenarioMediaItem[];
  caseRefs: ScenarioCaseRef[];
  strategySections: ScenarioSection[];
  executionPoints: ScenarioSection[];
  faqItems: ScenarioFaqItem[];
  cta: ScenarioCta | null;
  shouldIndex: boolean;
  sortOrder: number;
}

export interface ScenarioProjectItem {
  id: string;
  title: string;
  slogan: string;
  summary: string;
  tags: string[];
  location: string;
  clientType: string;
  eventType: string;
  dateText: string;
  coverMediaId: string;
  mediaItems: ScenarioMediaItem[];
  caseRefId: string;
  sortOrder: number;
  enabled: boolean;
}

export interface ScenarioMediaItem {
  id: string;
  mediaId: string;
  url: string;
  fileType: ScenarioMediaFileType;
  usage: ScenarioMediaUsage;
  alt: string;
  caption: string;
  posterMediaId: string;
  posterUrl: string;
  thumbnailUrl: string;
  duration: number | null;
  projectId: string;
  sortOrder: number;
  enabled: boolean;
}

export interface ScenarioCaseRef {
  id: string;
  title: string;
  path: string;
  summary: string;
  coverMediaId: string;
  relationType: ScenarioCaseRelationType;
  sortOrder: number;
  enabled: boolean;
}

export interface ScenarioSection {
  id: string;
  type:
    | 'intro'
    | 'strategy'
    | 'execution'
    | 'audience'
    | 'goal'
    | 'caseGrid'
    | 'mediaShowcase'
    | 'projectGallery'
    | 'cta'
    | 'other';
  title: string;
  subtitle: string;
  body: string;
  items: string[];
  mediaItems: ScenarioMediaItem[];
  sortOrder: number;
  enabled: boolean;
}

export interface ScenarioFaqItem {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  enabled: boolean;
}

export interface ScenarioCta {
  title: string;
  description: string;
  buttonText: string;
  href: string;
}

export interface VideoShowcaseBlock {
  id: string;
  title: string;
  description: string;
  videoMediaId: string;
  posterMediaId: string;
  thumbnailUrl: string;
  assetType: VideoAssetType;
  distributionChannels: string[];
  relatedProjectId: string;
  sortOrder: number;
  enabled: boolean;
}
```

`mediaShowcasePage` 可以在 `ScenarioDetailPage` 基础上扩展：

```ts
export interface MediaShowcasePage extends ScenarioDetailPage {
  pageType: 'mediaShowcasePage';
  videoBlocks: VideoShowcaseBlock[];
}
```

## 6. 与当前 pages 模型的差距

当前 `Page` / `sections` / `mediaRefs` 不足以承接场景三级页的正式目标。

主要差距：

- 缺少 `projectItems`，无法表达多个项目展示。
- 缺少项目级图库，无法把图片归属到具体项目。
- 缺少 `caseRefs`，无法结构化关联案例详情入口。
- 缺少 `videoBlocks`，无法表达视频与数字资产页面。
- 缺少 media type，`mediaRefs` 无法判断 image / video。
- 缺少 poster / thumbnail / video role。
- 缺少项目、block、case 级归属关系。
- `PageEditorPage` 当前不能结构化编辑项目图库。
- `PageEditorPage` 当前 mediaRefs 偏手填 URL，不是完整媒体库选择与绑定。
- `DynamicPage` 是通用白底文字模板，不是最终场景展示模板。

因此，不建议继续把正式场景三级页内容强行塞进 `sections.body` 或 Markdown。

## 7. 与 media-library 的关系

当前 media-library 已经比较接近素材库。它具备：

- image / video 文件类型
- url
- width / height
- duration
- thumbnailUrl
- alt
- caption
- category
- ownerType / ownerSlug
- groupKey
- slotNo
- sortOrder
- enabled

但 `pages.mediaRefs` 太薄，只能表达简单引用，无法稳定承载正式页面的项目图库和视频资产。

建议未来 media 引用从“手填 URL”升级为：

- 从 media-library asset 中选择素材。
- 页面保存 `mediaId`，不要只保存 URL。
- 自动带出 `url`、`fileType`、`width`、`height`、`duration`、`thumbnailUrl`。
- 页面级允许覆盖 `usage`、`alt`、`caption`。
- 支持 `projectId`、`blockId`、`caseRefId` 等归属关系。
- 支持视频 poster 的显式绑定：`posterMediaId` / `posterUrl`。
- 支持同一素材在不同页面位置有不同说明文案。

这样 media-library 继续作为资产源，scenario detail page 作为展示编排层。

## 8. 后续实施路线

建议第21-6A 后续拆分为：

- 第21-6A-5：数据模型设计文档，即本文档。
- 第21-6A-6：新增 scenario detail 类型定义与后端 JSON 数据骨架。
- 第21-6A-7：后台编辑器支持 `projectItems` / `mediaGallery` 基础编辑。
- 第21-6A-8：前台新建 `ScenarioShowcasePage` 模板，先不覆盖 family-day。
- 第21-6A-9：选择一个页面试点，例如 `/solutions/salon` 或 `/solutions/annual`，使用展示型模板接管。
- 第21-6A-10：`/solutions/video` 特殊媒体页单独设计。
- 第21-6A-11：再考虑 family-day legacy adapter。

这个顺序可以避免把现有 `family-day` 展示破坏掉，也能避免 route manifest 先行正确但页面模型仍然错误。

## 9. 风险点

- 不要把三级页做成普通文章页，否则会偏离未来官网展示目标。
- 不要破坏 `/solutions/family-day` 当前展示，它是现阶段最接近目标的 legacy 样板。
- `/solutions/video` 不要只按图片页处理，它需要视频、poster、截图、成片资产和分发说明。
- 不要让 route manifest 正确但页面价值不足。
- 不要让后台字段看似完整但前台无法真实渲染。
- 不要把临时验收 `pages.json` 提交。
- 不要为了 sitemap 唯一而忽略内容结构质量。
- 不要把 salon / annual 的 takeover 技术试点误判为最终页面模型。

## 10. 本轮禁令

第21-6A-5 只允许新增或更新设计文档。

本轮不修改：

- `src/App.tsx`
- `src/services/publicContent.ts`
- `server/src/scripts/prerender-route-manifest.ts`
- `server/src/services/pages/pages.service.ts`
- `admin/src/pages/PageEditorPage.tsx`
- `server/data/pages.json`
- `server/data/solutions.json`
- `dist-prerender`
- `server/data/publish-logs`

本轮不运行：

- `build:prerender`
- MySQL 相关命令
- 登录、安全、权限、部署相关操作

## 11. 第21-6A-6 类型与 API 骨架

第21-6A-6 新增 scenario detail 的类型定义、空 JSON 数据文件和后端 CRUD API 骨架。

新增类型文件：

- `shared/types/scenario-detail.ts`

新增数据文件：

- `server/data/scenario-detail-pages.json`

该文件初始内容必须保持为空数组：

```json
[]
```

新增后端骨架：

- `server/src/services/scenario-detail/scenario-detail.service.ts`
- `server/src/controllers/scenario-detail.controller.ts`
- `server/src/routes/scenario-detail.routes.ts`

后端 API 挂载到：

- `/api/scenario-detail-pages`

当前提供的接口：

- `GET /api/scenario-detail-pages`
- `GET /api/scenario-detail-pages/:id`
- `POST /api/scenario-detail-pages`
- `PUT /api/scenario-detail-pages/:id`
- `PATCH /api/scenario-detail-pages/:id/status`
- `DELETE /api/scenario-detail-pages/:id`
- `POST /api/scenario-detail-pages/:id/duplicate`
- `POST /api/scenario-detail-pages/reorder`

当前 validation 仅用于 scenario detail 自身校验，字段包括：

- `hasTitle`
- `hasSeoTitle`
- `hasSeoDescription`
- `hasValidPath`
- `hasMeaningfulIntro`
- `hasProjectOrMediaContent`
- `hasNoPlaceholder`
- `canPublish`

第21-6A-6 仍未接入：

- 前台渲染
- 后台 UI
- route manifest
- sitemap
- prerender HTML

## 12. 第21-6A-9 family-day 后台数据消费试点

第21-6A-9 调整方向为复用既有“场景解决方案”后台模块，而不是继续为场景三级页新建一套 PageEditor 或 scenario-detail 编辑器。

本轮以 `/solutions/family-day` 作为可控试点：

- 内容主来源优先读取 `SolutionManagementPage` 对应的 `/api/solutions` 数据。
- 只消费 `server/data/solutions.json` 中 `family-day` 场景下 enabled 的案例组和组内 enabled 图片素材。
- 前台仍使用既有 `FamilyDayPage` 项目 / 案例展示型视觉，不改成普通文章页，不改成 `DynamicPage`。
- 当后台 family-day 没有 enabled 案例组、没有有效图片素材、接口失败或字段不足时，继续 fallback 到 legacy `projectsData`，避免页面白屏。
- 本轮跳过 family-day 中的视频素材播放；视频与数字资产能力后续仍交给 `/solutions/video` 单独设计。
- route manifest 只让 `/solutions/family-day` 的 requiredChecks 与实际 HTML 渲染字段对齐：有可用后台项目时检查场景名、案例组标题、摘要、slug 与 CTA；无可用后台项目时保留 legacy fallback checks。

维护入口边界保持不变：

- 场景解决方案内容继续由 `SolutionManagementPage` 维护。
- `PageEditorPage` 不负责场景方案内容。
- `scenario-detail` API 骨架暂时冻结，不接 UI、不接前台、不接 route manifest、不接 sitemap。

这意味着 scenario detail 页面即使创建为 `published`，也不会影响当前 17 个正式页面，不会进入 sitemap，也不会接管 `/solutions/*` 路径。下一步才考虑后台编辑器或模板试点。

## 13. 第21-6A-10 通用场景展示适配层

第21-6A-10 不新增正式内容、不改 `solutions.json`，只把第21-6A-9 中 `/solutions/family-day` 已验证的后台案例组消费逻辑沉淀为前台通用展示适配层。

本轮新增前台轻量模型：

- `ScenarioShowcaseData`
- `ScenarioShowcaseProject`
- `ScenarioShowcaseMedia`

核心适配函数为 `adaptSolutionGroupsToShowcaseProjects`，输入仍来自 `SolutionManagementPage` 对应的 `/api/solutions` 数据，输出用于展示型“项目 / 案例 / 图库”页面。它保留 scene slug、scene title、scene description、enabled groups、group title、group summary、group slug、group sortOrder，以及组内 enabled media 的 `image` / `video` 类型、url、alt、caption 等字段。

当前 `/solutions/family-day` 只消费适配结果中的图片素材，继续使用既有 `FamilyDayPage` 展示型视觉；当后台数据不可用、没有有效案例组或没有可展示图片时，仍 fallback 到 legacy `projectsData`。

边界保持不变：

- 维护入口仍是后台“场景解决方案”模块 `SolutionManagementPage`。
- `PageEditor` 不负责场景方案内容。
- 不使用 `pages.json` 维护场景案例内容。
- `scenario-detail` API 骨架暂时冻结，不接前台、不接 UI、不接 route manifest、不接 sitemap。
- 本轮不正式接管 `salon`、`annual`、`exhibition`、`forum`、`other` 等其他场景三级页。

`/solutions/video` 保留特殊性：当前通用适配层会识别并保留 video media 字段，但不会在 family-day 播放视频。后续 video 页需要单独增强 `videoShowcase`、poster、thumbnail、duration、图片 / 视频混合媒体排版等能力。

## 14. 第21-6A-11 冻结旧 pages takeover

第21-6A-11 明确收回 `/solutions/salon` 与 `/solutions/annual` 的 PageEditor pages takeover 能力。该能力只作为第21-6A-2 / 第21-6A-3 的历史技术试点保留记录，不作为场景解决方案的正式业务路线。

后续归属：

- `/solutions/family-day`
- `/solutions/salon`
- `/solutions/annual`
- `/solutions/exhibition`
- `/solutions/video`
- `/solutions/forum`
- `/solutions/other`

上述场景解决方案路径统一归 `SolutionManagementPage` 管理。`PageEditor` 不负责已有业务模块路径，只负责普通页面、专题页、GEO 长尾页、补充页面等没有专属后台的内容。

`scenario-detail` API 骨架继续冻结，不接前台、不接 UI、不接 route manifest、不接 sitemap。
