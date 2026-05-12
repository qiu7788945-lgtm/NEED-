import type { MigrationModuleName, ModuleDefinition } from '../migration/types.js';

const sharedSeoFields = ['owner_type', 'owner_source_id', 'title', 'description', 'keywords'];
const sharedFaqFields = ['owner_type', 'owner_source_id', 'question', 'answer', 'sort_order', 'status'];
const sharedMediaFields = [
  'file_name',
  'original_name',
  'file_path',
  'public_url',
  'mime_type',
  'file_ext',
  'file_size',
  'category',
  'alt_text',
  'description',
  'metadata_json',
  'status',
];

export const moduleDefinitions: ModuleDefinition[] = [
  {
    moduleName: 'articles',
    migrationKey: 'content:articles',
    sourceFile: 'articles.json',
    sourceRequired: true,
    countStrategy: 'array',
    upsertKeys: ['articles.source_id', 'articles.slug', 'article_categories.slug'],
    plannedWrites: [
      {
        table: 'article_categories',
        fields: ['name', 'slug', 'description', 'sort_order', 'status'],
        purpose: 'Derived article category rows from article category slugs.',
      },
      {
        table: 'articles',
        fields: [
          'source_id',
          'category_slug',
          'title',
          'slug',
          'summary',
          'content',
          'status',
          'sort_order',
        ],
        purpose: 'Article primary records from articles.json.',
      },
      {
        table: 'seo_settings',
        fields: sharedSeoFields,
        purpose: 'Article SEO fields.',
      },
      {
        table: 'faq_items',
        fields: sharedFaqFields,
        purpose: 'Article FAQ items.',
      },
    ],
  },
  {
    moduleName: 'cases',
    migrationKey: 'content:cases',
    sourceFile: 'cases.json',
    sourceRequired: true,
    countStrategy: 'array',
    upsertKeys: ['cases.source_id', 'cases.slug', 'case_images.case_id+image_url+sort_order'],
    plannedWrites: [
      {
        table: 'cases',
        fields: [
          'source_id',
          'title',
          'slug',
          'summary',
          'client_type',
          'event_type',
          'event_date',
          'location',
          'cover_url',
          'cover_file_name',
          'cover_display_name',
          'word_file_name',
          'word_original_name',
          'content_html',
          'content_text',
          'raw_json',
          'status',
          'sort_order',
        ],
        purpose: 'Case primary records from cases.json.',
      },
      {
        table: 'case_images',
        fields: ['image_url', 'alt_text', 'caption', 'sort_order', 'is_enabled'],
        purpose: 'Extracted case images.',
      },
      {
        table: 'media_files',
        fields: sharedMediaFields,
        purpose: 'Case cover and extracted image metadata.',
      },
      {
        table: 'seo_settings',
        fields: sharedSeoFields,
        purpose: 'Case SEO fields.',
      },
      {
        table: 'faq_items',
        fields: sharedFaqFields,
        purpose: 'Case FAQ items.',
      },
    ],
  },
  {
    moduleName: 'solutions',
    migrationKey: 'content:solutions',
    sourceFile: 'solutions.json',
    sourceRequired: true,
    countStrategy: 'array',
    upsertKeys: [
      'solutions.slug',
      'solution_groups.source_id',
      'solution_groups.solution_id+slug',
      'solution_media_items.source_id',
      'solution_media_items.group_id+media_url+sort_order',
    ],
    plannedWrites: [
      {
        table: 'solutions',
        fields: ['source_id', 'title', 'slug', 'summary', 'raw_json', 'status', 'sort_order'],
        purpose: 'Solution scene primary records.',
      },
      {
        table: 'solution_groups',
        fields: [
          'solution_id',
          'source_id',
          'title',
          'slug',
          'summary',
          'scene_slug',
          'sort_order',
          'is_enabled',
        ],
        purpose: 'Solution grouped gallery/case sections.',
      },
      {
        table: 'solution_media_items',
        fields: [
          'group_id',
          'source_id',
          'file_type',
          'media_url',
          'media_file_name',
          'media_display_name',
          'alt_text',
          'caption',
          'sort_order',
          'is_enabled',
        ],
        purpose: 'Solution group image and video items.',
      },
      {
        table: 'media_files',
        fields: sharedMediaFields,
        purpose: 'Solution image and video metadata.',
      },
    ],
  },
  {
    moduleName: 'scenario-detail-pages',
    migrationKey: 'content:scenario-detail-pages',
    sourceFile: 'scenario-detail-pages.json',
    sourceRequired: true,
    countStrategy: 'array',
    upsertKeys: ['solution_pages.source_id', 'solution_pages.route_path', 'solution_pages.solution_id+slug'],
    plannedWrites: [
      {
        table: 'solution_pages',
        fields: ['solution_id', 'source_id', 'title', 'slug', 'route_path', 'summary', 'status', 'sort_order'],
        purpose: 'Scenario detail pages.',
      },
      {
        table: 'solution_page_blocks',
        fields: ['solution_page_id', 'block_type', 'block_data_json', 'sort_order', 'is_enabled'],
        purpose: 'Scenario detail page content blocks.',
      },
      {
        table: 'seo_settings',
        fields: sharedSeoFields,
        purpose: 'Scenario detail page SEO fields.',
      },
      {
        table: 'faq_items',
        fields: sharedFaqFields,
        purpose: 'Scenario detail page FAQ items.',
      },
    ],
  },
  {
    moduleName: 'pages',
    migrationKey: 'content:pages',
    sourceFile: 'pages.json',
    sourceRequired: true,
    countStrategy: 'array',
    upsertKeys: ['pages.source_id', 'pages.slug'],
    plannedWrites: [
      {
        table: 'pages',
        fields: ['source_id', 'title', 'slug', 'summary', 'status', 'sort_order', 'is_system_page'],
        purpose: 'Generic page records.',
      },
      {
        table: 'page_blocks',
        fields: ['page_id', 'block_type', 'block_data_json', 'sort_order', 'is_enabled'],
        purpose: 'Generic page block data.',
      },
      {
        table: 'seo_settings',
        fields: sharedSeoFields,
        purpose: 'Generic page SEO fields.',
      },
    ],
  },
  {
    moduleName: 'home-video',
    migrationKey: 'content:home-video',
    sourceFile: 'home-video.json',
    sourceRequired: true,
    countStrategy: 'singleton',
    upsertKeys: ['home_video.singleton_key'],
    plannedWrites: [
      {
        table: 'home_video',
        fields: ['singleton_key', 'video_url', 'poster_url', 'title', 'description', 'is_enabled'],
        purpose: 'Homepage hero video singleton.',
      },
      {
        table: 'media_files',
        fields: sharedMediaFields,
        purpose: 'Homepage video and poster metadata.',
      },
    ],
  },
  {
    moduleName: 'home-interactive-images',
    migrationKey: 'content:home-interactive-images',
    sourceFile: 'home-interactive-images.json',
    sourceRequired: true,
    countStrategy: 'array',
    upsertKeys: ['home_interactive_images.slot_number'],
    plannedWrites: [
      {
        table: 'home_interactive_images',
        fields: ['slot_number', 'image_url', 'alt_text', 'sort_order', 'is_enabled'],
        purpose: 'Fixed 12 homepage interactive image slots.',
      },
      {
        table: 'media_files',
        fields: sharedMediaFields,
        purpose: 'Homepage interactive image metadata.',
      },
    ],
  },
  {
    moduleName: 'contact-info',
    migrationKey: 'content:contact-info',
    sourceFile: 'contact-info.json',
    sourceRequired: true,
    countStrategy: 'singleton',
    upsertKeys: ['contact_info.singleton_key'],
    plannedWrites: [
      {
        table: 'contact_info',
        fields: ['singleton_key', 'content_json', 'is_enabled'],
        purpose: 'Contact information singleton JSON payload.',
      },
    ],
  },
  {
    moduleName: 'company-assets',
    migrationKey: 'content:company-assets',
    sourceFile: 'company-assets.json',
    sourceRequired: true,
    countStrategy: 'array',
    upsertKeys: ['company_assets.asset_key'],
    plannedWrites: [
      {
        table: 'company_assets',
        fields: ['asset_key', 'media_url', 'alt_text', 'description', 'sort_order', 'is_enabled', 'raw_json'],
        purpose: 'Company/contact page asset metadata.',
      },
      {
        table: 'media_files',
        fields: sharedMediaFields,
        purpose: 'Company/contact asset media metadata.',
      },
    ],
  },
  {
    moduleName: 'media-library',
    migrationKey: 'content:media-library',
    sourceFile: 'media-library.json',
    sourceRequired: false,
    countStrategy: 'array',
    upsertKeys: ['media_files.public_url', 'media_files.file_path'],
    plannedWrites: [
      {
        table: 'media_files',
        fields: sharedMediaFields,
        purpose: 'Media library metadata shadow migration.',
      },
    ],
  },
  {
    moduleName: 'publish-logs',
    migrationKey: 'content:publish-logs',
    sourceFile: 'publish-logs/*.json',
    sourceRequired: false,
    countStrategy: 'publish-logs',
    upsertKeys: ['publish_logs.publish_version'],
    plannedWrites: [
      {
        table: 'publish_logs',
        fields: [
          'publish_version',
          'publish_type',
          'target_type',
          'target_id',
          'status',
          'release_dir',
          'previous_version',
          'rollback_to_version',
          'summary',
          'error_message',
          'source_stats_json',
          'failed_routes_json',
          'routes_json',
          'raw_log_json',
          'started_at',
          'finished_at',
        ],
        purpose: 'Shadow publish log indexing only; JSON publish logs remain primary.',
      },
    ],
  },
];

export function findModuleDefinition(moduleName: MigrationModuleName): ModuleDefinition | undefined {
  return moduleDefinitions.find((definition) => definition.moduleName === moduleName);
}
