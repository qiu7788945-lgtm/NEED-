# Contact And Company Assets Model V21

本轮建立联系我们与自有资产的专属 JSON 数据模型与 API 链路。`/contact` 是专属模块，后续不交给 PageEditor 维护。

## Current Scope

- `server/data/contact-info.json` 保存公司名称、品牌名、地址、邮箱、电话占位和社媒二维码信息。
- `server/data/company-assets.json` 保存四类自有资产的标题、摘要、描述、地点、图片、alt、排序和启用状态。
- 第21-6F-3 新增 GET/PUT API，用于读取和保存上述两个 JSON 数据源。

## API

- `GET /api/contact-info`：读取 `server/data/contact-info.json`。
- `PUT /api/contact-info`：保存完整 contact info 对象。
- `GET /api/company-assets`：读取 `server/data/company-assets.json`。
- `PUT /api/company-assets`：保存完整 company assets 数组。

## Follow-Up Rounds

- 第21-6F-4：新增专属后台管理入口，用于维护联系方式、社媒二维码、自有资产内容、图片、alt、排序和启用状态。
- 第21-6F-5：前台 `/contact` 通过 `src/services/publicContent.ts` 接入 `fetchContactInfo()` 与 `fetchCompanyAssets()`，保留现有硬编码 fallback。

## Frontend And GEO Requirements

- 后续图片 URL 必须通过 `resolvePublicAssetUrl` 归一化。
- 后续 `/contact` requiredChecks 需要覆盖联系字段、社媒名称、自有资产标题和图片 alt。
- 后续上传图片进入 HTML 的链路应通过专属数据源字段确认，不依赖 PageEditor。
