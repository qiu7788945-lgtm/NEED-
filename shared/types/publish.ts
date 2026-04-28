import type { PublishStatus } from '../constants/status';

export type PublishAction = 'preview' | 'publish' | 'rollback';

export interface PublishLogSummary {
  id?: number;
  version: string;
  action: PublishAction;
  status: PublishStatus;
  message?: string;
  releasePath?: string;
}
