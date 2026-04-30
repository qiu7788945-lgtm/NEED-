# 第 15.3 轮迁移记录：案例解析数据迁移

迁移时间：2026-04-30  
迁移范围：现有官网源码中的案例解析内容。  
本轮没有修改前台、后台或 server API 功能代码；没有修改 public；没有迁移文章、首页内容或场景解决方案数据。

## 1. 本轮迁移了什么

本轮将当前官网中唯一可确认的正式案例内容迁移到：

- `server/data/cases.json`

迁移案例为：

- 制造研发中心的家庭日，不只是让孩子玩一天

该案例来自 `src/App.tsx` 中的 `caseStudiesData`，对应前台路由 `/cases/hyundai-family-day`。

## 2. 扫描与读取位置

| 位置 | 结果 |
|---|---|
| `src/App.tsx` | 找到 `caseStudiesData` 中的现代汽车研发中心家庭日案例正文。 |
| `src/App.tsx` 首页案例预览 | 发现第 2 / 第 3 张卡片由同一案例复制生成，不迁移为独立案例。 |
| `src/App.tsx` FamilyDay 专题页 | 发现 Festo 2025 家庭日和预留演示案例，属于场景解决方案范围，且素材未确认，本轮不迁移。 |
| `public/` | 未发现现代汽车案例正文引用的本地图片文件。 |
| `docs/content-audit/current-site-content-audit-v1.md` | 确认现代汽车家庭日案例应迁入案例解析，图片缺失需人工补。 |
| `docs/content-audit/migration-plan-v1.md` | 确认第 15 轮案例迁移策略：只迁文本，缺图不写无效媒体引用。 |
| `docs/content-audit/migration-log-v15-1.md` | 确认案例图片留到 15.3 或 Word 重导处理。 |
| `docs/content-audit/migration-log-v15-2.md` | 确认 15.3 建议迁移现代汽车家庭日案例文本。 |

## 3. 最终写入案例

| title | slug | clientType | eventType | eventDate | location | status | source |
|---|---|---|---|---|---|---|---|
| 制造研发中心的家庭日，不只是让孩子玩一天 | `hyundai-family-day` | 制造研发类企业 | 企业家庭日 / 开放日 | 空，待确认 | 现代汽车研发中心园区（具体城市待确认） | `draft` | `src/App.tsx caseStudiesData[0]` |

写入字段包括：

- `id`
- `title`
- `slug`
- `summary`
- `clientType`
- `eventType`
- `eventDate`
- `location`
- `contentHtml`
- `contentText`
- `sortOrder`
- `status`
- `seoTitle`
- `seoDescription`
- `keywords`
- `faqItems`
- `createdAt`
- `updatedAt`

## 4. 图片与封面处理

本轮没有迁移任何案例图片，也没有写入封面图。

原因：

1. `src/App.tsx` 中确实引用了现代汽车家庭日案例封面和正文图片路径。
2. 这些路径对应的真实文件没有在当前 `public/` 中找到。
3. 按本轮要求，不能使用 Unsplash、占位图、外链图或无关图片冒充正式案例素材。
4. 因此 `coverUrl`、`coverFileName`、`coverDisplayName` 保持空字符串，`extractedImages` 保持空数组。

源码中提到但本轮未迁移的图片包括：

| 源码引用 | 处理结果 | 原因 |
|---|---|---|
| `/03-主题主视觉-花Young亲子家年华.jpg` 及编码异常等价路径 | 未迁移 | 当前 `public/` 未发现真实文件。 |
| `/01-全场俯拍-场地利用.jpg` | 未迁移 | 当前 `public/` 未发现真实文件。 |
| `/02-入口欢迎-开放日第一印象.jpg` | 未迁移 | 当前 `public/` 未发现真实文件。 |
| `/04-空间分区-场地容量.jpg` | 未迁移 | 当前 `public/` 未发现真实文件。 |
| `/05-亲子打卡-主题场景.jpg` | 未迁移 | 当前 `public/` 未发现真实文件。 |
| `/06-互动游艺-低门槛参与.jpg` | 未迁移 | 当前 `public/` 未发现真实文件。 |
| `/07-手作体验-家庭共创.jpg` | 未迁移 | 当前 `public/` 未发现真实文件。 |
| `/08-员工荣誉-感恩表达.jpg` | 未迁移 | 当前 `public/` 未发现真实文件。 |
| `/09-餐饮补给-服务区.jpg` | 未迁移 | 当前 `public/` 未发现真实文件。 |
| `/10-礼品小卖部-场景化服务.jpg` | 未迁移 | 当前 `public/` 未发现真实文件。 |

后续建议：

- 找回原始案例图片后，通过后台案例解析页上传封面图。
- 如有 Word 原稿，优先使用第 12 轮 Word 导入流程重新导入，以自动提取正文图片并进入媒体库。
- 后续可追加媒体 seed，但必须基于真实本地文件。

## 5. 需要人工确认的字段

| 字段 | 当前值 | 需要确认 |
|---|---|---|
| `eventDate` | 空 | 原源码没有明确日期，需要人工补活动日期或年份。 |
| `location` | 现代汽车研发中心园区（具体城市待确认） | 需要确认城市和是否可公开。 |
| `clientType` | 制造研发类企业 | 来自源码 subtitle 语义，建议人工确认最终分类名称。 |
| `eventType` | 企业家庭日 / 开放日 | 来自源码 subtitle 和正文，建议人工确认是否保持该名称。 |
| `coverUrl` | 空 | 需要补真实封面。 |
| `extractedImages` | 空数组 | 需要补真实现场图或通过 Word 重导。 |
| 客户公开权限 | 未记录 | 需要确认“现代汽车研发中心”是否可以继续公开展示。 |

## 6. 未迁移内容

| 内容 | 原因 |
|---|---|
| 首页案例预览的第 2 / 第 3 张卡片 | 由同一个 `hyundai-family-day` 案例复制生成，只是展示占位，不是独立案例。 |
| Festo 2025 家庭日项目 | 属于场景解决方案 `family-day` 的项目组候选，真实公开权限和素材未确认。 |
| NEED 预留演示案例 02 | 明确是预留演示位，不是真实案例。 |
| FamilyDay 专题图库 | 多为占位名或 fallback，未确认真实素材，本轮不进入案例解析。 |
| public Markdown 文章 | 已属于 15.2 文章迁移范围，本轮不处理。 |
| 首页内容、首页媒体 | 已属于 15.1 范围，本轮不处理。 |
| 场景解决方案数据 | 留到第 15.4。 |

## 7. 如何验证

1. 启动服务端：`npm.cmd run dev:server`
2. 启动后台：`npm.cmd run dev:admin`
3. 打开后台“案例解析”。
4. 确认列表中出现“制造研发中心的家庭日，不只是让孩子玩一天”。
5. 打开编辑页，确认标题、摘要、客户类型、活动类型、地点、正文、SEO 字段均有内容。
6. 确认封面为空时页面不报错。
7. 确认 Word 图片列表为空时页面不报错。

## 8. 第 15.4 建议迁移什么

建议第 15.4 迁移场景解决方案数据：

1. 迁移 7 个默认场景的现有前台说明文案。
2. 将前台 scene id 映射到后台 `sceneSlug`。
3. 对 `family-day` 场景，谨慎迁移已确认的案例组结构。
4. Festo 2025 家庭日和模板项目先标注“需要人工确认”，不要直接当正式案例组。
5. 不迁移 Unsplash、占位图或缺失文件为正式媒体。
