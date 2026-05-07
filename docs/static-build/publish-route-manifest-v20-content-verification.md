# Publish Route Manifest v20 Content Verification

## 验收背景

第20轮目标是：无论后续是完全新增内容，还是在已经可以生成 HTML 的板块中新增内容，只要应该公开，就必须进入 route manifest；能真实渲染的生成 HTML；不能真实渲染的进入 skippedRoutes 并说明原因。

不允许静默遗漏，不允许未映射内容误进 sitemap。

## 当前正式状态

- shouldGenerate routes: 17
- skippedRoutes: 13
- sourceSummary:
  - fixed: 5
  - solution: 7
  - article: 4
  - case: 1
- 现有 17 条真实生成页面继续通过 HTML / sitemap / robots / requiredChecks 校验。

## 临时测试数据

测试期间曾临时追加以下数据，但未提交：

- solution: `test-unmapped-solution-20-13`
- article: `test-unmapped-article-20-13`
- case: `test-unmapped-case-20-13`

## 临时测试结果

测试期间：

- shouldGenerate routes 仍为 17
- skippedRoutes 从 13 增加到 16
- 三条测试内容均进入 route-manifest.json 的 skippedRoutes
- sitemap.xml 未出现三条测试 slug
- build:prerender 成功
- All prerender content checks passed
- Publish status: success

## skipReason 验证

- `test-unmapped-solution-20-13` -> `enabled solution has no React route mapping`
- `test-unmapped-article-20-13` -> `published article has no React route mapping`
- `test-unmapped-case-20-13` -> `published case has no React route mapping`

## 还原结果

- 已执行 `git checkout -- server/data/solutions.json server/data/articles.json server/data/cases.json`
- 还原后重新运行 `build:prerender`
- 恢复为 17 generated / 13 skipped
- All prerender content checks passed
- Publish status: success
- 工作区干净

## 当前能力边界

新增 enabled solution 不一定直接生成 HTML；必须有 React route mapping 和真实渲染能力。

新增 published article 不一定直接生成 HTML；当前 article/case 仍处于 legacy verified route 与 CMS 自动发现并存阶段。

新增 published case 不一定直接生成 HTML；无 mapping 必须 skipped。

这不是缺陷，而是防止假收录的保护机制。

## 后续要求

第20.5轮补内容时，新增的正式内容如果需要公开，必须同时满足：

1. CMS 状态 published/enabled
2. route manifest 能发现
3. React 能真实渲染
4. HTML requiredChecks 通过
5. sitemap 自动包含
6. publish log 记录成功

不能为了通过测试放松 requiredChecks。

不能把无法真实渲染的内容硬塞进 sitemap。

临时测试数据不得提交。
