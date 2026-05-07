# NEED 官网第20轮发布流程总体验收文档

## 1. 第20轮目标

第20轮不是简单增加一个发布按钮，而是建立一条从内容发现到静态 HTML 输出、发布校验、发布记录和后台触发的完整链路：

- route manifest
- published / enabled 内容发现
- React prerender HTML 输出
- sitemap / robots 自动更新
- skippedRoutes 与 skipReason
- 缺失检测
- 发布日志
- 发布 API
- 后台发布入口
- 新增内容不静默遗漏验收

核心原则：

无论后续是完全新增内容，还是在已经可以生成 HTML 的板块中新增内容，只要应该公开，就必须进入 route manifest；能真实渲染的生成 HTML；不能真实渲染的进入 skippedRoutes 并说明原因。

## 2. 已完成能力清单

1. route manifest
2. fixed routes
3. solutions enabled 自动发现
4. articles published 自动发现
5. cases published 自动发现
6. skippedRoutes / skipReason
7. legacy verified routes
8. HTML / sitemap / robots 缺失检测
9. route-manifest.json 输出
10. publish log 输出
11. publish log API
12. POST publish trigger API
13. 后台发布管理页面
14. 新增内容自动生成 HTML 验收

## 3. 当前正式生成状态

shouldGenerate routes: 17

skippedRoutes: 13

sourceSummary:

- fixed: 5
- solution: 7
- article: 4
- case: 1

17 个 shouldGenerate URL：

- /
- /solutions
- /solutions/family-day
- /solutions/salon
- /solutions/annual
- /solutions/exhibition
- /solutions/video
- /solutions/forum
- /solutions/other
- /contact
- /how-to-choose
- /how-to-choose/01
- /how-to-choose/02
- /how-to-choose/03
- /how-to-choose/04
- /choose-between-two
- /cases/hyundai-family-day

## 4. skippedRoutes 当前规则

- draft article 不生成，skipReason = `article not published`
- draft case 不生成，skipReason = `case not published`
- enabled solution 没有 React mapping 不生成，skipReason = `enabled solution has no React route mapping`
- published article 没有 React mapping 不生成，skipReason = `published article has no React route mapping`
- published case 没有 React mapping 不生成，skipReason = `published case has no React route mapping`
- choose-between-two 详情页当前内容弱，暂不生成
- legacy verified routes 在 CMS 完全接管前继续生成

## 5. 发布链路

命令行链路：

```bash
npm.cmd run build:prerender
```

会输出：

- `dist-prerender/`
- `dist-prerender/route-manifest.json`
- `dist-prerender/sitemap.xml`
- `dist-prerender/robots.txt`
- `server/data/publish-logs/publish-*.json`

API：

- `GET /api/publish/logs`
- `GET /api/publish/latest`
- `GET /api/publish/logs/:id`
- `POST /api/publish/prerender`

后台：

- 发布管理页面
- 查看 latest
- 查看 logs
- 触发生成静态 HTML
- 发布中状态
- 成功/失败提示

## 6. 新增内容验收结论

第20-13 临时测试期间曾追加但未提交：

- solution: `test-unmapped-solution-20-13`
- article: `test-unmapped-article-20-13`
- case: `test-unmapped-case-20-13`

测试期间：

- shouldGenerate 仍为 17
- skippedRoutes 从 13 增加到 16
- 三条测试内容均进入 skippedRoutes
- sitemap 未出现三条测试 slug
- build:prerender 成功
- All prerender content checks passed
- Publish status: success

还原后：

- 恢复 17 generated / 13 skipped
- All prerender content checks passed
- Publish status: success
- 工作区干净

## 7. 第20.5轮衔接要求

第20.5轮补正式官网内容时，任何要公开的新增内容必须满足：

1. CMS 状态 published / enabled
2. route manifest 能发现
3. 有 React route mapping
4. React 能真实渲染该内容
5. HTML requiredChecks 通过
6. sitemap 自动包含
7. publish log 记录成功
8. 后台发布管理能看到结果

强调：

不能只改 CMS 数据。

不能只新增后台内容。

必须保证最终真实 HTML 可被 GEO 抓取。

## 8. 仍然存在的边界

1. 新增 enabled solution 没有 mapping 时不会生成 HTML，只会 skipped。
2. 新增 published article 没有 mapping 时不会生成 HTML，只会 skipped。
3. 新增 published case 没有 mapping 时不会生成 HTML，只会 skipped。
4. 当前 article / case 仍有 legacy verified route 过渡状态。
5. 前台 localhost:3000 白屏时发布会失败，这是正确拦截。
6. 生产环境不能长期依赖 Vite dev server。
7. 20.5 补内容不能只改 CMS 数据，还要确保 React 真实渲染和 manifest 映射。
8. 不能为了通过测试放松 requiredChecks。
9. 不能把不能真实渲染的内容硬塞进 sitemap。

## 9. 最终验收命令

第20轮收口前应执行：

```bash
npm.cmd run lint
```

确保 dev:server 和 dev 前台启动后执行：

```bash
npm.cmd run build:prerender
```

后台发布管理页面点击：

```text
生成静态 HTML
```

最后检查：

```bash
git status --short
```

应无临时测试数据、publish logs、dist-prerender 产物。

## 10. 第20轮收口判断

第20轮主目标已完成，可以进入第20.5轮正式官网内容补全。

第20.5轮开始后，不能绕过第20轮发布链路。
