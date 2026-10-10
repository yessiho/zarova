
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

type PaymentStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

type Payment = {
  id: number;
  reference: string;
  sourceWalletId: number;
  destinationWalletId: number;
  amount: string;
  currency: string;
  description: string | null;
  status: PaymentStatus;
  createdAt: string;
  sourceWallet?: {
    id: number;
    currency: string;
    status?: string;
  } | null;
  destinationWallet?: {
    id: number;
    currency: string;
    status?: string;
  } | null;
  createdBy?: {
    id: number;
    email: string;
  } | null;
};

type PaymentsResponse = {
  data?: Payment[];
  payments?: Payment[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  statistics?: {
    totalPayments?: number;
    pendingPayments?: number;
    approvedPayments?: number;
    rejectedPayments?: number;
    processingPayments?: number;
    completedPayments?: number;
    failedPayments?: number;
  };
};

const statuses: PaymentStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
];

function formatAmount(amount: string, currency: string) {
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return `${currency} ${amount}`;
  }

  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(date: string) {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function statusClass(status: PaymentStatus) {
  return `status-badge status-${status.toLowerCase()}`;
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [statistics, setStatistics] =
    useState<NonNullable<PaymentsResponse['statistics']>>({});
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [currency, setCurrency] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });

      if (search.trim()) {
        params.set('search', search.trim());
      }

      if (status) {
        params.set('status', status);
      }

      if (currency) {
        params.set('currency', currency);
      }

      const response = await apiFetch(
        `/admin/payments?${params.toString()}`,
      );

      const result = response as PaymentsResponse;

      // Backend currently returns { data, pagination, statistics }.
      // Keep payments as a fallback for compatibility.
      const paymentRecords =
        result.data ?? result.payments ?? [];

      setPayments(paymentRecords);
      setStatistics(result.statistics ?? {});
      setTotalRecords(
        result.pagination?.total ??
          result.statistics?.totalPayments ??
          paymentRecords.length,
      );
      setTotalPages(
        Math.max(1, result.pagination?.totalPages ?? 1),
      );
    } catch (err) {
      setPayments([]);
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load payment requests.',
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, status, currency]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">FINANCIAL OPERATIONS</p>
          <h1>Payments</h1>
          <p className="page-description">
            Review and manage payment requests across Zarova.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Requests</span>
          <strong className="stat-value">
            {statistics.totalPayments ?? totalRecords}
          </strong>
        </div>

        <div className="stat-card">
          <span className="stat-label">Pending</span>
          <strong className="stat-value">
            {statistics.pendingPayments ?? 0}
          </strong>
        </div>

        <div className="stat-card">
          <span className="stat-label">Approved</span>
          <strong className="stat-value">
            {statistics.approvedPayments ?? 0}
          </strong>
        </div>

        <div className="stat-card">
          <span className="stat-label">Completed</span>
          <strong className="stat-value">
            {statistics.completedPayments ?? 0}
          </strong>
        </div>
      </div>

      <section className="content-card">
        <div className="section-header">
          <div>
            <h2>Payment Requests</h2>
            <p>Search, filter, and inspect payment activity.</p>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void loadPayments()}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="table-toolbar">
          <input
            className="form-input"
            type="search"
            placeholder="Search reference or description..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />

          <select
            className="form-input"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            className="form-input"
            value={currency}
            onChange={(event) => {
              setCurrency(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All currencies</option>
            <option value="NGN">NGN</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Payment</th>
                <th>Amount</th>
                <th>Currency</th>
                <th>Status</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="table-empty">
                    Loading payment requests...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="table-empty">
                    Unable to display payment requests.
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-empty">
                    No payment requests found.
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <strong>{payment.reference}</strong>
                      <span className="table-subtext">
                        ID: {payment.id}
                      </span>
                    </td>

                    <td>
                      <span className="table-primary">
                        Wallet #{payment.sourceWalletId}
                      </span>
                      <span className="table-subtext">
                        To wallet #{payment.destinationWalletId}
                      </span>
                    </td>

                    <td className="amount-cell">
                      {formatAmount(
                        payment.amount,
                        payment.currency,
                      )}
                    </td>

                    <td>{payment.currency}</td>

                    <td>
                      <span className={statusClass(payment.status)}>
                        {payment.status}
                      </span>
                    </td>

                    <td>{formatDate(payment.createdAt)}</td>

                    <td>
                      <Link
                        href={`/admin/payments/${payment.id}`}
                        className="table-action"
                      >
                        View details →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <span>
            Page {page} of {totalPages}
          </span>

          <div className="pagination-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}