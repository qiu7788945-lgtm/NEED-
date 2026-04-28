import { logger } from '../../utils/logger.js';

export interface AuditLogInput {
  action: string;
  entityType?: string;
  entityId?: string | number;
  actorId?: string | number;
  metadata?: Record<string, unknown>;
}

export function logAudit(input: AuditLogInput) {
  logger.info('Audit event placeholder', input);
}
