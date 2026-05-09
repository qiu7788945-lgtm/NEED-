# Contact And Company Assets Model V21

本轮只建立联系我们与自有资产 JSON 数据草案，不接入前台、不新增 API、不新增后台 UI，也不改变现有 prerender 输出。

## Scope

- `server/data/contact-info.json` 保存公司名称、品牌名、地址、邮箱、电话占位和社媒二维码信息。
- `server/data/company-assets.json` 保存四类自有资产的标题、摘要、描述、地点、图片、alt、排序和启用状态。
- `/contact` 是专属模块，后续不交给 PageEditor 维护。

## Follow-Up Rounds

- 第21-6F-3：新增 `GET/PUT` API，读取和保存 `contact-info.json` 与 `company-assets.json`。
- 第21-6F-4：新增专属后台管理入口，用于维护联系方式、社媒二维码、自有资产内容、图片、alt、排序和启用状态。
- 第21-6F-5：前台 `/contact` 通过 `src/services/publicContent.ts` 接入 `fetchContactInfo()` 与 `fetchCompanyAssets()`，保留现有硬编码 fallback。

## Frontend And GEO Requirements

- 后续图片 URL 必须通过 `resolvePublicAssetUrl` 归一化。
- 后续 `/contact` requiredChecks 需要覆盖联系字段、社媒名称、自有资产标题和图片 alt。
- 后续上传图片进入 HTML 的链路应通过专属数据源字段确认，不依赖 PageEditor。
