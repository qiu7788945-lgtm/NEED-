# NEED 官网第20.5轮文章详情页 CMS 接管记录

## 1. 本步目标

第20.5轮第2小步目标是让 `/how-to-choose/01` 到 `/how-to-choose/04` 具备真实渲染 CMS published article 的能力。

第20轮已经完成 route manifest、React prerender、sitemap、publish log、发布 API 和后台发布入口。但文章详情页仍处于 legacy route 与 CMS 自动发现并存的过渡阶段。本步只补前台渲染接管能力，为下一步正式转 published 做准备。

## 2. 路由与 CMS 文章映射

本步前台映射关系与 route manifest 保持一致：

- `/how-to-choose/01` -> `public-how-05`
- `/how-to-choose/02` -> `public-how-06`
- `/how-to-choose/03` -> `public-how-07`
- `/how-to-choose/04` -> `public-how-08`

CMS 文章必须属于 `how_to_choose` 分类，并且必须有标题、摘要和正文，才会接管详情页渲染。

## 3. 渲染规则

文章详情页采用 CMS published 优先、legacy fallback 保底的规则：

1. 进入 `/how-to-choose/01-04` 时，前台先调用 published article 读取能力。
2. 如果找到对应的 CMS published article，且字段完整，则标题、摘要和正文使用 CMS article。
3. 如果 CMS article 仍是 draft、接口不可用、字段不完整或读取失败，则继续使用现有 legacy `articlesData`。
4. 不删除 legacy fallback，保证当前正式 17 条 HTML 不掉线。

## 4. 本步不做的事

本步不修改 `server/data/articles.json`。

本步不把 `public-how-05` 到 `public-how-08` 从 draft 改为 published。

本步不放松 prerender requiredChecks。

本步不改变当前正式输出数量。CMS 文章仍为 draft 时，`/how-to-choose/01-04` 应继续通过 legacy fallback 生成。

## 5. 下一步

第20.5轮第3小步再将 `public-how-05` 到 `public-how-08` 转为 published，并执行完整验收：

- 确认 `/how-to-choose/01-04` HTML 正文来自 CMS article。
- 确认 route manifest 来源正确。
- 确认 sitemap 自动包含对应 URL。
- 确认 publish log 记录成功。
- 确认 requiredChecks 不被放松。
