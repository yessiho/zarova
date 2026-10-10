export const RISK_ALERT_STATUSES = [
  'OPEN',
  'UNDER_REVIEW',
  'FLAGGED',
  'RELEASED',
  'FALSE_POSITIVE',
] as const;

export type RiskAlertStatus =
  (typeof RISK_ALERT_STATUSES)[number];

export const RISK_SEVERITIES = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;

export type RiskSeverity =
  (typeof RISK_SEVERITIES)[number];

export const RISK_ALERT_TYPES = [
  'UNUSUAL_TRANSACTION',
  'VELOCITY_CHECK',
  'LARGE_TRANSFER',
  'SUSPICIOUS_LOGIN',
  'ACCOUNT_TAKEOVER',
  'MONEY_LAUNDERING',
  'SANCTIONS_MATCH',
  'MANUAL_REVIEW',
] as const;

export type RiskAlertType =
  (typeof RISK_ALERT_TYPES)[number];
