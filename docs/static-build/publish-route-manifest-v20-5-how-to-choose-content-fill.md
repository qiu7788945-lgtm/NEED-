# NEED 官网第20.5轮 how-to-choose CMS 内容对齐记录

## 1. 本步目标

第20.5轮第3b小步目标是把 `server/data/articles.json` 中 `public-how-05` 到 `public-how-08` 的正式内容，对齐当前 `/how-to-choose/01` 到 `/how-to-choose/04` legacy 正式文章与 prerender requiredChecks。

本步只补内容，不改变发布状态。

## 2. 对应关系

- `public-how-05` -> `/how-to-choose/01`
- `public-how-06` -> `/how-to-choose/02`
- `public-how-07` -> `/how-to-choose/03`
- `public-how-08` -> `/how-to-choose/04`

四篇 CMS 文章保留原有 `id`，保留 `how_to_choose` 分类，保留 `sortOrder` 1 到 4。

## 3. 本步修改内容

本步对齐以下字段：

- `title`
- `summary`
- `content`
- `seoTitle`
- `seoDescription`
- `keywords`
- `faqItems`

正文内容来自当前正式 legacy 文章，保证下一步转 published 后，前台文章详情页能渲染与现有正式页面一致的知识文章内容。

## 4. 发布状态

本步不把 `public-how-05` 到 `public-how-08` 转为 published。

四篇文章仍保持：

```text
status = draft
```

因此本步不会新增公开 URL，也不会改变当前正式 `17 generated / 13 skipped` 的发布状态。

## 5. requiredChecks

本步未修改 `server/src/scripts/prerender-route-manifest.ts`，未修改 requiredChecks，未放松任何 prerender 校验。

内容对齐后，四篇 CMS 文章已覆盖当前 `/how-to-choose/01-04` 对应的必要校验词。

## 6. 下一步

第20.5轮第3c再将 `public-how-05` 到 `public-how-08` 转为 published，并执行完整验收：

- 确认 HTML 正文来自 CMS article。
- 确认 route manifest 来源从 legacy fallback 过渡到 CMS published article。
- 确认 sitemap 仍包含 `/how-to-choose/01-04`。
- 确认 publish log 记录成功。
- 确认 requiredChecks 不被放松。
