'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useRouter } from 'next/navigation';

import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCcw,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  ReceiptText,
  TrendingUp,
  CircleCheck,
  Eye,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

interface Transaction {
  id: number;
  reference: string;
  amount: string;
  currency: string;
  type: string;
  status: string;
  sourceWalletId: number | null;
  destinationWalletId: number | null;
  createdAt: string;
}

interface TransactionsMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface TransactionsResponse {
  data: Transaction[];
  meta?: TransactionsMeta;
}

interface TransactionFilters {
  search: string;
  type: string;
  status: string;
}

interface ApiError {
  message?: string;
}

const DEFAULT_META: TransactionsMeta = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
};

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
    return (error as ApiError).message as string;
  }

  return fallback;
}

function isTransaction(value: unknown): value is Transaction {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    'id' in value &&
    'reference' in value &&
    'amount' in value &&
    'currency' in value &&
    'type' in value &&
    'status' in value &&
    'createdAt' in value
  );
}

function isTransactionsMeta(
  value: unknown,
): value is TransactionsMeta {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    'page' in value &&
    'limit' in value &&
    'total' in value &&
    'totalPages' in value
  );
}

function isTransactionsResponse(
  value: unknown,
): value is TransactionsResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return 'data' in value && Array.isArray(value.data);
}

export default function TransactionsPage() {
  const router = useRouter();

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [search, setSearch] = useState('');

  const [type, setType] = useState('');

  const [status, setStatus] = useState('');

  const [page, setPage] = useState(1);

  const [meta, setMeta] =
    useState<TransactionsMeta>(DEFAULT_META);

  /*
   * ==========================================
   * LOAD TRANSACTIONS
   * ==========================================
   */

  const loadTransactions = useCallback(
    async (
      selectedPage = 1,
      filters: TransactionFilters = {
        search: '',
        type: '',
        status: '',
      },
    ) => {
      try {
        setLoading(true);

        setError('');

        const params = new URLSearchParams();

        params.set('page', String(selectedPage));

        params.set('limit', '10');

        if (filters.search.trim()) {
          params.set(
            'search',
            filters.search.trim(),
          );
        }

        if (filters.type) {
          params.set('type', filters.type);
        }

        if (filters.status) {
          params.set('status', filters.status);
        }

        const response: unknown = await apiFetch(
          `/transactions?${params.toString()}`,
        );

        /*
         * Support direct array response.
         */

        if (Array.isArray(response)) {
          const validTransactions =
            response.filter(isTransaction);

          setTransactions(validTransactions);

          setMeta({
            page: 1,
            limit: validTransactions.length,
            total: validTransactions.length,
            totalPages: 1,
          });

          return;
        }

        /*
         * Support paginated API response.
         */

        if (isTransactionsResponse(response)) {
          const validTransactions =
            response.data.filter(isTransaction);

          setTransactions(validTransactions);

          if (
            response.meta &&
            isTransactionsMeta(response.meta)
          ) {
            setMeta(response.meta);
          } else {
            setMeta({
              page: selectedPage,
              limit:
                validTransactions.length || 10,
              total: validTransactions.length,
              totalPages: 1,
            });
          }

          return;
        }

        /*
         * Unexpected API response.
         */

        setTransactions([]);

        setMeta(DEFAULT_META);

        throw new Error(
          'Unexpected response received from the transactions API.',
        );
      } catch (caughtError: unknown) {
        console.error(caughtError);

        const message = getErrorMessage(
          caughtError,
          'Unable to load transactions.',
        );

        if (message === 'Unauthorized') {
          localStorage.removeItem(
            'access_token',
          );

          localStorage.removeItem('user');

          router.push('/login');

          return;
        }

        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  /*
   * ==========================================
   * INITIAL LOAD
   *
   * Schedule the API request asynchronously.
   * This avoids react-hooks/set-state-in-effect
   * while preserving the initial data load.
   * ==========================================
   */

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTransactions(1, {
        search: '',
        type: '',
        status: '',
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadTransactions]);

  /*
   * ==========================================
   * CURRENT FILTERS
   * ==========================================
   */

  const currentFilters =
    useMemo<TransactionFilters>(
      () => ({
        search,
        type,
        status,
      }),
      [search, type, status],
    );

  /*
   * ==========================================
   * SEARCH
   * ==========================================
   */

  function handleSearch(
    event: { preventDefault(): void },
  ) {
    event.preventDefault();

    setPage(1);

    void loadTransactions(1, {
      search,
      type,
      status,
    });
  }

  /*
   * ==========================================
   * TYPE FILTER
   * ==========================================
   */

  function handleTypeChange(value: string) {
    setType(value);

    setPage(1);

    void loadTransactions(1, {
      search,
      type: value,
      status,
    });
  }

  /*
   * ==========================================
   * STATUS FILTER
   * ==========================================
   */

  function handleStatusChange(value: string) {
    setStatus(value);

    setPage(1);

    void loadTransactions(1, {
      search,
      type,
      status: value,
    });
  }

  /*
   * ==========================================
   * PAGINATION
   * ==========================================
   */

  function changePage(newPage: number) {
    if (
      newPage < 1 ||
      newPage > meta.totalPages ||
      newPage === page
    ) {
      return;
    }

    setPage(newPage);

    void loadTransactions(
      newPage,
      currentFilters,
    );
  }

  /*
   * ==========================================
   * REFRESH
   * ==========================================
   */

  function handleRefresh() {
    void loadTransactions(
      page,
      currentFilters,
    );
  }

  /*
   * ==========================================
   * FORMAT AMOUNT
   * ==========================================
   */

  function formatAmount(
    amount: string,
    currency: string,
  ): string {
    try {
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(amount));
    } catch {
      return `${currency} ${Number(
        amount,
      ).toLocaleString()}`;
    }
  }

  /*
   * ==========================================
   * FORMAT DATE
   * ==========================================
   */

  function formatDate(date: string): string {
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return 'Invalid date';
    }

    return parsedDate.toLocaleString('en-NG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  /*
   * ==========================================
   * TRANSACTION ICON
   * ==========================================
   */

  function getTransactionIcon(
    transactionType: string,
  ) {
    switch (transactionType) {
      case 'DEPOSIT':
        return <ArrowDownLeft size={18} />;

      case 'WITHDRAWAL':
        return <ArrowUpRight size={18} />;

      case 'TRANSFER':
        return <ArrowLeftRight size={18} />;

      default:
        return <RefreshCcw size={18} />;
    }
  }

  /*
   * ==========================================
   * TRANSACTION ICON CLASS
   * ==========================================
   */

  function getTransactionIconClass(
    transactionType: string,
  ): string {
    switch (transactionType) {
      case 'DEPOSIT':
        return 'transaction-type-icon deposit';

      case 'WITHDRAWAL':
        return 'transaction-type-icon withdrawal';

      case 'TRANSFER':
        return 'transaction-type-icon transfer';

      default:
        return 'transaction-type-icon';
    }
  }

  /*
   * ==========================================
   * STATUS CLASS
   * ==========================================
   */

  function getStatusClass(
    transactionStatus: string,
  ): string {
    return transactionStatus
      .toLowerCase()
      .replace(/\s/g, '-');
  }

  /*
   * ==========================================
   * CURRENT PAGE STATISTICS
   * ==========================================
   */

  const transactionStats = useMemo(() => {
    const completedTransactions =
      transactions.filter(
        (transaction) =>
          transaction.status === 'COMPLETED',
      ).length;

    const depositTransactions =
      transactions.filter(
        (transaction) =>
          transaction.type === 'DEPOSIT',
      ).length;

    const transferTransactions =
      transactions.filter(
        (transaction) =>
          transaction.type === 'TRANSFER',
      ).length;

    return {
      completedTransactions,
      depositTransactions,
      transferTransactions,
    };
  }, [transactions]);

  return (
    <div className="transactions-page">
      {/* ======================================
          PAGE HEADER
      ====================================== */}

      <section className="transactions-hero">
        <div className="transactions-header-content">
          <div className="transactions-page-icon">
            <ReceiptText size={24} />
          </div>

          <div>
            <div className="page-eyebrow">
              Financial Activity
            </div>

            <h1>Transactions</h1>

            <p>
              Monitor, search and manage all financial
              transactions from one secure location.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="refresh-button"
          onClick={handleRefresh}
          disabled={loading}
        >
          <RefreshCcw
            size={18}
            className={
              loading ? 'refresh-spin' : ''
            }
          />

          {loading
            ? 'Refreshing...'
            : 'Refresh'}
        </button>
      </section>

      {/* ======================================
          ERROR
      ====================================== */}

      {error && (
        <div className="dashboard-error">
          {error}
        </div>
      )}

      {/* ======================================
          SUMMARY CARDS
      ====================================== */}

      <section className="transaction-summary-grid">
        <div className="transaction-summary-card">
          <div className="summary-icon summary-blue">
            <ReceiptText size={20} />
          </div>

          <div>
            <span>Total Transactions</span>

            <strong>{meta.total}</strong>

            <small>
              All recorded activity
            </small>
          </div>
        </div>

        <div className="transaction-summary-card">
          <div className="summary-icon summary-green">
            <CircleCheck size={20} />
          </div>

          <div>
            <span>Completed</span>

            <strong>
              {transactionStats.completedTransactions}
            </strong>

            <small>
              Successful transactions
            </small>
          </div>
        </div>

        <div className="transaction-summary-card">
          <div className="summary-icon summary-purple">
            <ArrowDownLeft size={20} />
          </div>

          <div>
            <span>Deposits</span>

            <strong>
              {transactionStats.depositTransactions}
            </strong>

            <small>
              Incoming transactions
            </small>
          </div>
        </div>

        <div className="transaction-summary-card">
          <div className="summary-icon summary-orange">
            <TrendingUp size={20} />
          </div>

          <div>
            <span>Transfers</span>

            <strong>
              {transactionStats.transferTransactions}
            </strong>

            <small>
              Wallet movement activity
            </small>
          </div>
        </div>
      </section>

      {/* ======================================
          FILTER PANEL
      ====================================== */}

      <section className="transaction-filter-card">
        <div className="filter-card-header">
          <div>
            <h2>Transaction Records</h2>

            <p>
              Search and filter financial activity.
            </p>
          </div>

          <div className="transaction-count">
            {meta.total} Records
          </div>
        </div>

        <div className="transaction-filters">
          {/* SEARCH */}

          <form
            className="transaction-search"
            onSubmit={handleSearch}
          >
            <Search size={19} />

            <input
              type="text"
              placeholder="Search by transaction reference..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />

            <button type="submit">
              Search
            </button>
          </form>

          {/* FILTER CONTROLS */}

          <div className="filter-controls">
            <div className="filter-select">
              <Filter size={17} />

              <select
                value={type}
                onChange={(event) =>
                  handleTypeChange(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  All Types
                </option>

                <option value="DEPOSIT">
                  Deposit
                </option>

                <option value="WITHDRAWAL">
                  Withdrawal
                </option>

                <option value="TRANSFER">
                  Transfer
                </option>
              </select>
            </div>

            <div className="filter-select">
              <CircleCheck size={17} />

              <select
                value={status}
                onChange={(event) =>
                  handleStatusChange(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  All Statuses
                </option>

                <option value="COMPLETED">
                  Completed
                </option>

                <option value="REVERSED">
                  Reversed
                </option>

                <option value="FAILED">
                  Failed
                </option>

                <option value="PENDING">
                  Pending
                </option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================
          TRANSACTIONS TABLE
      ====================================== */}

      <section className="transactions-table-card">
        {loading ? (
          <div className="transactions-loading">
            <div className="transactions-loader" />

            <h3>Loading transactions</h3>

            <p>
              Retrieving your financial activity...
            </p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="empty-state transaction-empty">
            <div className="empty-state-icon">
              <ReceiptText size={34} />
            </div>

            <h3>No transactions found</h3>

            <p>
              Try adjusting your filters or search
              criteria.
            </p>
          </div>
        ) : (
          <div className="transactions-table-wrapper">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Transaction</th>

                  <th>Reference</th>

                  <th>Date & Time</th>

                  <th>Amount</th>

                  <th>Status</th>

                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {transactions.map(
                  (transaction) => (
                    <tr key={transaction.id}>
                      {/* TRANSACTION TYPE */}

                      <td>
                        <div className="transaction-table-type">
                          <div
                            className={getTransactionIconClass(
                              transaction.type,
                            )}
                          >
                            {getTransactionIcon(
                              transaction.type,
                            )}
                          </div>

                          <div className="transaction-type-details">
                            <strong>
                              {transaction.type}
                            </strong>

                            <span>
                              Transaction #
                              {transaction.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* REFERENCE */}

                      <td>
                        <span className="transaction-reference">
                          {transaction.reference}
                        </span>
                      </td>

                      {/* DATE */}

                      <td>
                        <span className="transaction-date">
                          {formatDate(
                            transaction.createdAt,
                          )}
                        </span>
                      </td>

                      {/* AMOUNT */}

                      <td>
                        <strong className="transaction-amount-value">
                          {formatAmount(
                            transaction.amount,
                            transaction.currency,
                          )}
                        </strong>
                      </td>

                      {/* STATUS */}

                      <td>
                        <span
                          className={`transaction-status ${getStatusClass(
                            transaction.status,
                          )}`}
                        >
                          {transaction.status}
                        </span>
                      </td>

                      {/* ACTION */}

                      <td>
                        <button
                          type="button"
                          className="view-transaction-button"
                          onClick={() =>
                            router.push(
                              `/transactions/${transaction.id}`,
                            )
                          }
                        >
                          <Eye size={16} />

                          View
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ======================================
          PAGINATION
      ====================================== */}

      {!loading &&
        transactions.length > 0 &&
        meta.totalPages > 1 && (
          <div className="pagination">
            <button
              type="button"
              onClick={() =>
                changePage(page - 1)
              }
              disabled={page === 1}
              aria-label="Previous page"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="pagination-info">
              <span>Page</span>

              <strong>{page}</strong>

              <span>
                of {meta.totalPages}
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                changePage(page + 1)
              }
              disabled={
                page === meta.totalPages
              }
              aria-label="Next page"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
    </div>
  );
}