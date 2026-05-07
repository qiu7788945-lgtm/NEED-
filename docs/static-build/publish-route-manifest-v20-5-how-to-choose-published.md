# NEED 官网第20.5轮 how-to-choose CMS 文章 published 记录

## 1. 本步目标

第20.5轮第3c小步目标是将已经完成内容对齐的 4 篇 `how_to_choose` CMS 文章从 `draft` 转为 `published`，让 `/how-to-choose/01` 到 `/how-to-choose/04` 进入 CMS published article 接管阶段。

## 2. 转 published 的文章

- `public-how-05` -> `/how-to-choose/01`
- `public-how-06` -> `/how-to-choose/02`
- `public-how-07` -> `/how-to-choose/03`
- `public-how-08` -> `/how-to-choose/04`

本步只修改以上 4 篇文章的 `status` 字段：

```text
draft -> published
```

## 3. 保持不变的字段

本步不修改以下字段：

- `id`
- `slug`
- `category`
- `sortOrder`
- `title`
- `summary`
- `content`
- `seoTitle`
- `seoDescription`

## 4. 预期发布状态变化

下一次执行 `build:prerender` 时预期：

- generated routes 仍为 17
- skippedRoutes 从 13 降为 9
- `/how-to-choose/01` 到 `/how-to-choose/04` 仍然 shouldGenerate
- route manifest 中 `/how-to-choose/01` 到 `/how-to-choose/04` 的 sourceId 应分别来自 `public-how-05` 到 `public-how-08`
- sitemap 仍包含 `/how-to-choose/01` 到 `/how-to-choose/04`

## 5. requiredChecks

本步未修改 `server/src/scripts/prerender-route-manifest.ts`，未修改 requiredChecks，未放松任何校验。

第20.5轮第3b已经将 4 篇 CMS 文章正文对齐当前 legacy 正式文章，因此下一次 prerender 应继续通过现有 requiredChecks。

## 6. 下一步验收

下一步需要执行完整发布验收：

- `npm.cmd run lint`
- `npm.cmd run build:prerender`

并确认：

- Manifest routes loaded: 17
- Manifest skipped routes: 9
- Generated HTML files checked: 17
- Sitemap URLs checked: 17
- Skipped routes checked: 9
- All prerender content checks passed
- Publish status: success
- HTML 正文来自 CMS article，而不是 legacy fallback
