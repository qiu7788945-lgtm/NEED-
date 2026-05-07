# NEED 官网第20.5轮正式内容补全收口文档

## 1. 第20.5轮目标

第20.5轮不是继续扩展新栏目，而是把第20轮已经能生成 HTML 的正式 URL 中，仍处于 legacy 过渡状态的内容，逐步切换到 CMS published 内容来源。

核心原则：

- 不能只改 CMS status 就算发布
- 必须保证 React 真实渲染 CMS 内容
- 必须通过 requiredChecks
- 必须进入 sitemap
- 必须由 publish log 记录成功

## 2. 已完成内容

### how-to-choose 文章

已完成：

- `/how-to-choose/01` -> `public-how-05`
- `/how-to-choose/02` -> `public-how-06`
- `/how-to-choose/03` -> `public-how-07`
- `/how-to-choose/04` -> `public-how-08`

完成动作：

1. 文章详情页 CMS 接管能力
2. CMS 内容对齐 legacy 正文和 requiredChecks
3. `public-how-05` 到 `public-how-08` 从 draft 转 published
4. `build:prerender` 验证通过
5. route-manifest sourceId 已来自 `public-how-05` 到 `public-how-08`

### Hyundai family day case

已完成：

- `/cases/hyundai-family-day` -> `legacy-hyundai-family-day`

完成动作：

1. 案例详情页 CMS 接管能力
2. `legacy-hyundai-family-day` 从 draft 转 published
3. `build:prerender` 验证通过
4. route-manifest sourceId 已来自 `legacy-hyundai-family-day`
5. HTML 正文已来自 CMS case

## 3. 当前最终生成状态

- shouldGenerate routes: 17
- skippedRoutes: 8

当前 17 条生成 URL 仍是：

- `/`
- `/solutions`
- `/solutions/family-day`
- `/solutions/salon`
- `/solutions/annual`
- `/solutions/exhibition`
- `/solutions/video`
- `/solutions/forum`
- `/solutions/other`
- `/contact`
- `/how-to-choose`
- `/how-to-choose/01`
- `/how-to-choose/02`
- `/how-to-choose/03`
- `/how-to-choose/04`
- `/choose-between-two`
- `/cases/hyundai-family-day`

## 4. 当前 8 条 skippedRoutes

剩余 8 条 skippedRoutes 是：

method_judgment 4 篇：

- `src-method-01`
- `src-method-02`
- `src-method-03`
- `src-method-04`

choose_between_two 4 篇：

- `choose-placeholder-01`
- `choose-placeholder-02`
- `choose-placeholder-03`
- `choose-placeholder-04`

说明：

- method_judgment 当前没有独立正式栏目入口与详情页策略，暂不纳入 sitemap。
- choose_between_two 详情文章仍是占位内容，暂不纳入 sitemap。
- 这 8 条 skipped 是有意保留，不是遗漏。
- 当前不应为了减少 skipped 数量而强行发布弱内容。

## 5. 为什么本轮不继续纳入 choose-between-two 详情

- `choose-placeholder-01` 到 `choose-placeholder-04` 仍是占位/弱内容。
- 若纳入，需要新增 CMS 内容、详情路由、route mapping、requiredChecks、sitemap 验收。
- 这已经属于新栏目建设，建议放到第21轮。

## 6. 为什么本轮不继续纳入 method_judgment

- method_judgment 4 篇内容已经迁移/对齐到 how-to-choose 01-04。
- 当前没有独立栏目入口。
- 直接发布会造成内容重复和 URL 语义混乱。
- 建议第21轮统一设计“方法与判断”栏目后再纳入。

## 7. 仍然存在的边界

1. 7 个 solution 详情页虽然由 `solutions.json` enabled 发现，但前台详情正文仍以 legacy React 内容为主。
2. fixed 页面仍主要是 React 静态内容。
3. contact 页面尚未接入后台内容管理。
4. choose-between-two 详情页暂未正式建设。
5. method_judgment 暂未正式建设。
6. 后续新增公开内容仍必须满足：CMS published/enabled、manifest 发现、React 真实渲染、requiredChecks 通过、sitemap 包含、publish log 成功。

## 8. 最终验收命令

第20.5收口前必须运行：

```bash
npm.cmd run lint
npm.cmd run build:prerender
```

预期结果：

- Manifest routes loaded: 17
- Manifest skipped routes: 8
- Generated HTML files checked: 17
- Sitemap URLs checked: 17
- Skipped routes checked: 8
- All prerender content checks passed
- Publish status: success

还应确认：

- route-manifest 中 `/how-to-choose/01-04` sourceId 为 `public-how-05` 到 `public-how-08`
- route-manifest 中 `/cases/hyundai-family-day` sourceId 为 `legacy-hyundai-family-day`
- `git status` 不包含 `dist-prerender` 或 publish logs

## 9. 第20.5轮收口判断

第20.5轮可以收口。

下一轮建议进入第21轮，重点处理：

1. choose-between-two 详情内容与 CMS 渲染
2. method_judgment 栏目策略
3. solution 详情页 CMS 深度接管
4. contact 页面后台配置化
