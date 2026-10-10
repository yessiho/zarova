'use client';

import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  RefreshCw,
  Search,
  ReceiptText,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';

type TransactionStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REVERSED';

type TransactionType =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'TRANSFER';

type Currency = 'NGN' | 'USD' | 'EUR' | 'GBP';

type Customer = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
};

type WalletSummary = {
  id: number;
  currency: string;
  status: string;
};

type AdminTransaction = {
  id: number;
  reference: string;
  type: string;
  amount: string;
  currency: Currency;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
  customer: Customer | null;
  sourceWallet: WalletSummary | null;
  destinationWallet: WalletSummary | null;
};

type TransactionResponse = {
  data: AdminTransaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  statistics: {
    totalTransactions: number;
    pendingTransactions: number;
    completedTransactions: number;
    failedTransactions: number;
    reversedTransactions: number;
  };
};

const PAGE_SIZE = 20;

function formatAmount(
  amount: string,
  currency: Currency,
): string {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Number(amount));
  } catch {
    return `${currency} ${amount}`;
  }
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getInitials(customer: Customer | null): string {
  if (!customer) return '—';

  return `${customer.firstName?.[0] ?? ''}${customer.lastName?.[0] ?? ''}`
    .toUpperCase()
    .slice(0, 2);
}

function getCustomerName(customer: Customer | null): string {
  if (!customer) return 'Unknown customer';

  return `${customer.firstName} ${customer.lastName}`.trim();
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'completed';

    case 'PENDING':
      return 'pending';

    case 'FAILED':
      return 'failed';

    case 'REVERSED':
      return 'reversed';

    default:
      return 'inactive';
  }
}

function getTypeClass(type: string): string {
  switch (type) {
    case 'DEPOSIT':
      return 'deposit';

    case 'WITHDRAWAL':
      return 'withdrawal';

    case 'TRANSFER':
      return 'transfer';

    default:
      return '';
  }
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<
    AdminTransaction[]
  >([]);

  const [statistics, setStatistics] =
    useState<TransactionResponse['statistics']>({
      totalTransactions: 0,
      pendingTransactions: 0,
      completedTransactions: 0,
      failedTransactions: 0,
      reversedTransactions: 0,
    });

  const [page, setPage] = useState(1);

  const [pagination, setPagination] =
    useState<TransactionResponse['pagination']>({
      page: 1,
      limit: PAGE_SIZE,
      total: 0,
      totalPages: 0,
    });

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [currency, setCurrency] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function loadTransactions(
    targetPage = page,
    options?: {
      refresh?: boolean;
    },
  ) {
    try {
      setError('');

      if (options?.refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const params = new URLSearchParams();

      params.set('page', String(targetPage));
      params.set('limit', String(PAGE_SIZE));

      if (search.trim()) {
        params.set('search', search.trim());
      }

      if (status) {
        params.set('status', status);
      }

      if (type) {
        params.set('type', type);
      }

      if (currency) {
        params.set('currency', currency);
      }

      const response =
        await apiFetch<TransactionResponse>(
          `/admin/transactions?${params.toString()}`,
        );

      setTransactions(response.data);
      setPagination(response.pagination);
      setStatistics(response.statistics);
      setPage(response.pagination.page);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load transactions.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadTransactions(1);
    // Filters intentionally trigger a fresh first page.
    // Search only changes when the user submits the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, type, currency]);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    void loadTransactions(1);
  }

  function handleClearFilters() {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setType('');
    setCurrency('');
  }

  function handlePreviousPage() {
    if (page <= 1) return;

    void loadTransactions(page - 1);
  }

  function handleNextPage() {
    if (page >= pagination.totalPages) return;

    void loadTransactions(page + 1);
  }

  return (
    <div className="admin-page">
      <div className="admin-detail-topbar">
        <div>
          <div className="admin-page-eyebrow">
            Transaction Operations
          </div>

          <h1 className="page-title">
            Transactions
          </h1>

          <p className="page-description">
            Monitor and investigate customer financial
            transactions across Zarova.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            void loadTransactions(page, {
              refresh: true,
            })
          }
          disabled={loading || refreshing}
        >
          <RefreshCw
            size={16}
            className={
              refreshing
                ? 'admin-refresh-spin'
                : undefined
            }
          />

          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="admin-stat-grid admin-transaction-stat-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-card-header">
            <span>Total Transactions</span>
            <ReceiptText size={18} />
          </div>

          <strong>
            {statistics.totalTransactions.toLocaleString()}
          </strong>

          <small>Matching current filters</small>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-card-header">
            <span>Completed</span>
          </div>

          <strong>
            {statistics.completedTransactions.toLocaleString()}
          </strong>

          <small>Successfully processed</small>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-card-header">
            <span>Pending</span>
          </div>

          <strong>
            {statistics.pendingTransactions.toLocaleString()}
          </strong>

          <small>Awaiting completion</small>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-card-header">
            <span>Failed / Reversed</span>
          </div>

          <strong>
            {(
              statistics.failedTransactions +
              statistics.reversedTransactions
            ).toLocaleString()}
          </strong>

          <small>
            Failed {statistics.failedTransactions} · Reversed{' '}
            {statistics.reversedTransactions}
          </small>
        </div>
      </div>

      <div className="admin-filter-bar">
        <form
          className="admin-search-box"
          onSubmit={handleSearch}
        >
          <Search size={18} />

          <input
            type="search"
            placeholder="Search reference, customer, email..."
            value={searchInput}
            onChange={(event) =>
              setSearchInput(event.target.value)
            }
          />

          <button type="submit">
            Search
          </button>
        </form>

        <div className="admin-filter-group">
          <Filter size={16} />

          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value)
            }
            aria-label="Transaction status"
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="REVERSED">Reversed</option>
          </select>

          <select
            value={type}
            onChange={(event) =>
              setType(event.target.value)
            }
            aria-label="Transaction type"
          >
            <option value="">All types</option>
            <option value="DEPOSIT">Deposit</option>
            <option value="WITHDRAWAL">Withdrawal</option>
            <option value="TRANSFER">Transfer</option>
          </select>

          <select
            value={currency}
            onChange={(event) =>
              setCurrency(event.target.value)
            }
            aria-label="Currency"
          >
            <option value="">All currencies</option>
            <option value="NGN">NGN</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>

          {(search || status || type || currency) && (
            <button
              type="button"
              className="text-button"
              onClick={handleClearFilters}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="admin-alert admin-alert-error">
          <strong>Unable to load transactions</strong>
          <span>{error}</span>
        </div>
      )}

      <section className="admin-panel admin-transaction-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Transaction activity</h2>
            <p>
              {pagination.total.toLocaleString()} transaction
              {pagination.total === 1 ? '' : 's'} found
            </p>
          </div>
        </div>

        {loading ? (
          <div className="admin-loading">
            <div className="admin-loading-spinner" />
            <p>Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="admin-empty">
            <ReceiptText size={38} />

            <h3>No transactions found</h3>

            <p>
              There are no transactions matching the current
              search and filters.
            </p>

            {(search || status || type || currency) && (
              <button
                type="button"
                className="secondary-button"
                onClick={handleClearFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="data-table admin-transactions-table">
                <thead>
                  <tr>
                    <th>Transaction</th>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>
                        <div className="admin-table-primary">
                          {transaction.reference}
                        </div>

                        <div className="admin-table-secondary">
                          ID #{transaction.id}
                        </div>
                      </td>

                      <td>
                        <div className="admin-customer-cell">
                          <span className="admin-customer-avatar">
                            {getInitials(
                              transaction.customer,
                            )}
                          </span>

                          <span>
                            <strong>
                              {getCustomerName(
                                transaction.customer,
                              )}
                            </strong>

                            <small>
                              {transaction.customer?.email ??
                                'No customer record'}
                            </small>
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`admin-transaction-type ${getTypeClass(
                            transaction.type,
                          )}`}
                        >
                          {transaction.type}
                        </span>
                      </td>

                      <td>
                        <div className="admin-amount-cell">
                          {formatAmount(
                            transaction.amount,
                            transaction.currency,
                          )}
                        </div>
                      </td>

                      <td>
                        <span
                          className={`status-badge ${getStatusClass(
                            transaction.status,
                          )}`}
                        >
                          {transaction.status}
                        </span>
                      </td>

                      <td>
                        <div className="admin-date-cell">
                          {formatDate(
                            transaction.createdAt,
                          )}
                        </div>
                      </td>

                      <td>
                        <Link
                          href={`/admin/transactions/${transaction.id}`}
                          className="admin-icon-button"
                          aria-label={`View transaction ${transaction.reference}`}
                          title="View transaction"
                        >
                          <Eye size={17} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="admin-pagination">
                <span>
                  Page {pagination.page} of{' '}
                  {pagination.totalPages}
                </span>

                <div>
                  <button
                    type="button"
                    className="admin-pagination-button"
                    onClick={handlePreviousPage}
                    disabled={page <= 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={17} />
                  </button>

                  <button
                    type="button"
                    className="admin-pagination-button"
                    onClick={handleNextPage}
                    disabled={
                      page >= pagination.totalPages
                    }
                    aria-label="Next page"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}