/*
 * ============================================================
 * WEBHOOK EVENT CONSTANTS
 *
 * All supported webhook event names for the Zarova platform.
 * ============================================================
 */

export const WEBHOOK_EVENTS = {
  TRANSACTION_COMPLETED: 'TRANSACTION_COMPLETED',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  WALLET_FUNDED: 'WALLET_FUNDED',
  WALLET_WITHDRAWN: 'WALLET_WITHDRAWN',
  PAYMENT_APPROVED: 'PAYMENT_APPROVED',
  PAYMENT_REJECTED: 'PAYMENT_REJECTED',
  RISK_ALERT_CREATED: 'RISK_ALERT_CREATED',
  TWO_FACTOR_ENABLED: 'TWO_FACTOR_ENABLED',
  TWO_FACTOR_DISABLED: 'TWO_FACTOR_DISABLED',
} as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];

export const WEBHOOK_EVENT_LIST: WebhookEvent[] = Object.values(WEBHOOK_EVENTS);
