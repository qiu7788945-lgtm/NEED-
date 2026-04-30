# 第 15.4 轮迁移记录：场景解决方案说明与案例组迁移

迁移时间：2026-04-30  
迁移范围：现有官网源码中的场景解决方案说明、可归属的场景项目组。  
本轮没有修改前台、后台或 server API 功能代码；没有修改 public；没有迁移文章、案例解析或首页内容。

## 1. 本轮迁移了什么

本轮将当前官网前台 `src/App.tsx` 中的场景解决方案内容迁移到：

- `server/data/solutions.json`

处理内容包括：

1. 保留 7 个默认场景。
2. 为 7 个场景写入当前官网已有说明文案的摘要版 description。
3. 将 `FamilyDayPage` 中明确存在的“费斯托 2025 家庭日”迁移为 `family-day` 下的文字型案例组草稿。
4. 未迁移任何图片或视频素材。

## 2. 读取来源

| 位置 | 读取结果 |
|---|---|
| `src/App.tsx:2265` | 读取场景列表标题、短描述、前台 id。 |
| `src/App.tsx:2324` | 读取 `solutionsData` 中 7 个场景的说明文章。 |
| `src/App.tsx:2462` | 读取 `projectsData` 中 FamilyDay 专题项目卡。 |
| `src/App.tsx:2539` | 确认 FamilyDay 图库渲染存在 Unsplash fallback，不可当正式素材迁移。 |
| `public/` | 未发现 `photo.jpg`、`photo-2.jpg`、`placeholder-1.jpg` 等 FamilyDay 图库真实文件。 |
| `docs/content-audit/current-site-content-audit-v1.md` | 确认前台 id 与后台 sceneSlug 映射，以及各场景缺真实图片。 |
| `docs/content-audit/migration-plan-v1.md` | 确认场景迁移策略：先迁说明，案例组等待素材确认。 |
| `docs/content-audit/migration-log-v15-3.md` | 确认 Festo 2025 家庭日属于场景解决方案候选，需谨慎处理。 |

## 3. 场景迁移结果

| sceneSlug | name | description 是否写入 | groups 数量 | 是否需要人工确认 |
|---|---|---:|---:|---:|
| `family-day` | 企业家庭日 / 开放日 | 是 | 1 | 是，需确认项目公开权限和补图。 |
| `client-appreciation` | 客户答谢 & 精品沙龙 | 是 | 0 | 是，需补真实案例组和素材。 |
| `annual-meeting` | 年会活动与企业文化 | 是 | 0 | 是，需补真实案例组和素材。 |
| `commercial-display` | 商业美陈与展览 | 是 | 0 | 是，需补真实案例组和素材。 |
| `video-digital-assets` | 视频与数字资产 | 是 | 0 | 是，需补视频或主图素材。 |
| `academic-forum` | 学术与专业论坛 | 是 | 0 | 是，需补论坛案例和素材。 |
| `other` | 其他 | 是 | 0 | 是，需人工定义归档范围。 |

## 4. 每个场景写入的 description

| sceneSlug | description 摘要 |
|---|---|
| `family-day` | 企业家庭日不只是员工福利活动，更是企业文化软实力表达；用于员工关怀、家属认同、园区开放和企业文化体验。 |
| `client-appreciation` | 客户答谢和精品沙龙重点在尊贵感、价值交流、客户粘性、私密性和高级服务边界。 |
| `annual-meeting` | 年会承载总结、表彰、士气和战略宣贯，需要兼顾流程、情绪曲线、员工参与和文化表达。 |
| `commercial-display` | 商业美陈与展览是品牌空间表达，需要兼顾视觉吸引、动线、工艺落地和复用。 |
| `video-digital-assets` | 视频与数字资产是活动传播长尾，需要在筹备期规划影像大纲、核心观点和分发场景。 |
| `academic-forum` | 学术与专业论坛需要兼顾嘉宾接待、知识可视化、流程控场、版权保密和安全隔离。 |
| `other` | 特殊场景需求可拆解为资源统筹、空间美学、流程控制和风险规避。 |

## 5. 案例组迁移结果

| title | slug | sceneSlug | items 数量 | 是否缺图 | source |
|---|---|---|---:|---:|---|
| 费斯托 2025 家庭日 | `festo-2025-family-day` | `family-day` | 0 | 是 | `src/App.tsx projectsData[0]` |

说明：

- 该项目在 `FamilyDayPage` 的 `projectsData` 中有明确标题、slogan、shortIntro 和 gallery 结构。
- 因图库文件缺失且渲染逻辑使用 Unsplash fallback，本轮只迁移为文字型案例组草稿。
- `enabled` 设为 `false`，避免被误认为已具备完整素材的正式案例组。
- `items` 保持空数组，后续需人工上传真实图片。

## 6. 图片 / 视频处理

本轮未迁移任何图片或视频，也没有写入 `media-library.json`。

| 源码素材 | 处理结果 | 原因 |
|---|---|---|
| `photo.jpg` 到 `photo-7.jpg` | 未迁移 | `public/` 未发现真实文件；前台渲染会回退到 Unsplash。 |
| `placeholder-1.jpg` 到 `placeholder-4.jpg` | 未迁移 | 明确是预留演示位素材名，不是正式案例素材。 |
| Unsplash fallback 图片 | 未迁移 | 外链占位图，不可作为 NEED 正式场景素材。 |
| 首页 `hero-video.mp4` | 未迁移 | 属于 15.1 首页视频范围，不等同于“视频与数字资产”场景素材。 |

后续如找回真实图片，建议通过后台“场景解决方案”页面上传素材，或新增经过审核的 media seed。

## 7. 未迁移内容与原因

| 内容 | 原因 |
|---|---|
| NEED 预留演示案例 02 | 源码注释明确为预留演示案例，不是真实项目。 |
| FamilyDay 图库素材 | 本地文件缺失，且存在 Unsplash fallback。 |
| 现代汽车家庭日案例组 | 已在 15.3 迁入案例解析；是否同步成 `family-day` 案例组需确认素材和公开权限后再做。 |
| 文章、首页、案例解析数据 | 不属于本轮范围。 |
| 其他场景案例组 | 当前源码只有说明文章，没有明确真实案例组或素材。 |

## 8. 需要人工确认

1. “费斯托 2025 家庭日”是否为真实可公开项目。
2. “费斯托 2025 家庭日”是否应保持在 `family-day`，还是也需要进入案例解析。
3. `photo.jpg` 到 `photo-7.jpg` 是否存在原始真实图片。
4. 现代汽车家庭日是否要同步为 `family-day` 的案例组。
5. 其他 6 个场景是否已有可公开案例和素材。
6. “其他”场景未来是否保留，或拆分为更明确的业务分类。

## 9. 如何验证

1. 启动服务端：`npm.cmd run dev:server`
2. 启动后台：`npm.cmd run dev:admin`
3. 打开后台“场景解决方案”。
4. 确认 7 个默认场景仍存在。
5. 逐个点击场景，确认说明文案已写入。
6. 打开“企业家庭日 / 开放日”，确认能看到“费斯托 2025 家庭日”案例组。
7. 确认该案例组没有素材时页面不报错。
8. 确认其他场景没有被强行生成空案例组。

## 10. 第 15.5 建议做什么

建议第 15.5 做数据质量与迁移收口：

1. 汇总首页、文章、案例、场景四类迁移结果。
2. 检查所有 JSON 是否可读、字段是否完整、slug 是否唯一。
3. 列出待补图、待补 SEO、待人工确认的总清单。
4. 若要继续推进，可做“public 资源 seed 导入工具”或“迁移数据质量检查脚本”。
5. 暂时仍不接正式前台、不做静态发布。
