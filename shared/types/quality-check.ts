export type QualityCheckModule = 'home' | 'articles' | 'cases' | 'solutions' | 'media' | 'seo';

export type QualityCheckSeverity = 'high' | 'medium' | 'low';

export type QualityCheckTargetType =
  | 'homeVideo'
  | 'homeInteractive'
  | 'article'
  | 'case'
  | 'solution'
  | 'solutionGroup'
  | 'mediaSeed';

export interface QualityCheckTarget {
  type: QualityCheckTargetType;
  id?: string;
  slug?: string;
  category?: string;
}

export interface QualityCheckItem {
  id: string;
  module: QualityCheckModule;
  objectType: string;
  objectTitle: string;
  severity: QualityCheckSeverity;
  issue: string;
  suggestion: string;
  blockingPublish: boolean;
  needsHumanConfirmation: boolean;
  target: QualityCheckTarget;
}

export interface QualityCheckSummary {
  total: number;
  high: number;
  medium: number;
  low: number;
  blockingPublish: number;
}

export interface QualityCheckResult {
  summary: QualityCheckSummary;
  items: QualityCheckItem[];
  updatedAt: string;
}
