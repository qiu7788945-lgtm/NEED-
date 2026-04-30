# 静态 HTML 发布系统 V1

第 17 轮新增本地静态 HTML 生成系统。它读取后台 JSON 数据，生成真实 HTML、sitemap 和 robots 文件到 `dist-static/`，用于后续 GEO 抓取和静态发布流程验证。

## 1. 生成命令

默认只生成可公开内容：

```bash
npm.cmd run build:static
```

本地预览草稿内容：

```bash
npm.cmd run build:static -- --include-draft
```

或：

```bash
set INCLUDE_DRAFT_STATIC=true
npm.cmd run build:static
```

## 2. 输出目录

```text
dist-static/
```

每次生成前脚本会清空 `dist-static/`，然后重新生成全部静态文件。脚本不会删除 `public/`，不会移动 `uploads/`，也不会修改任何 `server/data/*.json`。

## 3. V1 生成页面

| 页面 | 输出路径 |
|---|---|
| 首页 | `dist-static/index.html` |
| 文章列表页 | `dist-static/articles/index.html` |
| 文章详情页 | `dist-static/articles/{slug}/index.html` |
| 案例列表页 | `dist-static/cases/index.html` |
| 案例详情页 | `dist-static/cases/{slug}/index.html` |
| 场景解决方案总页 | `dist-static/solutions/index.html` |
| 场景详情页 | `dist-static/solutions/{sceneSlug}/index.html` |
| 场景案例组详情页 | `dist-static/solutions/{sceneSlug}/{groupSlug}/index.html` |
| 联系页 | `dist-static/contact/index.html` |
| 404 页 | `dist-static/404.html` |
| sitemap | `dist-static/sitemap.xml` |
| robots | `dist-static/robots.txt` |
| 基础样式 | `dist-static/assets/static.css` |

## 4. draft / published 规则

| 内容类型 | 默认生成 | include draft 模式 |
|---|---|---|
| 文章详情 | 只生成 `status=published` | 生成 `published` 和 `draft`，草稿带“草稿预览”标记 |
| 案例详情 | 只生成 `status=published` | 生成 `published` 和 `draft`，草稿带“草稿预览”标记 |
| 文章 / 案例列表 | 默认只显示 published | 显示 draft 并标记草稿 |
| 场景案例组 | 默认生成 `enabled=true` | 也生成 `enabled=false` 预览并标记未启用 |

当前迁移数据中，文章和案例仍主要是 draft，所以默认构建会生成首页、列表页、场景页、联系页、404、sitemap、robots；详情预览可使用 `--include-draft`。

## 5. sitemap 收录规则

`sitemap.xml` 只收录可公开页面：

- 首页
- 文章列表页
- `published` 文章详情页
- 案例列表页
- `published` 案例详情页
- 场景总页
- `enabled=true` 场景详情页
- `enabled=true` 场景案例组详情页
- 联系页

不收录：

- draft 文章
- draft 案例
- offline 内容
- `enabled=false` 案例组
- include draft 预览页
- 404 页

## 6. robots 规则

V1 生成：

```text
User-agent: *
Allow: /
Sitemap: https://www.need-pr.com/sitemap.xml
```

`siteBaseUrl` 当前为：

```text
https://www.need-pr.com
```

后续如最终域名变化，需要在静态生成脚本中替换。

## 7. HTML 模板能力

每个页面包含：

- `<!doctype html>`
- `<html lang="zh-CN">`
- `meta charset`
- viewport
- title
- description
- canonical
- Open Graph 基础标签
- 真实正文 HTML
- 图片 alt
- 基础 JSON-LD
- 简单 CTA

详情页支持：

- Article JSON-LD
- CreativeWork JSON-LD
- BreadcrumbList JSON-LD
- FAQPage JSON-LD

结构化数据不会编造电话、地址、价格等不存在的信息。

## 8. 当前 V1 不做什么

- 不接正式前台 React 视觉。
- 不修改 `src/App.tsx`。
- 不修改 `public/`。
- 不修改后台业务数据 JSON。
- 不自动补 SEO、alt、正文或 FAQ。
- 不接 MySQL。
- 不接腾讯云 COS。
- 不部署线上。
- 不做页面编辑器。

## 9. 第 18 轮建议

第 18 轮建议做“静态页视觉与内容模板增强”：

1. 将当前官网视觉语言迁移到静态模板，但不改 React 前台。
2. 增强文章、案例、场景详情页排版。
3. 增加更完整的导航、页脚、CTA 和移动端样式。
4. 对接第 16 轮质量检查，把 blockingPublish 作为发布前提示。
5. 增加发布报告，列出生成页面、跳过页面和 sitemap 收录页面。
