# 第 16 轮：后台数据质量与 GEO 字段检查规则

本轮新增只读健康检查能力，读取现有后台 JSON 数据并输出 high / medium / low 风险项。检查器不会自动修改数据、不会补 SEO、不会补 alt，也不会改变发布状态。

## 1. 检查数据范围

| 模块 | 数据来源 | 检查目的 |
|---|---|---|
| 首页视频 | `server/data/home-video.json` | 检查视频地址、标题、描述、poster、路径可访问性。 |
| 首页 12 图 | `server/data/home-interactive-images.json` | 检查 12 个槽位、启用状态、图片地址、alt、排序。 |
| 文章 | `server/data/articles.json` | 检查标题、slug、栏目、正文、占位内容、SEO、关键词、FAQ、排序。 |
| 案例解析 | `server/data/cases.json` | 检查案例基础字段、正文、日期地点、封面、现场图、SEO、FAQ。 |
| 场景解决方案 | `server/data/solutions.json` | 检查 7 个默认场景、说明、案例组、素材数量和素材描述。 |
| public 媒体 seed | `server/data/seeds/public-home-media.seed.json` | 检查首页 public 资源是否具备导入媒体库的基础字段。 |
| 媒体库索引 | `server/data/media-library.json` | 只用于判断 public seed 是否已登记进媒体库。 |

## 2. API 输出

```text
GET /api/quality-check
```

返回统一 API 响应，`data` 中包含 `summary`、`items` 和 `updatedAt`。每条问题包含模块、对象类型、对象名称、优先级、问题描述、建议处理方式、是否阻碍发布、是否需要人工确认和目标信息。

## 3. 高优先级规则

高优先级代表发布前必须处理或人工确认，否则不建议进入静态发布。

| 模块 | 规则 | 是否阻碍发布 |
|---|---|---:|
| 首页视频 | `enabled=true` 但 `videoUrl` 为空。 | 是 |
| 首页视频 | 视频路径在本地 public/uploads 中无法确认。 | 是 |
| 首页视频 | `enabled=true` 但标题为空。 | 是 |
| 首页 12 图 | 12 个槽位全部为空。 | 是 |
| 首页 12 图 | 启用槽位 `mediaUrl` 为空。 | 是 |
| 首页 12 图 | 启用且有图，但 alt 为空。 | 是 |
| 文章 | title、slug、category、content、seoTitle、seoDescription 为空或非法。 | 是 |
| 文章 | 正文包含“待补充”或“占位”。 | 是 |
| 文章 | 同一栏目下 slug 或 sortOrder 重复。 | 是 |
| 案例 | 标题、slug、摘要、正文、SEO、日期、客户类型、活动类型缺失。 | 是 |
| 案例 | 存在“待确认 / 公开权限”等人工确认提示。 | 是 |
| 案例 | 已发布但缺封面或现场图。 | 是 |
| 场景 | 默认 7 个场景缺失。 | 是 |
| 场景 | 场景 slug 不在默认列表。 | 是 |
| 场景 | 启用场景 description 为空。 | 是 |
| 场景 | 启用案例组 items 为空。 | 是 |
| 场景 | 视频与数字资产每组超过 1 个素材。 | 是 |
| 场景 | 普通场景每组超过 7 张图。 | 是 |
| 媒体 seed | seed 文件不存在、url 为空、fileType 为空。 | 是 |
| 媒体 seed | 二维码资源有效性未确认。 | 是 |
| SEO/GEO | 首页 12 图为空、二选一占位正文、案例缺证据、启用空案例组、二维码未确认。 | 是 |

## 4. 中优先级规则

中优先级代表不一定立即阻断发布，但会影响 GEO 质量、后台可维护性或发布前完整度。

| 模块 | 规则 |
|---|---|
| 首页视频 | 缺 poster。 |
| 首页视频 | description 为空。 |
| 首页 12 图 | 槽位不足 12 个。 |
| 首页 12 图 | sortOrder 缺失或重复。 |
| 文章 | summary、keywords、FAQ 为空。 |
| 文章 | status 为 draft。 |
| 案例 | coverUrl、extractedImages、location、keywords、FAQ 为空。 |
| 案例 | status 为 draft。 |
| 场景 | 启用场景只有 description，没有任何案例组。 |
| 场景 | group summary 为空。 |
| 场景 | item alt 或 caption 为空。 |
| 场景 | 未启用且无素材的文字型草稿组，需要确认保留还是删除。 |
| 媒体 seed | seed 已生成但尚未导入媒体库。 |
| 媒体 seed | logo 仍为 `temporary`。 |
| 媒体 seed | alt 为空。 |
| SEO/GEO | 缺 FAQ、缺 alt、缺 poster、场景案例组不足。 |

## 5. 低优先级规则

| 模块 | 规则 |
|---|---|
| 文章 | SEO 描述偏短。 |
| 文章 | 关键词数量偏少。 |
| 媒体 / SEO | 分类、关键词和结构化数据可以进一步细化。 |

## 6. 后台页面

后台新增菜单 `GEO 检查`。页面包含统计卡片、模块筛选、优先级筛选、阻碍发布筛选、人工确认筛选、问题列表和“刷新检查”按钮。

页面会明确提示：本页只做检查，不会自动修改数据。

## 7. 后续发布关系

1. 有 high 且 `blockingPublish=true` 的内容，不建议进入正式静态发布。
2. published 内容如果 SEO 基础字段不完整，应阻断发布。
3. 草稿内容可以保留在后台，但不应被静态发布系统输出。
4. 缺 FAQ、alt、poster 的内容可以作为发布前建议项，视页面重要性决定是否强制。
