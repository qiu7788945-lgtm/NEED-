# 第 15.2 轮迁移记录：文章数据迁移进后台

迁移时间：2026-04-30  
纠偏时间：2026-04-30  
迁移目标：将当前官网已有文章 / 方法内容迁移到 `server/data/articles.json`。  
本轮只修改文章 JSON 与迁移日志，没有修改前台、public、admin 功能、server API 逻辑或 shared 类型。

## 1. 本轮迁移了什么

1. 从 `src/App.tsx` 的 `articlesData` 迁移 4 篇完整文章，归入 `method_judgment`。
2. 从 `public/` 中 4 个有实质内容的 Markdown 文件迁移 4 篇文章，归入 `how_to_choose`。
3. 从 `src/App.tsx` 的 `chooseBetweenTwoArticlesData` 迁移 4 篇“二选一怎么选”草稿占位文章，归入 `choose_between_two`。
4. 跳过 public 中 4 个空 Markdown 文件的正文内容，但这些标题已由 `chooseBetweenTwoArticlesData` 进入占位文章。
5. 所有迁移文章默认 `status = draft`，等待人工校对后再发布。

## 2. 纠偏说明

原第 15.2 迁移结果出现栏目数量偏差：

- `method_judgment` 为 5 篇。
- `how_to_choose` 为 3 篇。
- `choose_between_two` 为 0 篇。

原因：

1. 将 `public/04_为什么很多活动最后不是输在创意_而是输在执行.md` 按标题语义归入了 `method_judgment`，但从第 14 轮文档和 public 文件定位看，它属于“怎么选活动公司”系列三级页面文章，应归入 `how_to_choose`。
2. 看到 `chooseBetweenTwoArticlesData` 的 `excerpt` 和 `content` 为空后直接跳过，导致“二选一怎么选”栏目为空。
3. 没有把“二选一”空正文按占位草稿迁移，和本次纠偏要求不一致。

纠偏动作：

- 将“为什么很多活动最后不是输在创意，而是输在执行”从 `method_judgment` 调整为 `how_to_choose`。
- 将 `chooseBetweenTwoArticlesData` 中 4 个标题迁移为 `choose_between_two` 草稿占位文章。
- 保持 `articlesData` 中 4 篇完整长文为 `method_judgment`。

纠偏后栏目数量：

- `how_to_choose`：4 篇
- `method_judgment`：4 篇
- `choose_between_two`：4 篇

## 3. 原始文章来源扫描

### 3.1 `src/App.tsx` 中的完整文章

| title | source 文件 | 原始变量名/模块 | 是否有 summary | 是否有 content | 建议迁移栏目 | 是否完整 |
|---|---|---|---:|---:|---|---:|
| 真正靠谱的活动执行，不是现场救火能力，而是前面少埋雷 | `src/App.tsx` | `articlesData` | 是 | 是 | `method_judgment` | 是 |
| 为什么有些方案看起来很好，现场却不成立 | `src/App.tsx` | `articlesData` | 是 | 是 | `method_judgment` | 是 |
| 为什么一场活动开始前，先把目标判断清楚更重要 | `src/App.tsx` | `articlesData` | 是 | 是 | `method_judgment` | 是 |
| 为什么预算判断，比一味堆创意更重要 | `src/App.tsx` | `articlesData` | 是 | 是 | `method_judgment` | 是 |

### 3.2 `src/App.tsx` 中的二选一文章占位

| title | source 文件 | 原始变量名/模块 | 是否有 summary | 是否有 content | 建议迁移栏目 | 是否完整 |
|---|---|---|---:|---:|---|---:|
| 一家案例更大，一家更贴需求，该怎么选 | `src/App.tsx` | `chooseBetweenTwoArticlesData` | 否 | 否 | `choose_between_two` | 否，占位迁移 |
| 一家创意更强，一家执行更稳，怎么判断更适合你 | `src/App.tsx` | `chooseBetweenTwoArticlesData` | 否 | 否 | `choose_between_two` | 否，占位迁移 |
| 一家报价更高，一家报价更低，真正该比什么 | `src/App.tsx` | `chooseBetweenTwoArticlesData` | 否 | 否 | `choose_between_two` | 否，占位迁移 |
| 两家活动公司都不错，最后到底该怎么做决定 | `src/App.tsx` | `chooseBetweenTwoArticlesData` | 否 | 否 | `choose_between_two` | 否，占位迁移 |

### 3.3 public Markdown 文件

| title / 文件 | source 文件 | 原始变量名/模块 | 是否有 summary | 是否有 content | 建议迁移栏目 | 是否完整 |
|---|---|---|---:|---:|---|---:|
| 看活动公司，先看它是不是在理解需求 | `public/01_看活动公司_先看它是不是在理解需求.md` | public Markdown | 是 | 是 | `how_to_choose` | 是 |
| 怎么判断一个活动公司有没有判断力 | `public/02_怎么判断一个活动公司有没有判断力.md` | public Markdown | 是 | 是 | `how_to_choose` | 是 |
| 活动公司案例很好看，为什么项目未必适合你 | `public/03_活动公司案例很好看_为什么项目未必适合你.md` | public Markdown | 是 | 是 | `how_to_choose` | 是 |
| 为什么很多活动最后不是输在创意，而是输在执行 | `public/04_为什么很多活动最后不是输在创意_而是输在执行.md` | public Markdown | 是 | 是 | `how_to_choose` | 是 |
| 一家创意更强，一家执行更稳，怎么判断更适合你 | `public/一家创意更强，一家执行更稳，怎么判断更适合你.md` | public Markdown | 否 | 否 | `choose_between_two` | 否，空文件 |
| 一家报价更高，一家报价更低，真正该比什么 | `public/一家报价更高，一家报价更低，真正该比什么.md` | public Markdown | 否 | 否 | `choose_between_two` | 否，空文件 |
| 一家案例更大，一家更贴需求，该怎么选 | `public/一家案例更大，一家更贴需求，该怎么选.md` | public Markdown | 否 | 否 | `choose_between_two` | 否，空文件 |
| 两家活动公司都不错，最后到底该怎么做决定 | `public/两家活动公司都不错，最后到底该怎么做决定.md` | public Markdown | 否 | 否 | `choose_between_two` | 否，空文件 |
| `README.md` | `public/README.md` | public 目录说明 | 否 | 否 | 不迁移 | 否 |

### 3.4 栏目页内容

| title / 模块 | source 文件 | 原始变量名/模块 | 是否有 summary | 是否有 content | 建议迁移栏目 | 是否完整 |
|---|---|---|---:|---:|---|---:|
| 怎么选活动公司栏目页 | `src/App.tsx` | `HowToChoosePage.sections` | 是 | 是 | 页面/栏目配置，不作为单篇文章 | 是 |
| 二选一怎么选栏目页 | `src/App.tsx` | `ChooseBetweenTwoPage.sections` / `scenarios` / `checklist` | 是 | 是 | 页面/栏目配置，不作为单篇文章 | 是 |

说明：栏目页内容不是单篇文章详情，本轮不写入 `articles.json`，后续可进入页面编辑器或栏目配置。

## 4. 最终写入文章

共写入 12 篇文章到 `server/data/articles.json`。

### 4.1 怎么选活动公司：`how_to_choose`

| sortOrder | title | slug | source | status |
|---:|---|---|---|---|
| 5 | 看活动公司，先看它是不是在理解需求 | `how-to-choose-understands-your-brief` | `public/01_看活动公司_先看它是不是在理解需求.md` | `draft` |
| 6 | 怎么判断一个活动公司有没有判断力 | `how-to-judge-event-agency-judgment` | `public/02_怎么判断一个活动公司有没有判断力.md` | `draft` |
| 7 | 活动公司案例很好看，为什么项目未必适合你 | `why-good-event-cases-may-not-fit-you` | `public/03_活动公司案例很好看_为什么项目未必适合你.md` | `draft` |
| 8 | 为什么很多活动最后不是输在创意，而是输在执行 | `why-events-fail-in-execution-not-creative` | `public/04_为什么很多活动最后不是输在创意_而是输在执行.md` | `draft` |

### 4.2 方法与判断：`method_judgment`

| sortOrder | title | slug | source | status |
|---:|---|---|---|---|
| 1 | 真正靠谱的活动执行，不是现场救火能力，而是前面少埋雷 | `reliable-event-execution-starts-before-site` | `src/App.tsx articlesData[0]` | `draft` |
| 2 | 为什么有些方案看起来很好，现场却不成立 | `why-good-looking-event-plans-fail-onsite` | `src/App.tsx articlesData[1]` | `draft` |
| 3 | 为什么一场活动开始前，先把目标判断清楚更重要 | `why-event-goals-must-be-judged-first` | `src/App.tsx articlesData[2]` | `draft` |
| 4 | 为什么预算判断，比一味堆创意更重要 | `why-budget-judgment-matters-more-than-creative-stacking` | `src/App.tsx articlesData[3]` | `draft` |

### 4.3 二选一怎么选：`choose_between_two`

| sortOrder | title | slug | source | status | 迁移方式 |
|---:|---|---|---|---|---|
| 9 | 一家案例更大，一家更贴需求，该怎么选 | `larger-case-or-better-fit-how-to-choose` | `src/App.tsx chooseBetweenTwoArticlesData[0]` | `draft` | 占位迁移，需人工补正文 |
| 10 | 一家创意更强，一家执行更稳，怎么判断更适合你 | `more-creative-or-more-stable-execution` | `src/App.tsx chooseBetweenTwoArticlesData[1]` | `draft` | 占位迁移，需人工补正文 |
| 11 | 一家报价更高，一家报价更低，真正该比什么 | `higher-quote-or-lower-quote-what-to-compare` | `src/App.tsx chooseBetweenTwoArticlesData[2]` | `draft` | 占位迁移，需人工补正文 |
| 12 | 两家活动公司都不错，最后到底该怎么做决定 | `two-good-event-agencies-how-to-decide` | `src/App.tsx chooseBetweenTwoArticlesData[3]` | `draft` | 占位迁移，需人工补正文 |

## 5. 未迁移内容与原因

| 内容 | 原因 |
|---|---|
| public 中 4 个“二选一怎么选”Markdown 正文 | 文件长度为 0，无正文可迁；同题标题已由 `chooseBetweenTwoArticlesData` 占位迁移。 |
| `HowToChoosePage` 的栏目页说明段落 | 它更像栏目页/专题页正文，不是单篇文章；后续应由页面编辑器或栏目配置承接。 |
| `ChooseBetweenTwoPage` 的栏目页说明、场景、清单 | 它更像栏目页/专题页正文，不是单篇文章；后续应由页面编辑器或栏目配置承接。 |
| 案例、场景解决方案、首页文案 | 不属于 15.2 范围。 |

## 6. 需要人工确认

1. `choose_between_two` 4 篇目前都是占位迁移，需要补正式正文。
2. public Markdown 与前台栏目页内容主题有重合，后续是否合并需要人工确认。
3. 所有文章当前都是 `draft`，发布前需要人工校对。
4. `seoDescription` 先来自摘要或占位描述，后续可人工优化到更适合搜索展示的 80-120 字。
5. `keywords` 先用基础关键词字符串，后续可以结合 GEO 检查统一规范。

## 7. 如何验证

1. 启动服务端：`npm.cmd run dev:server`
2. 启动后台：`npm.cmd run dev:admin`
3. 打开后台文章管理，确认列表中有 12 篇草稿文章。
4. 按栏目筛选：
   - `method_judgment` 应有 4 篇。
   - `how_to_choose` 应有 4 篇。
   - `choose_between_two` 应有 4 篇。
5. 打开“二选一怎么选”任意文章，正文应显示“【待补充】该文章为‘二选一怎么选’栏目迁移占位，后续需要补充正式正文。”

## 8. 第 15.3 建议迁移什么

建议第 15.3 迁移案例解析数据：

1. 迁移 `src/App.tsx` 中现代汽车家庭日案例文本。
2. 不写入缺失的图片路径，先标记为待补图。
3. 如能找到 Word 原稿，优先用 Word 导入流程重新生成案例草稿。
4. 补齐案例 slug、摘要、SEO 字段、客户类型、活动类型、地点、时间。
5. 记录哪些图片需要找回或重新上传。
