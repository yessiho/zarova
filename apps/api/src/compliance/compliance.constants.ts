export const COMPLIANCE_CASE_STATUSES = [
  'OPEN',
  'UNDER_REVIEW',
  'ESCALATED',
  'RESOLVED',
  'DISMISSED',
] as const;

export type ComplianceCaseStatus =
  (typeof COMPLIANCE_CASE_STATUSES)[number];

export const COMPLIANCE_PRIORITIES = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;

export type CompliancePriority =
  (typeof COMPLIANCE_PRIORITIES)[number];

export const COMPLIANCE_CASE_TYPES = [
  'TRANSACTION_MONITORING',
  'SUSPICIOUS_TRANSACTION',
  'FRAUD_REVIEW',
  'KYC_REVIEW',
  'AML_REVIEW',
  'ACCOUNT_REVIEW',
  'MANUAL_REVIEW',
] as const;

export type ComplianceCaseType =
  (typeof COMPLIANCE_CASE_TYPES)[number];