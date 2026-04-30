# 第 15.1 轮迁移记录：首页配置迁移 + public 媒体登记基础

迁移时间：2026-04-30  
迁移范围：首页视频配置、首页交互图槽位、首页相关 public 媒体 seed 清单。  
本轮没有迁移文章、案例、场景解决方案，也没有修改前台、后台或 server API 功能代码。

## 1. 本轮迁移了什么

1. 将当前官网首页首屏视频 `/hero-video.mp4` 写入 `server/data/home-video.json`。
2. 保留 `server/data/home-interactive-images.json` 的 12 个槽位结构，但未填入正式图片。
3. 新增 `server/data/seeds/public-home-media.seed.json`，用于记录可审核、可导入媒体库的首页相关 public 资源。
4. 记录哪些资源需要人工确认，哪些资源本轮没有迁移。

## 2. 首页视频配置迁移结果

已写入 `server/data/home-video.json`：

| 字段 | 值 |
|---|---|
| `videoUrl` | `/hero-video.mp4` |
| `videoFileName` | `hero-video.mp4` |
| `videoDisplayName` | `首页首屏视频` |
| `title` | `NEED 首页视频` |
| `description` | `NEED 官网首页首屏展示视频` |
| `enabled` | `true` |

说明：

- 未复制 `public/hero-video.mp4`。
- 只登记现有 public 路径，保持当前资源位置不变。
- `posterUrl`、`posterFileName`、`posterDisplayName` 暂为空，因为当前盘点没有发现明确首页视频 poster。

## 3. 首页交互图迁移结果

已写入 `server/data/home-interactive-images.json`：

- 保留 12 个槽位。
- 所有槽位的 `mediaUrl`、`mediaFileName`、`alt` 为空。
- `slotNo` 和 `sortOrder` 为 1 到 12。
- `enabled` 为 `true`。

原因：

- 第 14 轮盘点确认：当前首页“创意案例现场 / 交互图”只有 6 张 Unsplash 外链图，没有明确的 12 张本地 NEED 图片。
- 按本轮要求，不把 Unsplash fallback 当作正式 NEED 媒体迁移。
- 后续需要人工提供或确认真实首页交互图，再填入槽位。

## 4. public 媒体 seed 清单

新增 `server/data/seeds/public-home-media.seed.json`，包含以下资源：

| 资源 | category | ownerType | ownerSlug | groupKey | 说明 |
|---|---|---|---|---|---|
| `hero-video.mp4` | `home_video` | `home` | `homepage` | `hero-video` | 首页首屏视频 |
| `logo.png` | `temporary` | `system` | `global` | `brand` | 导航 Logo；现有媒体分类无 `site_asset` |
| `qr-wechat.png` | `qrcode` | `system` | `contact` | `contact-qrcode` | 官方微信二维码 |
| `qr-xhs-main.png` | `qrcode` | `system` | `contact` | `contact-qrcode` | NEED 尼德公关小红书二维码 |
| `qr-xhs-sub.png` | `qrcode` | `system` | `contact` | `contact-qrcode` | 然汽造小红书二维码 |

注意：

- 本轮没有直接写入 `server/data/media-library.json`。
- seed 使用现有 `MediaOwnerType` 中允许的 `home` / `system`。当前类型没有 `site`，所以站点级资源暂用 `system`。
- 后续如果新增 `site_asset` 分类或 `site` ownerType，可再做一次轻量归类迁移。

## 5. 需要人工确认的资源

| 资源 | 需要确认的问题 |
|---|---|
| `hero-video.mp4` | 是否为最终首页首屏视频；是否需要 poster；是否需要压缩版。 |
| `logo.png` | 是否继续作为正式品牌 Logo；是否需要进入站点配置而非普通媒体。 |
| `qr-wechat.png` | 微信二维码是否仍有效。 |
| `qr-xhs-main.png` | 小红书主账号二维码是否仍有效。 |
| `qr-xhs-sub.png` | 小红书子账号二维码是否仍有效。 |
| 首页交互图 | 需要提供真实 12 图或确认当前应该展示哪些 NEED 现场图。 |

## 6. 本轮没有迁移的资源

| 资源 | 原因 |
|---|---|
| `factory-1.png` 到 `factory-4.png` | 属于联系页/企业资产页，不是首页配置；可在后续站点配置或页面编辑器迁移。 |
| `red1.jpg`、`red2.jpg` | 第 14 轮未发现前台引用，需人工确认用途。 |
| `wechat-qr.jpg` | 第 14 轮未发现前台引用，可能是旧二维码，需人工确认。 |
| public Markdown 文件 | 属于文章迁移范围，留到 15.2。 |
| 现代汽车家庭日案例图片路径 | 属于案例迁移范围，且当前 public 未发现对应文件，留到 15.3 或 Word 重导。 |
| Unsplash 外链图 | 不作为 NEED 正式媒体迁移。 |

## 7. 如何验证

1. 启动服务端：`npm.cmd run dev:server`
2. 启动后台：`npm.cmd run dev:admin`
3. 打开后台首页管理，检查首页视频配置是否显示：
   - 视频地址：`/hero-video.mp4`
   - 展示名称：`首页首屏视频`
   - 状态：启用
4. 打开首页 12 图管理，检查仍有 12 个槽位，且为空槽位。
5. 检查 `server/data/seeds/public-home-media.seed.json`，确认 seed 清单包含首页视频、Logo 和 3 个二维码。

## 8. 第 15.2 建议迁移什么

建议第 15.2 迁移文章数据：

1. 迁移 `src/App.tsx` 中 `articlesData` 的 4 篇文章。
2. 迁移 `src/App.tsx` 中 `chooseBetweenTwoArticlesData` 的 4 篇文章。
3. 读取 `public/` 中 4 个有内容的 Markdown 文件，人工确认是否与代码文章重复。
4. 为空 Markdown 只建立选题草稿或暂不迁移。
5. 补 slug、SEO title、SEO description、keywords 和摘要。
