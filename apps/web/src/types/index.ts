// ============================================================
// ZAROVA - SHARED FRONTEND TYPES
// ============================================================

// ============================================================
// CURRENCY
// ============================================================

export type Currency = 'NGN' | 'USD' | 'EUR' | 'GBP';

// ============================================================
// WALLET STATUS
//
// Must match the backend Prisma contract.
// ============================================================

export type WalletStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';

// ============================================================
// WALLET ACCOUNT TYPE
// ============================================================

export type WalletAccountType = 'SAVINGS' | 'CURRENT' | 'VIRTUAL';

// ============================================================
// WALLET ACCOUNT STATUS
// ============================================================

export type WalletAccountStatus =
  | 'ACTIVE'
  | 'FROZEN'
  | 'SUSPENDED'
  | 'CLOSED';

// ============================================================
// WALLET ACCOUNT
//
// Each wallet can have one bank / virtual account.
// ============================================================

export interface WalletAccount {
  id: number;

  walletId: number;

  accountNumber: string;

  accountName: string;

  bankName: string;

  bankCode: string | null;

  accountType: WalletAccountType;

  status: WalletAccountStatus;

  createdAt: string;

  updatedAt: string;
}

// ============================================================
// WALLET
//
// This matches the response from:
// GET /wallets
// ============================================================

export interface Wallet {
  id: number;

  userId: number;

  currency: Currency;

  /*
   * PostgreSQL BigInt values are serialized by the backend
   * as strings to avoid JavaScript precision issues.
   */
  balance: string;

  status: WalletStatus;

  createdAt: string;

  updatedAt: string;

  /*
   * Banking / virtual account attached to this wallet.
   *
   * It can be null for old wallets that have not yet
   * been assigned an account.
   */
  account: WalletAccount | null;
}

// ============================================================
// TRANSACTION TYPE
// ============================================================

export type TransactionType =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'TRANSFER';

// ============================================================
// TRANSACTION STATUS
// ============================================================

export type TransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REVERSED';

// ============================================================
// TRANSACTION
// ============================================================

export interface Transaction {
  id: number;

  reference: string;

  type: TransactionType;

  status: TransactionStatus;

  /*
   * BigInt values from the backend are serialized as strings.
   */
  amount: string;

  currency: Currency;

  sourceWalletId: number | null;

  destinationWalletId: number | null;

  createdAt: string;

  updatedAt: string;
}

// ============================================================
// USER
// ============================================================

export interface User {
  id: number;

  email: string;

  firstName: string;

  lastName: string;

  status: string;
}

// ============================================================
// LOGIN RESPONSE
//
// Important:
// Backend returns `accessToken`, not `access_token`.
// ============================================================

export interface LoginResponse {
  accessToken: string;

  user: User;
}

// ============================================================
// API ERROR RESPONSE
// ============================================================

export interface ApiErrorResponse {
  message?: string | string[];

  error?: string;

  statusCode?: number;
}