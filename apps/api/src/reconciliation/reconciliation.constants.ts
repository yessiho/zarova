export const RECONCILIATION_RUN_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'APPROVED',
  'FAILED',
] as const;

export type ReconciliationRunStatus =
  (typeof RECONCILIATION_RUN_STATUSES)[number];

export const RECONCILIATION_RUN_TYPES = [
  'MANUAL',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
] as const;

export type ReconciliationRunType =
  (typeof RECONCILIATION_RUN_TYPES)[number];

export const RECONCILIATION_ENTRY_STATUSES = [
  'MATCHED',
  'UNMATCHED',
  'DISCREPANCY',
] as const;

export type ReconciliationEntryStatus =
  (typeof RECONCILIATION_ENTRY_STATUSES)[number];
