'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';


import {
  RefreshCw,
  Landmark,
  TrendingUp,
  TrendingDown,
  WalletCards,
  AlertCircle,
  Loader2,
  ArrowLeftRight,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

/* =====================================================
   TYPES
===================================================== */

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

type CurrencyBalance = {
  currency: string;
  amount: number;
};

type ApiError = {
  message?: string;
};

type LedgerApiResponse = {
  accounts?: unknown;
  data?: unknown;
  items?: unknown;
  results?: unknown;
};

/* =====================================================
   HELPERS
===================================================== */

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as ApiError).message === 'string'
  ) {
    return (error as ApiError).message ?? fallback;
  }

  return fallback;
}

function isLedgerAccountType(
  value: unknown,
): value is LedgerAccountType {
  return (
    value === 'ASSET' ||
    value === 'LIABILITY' ||
    value === 'REVENUE' ||
    value === 'EXPENSE' ||
    value === 'EQUITY'
  );
}

function isNumberOrString(
  value: unknown,
): value is string | number {
  return (
    typeof value === 'string' ||
    typeof value === 'number'
  );
}

function isLedgerAccount(
  value: unknown,
): value is LedgerAccount {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  const account = value as Record<string, unknown>;

  return (
    typeof account.id === 'number' &&
    typeof account.code === 'string' &&
    typeof account.name === 'string' &&
    isLedgerAccountType(account.type) &&
    typeof account.currency === 'string' &&
    typeof account.active === 'boolean' &&
    isNumberOrString(account.totalDebit) &&
    isNumberOrString(account.totalCredit) &&
    isNumberOrString(account.balance)
  );
}

function isLedgerAccountArray(
  value: unknown,
): value is LedgerAccount[] {
  return (
    Array.isArray(value) &&
    value.every(isLedgerAccount)
  );
}

/* =====================================================
   NORMALIZE API RESPONSE
===================================================== */

function normalizeLedgerResponse(
  response: unknown,
): LedgerAccount[] | null {
  if (isLedgerAccountArray(response)) {
    return response;
  }

  if (
    typeof response !== 'object' ||
    response === null
  ) {
    return null;
  }

  const data = response as LedgerApiResponse;

  const possibleResponses = [
    data.accounts,
    data.data,
    data.items,
    data.results,
  ];

  for (const value of possibleResponses) {
    if (isLedgerAccountArray(value)) {
      return value;
    }
  }

  return null;
}

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

function getTypeClass(
  type: LedgerAccountType,
): string {
  switch (type) {
    case 'ASSET':
      return 'ledger-badge asset';

    case 'LIABILITY':
      return 'ledger-badge liability';

    case 'REVENUE':
      return 'ledger-badge revenue';

    case 'EXPENSE':
      return 'ledger-badge expense';

    case 'EQUITY':
      return 'ledger-badge equity';

    default:
      return 'ledger-badge';
  }
}

function getCurrencyBalances(
  accounts: LedgerAccount[],
  type: LedgerAccountType,
): CurrencyBalance[] {
  const balances = new Map<string, number>();

  accounts
    .filter(
      (account) => account.type === type,
    )
    .forEach((account) => {
      const balance = Number(account.balance);

      if (!Number.isFinite(balance)) {
        return;
      }

      const currentBalance =
        balances.get(account.currency) ?? 0;

      balances.set(
        account.currency,
        currentBalance + balance,
      );
    });

  return Array.from(
    balances.entries(),
  ).map(([currency, amount]) => ({
    currency,
    amount,
  }));
}

/* =====================================================
   LEDGER PAGE
===================================================== */

export default function LedgerPage() {
  const [accounts, setAccounts] =
    useState<LedgerAccount[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  const requestInProgress =
    useRef(false);

  /* =====================================================
     LOAD LEDGER ACCOUNTS
  ===================================================== */

  const loadAccounts = useCallback(
    async (isRefresh = false) => {
      if (requestInProgress.current) {
        return;
      }

      requestInProgress.current = true;

      try {
        setError('');

        if (!isRefresh) {
          setAccounts([]);
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        const response: unknown =
          await apiFetch('/ledger/accounts');

        const normalizedAccounts =
          normalizeLedgerResponse(response);

        if (!normalizedAccounts) {
          throw new Error(
            'Unexpected response from ledger API.',
          );
        }

        setAccounts(normalizedAccounts);
      } catch (caughtError: unknown) {
        console.error(
          'Ledger loading error:',
          caughtError,
        );

        setAccounts([]);

        setError(
          getErrorMessage(
            caughtError,
            'Unable to load ledger accounts.',
          ),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
        requestInProgress.current = false;
      }
    },
    [],
  );

  /* =====================================================
     INITIAL LOAD
  ===================================================== */

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadAccounts();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadAccounts]);

  /* =====================================================
     STATISTICS
  ===================================================== */

  const statistics = useMemo(() => {
    const activeAccounts =
      accounts.filter(
        (account) => account.active,
      ).length;

    const assetAccounts =
      accounts.filter(
        (account) =>
          account.type === 'ASSET',
      ).length;

    const liabilityAccounts =
      accounts.filter(
        (account) =>
          account.type === 'LIABILITY',
      ).length;

    const currencies = [
      ...new Set(
        accounts
          .map(
            (account) =>
              account.currency,
          )
          .filter(Boolean),
      ),
    ];

    const assetBalances =
      getCurrencyBalances(
        accounts,
        'ASSET',
      );

    const liabilityBalances =
      getCurrencyBalances(
        accounts,
        'LIABILITY',
      );

    return {
      activeAccounts,
      assetAccounts,
      liabilityAccounts,
      currencies,
      assetBalances,
      liabilityBalances,
    };
  }, [accounts]);

  /* =====================================================
     PAGE
  ===================================================== */

  return (
    <div className="ledger-page">

      {/* PAGE HEADER */}

      <div className="ledger-header">
        <div>
          <div className="ledger-title-row">
            <Landmark size={28} />

            <h1>General Ledger</h1>
          </div>

          <p>
            Monitor financial accounts, balances, and
            double-entry accounting activity.
          </p>
        </div>

        <button
          type="button"
          className="ledger-refresh-button"
          onClick={() =>
            void loadAccounts(true)
          }
          disabled={loading || refreshing}
        >
          {refreshing ? (
            <Loader2
              size={18}
              className="spin"
            />
          ) : (
            <RefreshCw size={18} />
          )}

          {refreshing
            ? 'Refreshing...'
            : 'Refresh'}
        </button>
      </div>

      {/* ERROR */}

      {error && (
        <div className="ledger-error">
          <AlertCircle size={20} />

          <div>
            <strong>
              Unable to load ledger
            </strong>

            <span>{error}</span>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadAccounts()
            }
          >
            Try Again
          </button>
        </div>
      )}

      {/* LOADING */}

      {loading ? (
        <div className="ledger-loading">
          <Loader2
            size={34}
            className="spin"
          />

          <p>
            Loading ledger accounts...
          </p>
        </div>
      ) : (
        <>

          {/* SUMMARY */}

          <div className="ledger-summary-grid">

            {/* TOTAL ACCOUNTS */}

            <div className="ledger-summary-card">
              <div className="summary-icon accounts">
                <WalletCards size={22} />
              </div>

              <div>
                <span>Total Accounts</span>

                <strong>
                  {accounts.length}
                </strong>

                <small>
                  {statistics.activeAccounts} active
                </small>
              </div>
            </div>

            {/* ASSET ACCOUNTS */}

            <div className="ledger-summary-card">
              <div className="summary-icon asset">
                <TrendingUp size={22} />
              </div>

              <div>
                <span>
                  Asset Accounts
                </span>

                <strong>
                  {statistics.assetAccounts}
                </strong>

                <small>
                  Financial assets tracked
                </small>
              </div>
            </div>

            {/* LIABILITY ACCOUNTS */}

            <div className="ledger-summary-card">
              <div className="summary-icon liability">
                <TrendingDown size={22} />
              </div>

              <div>
                <span>
                  Liability Accounts
                </span>

                <strong>
                  {statistics.liabilityAccounts}
                </strong>

                <small>
                  Customer balances tracked
                </small>
              </div>
            </div>

            {/* SUPPORTED CURRENCIES */}

            <div className="ledger-summary-card">
              <div className="summary-icon currencies">
                <Landmark size={22} />
              </div>

              <div>
                <span>
                  Supported Currencies
                </span>

                <strong>
                  {statistics.currencies.length}
                </strong>

                <small>
                  {statistics.currencies.length > 0
                    ? statistics.currencies.join(', ')
                    : 'No currencies yet'}
                </small>
              </div>
            </div>
          </div>

          {/* FINANCIAL POSITION */}

          <section className="ledger-financial-section">
            <div className="ledger-financial-header">
              <div>
                <h2>
                  Financial Position
                </h2>

                <p>
                  Account balances grouped by
                  currency. Different currencies
                  are not combined.
                </p>
              </div>

              <ArrowLeftRight size={22} />
            </div>

            <div className="ledger-info-grid">

              {/* ASSET BALANCES */}

              <div className="ledger-info-card">
                <div className="ledger-info-icon asset">
                  <TrendingUp size={22} />
                </div>

                <div className="ledger-balance-content">
                  <span>
                    Asset Balances
                  </span>

                  {statistics.assetBalances.length >
                  0 ? (
                    <div className="ledger-currency-balances">
                      {statistics.assetBalances.map(
                        (item) => (
                          <div
                            key={
                              item.currency
                            }
                            className="ledger-currency-row"
                          >
                            <span>
                              {item.currency}
                            </span>

                            <strong>
                              {formatAmount(
                                item.amount,
                                item.currency,
                              )}
                            </strong>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <small>
                      No asset balances available
                    </small>
                  )}
                </div>
              </div>

              {/* LIABILITY BALANCES */}

              <div className="ledger-info-card">
                <div className="ledger-info-icon liability">
                  <TrendingDown size={22} />
                </div>

                <div className="ledger-balance-content">
                  <span>
                    Liability Balances
                  </span>

                  {statistics.liabilityBalances
                    .length > 0 ? (
                    <div className="ledger-currency-balances">
                      {statistics.liabilityBalances.map(
                        (item) => (
                          <div
                            key={
                              item.currency
                            }
                            className="ledger-currency-row"
                          >
                            <span>
                              {item.currency}
                            </span>

                            <strong>
                              {formatAmount(
                                item.amount,
                                item.currency,
                              )}
                            </strong>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <small>
                      No liability balances
                      available
                    </small>
                  )}
                </div>
              </div>

            </div>
          </section>

          {/* LEDGER TABLE */}

          <section className="ledger-table-section">
            <div className="ledger-table-header">
              <div>
                <h2>
                  Ledger Accounts
                </h2>

                <p>
                  Real-time account balances
                  generated from double-entry
                  ledger records.
                </p>
              </div>

              <span className="ledger-count">
                {accounts.length}{' '}
                {accounts.length === 1
                  ? 'Account'
                  : 'Accounts'}
              </span>
            </div>

            {accounts.length === 0 ? (
              <div className="ledger-empty">
                <Landmark size={42} />

                <h3>
                  No Ledger Accounts
                </h3>

                <p>
                  Ledger accounts will appear
                  here once financial
                  transactions are processed.
                </p>
              </div>
            ) : (
              <div className="ledger-table-wrapper">
                <table className="ledger-table">

                  <thead>
                    <tr>
                      <th>Account</th>

                      <th>Code</th>

                      <th>Type</th>

                      <th>Currency</th>

                      <th className="number">
                        Total Debit
                      </th>

                      <th className="number">
                        Total Credit
                      </th>

                      <th className="number">
                        Balance
                      </th>

                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {accounts.map(
                      (account) => (
                        <tr key={account.id}>

                          {/* ACCOUNT */}

                          <td>
                            <div className="ledger-account-name">
                              <div className="ledger-account-icon">
                                <Landmark
                                  size={18}
                                />
                              </div>

                              <div>
                                <strong>
                                  {account.name}
                                </strong>

                                <span>
                                  Account ID #
                                  {account.id}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* CODE */}

                          <td>
                            <code>
                              {account.code}
                            </code>
                          </td>

                          {/* TYPE */}

                          <td>
                            <span
                              className={getTypeClass(
                                account.type,
                              )}
                            >
                              {account.type}
                            </span>
                          </td>

                          {/* CURRENCY */}

                          <td>
                            <span className="currency-pill">
                              {account.currency}
                            </span>
                          </td>

                          {/* DEBIT */}

                          <td className="number debit">
                            {formatAmount(
                              account.totalDebit,
                              account.currency,
                            )}
                          </td>

                          {/* CREDIT */}

                          <td className="number credit">
                            {formatAmount(
                              account.totalCredit,
                              account.currency,
                            )}
                          </td>

                          {/* BALANCE */}

                          <td className="number balance">
                            {formatAmount(
                              account.balance,
                              account.currency,
                            )}
                          </td>

                          {/* STATUS */}

                          <td>
                            <span
                              className={`ledger-status ${
                                account.active
                                  ? 'active'
                                  : 'inactive'
                              }`}
                            >
                              <span />

                              {account.active
                                ? 'Active'
                                : 'Inactive'}
                            </span>
                          </td>

                        </tr>
                      ),
                    )}
                  </tbody>

                </table>
              </div>
            )}
          </section>

        </>
      )}
    </div>
  );
}