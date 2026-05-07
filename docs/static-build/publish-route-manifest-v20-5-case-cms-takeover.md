# NEED 官网第20.5轮案例详情页 CMS 接管记录

## 1. 本步目标

第20.5轮第4小步目标是让 `/cases/hyundai-family-day` 具备真实渲染 CMS published case 的能力。

第20轮已经完成 route manifest、React prerender、sitemap、publish log、发布 API 和后台发布入口。当前 Hyundai 家庭日案例仍处于 legacy route 与 CMS 自动发现并存的过渡阶段。本步只补前台渲染接管能力，为下一步正式转 published 做准备。

## 2. 路由与 CMS case 映射

本步前台映射关系与 route manifest 保持一致：

- `/cases/hyundai-family-day`
- CMS case id: `legacy-hyundai-family-day`
- CMS case slug: `hyundai-family-day`

前台访问 `/cases/hyundai-family-day` 时，会优先尝试读取 slug 为 `hyundai-family-day` 或 id 为 `legacy-hyundai-family-day` 的 published CMS case。

## 3. 渲染规则

案例详情页采用 CMS published 优先、legacy fallback 保底的规则：

1. 进入 `/cases/hyundai-family-day` 时，前台先调用 published case 读取能力。
2. 如果找到对应的 CMS published case，且字段完整，则标题、客户/类型信息、摘要和正文使用 CMS case。
3. 如果 CMS case 仍是 draft、接口不可用、字段不完整或读取失败，则继续使用现有 legacy `caseStudiesData`。
4. 不删除 legacy fallback，保证当前正式 HTML 不掉线。
5. 未知 case slug 不再 fallback 到第一个 legacy case，避免未来错误 slug 误显示 Hyundai 案例。

## 4. 本步不做的事

本步不修改 `server/data/cases.json`。

本步不把 `legacy-hyundai-family-day` 从 draft 改为 published。

本步不修改 `server/src/scripts/prerender-route-manifest.ts`，不修改 requiredChecks，不放松任何 prerender 校验。

本步不改变当前正式输出数量。CMS case 仍为 draft 时，`/cases/hyundai-family-day` 应继续通过 legacy fallback 生成。

## 5. 下一步

第20.5轮第5小步再将 `legacy-hyundai-family-day` 转为 published，并执行完整验收：

- 确认 `/cases/hyundai-family-day` HTML 正文来自 CMS case。
- 确认 route manifest 来源正确。
- 确认 sitemap 仍包含 `/cases/hyundai-family-day`。
- 确认 publish log 记录成功。
- 确认 requiredChecks 不被放松。
