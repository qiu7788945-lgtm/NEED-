import type { CompareReport } from './types.js';

export function writeCompareReport(report: CompareReport): void {
  console.log(JSON.stringify(report, null, 2));
}
