# NEED 官网第20.5轮 Hyundai CMS case published 记录

## 1. 本步目标

第20.5轮第5b小步目标是将 `server/data/cases.json` 中的 Hyundai CMS case 转为 published，让 `/cases/hyundai-family-day` 后续由 CMS case 接管。

## 2. 转 published 的 case

- CMS case id: `legacy-hyundai-family-day`
- CMS case slug: `hyundai-family-day`
- 对应 URL: `/cases/hyundai-family-day`

本步只修改该 case 的 `status` 字段：

```text
draft -> published
```

## 3. 保持不变的字段

本步不修改以下字段：

- `id`
- `slug`
- `title`
- `summary`
- `clientType`
- `eventType`
- `contentHtml`
- `contentText`
- `seoTitle`
- `seoDescription`
- `coverUrl`
- `extractedImages`

## 4. 预期发布状态变化

下一次执行 `build:prerender` 时预期：

- generated routes 仍为 17
- skippedRoutes 从 9 降为 8
- `/cases/hyundai-family-day` 仍然 shouldGenerate
- route manifest 中 `/cases/hyundai-family-day` 的 sourceId 应来自 `legacy-hyundai-family-day`
- sitemap 仍包含 `/cases/hyundai-family-day`

## 5. requiredChecks

本步未修改 `server/src/scripts/prerender-route-manifest.ts`，未修改 requiredChecks，未放松任何校验。

第20.5轮第5a已经确认 CMS case 正文包含当前 `/cases/hyundai-family-day` requiredChecks 所需关键词。

## 6. 图片字段

Hyundai CMS case 的图片字段仍可在后续单独补充。

当前 `coverUrl` 和 `extractedImages` 不阻塞本次正文和 GEO HTML 发布，因为本步核心目标是 CMS case 正文接管，并且前台已有 legacy 封面 fallback。

## 7. 下一步验收

下一步需要执行完整发布验收：

- `npm.cmd run lint`
- `npm.cmd run build:prerender`

并确认：

- Manifest routes loaded: 17
- Manifest skipped routes: 8
- Generated HTML files checked: 17
- Sitemap URLs checked: 17
- Skipped routes checked: 8
- All prerender content checks passed
- Publish status: success
- HTML 正文来自 CMS case，而不是 legacy fallback
