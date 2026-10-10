'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  useParams,
  useRouter,
} from 'next/navigation';

import {
  ArrowLeft,
  Landmark,
  TrendingDown,
  TrendingUp,
  WalletCards,
  Activity,
  CircleDollarSign,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

/* ==========================================================
   TYPES
========================================================== */

type LedgerAccountType =
  | 'ASSET'
  | 'LIABILITY'
  | 'REVENUE'
  | 'EXPENSE'
  | 'EQUITY';

type LedgerAccount = {
  id: number;
  code: string;
  name: string;
  type: LedgerAccountType;
  currency: string;
  active: boolean;
  totalDebit: string | number;
  totalCredit: string | number;
  balance: string | number;
  createdAt?: string;
  updatedAt?: string;
};

type LedgerDetailResponse = {
  account: LedgerAccount;
};

/* ==========================================================
   HELPERS
========================================================== */

function formatAmount(
  amount: string | number,
  currency: string,
): string {
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return `${currency} ${amount}`;
  }

  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString(
      'en-NG',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    )}`;
  }
}

function formatDate(
  value?: string,
): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat(
    'en-NG',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(date);
}

function getTypeClass(
  type: LedgerAccountType,
): string {
  switch (type) {
    case 'ASSET':
      return 'ledger-detail-type asset';

    case 'LIABILITY':
      return 'ledger-detail-type liability';

    case 'REVENUE':
      return 'ledger-detail-type revenue';

    case 'EXPENSE':
      return 'ledger-detail-type expense';

    case 'EQUITY':
      return 'ledger-detail-type equity';

    default:
      return 'ledger-detail-type';
  }
}

function getNormalBalance(
  type: LedgerAccountType,
): 'Debit' | 'Credit' {
  return type === 'ASSET' ||
    type === 'EXPENSE'
    ? 'Debit'
    : 'Credit';
}

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (
      error as {
        message?: unknown;
      }
    ).message === 'string'
  ) {
    return (
      error as {
        message: string;
      }
    ).message;
  }

  return 'Unable to load ledger account.';
}

/* ==========================================================
   PAGE
========================================================== */

export default function LedgerAccountDetailPage() {
  const router = useRouter();

  const params = useParams();

  const accountId = String(
    params.id ?? '',
  );

  const [account, setAccount] =
    useState<LedgerAccount | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  /* ========================================================
     LOAD ACCOUNT
  ======================================================== */

  const loadAccount =
    useCallback(
      async (
        isRefresh = false,
      ) => {
        try {
          setError('');

          if (isRefresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          const response =
            (await apiFetch(
              `/admin/ledger/accounts/${accountId}`,
            )) as LedgerDetailResponse;

          if (
            !response ||
            !response.account
          ) {
            throw new Error(
              'Invalid ledger account response.',
            );
          }

          setAccount(
            response.account,
          );
        } catch (
          caughtError: unknown
        ) {
          console.error(
            'Ledger account loading error:',
            caughtError,
          );

          const message =
            getErrorMessage(
              caughtError,
            );

          setError(message);
          setAccount(null);
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [accountId],
    );

  /* ========================================================
     INITIAL LOAD
  ======================================================== */

  useEffect(() => {
    if (!accountId) {
      setError(
        'Invalid ledger account ID.',
      );

      setLoading(false);

      return;
    }

    void loadAccount();
  }, [
    accountId,
    loadAccount,
  ]);

  /* ========================================================
     LOADING STATE
  ======================================================== */

  if (loading) {
    return (
      <div className="ledger-detail-page">

        <div className="ledger-detail-loading">
          <div className="ledger-detail-loading-icon">
            <Loader2
              size={30}
              className="ledger-detail-spin"
            />
          </div>

          <h2>
            Loading ledger account
          </h2>

          <p>
            Retrieving account details and
            current ledger balance...
          </p>
        </div>

      </div>
    );
  }

  /* ========================================================
     ERROR STATE
  ======================================================== */

  if (error || !account) {
    return (
      <div className="ledger-detail-page">

        <div className="ledger-detail-topbar">
          <button
            type="button"
            className="ledger-detail-back"
            onClick={() =>
              router.push(
                '/admin/ledger',
              )
            }
          >
            <ArrowLeft size={18} />

            Back to Ledger
          </button>
        </div>

        <div className="ledger-detail-error">

          <div className="ledger-detail-error-icon">
            <AlertCircle size={28} />
          </div>

          <div>
            <h2>
              Unable to load ledger account
            </h2>

            <p>
              {error ||
                'The requested ledger account could not be found.'}
            </p>
          </div>

          <button
            type="button"
            className="ledger-detail-retry"
            onClick={() =>
              void loadAccount()
            }
          >
            <RefreshCw size={17} />

            Try Again
          </button>

        </div>

      </div>
    );
  }

  /* ========================================================
     DERIVED VALUES
  ======================================================== */

  const normalBalance =
    getNormalBalance(
      account.type,
    );

  const balanceIsPositive =
    Number(account.balance) >= 0;

  /* ========================================================
     PAGE
  ======================================================== */

  return (
    <div className="ledger-detail-page">

      {/* ====================================================
          TOP BAR
      ==================================================== */}

      <div className="ledger-detail-topbar">

        <button
          type="button"
          className="ledger-detail-back"
          onClick={() =>
            router.push(
              '/admin/ledger',
            )
          }
        >
          <ArrowLeft size={18} />

          Back to Ledger
        </button>

        <button
          type="button"
          className="ledger-detail-refresh"
          onClick={() =>
            void loadAccount(true)
          }
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2
              size={17}
              className="ledger-detail-spin"
            />
          ) : (
            <RefreshCw size={17} />
          )}

          {refreshing
            ? 'Refreshing...'
            : 'Refresh'}
        </button>

      </div>

      {/* ====================================================
          BREADCRUMB
      ==================================================== */}

      <div className="ledger-detail-breadcrumb">

        <button
          type="button"
          onClick={() =>
            router.push(
              '/admin/ledger',
            )
          }
        >
          General Ledger
        </button>

        <ChevronRight size={15} />

        <span>
          {account.code}
        </span>

      </div>

      {/* ====================================================
          ACCOUNT HERO
      ==================================================== */}

      <section className="ledger-detail-hero">

        <div className="ledger-detail-hero-main">

          <div className="ledger-detail-account-icon">
            <Landmark size={30} />
          </div>

          <div className="ledger-detail-title">

            <div className="ledger-detail-title-line">

              <h1>
                {account.name}
              </h1>

              <span
                className={
                  account.active
                    ? 'ledger-detail-status active'
                    : 'ledger-detail-status inactive'
                }
              >
                <span />

                {account.active
                  ? 'Active'
                  : 'Inactive'}
              </span>

            </div>

            <p>
              General Ledger Account
            </p>

            <div className="ledger-detail-meta">

              <span>
                Code:
                <strong>
                  {account.code}
                </strong>
              </span>

              <span className="ledger-detail-meta-divider">
                •
              </span>

              <span>
                Account ID:
                <strong>
                  #{account.id}
                </strong>
              </span>

              <span className="ledger-detail-meta-divider">
                •
              </span>

              <span>
                Currency:
                <strong>
                  {account.currency}
                </strong>
              </span>

            </div>

          </div>

        </div>

        <div className="ledger-detail-type-wrapper">

          <span
            className={getTypeClass(
              account.type,
            )}
          >
            {account.type}
          </span>

        </div>

      </section>

      {/* ====================================================
          BALANCE HERO
      ==================================================== */}

      <section className="ledger-detail-balance-card">

        <div className="ledger-detail-balance-left">

          <div className="ledger-detail-balance-icon">
            <CircleDollarSign
              size={25}
            />
          </div>

          <div>
            <span>
              Current Balance
            </span>

            <strong>
              {formatAmount(
                account.balance,
                account.currency,
              )}
            </strong>

            <small>
              {account.currency}{' '}
              ledger balance
            </small>
          </div>

        </div>

        <div className="ledger-detail-balance-indicator">

          <span>
            Normal Balance
          </span>

          <strong>
            {normalBalance}
          </strong>

        </div>

      </section>

      {/* ====================================================
          FINANCIAL SUMMARY
      ==================================================== */}

      <div className="ledger-detail-stat-grid">

        {/* TOTAL DEBIT */}

        <div className="ledger-detail-stat-card">

          <div className="ledger-detail-stat-icon debit">
            <TrendingDown size={21} />
          </div>

          <div className="ledger-detail-stat-content">

            <span>
              Total Debit
            </span>

            <strong>
              {formatAmount(
                account.totalDebit,
                account.currency,
              )}
            </strong>

            <small>
              Debit activity
            </small>

          </div>

        </div>

        {/* TOTAL CREDIT */}

        <div className="ledger-detail-stat-card">

          <div className="ledger-detail-stat-icon credit">
            <TrendingUp size={21} />
          </div>

          <div className="ledger-detail-stat-content">

            <span>
              Total Credit
            </span>

            <strong>
              {formatAmount(
                account.totalCredit,
                account.currency,
              )}
            </strong>

            <small>
              Credit activity
            </small>

          </div>

        </div>

        {/* BALANCE */}

        <div className="ledger-detail-stat-card">

          <div className="ledger-detail-stat-icon balance">
            <WalletCards size={21} />
          </div>

          <div className="ledger-detail-stat-content">

            <span>
              Closing Balance
            </span>

            <strong>
              {formatAmount(
                account.balance,
                account.currency,
              )}
            </strong>

            <small>
              Current calculated position
            </small>

          </div>

        </div>

      </div>

      {/* ====================================================
          MAIN CONTENT
      ==================================================== */}

      <div className="ledger-detail-content-grid">

        {/* ==================================================
            ACCOUNT INFORMATION
        ================================================== */}

        <section className="ledger-detail-panel">

          <div className="ledger-detail-panel-header">

            <div className="ledger-detail-panel-heading">

              <div className="ledger-detail-panel-icon">
                <Landmark size={19} />
              </div>

              <div>
                <h2>
                  Account Information
                </h2>

                <p>
                  Core configuration and
                  identification details.
                </p>
              </div>

            </div>

          </div>

          <div className="ledger-detail-info-list">

            <div className="ledger-detail-info-row">
              <span>
                Account Name
              </span>

              <strong>
                {account.name}
              </strong>
            </div>

            <div className="ledger-detail-info-row">
              <span>
                Account Code
              </span>

              <code>
                {account.code}
              </code>
            </div>

            <div className="ledger-detail-info-row">
              <span>
                Account Type
              </span>

              <span
                className={getTypeClass(
                  account.type,
                )}
              >
                {account.type}
              </span>
            </div>

            <div className="ledger-detail-info-row">
              <span>
                Currency
              </span>

              <strong>
                {account.currency}
              </strong>
            </div>

            <div className="ledger-detail-info-row">
              <span>
                Status
              </span>

              <span
                className={
                  account.active
                    ? 'ledger-detail-status active'
                    : 'ledger-detail-status inactive'
                }
              >
                <span />

                {account.active
                  ? 'Active'
                  : 'Inactive'}
              </span>
            </div>

            <div className="ledger-detail-info-row">
              <span>
                Account ID
              </span>

              <strong>
                #{account.id}
              </strong>
            </div>

            <div className="ledger-detail-info-row">
              <span>
                Created
              </span>

              <strong>
                {formatDate(
                  account.createdAt,
                )}
              </strong>
            </div>

            <div className="ledger-detail-info-row">
              <span>
                Last Updated
              </span>

              <strong>
                {formatDate(
                  account.updatedAt,
                )}
              </strong>
            </div>

          </div>

        </section>

        {/* ==================================================
            ACCOUNTING SUMMARY
        ================================================== */}

        <section className="ledger-detail-panel">

          <div className="ledger-detail-panel-header">

            <div className="ledger-detail-panel-heading">

              <div className="ledger-detail-panel-icon accounting">
                <Activity size={19} />
              </div>

              <div>
                <h2>
                  Accounting Summary
                </h2>

                <p>
                  Double-entry accounting
                  position for this account.
                </p>
              </div>

            </div>

          </div>

          <div className="ledger-detail-accounting-summary">

            <div className="ledger-detail-summary-row">

              <div className="ledger-detail-summary-label">
                <span className="summary-dot debit" />

                Debit Activity
              </div>

              <strong>
                {formatAmount(
                  account.totalDebit,
                  account.currency,
                )}
              </strong>

            </div>

            <div className="ledger-detail-summary-row">

              <div className="ledger-detail-summary-label">
                <span className="summary-dot credit" />

                Credit Activity
              </div>

              <strong>
                {formatAmount(
                  account.totalCredit,
                  account.currency,
                )}
              </strong>

            </div>

            <div className="ledger-detail-summary-divider" />

            <div className="ledger-detail-summary-row closing">

              <div className="ledger-detail-summary-label">
                <span className="summary-dot balance" />

                Closing Balance
              </div>

              <strong>
                {formatAmount(
                  account.balance,
                  account.currency,
                )}
              </strong>

            </div>

          </div>

          {/* NORMAL BALANCE */}

          <div className="ledger-detail-normal-balance">

            <div className="ledger-detail-normal-icon">
              <Activity size={18} />
            </div>

            <div>

              <span>
                Normal Balance
              </span>

              <strong>
                {normalBalance}
              </strong>

              <p>
                {account.type ===
                  'ASSET' ||
                account.type ===
                  'EXPENSE'
                  ? 'This account normally increases with debit entries.'
                  : 'This account normally increases with credit entries.'}
              </p>

            </div>

          </div>

        </section>

      </div>

      {/* ====================================================
          FOOTER INFORMATION
      ==================================================== */}

      <div className="ledger-detail-footer">

        <div>
          <Landmark size={17} />

          <span>
            Ledger account #{account.id}
          </span>
        </div>

        <span>
          {account.code}
          {' · '}
          {account.currency}
          {' · '}
          {account.type}
        </span>

      </div>

    </div>
  );
}