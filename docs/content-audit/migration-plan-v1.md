# 第 15 轮内容迁移计划 v1

审计依据：`docs/content-audit/current-site-content-audit-v1.md`  
目标轮次：第 15 轮“现有官网内容迁移进后台”

## A. 第 15 轮迁移目标

第 15 轮建议把当前官网前台已经写死的可确认内容迁移为后台初始数据，让后台成为后续静态发布的数据源。

迁移目标不是改前台展示，也不是直接发布静态页面，而是建立一套可复用的初始数据：

- 首页配置：首屏文案、首页视频、首页关键模块文案、首页 CTA。
- 媒体库登记：当前被前台引用且确认有效的 public 图片/视频。
- 文章管理：`App.tsx` 中硬编码文章和 `public/` 中有正文的 Markdown 文章。
- 案例解析：现代汽车家庭日案例的文本内容和可找回的案例图片。
- 场景解决方案：7 个场景的说明文案，以及确认可公开的场景案例组。
- SEO/GEO 基础字段：title、description、slug、alt、摘要、关键词。

## B. 迁移优先级

### 第一优先级

| 内容 | 来源 | 目标后台模块 | 迁移理由 | 注意事项 |
|---|---|---|---|---|
| 首页视频 | `public/hero-video.mp4`、`src/App.tsx:195` | 首页管理 + 媒体库 `home_video` | 首页首屏核心资产 | 需要确认视频是否为最终版。 |
| 首页核心文案 | `src/App.tsx` 首页各模块 | 首页管理 | 后续官网发布必须可配置 | 需要确认编码和最终文案。 |
| 首页二维码 | `public/qr-wechat.png`、`qr-xhs-main.png`、`qr-xhs-sub.png` | 媒体库 `qrcode` + 首页/站点配置 | 联系转化入口 | 需要确认账号有效。 |
| 首页 12 图 / 交互图 | 当前没有真正 12 张本地交互图，只有 6 张 Unsplash 外链图 | 首页管理 + 媒体库 `home_interactive` | 是后台已有模块 | 不能直接迁移 Unsplash 为真实素材；需补真实图。 |
| 现有案例 | `src/App.tsx:877` | 案例解析 | 有长正文，GEO 价值高 | 图片缺失，建议找 Word 原稿重新导入。 |
| 现有场景方案 | `src/App.tsx:2265`、`src/App.tsx:2324`、`src/App.tsx:2462` | 场景解决方案 | 与第 13 轮后台模块匹配 | 前台 id 需映射到后台 slug。 |

### 第二优先级

| 内容 | 来源 | 目标后台模块 | 迁移理由 | 注意事项 |
|---|---|---|---|---|
| 代码内文章 | `articlesData`、`chooseBetweenTwoArticlesData` | 文章管理 | 已有独立详情路由，适合静态发布 | 补 slug、SEO、栏目。 |
| public 中有内容的 Markdown | `public/01_...md` 到 `public/04_...md` | 文章管理 | 可能是旧版文章稿 | 需检查是否与代码文章重复。 |
| 被引用 public 图片 | logo、二维码、factory 图片 | 媒体库 / 站点配置 | 当前页面依赖 | logo/工厂图归属需人工确认。 |
| SEO 基础字段 | `index.html`、代码标题摘要 | 发布系统 / GEO 检查 | 静态发布前必需 | 当前只有全站 meta。 |

### 第三优先级

| 内容 | 来源 | 目标后台模块 | 迁移理由 | 注意事项 |
|---|---|---|---|---|
| 未引用但可能有价值的素材 | `public/red1.jpg`、`red2.jpg`、`wechat-qr.jpg` | 媒体库 `temporary` / `qrcode` | 可能是旧素材 | 需人工确认是否保留。 |
| 空 Markdown 选题文件 | `public/一家...md` 等 4 个空文件 | 文章管理草稿 | 可作为选题 | 不应迁移为已发布文章。 |
| 旧图 / 备选图 / 临时资源 | 当前未发现更多目录 | 媒体库 `temporary` | 归档备用 | 第 15 轮可先不处理。 |

## C. 未来后台归属关系

| 当前内容 | 未来后台归属 |
|---|---|
| 首页首屏文案 | 首页管理 |
| 首页视频 | 媒体库 + 首页管理 |
| 首页二维码 | 媒体库 `qrcode` + 首页管理 / 站点配置 |
| 首页交互图 / 创意案例现场 | 媒体库 `home_interactive` + 首页管理 |
| 首页文章预览 | 文章管理数据驱动 |
| 首页案例预览 | 案例解析数据驱动 |
| “怎么选活动公司”文章 | 文章管理，栏目为“怎么选活动公司” |
| “二选一怎么选”文章 | 文章管理，栏目为“二选一怎么选” |
| 方法判断类长文 | 文章管理，栏目为“方法与判断” |
| 现代汽车家庭日案例 | 案例解析；可同步归档到场景解决方案 `family-day` |
| 7 个场景说明 | 场景解决方案 |
| 场景项目图库 | 场景解决方案案例组 |
| 联系页地址、邮箱、二维码 | 站点配置 / 页面编辑器；媒体先进媒体库 |
| 工厂/资产介绍 | 页面编辑器或后续“企业资产”模块；媒体先进媒体库 |
| 专题页内容 | 页面编辑器 |
| SEO 字段 | GEO 检查 / 发布系统 |

## D. 建议迁移方式

第 15 轮建议采用“初始化 JSON 数据 + 媒体库登记”的方式，不要求人工重新上传一遍已有 `public/` 资源。

建议方式：

1. 编写一次性迁移脚本或初始化函数，把可确认内容写入现有本地 JSON。
2. 首页配置写入首页管理已有数据文件。
3. 文章内容写入文章管理 JSON，保留原正文 Markdown/HTML。
4. 案例内容写入 `server/data/cases.json`，缺失图片先标记为待补，不写无效媒体引用。
5. 场景内容写入 `server/data/solutions.json`，先迁移场景说明和已确认案例组。
6. `public/` 中被引用的图片/视频登记到 `media-library.json`，url 可继续指向现有 public 路径或在后续迁移到 uploads。
7. 媒体登记时补基础元数据：`category`、`ownerType`、`ownerSlug`、`groupKey`、`displayName`、`alt`、`status`。
8. 对无法确认的内容使用 `draft` 或 `offline`，不要直接发布。

媒体登记建议：

| 资源 | category | ownerType | ownerSlug | groupKey |
|---|---|---|---|---|
| `hero-video.mp4` | `home_video` | `home` | `homepage` | `hero` |
| 二维码 | `qrcode` | `site` | `contact` | 对应账号 |
| 首页交互图 | `home_interactive` | `home` | `homepage` | `interactive` |
| 案例图片 | `case_image` | `case` | 案例 slug | `legacy-import` 或 `word-import` |
| 场景图片 | `solution_image` | `solution` | sceneSlug | group slug |
| 场景视频 | `solution_video` | `solution` | sceneSlug | group slug |
| 工厂资产图 | `temporary` | `site` | `contact-assets` | `factory` |

## E. 第 15 轮建议拆解

1. 迁移首页配置
   - 写入首页首屏文案、模块文案、CTA 文案。
   - 绑定首页视频。
   - 保留当前前台不接入正式发布。

2. 登记首页图片/视频到媒体库
   - 登记 `hero-video.mp4`。
   - 登记二维码。
   - 对首页交互图先等待真实素材；不要把 Unsplash 外链登记为 NEED 案例图。

3. 迁移文章数据
   - 迁移 `articlesData` 4 篇。
   - 迁移 `chooseBetweenTwoArticlesData` 4 篇。
   - 读取 public 中 4 个有内容的 Markdown，人工确认后迁移。
   - 为空 Markdown 建立草稿或暂不迁移。

4. 迁移案例数据
   - 迁移现代汽车家庭日案例文本。
   - 生成 slug、摘要、SEO title、SEO description。
   - 图片缺失时标记为待补，不写坏链接。
   - 如能找到 Word 原稿，优先用第 12 轮 Word 导入流程重新生成案例草稿。

5. 迁移场景解决方案数据
   - 把前台 id 映射为后台默认 sceneSlug。
   - 迁移 7 个场景说明。
   - `family-day` 可建立已确认案例组；其他场景先保留说明，案例组等待素材。

6. 补齐 alt / slug / SEO
   - 每篇文章补 slug、seoTitle、seoDescription、keywords。
   - 每张图补 displayName、alt、caption。
   - 每个场景补摘要和 GEO 关键词。

7. 跑后台数据质量检查
   - 检查 JSON 可读写。
   - 检查媒体库 category / ownerType / ownerSlug / groupKey。
   - 检查缺图、空正文、重复 slug。
   - 检查刷新后后台数据仍保留。

## F. 第 15 轮不建议做的事

1. 不建议直接把后台数据接入正式官网前台。
2. 不建议做静态 HTML 发布。
3. 不建议把 Unsplash 外链当作真实案例资产迁移。
4. 不建议迁移空 Markdown 为正式文章。
5. 不建议删除 public 中未引用文件，应先人工确认。
6. 不建议接 MySQL / COS。
7. 不建议做页面编辑器；联系页和专题页复杂内容可先记录为待迁移。

## G. 第 15 轮验收建议

1. 后台首页管理能看到迁移后的首页文案和视频。
2. 媒体库能看到首页视频、二维码、可确认图片。
3. 文章管理能看到迁移后的文章草稿/发布状态。
4. 案例解析能看到现代汽车家庭日案例草稿。
5. 场景解决方案能看到 7 个场景说明和确认后的案例组。
6. 所有迁移数据刷新后仍保留。
7. 没有坏 JSON、重复 slug、错误 category。
8. 前台 `src/App.tsx` 不受影响。
