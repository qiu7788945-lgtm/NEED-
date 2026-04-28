export const CONTENT_STATUSES = ['draft', 'published', 'offline', 'archived'] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const MEDIA_STATUSES = ['active', 'temp', 'archived'] as const;

export type MediaStatus = (typeof MEDIA_STATUSES)[number];

export const PUBLISH_STATUSES = ['pending', 'success', 'failed'] as const;

export type PublishStatus = (typeof PUBLISH_STATUSES)[number];
