import type { MigrationPlan } from './types.js';

export function reportMigrationPlan(plan: MigrationPlan): void {
  console.log(JSON.stringify(plan, null, 2));
}
