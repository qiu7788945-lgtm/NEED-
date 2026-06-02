import type { ExportModuleDefinition, ExportModuleName } from './types.js';

export const exportModuleRegistry: ExportModuleDefinition[] = [
  {
    moduleName: 'contact-info',
    jsonPath: 'server/data/contact-info.json',
    mysqlTables: ['contact_info'],
    exportStatus: 'implemented',
    riskLevel: 'low',
    notes: ['Singleton content module exported from contact_info.content_json.'],
  },
  {
    moduleName: 'company-assets',
    jsonPath: 'server/data/company-assets.json',
    mysqlTables: ['company_assets', 'media_files'],
    exportStatus: 'implemented',
    riskLevel: 'medium',
    notes: ['Exports from company_assets; raw_json preserves core display fields while media_files remains informational.'],
  },
  {
    moduleName: 'home-video',
    jsonPath: 'server/data/home-video.json',
    mysqlTables: ['home_video', 'media_files'],
    exportStatus: 'implemented',
    riskLevel: 'medium',
    notes: ['Exports from home_video and uses optional media_files metadata for file names only.'],
  },
  {
    moduleName: 'home-interactive-images',
    jsonPath: 'server/data/home-interactive-images.json',
    mysqlTables: ['home_interactive_images', 'media_files'],
    exportStatus: 'implemented',
    riskLevel: 'medium',
    notes: ['Exports from home_interactive_images and preserves the 12-slot JSON shape.'],
  },
  {
    moduleName: 'articles',
    jsonPath: 'server/data/articles.json',
    mysqlTables: ['articles', 'article_categories', 'seo_settings', 'faq_items'],
    exportStatus: 'skeleton_only',
    riskLevel: 'medium',
    notes: ['Future export should merge article rows with category, SEO, and FAQ rows into articles.json shape.'],
  },
  {
    moduleName: 'cases',
    jsonPath: 'server/data/cases.json',
    mysqlTables: ['cases', 'case_images', 'seo_settings', 'faq_items'],
    exportStatus: 'skeleton_only',
    riskLevel: 'high',
    notes: ['Future export should use cases.raw_json as the JSON-shape base and validate active case_images.'],
  },
  {
    moduleName: 'solutions',
    jsonPath: 'server/data/solutions.json',
    mysqlTables: ['solutions', 'solution_groups', 'solution_media_items'],
    exportStatus: 'skeleton_only',
    riskLevel: 'high',
    notes: ['Future export should use solutions.raw_json as the scene-shape base and validate active split rows.'],
  },
  {
    moduleName: 'pages',
    jsonPath: 'server/data/pages.json',
    mysqlTables: ['pages', 'page_blocks', 'seo_settings'],
    exportStatus: 'skipped_empty_source',
    riskLevel: 'low',
    notes: ['Current JSON source is expected to be empty in 22-6-3; keep as empty-source confirmation only.'],
  },
];

export function findExportModuleDefinition(moduleName: ExportModuleName) {
  return exportModuleRegistry.find((definition) => definition.moduleName === moduleName);
}
