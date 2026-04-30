# 当前官网内容迁移清单 v1

审计时间：2026-04-30  
审计范围：`src/`、`public/`、`index.html`、`metadata.json`。  
本轮只做盘点，不迁移数据、不修改前台/后台/服务端功能。

## 结论摘要

当前官网前台内容主要硬编码在 [src/App.tsx](/d:/needwebV1/need-pr-agency/src/App.tsx) 和 [src/pages/ContactAndAssetsPage.tsx](/d:/needwebV1/need-pr-agency/src/pages/ContactAndAssetsPage.tsx) 中。`public/` 中存在一批真实资源，但也有未引用资源、空 Markdown 占位文件，以及 `App.tsx` 中引用但 `public/` 当前不存在的案例图片。

第 15 轮迁移应优先处理：首页视频、首页二维码/联系信息、首页栏目文案、文章数据、现代汽车家庭日案例、场景解决方案文案和可确认的 public 媒体资源。部分内容存在编码显示异常、缺图、占位数据或外链图片依赖，需要人工确认后再迁移。

## A. 当前官网页面结构总览

| 页面 / 模块名称 | 当前源码位置 | 当前内容类型 | 是否写死在代码里 | 是否需要迁移进后台 | 未来后台归属模块 | GEO 重要性 | 备注 |
|---|---|---:|---:|---:|---|---|---|
| 全站路由 | `src/App.tsx:2665` | 路由结构 | 是 | 部分 | 发布系统 / 静态路由规划 | 高 | 当前没有静态发布；未来文章、案例、场景需要独立 URL。 |
| 开屏 Splash | `src/App.tsx:9` | 动效 / 品牌露出 | 是 | 否 | 保留固定 | 低 | 属于体验层，不建议进入内容后台。 |
| 顶部导航 Navbar | `src/App.tsx:65` | 导航、二级场景入口 | 是 | 部分 | 站点配置 / 场景解决方案 | 中 | 场景名称可由后台场景配置驱动；导航样式保留固定。 |
| 首页首屏 Hero | `src/App.tsx:195` | 标题、品牌文案、视频、CTA | 是 | 是 | 首页管理 + 媒体库 | 高 | `/hero-video.mp4` 应迁入首页视频配置。 |
| 我们是谁 | `src/App.tsx:351` | 品牌介绍文案 | 是 | 是 | 首页管理 | 高 | 建议作为首页模块文案迁移。 |
| 创意案例现场 / 交互图轨迹 | `src/App.tsx:399` | 视觉模块、6 张外链图、引导文案 | 是 | 部分 | 首页管理 + 媒体库 | 中 | 当前使用 Unsplash 外链，不宜直接作为真实案例图。 |
| 方法预览 | `src/App.tsx:663` | 文章卡片入口 | 是 | 是 | 文章管理 | 高 | 由 `articlesData` 驱动。 |
| 案例预览 | `src/App.tsx:709` | 案例卡片入口 | 是 | 是 | 案例解析 | 高 | 当前重复使用同一案例制造三张卡片，需去重。 |
| 怎么选活动公司预览 | `src/App.tsx:790` | 栏目入口 | 是 | 是 | 文章管理 | 高 | 应迁移为栏目页/专题页内容。 |
| 二选一怎么选预览 | `src/App.tsx:824` | 栏目入口 | 是 | 是 | 文章管理 | 高 | 应迁移为栏目页/专题页内容。 |
| 首页 CTA / 二维码 | `src/App.tsx:569` | 联系入口、二维码 | 是 | 是 | 首页管理 + 媒体库 / 站点配置 | 中 | 二维码资源存在于 `public/`。 |
| 联系我们与硬核资产页 | `src/pages/ContactAndAssetsPage.tsx:1` | 地址、邮箱、二维码、工厂图片 | 是 | 部分 | 站点配置 / 页面编辑器 / 媒体库 | 中 | 目前后台没有“站点配置/页面编辑器”，第 15 轮可先登记媒体。 |
| 文章栏目页：怎么选活动公司 | `src/App.tsx:1603` | 栏目长文、观察点、文章列表 | 是 | 是 | 文章管理 / 页面编辑器 | 高 | 有独立 URL，适合静态发布。 |
| 文章详情页 | `src/App.tsx:1797` | Markdown 文章详情 | 是 | 是 | 文章管理 | 高 | 由 `articlesData` 生成。 |
| 文章栏目页：二选一怎么选 | `src/App.tsx:1847` | 栏目长文、场景、清单、文章列表 | 是 | 是 | 文章管理 / 页面编辑器 | 高 | 有独立 URL，适合静态发布。 |
| 二选一文章详情页 | `src/App.tsx:2192` | Markdown 文章详情 | 是 | 是 | 文章管理 | 高 | 由 `chooseBetweenTwoArticlesData` 生成。 |
| 场景解决方案列表页 | `src/App.tsx:2258` | 7 个场景入口 | 是 | 是 | 场景解决方案 | 高 | 当前 slug 与后台默认 slug 不完全一致，需要映射。 |
| 场景文章页 | `src/App.tsx:2571` | 场景说明文章 | 是 | 是 | 场景解决方案 / 文章管理 | 高 | 非 `family-day` 场景主要是文案说明，缺真实案例组。 |
| 企业家庭日专题页 | `src/App.tsx:2485` | 场景专题、项目卡、图库 | 是 | 是 | 场景解决方案 + 案例解析 | 高 | 图库多为占位/外链 fallback，需要人工确认。 |
| 案例详情页 | `src/App.tsx:1549` | 案例文章详情 | 是 | 是 | 案例解析 | 高 | 当前主要是现代汽车家庭日案例。 |
| 404 页面 | `src/App.tsx:2628` | 固定提示 | 是 | 否 | 保留固定 | 低 | 可保留在代码中。 |

## B. 当前首页内容盘点

| 首页模块 | 当前文案内容摘要 | 当前图片 / 视频资源 | 当前源码位置 | 未来归属 | 是否迁移 | 是否需要补 SEO / alt | 是否需要人工确认 |
|---|---|---|---|---|---:|---:|---:|
| 顶部导航 | 品牌 logo、首页锚点、场景解决方案、联系我们等入口 | `/logo.png` | `src/App.tsx:65` | 站点配置 / 场景解决方案 | 部分 | logo alt 可保留 | 是，导航栏目是否后台化需确认。 |
| 首页首屏 | NEED 品牌主张、活动策划/空间表达相关核心文案、CTA | `/hero-video.mp4` | `src/App.tsx:195` | 首页管理 + 媒体库 | 是 | 需要首页 title/description、视频 poster/alt 说明 | 是，确认首屏最终文案。 |
| 我们是谁 | NEED 的定位、服务方式、判断力与落地能力表达 | 无 | `src/App.tsx:351` | 首页管理 | 是 | 需要作为首页正文模块保留关键词 | 是，编码和最终措辞需核对。 |
| 创意案例现场 / 交互图 | “FROM CREATIVE IDEAS TO REAL CASES”等视觉引导 | 6 张 Unsplash 外链图 | `src/App.tsx:399` | 首页管理 / 媒体库 | 部分 | 外链图缺业务 alt | 是，不建议直接当真实案例素材迁移。 |
| 方法与判断预览 | 从 `articlesData` 中读取文章卡片 | 无 | `src/App.tsx:663` | 文章管理 | 是 | 每篇文章需补 SEO | 否，内容主体在代码中。 |
| 案例预览 | 从 `caseStudiesData` 读取，当前用同一案例复制出 3 张卡片 | 现代汽车家庭日封面路径，但文件缺失 | `src/App.tsx:709` | 案例解析 | 是 | 案例图 alt、slug、SEO 需补 | 是，重复卡片不可直接迁移为 3 个案例。 |
| 怎么选活动公司预览 | 引导进入 `/how-to-choose` | 无 | `src/App.tsx:790` | 文章管理 / 专题页 | 是 | 栏目页需独立 SEO | 否。 |
| 二选一怎么选预览 | 引导进入 `/choose-between-two` | 无 | `src/App.tsx:824` | 文章管理 / 专题页 | 是 | 栏目页需独立 SEO | 否。 |
| 联系 CTA | 联系二维码、微信/小红书入口 | `/qr-wechat.png`、`/qr-xhs-main.png`、`/qr-xhs-sub.png` | `src/App.tsx:569` | 首页管理 + 媒体库 / 站点配置 | 是 | 二维码图片需要 alt | 是，确认三个账号是否仍使用。 |

## C. 当前文章 / 方法内容盘点

### 代码内文章

| 标题 | 当前位置 | 当前栏目判断 | 未来归属栏目 | 是否建议迁移 | 是否需要改写 | 是否需要补 slug / SEO |
|---|---|---|---|---:|---:|---:|
| 真正靠谱的活动执行，不是现场救火能力，而是前面少埋雷 | `src/App.tsx:966` | 方法与判断 | 方法与判断 | 是 | 可轻微校对 | 是 |
| 为什么有些方案看起来很好，现场却不成立 | `src/App.tsx:1098` | 方法与判断 | 方法与判断 | 是 | 可轻微校对 | 是 |
| 为什么一场活动开始前，先把目标判断清楚更重要 | `src/App.tsx:1234` | 方法与判断 | 方法与判断 | 是 | 可轻微校对 | 是 |
| 为什么预算判断，比一味堆创意更重要 | `src/App.tsx:1378` | 方法与判断 | 方法与判断 | 是 | 可轻微校对 | 是 |
| 一家案例更大，一家更贴需求，该怎么选 | `src/App.tsx:1524` | 二选一怎么选 | 二选一怎么选 | 是 | 可轻微校对 | 是 |
| 一家创意更强，一家执行更稳，怎么判断更适合你 | `src/App.tsx:1530` | 二选一怎么选 | 二选一怎么选 | 是 | 可轻微校对 | 是 |
| 一家报价更高，一家报价更低，真正该比什么 | `src/App.tsx:1536` | 二选一怎么选 | 二选一怎么选 | 是 | 可轻微校对 | 是 |
| 两家活动公司都不错，最后到底该怎么做决定 | `src/App.tsx:1542` | 二选一怎么选 | 二选一怎么选 | 是 | 可轻微校对 | 是 |

### public Markdown 文件

| 文件 | 状态 | 当前栏目判断 | 是否建议迁移 | 备注 |
|---|---|---|---:|---|
| `public/01_看活动公司_先看它是不是在理解需求.md` | 有内容 | 怎么选活动公司 | 是 | 可作为文章管理初始数据；需确认是否与代码内栏目内容重复。 |
| `public/02_怎么判断一个活动公司有没有判断力.md` | 有内容 | 怎么选活动公司 | 是 | 可作为文章管理初始数据；需补 slug / SEO。 |
| `public/03_活动公司案例很好看_为什么项目未必适合你.md` | 有内容 | 怎么选活动公司 | 是 | 可作为文章管理初始数据；需补 slug / SEO。 |
| `public/04_为什么很多活动最后不是输在创意_而是输在执行.md` | 有内容 | 方法与判断 | 是 | 与执行力主题相关，需确认是否并入“方法与判断”。 |
| `public/一家创意更强，一家执行更稳，怎么判断更适合你.md` | 空文件 | 二选一怎么选 | 暂不迁移 | 占位文件，需要人工补正文。 |
| `public/一家报价更高，一家报价更低，真正该比什么.md` | 空文件 | 二选一怎么选 | 暂不迁移 | 占位文件，需要人工补正文。 |
| `public/一家案例更大，一家更贴需求，该怎么选.md` | 空文件 | 二选一怎么选 | 暂不迁移 | 占位文件，需要人工补正文。 |
| `public/两家活动公司都不错，最后到底该怎么做决定.md` | 空文件 | 二选一怎么选 | 暂不迁移 | 占位文件，需要人工补正文。 |

## D. 当前案例内容盘点

| 案例标题 | 当前位置 | 图片资源 | 当前字段完整度 | 未来归属 | 是否建议迁移 | 是否需要人工补信息 | 是否需要 Word 化重新导入 |
|---|---|---|---|---|---:|---:|---:|
| 制造研发中心的家庭日，不只是让孩子玩一天 | `src/App.tsx:877` | `coverImg` 和正文 10 张图片路径均引用中文文件名，但当前 `public/` 未发现这些文件 | 有标题、摘要、标签、正文；缺客户类型/活动时间/地点/SEO/真实图片文件 | 案例解析 + 场景解决方案 `family-day` | 是 | 是，必须找回图片并确认客户名/公开权限 | 建议，如已有 Word 原稿可重新导入 |
| 首页案例预览的第 2 / 第 3 张卡片 | `src/App.tsx:709` | 同上 | 由同一案例复制出的展示项 | 不迁移为独立案例 | 否 | 是 | 否 |
| Festo 2025 企业家庭日 / 开放日项目 | `src/App.tsx:2462` | `projectsData.gallery` 中包含本地占位名与 Unsplash fallback | 有标题/年份/标签/摘要/图库结构，缺真实媒体确认 | 场景解决方案 `family-day`，必要时也可进入案例解析 | 待确认 | 是，确认是否真实可公开案例 | 待确认 |
| 家庭日模板案例 / 其他项目卡 | `src/App.tsx:2462` | 多为 `photo.jpg`、`photo-2.jpg` 等占位名或外链 fallback | 字段不完整 | 场景解决方案 `family-day` | 待确认 | 是 | 待确认 |

## E. 当前场景解决方案内容盘点

前台当前场景 id 与后台第 13 轮默认 `sceneSlug` 不完全一致。第 15 轮迁移时建议做映射：

| 前台 id | 后台 sceneSlug |
|---|---|
| `family-day` | `family-day` |
| `salon` | `client-appreciation` |
| `annual` | `annual-meeting` |
| `exhibition` | `commercial-display` |
| `video` | `video-digital-assets` |
| `forum` | `academic-forum` |
| `other` | `other` |

| 未来场景分类 | 当前内容 | 当前图片 / 视频 | 当前源码位置 | 未来 sceneSlug | 是否迁移成案例组 | 是否需要补图 / 补说明 / 补 alt |
|---|---|---|---|---|---:|---|
| 企业家庭日 / 开放日 | 场景列表卡、场景文章、FamilyDay 专题页、Festo/家庭日项目卡 | 现代汽车案例图路径缺失；FamilyDay 图库多为占位/Unsplash fallback | `src/App.tsx:2266`、`src/App.tsx:2326`、`src/App.tsx:2485` | `family-day` | 是 | 需要补真实图片、组标题、组摘要、alt。 |
| 客户答谢 & 精品沙龙 | 场景列表卡和场景说明文章 | 未发现真实图片 | `src/App.tsx:2267`、`src/App.tsx:2346` | `client-appreciation` | 暂不直接生成案例组 | 需要补案例图片或视频。 |
| 年会活动与企业文化 | 场景列表卡和场景说明文章 | 未发现真实图片 | `src/App.tsx:2268`、`src/App.tsx:2366` | `annual-meeting` | 暂不直接生成案例组 | 需要补案例图片或视频。 |
| 商业美陈与展览 | 场景列表卡和场景说明文章 | 未发现真实图片 | `src/App.tsx:2269`、`src/App.tsx:2386` | `commercial-display` | 暂不直接生成案例组 | 需要补案例图片、空间说明和 alt。 |
| 视频与数字资产 | 场景列表卡和场景说明文章 | 未发现视频素材；首页视频不等同于该场景素材 | `src/App.tsx:2270`、`src/App.tsx:2406` | `video-digital-assets` | 暂不直接生成案例组 | 需要补 1 个视频或主图。 |
| 学术与专业论坛 | 场景列表卡和场景说明文章 | 未发现真实图片 | `src/App.tsx:2271`、约 `src/App.tsx:2426` | `academic-forum` | 暂不直接生成案例组 | 需要补案例图和论坛关键词。 |
| 其他 | 场景列表卡和场景说明文章 | 未发现真实图片 | `src/App.tsx:2272`、`src/App.tsx:2446` | `other` | 暂不直接生成案例组 | 需要人工定义归档范围。 |

## F. 当前 public 资源盘点

### 图片

| 文件路径 | 文件名 | 资源类型 | 是否被前台引用 | 被哪些模块引用 | 未来媒体库分类建议 | 未来 ownerType | 未来 ownerSlug | 未来 groupKey | 是否建议迁移 | 是否可废弃 | 是否需要人工确认 |
|---|---|---|---:|---|---|---|---|---|---:|---:|---:|
| `public/logo.png` | `logo.png` | logo | 是 | Navbar | `temporary` | `site` | `global` | `brand` | 待定 | 否 | 是，logo 更适合站点配置而非普通媒体。 |
| `public/qr-wechat.png` | `qr-wechat.png` | 二维码 | 是 | 首页 CTA、联系页、二维码弹窗 | `qrcode` | `site` | `contact` | `wechat` | 是 | 否 | 是，确认账号有效。 |
| `public/qr-xhs-main.png` | `qr-xhs-main.png` | 二维码 | 是 | 首页 CTA、联系页、二维码弹窗 | `qrcode` | `site` | `contact` | `xhs-main` | 是 | 否 | 是，确认账号有效。 |
| `public/qr-xhs-sub.png` | `qr-xhs-sub.png` | 二维码 | 是 | 首页 CTA、联系页、二维码弹窗 | `qrcode` | `site` | `contact` | `xhs-sub` | 是 | 否 | 是，确认账号有效。 |
| `public/factory-1.png` | `factory-1.png` | 图片 | 是 | 联系页“自有设备仓库” | `temporary` | `site` | `contact-assets` | `factory` | 是 | 否 | 是，现有分类没有 contact_asset，可先临时登记。 |
| `public/factory-2.png` | `factory-2.png` | 图片 | 是 | 联系页“自有印厂” | `temporary` | `site` | `contact-assets` | `factory` | 是 | 否 | 是。 |
| `public/factory-3.png` | `factory-3.png` | 图片 | 是 | 联系页“自有数码印刷” | `temporary` | `site` | `contact-assets` | `factory` | 是 | 否 | 是。 |
| `public/factory-4.png` | `factory-4.png` | 图片 | 是 | 联系页“自有木作、3D 打印、泡沫雕刻特装工厂” | `temporary` | `site` | `contact-assets` | `factory` | 是 | 否 | 是。 |
| `public/red1.jpg` | `red1.jpg` | 图片 | 未发现 | 未发现 | `temporary` | `unknown` | `unknown` | `legacy` | 待定 | 待定 | 是。 |
| `public/red2.jpg` | `red2.jpg` | 图片 | 未发现 | 未发现 | `temporary` | `unknown` | `unknown` | `legacy` | 待定 | 待定 | 是。 |
| `public/wechat-qr.jpg` | `wechat-qr.jpg` | 二维码/图片 | 未发现 | 未发现 | `qrcode` | `site` | `contact` | `legacy` | 待定 | 待定 | 是，可能是旧二维码。 |

### 视频

| 文件路径 | 文件名 | 资源类型 | 是否被前台引用 | 被哪些模块引用 | 未来媒体库分类建议 | 未来 ownerType | 未来 ownerSlug | 未来 groupKey | 是否建议迁移 | 是否可废弃 | 是否需要人工确认 |
|---|---|---|---:|---|---|---|---|---|---:|---:|---:|
| `public/hero-video.mp4` | `hero-video.mp4` | 视频 | 是 | 首页首屏 | `home_video` | `home` | `homepage` | `hero` | 是 | 否 | 是，需确认是否需要 poster 和压缩版本。 |

### Markdown / 其他

| 文件路径 | 文件名 | 资源类型 | 是否被前台引用 | 被哪些模块引用 | 未来媒体库分类建议 | 未来 ownerType | 未来 ownerSlug | 未来 groupKey | 是否建议迁移 | 是否可废弃 | 是否需要人工确认 |
|---|---|---|---:|---|---|---|---|---|---:|---:|---:|
| `public/01_看活动公司_先看它是不是在理解需求.md` | 同名 | Markdown | 未发现直接引用 | 未发现 | 不进入媒体库 | `article` | 待生成 | `legacy-md` | 是 | 否 | 是，确认是否与代码文章重复。 |
| `public/02_怎么判断一个活动公司有没有判断力.md` | 同名 | Markdown | 未发现直接引用 | 未发现 | 不进入媒体库 | `article` | 待生成 | `legacy-md` | 是 | 否 | 是。 |
| `public/03_活动公司案例很好看_为什么项目未必适合你.md` | 同名 | Markdown | 未发现直接引用 | 未发现 | 不进入媒体库 | `article` | 待生成 | `legacy-md` | 是 | 否 | 是。 |
| `public/04_为什么很多活动最后不是输在创意_而是输在执行.md` | 同名 | Markdown | 未发现直接引用 | 未发现 | 不进入媒体库 | `article` | 待生成 | `legacy-md` | 是 | 否 | 是。 |
| `public/一家创意更强，一家执行更稳，怎么判断更适合你.md` | 同名 | Markdown | 未发现直接引用 | 未发现 | 不进入媒体库 | `article` | 待生成 | `placeholder` | 暂不迁移 | 否 | 是，空文件。 |
| `public/一家报价更高，一家报价更低，真正该比什么.md` | 同名 | Markdown | 未发现直接引用 | 未发现 | 不进入媒体库 | `article` | 待生成 | `placeholder` | 暂不迁移 | 否 | 是，空文件。 |
| `public/一家案例更大，一家更贴需求，该怎么选.md` | 同名 | Markdown | 未发现直接引用 | 未发现 | 不进入媒体库 | `article` | 待生成 | `placeholder` | 暂不迁移 | 否 | 是，空文件。 |
| `public/两家活动公司都不错，最后到底该怎么做决定.md` | 同名 | Markdown | 未发现直接引用 | 未发现 | 不进入媒体库 | `article` | 待生成 | `placeholder` | 暂不迁移 | 否 | 是，空文件。 |
| `public/README.md` | `README.md` | 说明文件 | 否 | 无 | 不进入媒体库 | 无 | 无 | 无 | 否 | 否 | 否。 |

### 源码引用但当前 public 未发现的资源

| 引用路径 | 当前位置 | 未来归属 | 迁移建议 |
|---|---|---|---|
| `/03-主题主视觉-花Young亲子家年华.jpg` 及编码异常等价路径 | `src/App.tsx:883` | 案例解析 / `case_image` | 当前文件不存在，需找回原图或通过 Word 重新导入。 |
| `/01-全场俯拍-场地利用.jpg` 到 `/10-礼品小卖部-场景化服务.jpg` 相关案例图 | `src/App.tsx:877` 正文 Markdown | 案例解析 / `case_image` | 当前文件不存在，不能直接迁移媒体引用。 |
| `photo.jpg`、`photo-2.jpg` 等 FamilyDay 图库名 | `src/App.tsx:2462` | 场景解决方案 / `solution_image` | 当前 public 未发现，且渲染逻辑会使用 Unsplash fallback；需人工确认真实图片。 |

## G. 当前 SEO / GEO 基础盘点

| 当前页面路由 | 当前 title | 当前 description | 是否需要独立 title | 是否需要独立 description | 是否需要 FAQ | 是否需要结构化数据 | 是否需要补内链 | 是否适合静态发布 |
|---|---|---|---:|---:|---:|---:|---:|---:|
| `/` | 使用 `index.html` 全站 title | 使用 `index.html` 全站 description | 是 | 是 | 可选 | Organization / LocalBusiness 可选 | 是 | 是 |
| `/contact` | 使用全站 title | 使用全站 description | 是 | 是 | 可选 | LocalBusiness / ContactPoint | 是 | 是 |
| `/how-to-choose` | 使用全站 title | 使用全站 description | 是 | 是 | 是 | ArticleCollection / FAQPage 可选 | 是 | 是 |
| `/how-to-choose/:articleId` | 使用全站 title | 使用全站 description | 是 | 是 | 可选 | Article | 是 | 是 |
| `/choose-between-two` | 使用全站 title | 使用全站 description | 是 | 是 | 是 | ArticleCollection / FAQPage 可选 | 是 | 是 |
| `/choose-between-two/:articleId` | 使用全站 title | 使用全站 description | 是 | 是 | 可选 | Article | 是 | 是 |
| `/cases/:id` | 使用全站 title | 使用全站 description | 是 | 是 | 是 | Article / ImageObject | 是 | 是 |
| `/solutions` | 使用全站 title | 使用全站 description | 是 | 是 | 是 | CollectionPage | 是 | 是 |
| `/solutions/:articleId` | 使用全站 title | 使用全站 description | 是 | 是 | 是 | Article / Service | 是 | 是 |
| `*` 404 | 使用全站 title | 使用全站 description | 可选 | 可选 | 否 | 否 | 返回首页即可 | 可静态兜底 |

已确认情况：

- [index.html](/d:/needwebV1/need-pr-agency/index.html:6) 有全站 `title`、`description`、`keywords`、`og:title`、`og:description`、`og:type`。
- 未发现 `robots.txt`、`sitemap.xml`、favicon 文件或 favicon link。
- [metadata.json](/d:/needwebV1/need-pr-agency/metadata.json) 有应用名称和英文描述，但描述中中文显示存在编码异常痕迹，需要人工确认。
- 当前前台是 SPA 路由，动态页面不会天然产生独立 meta；未来静态发布时要从后台字段生成页面级 SEO。

## H. 迁移风险与注意事项

1. `src/App.tsx` 中部分中文在终端读取时曾出现编码异常，但源码实际运行页面可能正常。第 15 轮迁移前需要用编辑器或浏览器确认原文。
2. 现代汽车家庭日案例引用了多张中文命名图片，但当前 `public/` 未发现对应文件。不能只迁移路径，需要找回文件或用 Word 原稿重导。
3. 首页案例预览重复使用同一个案例生成多张卡片，属于展示占位，不应迁移为多个真实案例。
4. `FamilyDayPage` 的图库使用 `photo.jpg` 等占位名和 Unsplash fallback，不应在没有人工确认时进入正式媒体库。
5. `public/` 中 4 个“二选一怎么选”Markdown 文件为空，只能作为选题保留，不能作为文章正文迁移。
6. `public/red1.jpg`、`public/red2.jpg`、`public/wechat-qr.jpg` 未发现前台引用，是否废弃需要人工确认。
7. 二维码资源可能有新旧版本，需要确认当前有效账号。
8. 当前缺少 per-route SEO、sitemap、robots、favicon，GEO/SEO 发布前需要补齐。
9. 外链 Unsplash 图片不应作为 NEED 真实案例资产迁移，除非只是保留为视觉占位。
10. Splash、导航交互、页面布局和 404 文案建议保留在代码中，不进入内容后台。
11. 联系页“自有工厂/设备”等内容当前后台没有明确模块，第 15 轮可先登记媒体，正文后续进入页面编辑器或站点配置。
