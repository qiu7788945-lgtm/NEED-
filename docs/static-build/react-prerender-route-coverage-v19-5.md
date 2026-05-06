# React Prerender 路由覆盖说明｜v19.5

## 1. 当前结论

- 第19.5轮目标是让现有 React 官网主要公开路由进入 React prerender。
- 现有 React 前台仍然是视觉、结构、交互真相源。
- 静态 HTML 是 GEO 输出层。
- 本轮没有改 React 前台，没有改后台数据，没有扩旧 build-static-site.ts。
- build:prerender 已经可以输出一组更完整的 GEO 静态 HTML。

## 2. 当前已纳入 prerender 的 URL

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

## 3. 当前暂不纳入的 URL

- /choose-between-two/01
- /choose-between-two/02
- /choose-between-two/03
- /choose-between-two/04

原因：当前详情页内容相对较弱，GEO 价值弱于列表页，后续内容补全后再纳入。

- /cases/hyundai-family-day-2
- /cases/hyundai-family-day-3

原因：它们是首页案例展示复制项，不是真实独立案例内容页，不应进入 sitemap。

## 4. 输出目录

- build:prerender 输出到 dist-prerender/
- dist-prerender/ 是生成产物，不提交 Git
- 每个 URL 对应一个 index.html
- sitemap.xml 和 robots.txt 也由 build:prerender 生成

## 5. 运行方式

1. 启动后台：

```bash
npm.cmd run dev:server
```

2. 启动前台：

```bash
npm.cmd run dev
```

3. 运行 prerender：

```bash
npm.cmd run build:prerender
```

## 6. 验收标准

- npm.cmd run lint 通过
- npm.cmd run build 通过
- npm.cmd run build:prerender 通过
- 每个已纳入 URL 都输出对应 index.html
- 每个页面 HTML 中能看到正文
- 每个页面有 title / description / canonical
- sitemap.xml 包含全部已纳入 URL
- robots.txt 指向 sitemap.xml
- 控制台输出 All prerender content checks passed

## 7. 与第20轮的关系

第20轮后台发布流程应优先调用 build:prerender，而不是继续扩大旧 build:static。

第20轮要做的是把“后台发布按钮 → React prerender → dist-prerender 输出 → 发布日志”的流程串起来。

## 8. 风险提醒

- 不要把旧 build-static-site.ts 继续扩成第二套官网。
- 不要把复制出来的假案例 URL 纳入 sitemap。
- 不要把内容弱的详情页提前纳入 GEO 输出。
- 不要在未补内容前盲目扩大路由。
- 后续正式上线域名确定后，需要通过 SITE_BASE_URL 设置 canonical 和 sitemap 域名。
