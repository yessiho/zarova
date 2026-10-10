'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

type Customer = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  walletCount: number;
  transactionCount: number;
  createdAt?: string;
};

type CustomerResponse = {
  data: Customer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  statistics: {
    total: number;
    active: number;
    suspended: number;
    deactivated: number;
  };
};

function formatDate(value?: string) {
  if (!value) return '—';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-NG', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(date);
}

function statusClass(status: string) {
  return status.toLowerCase();
}

export default function AdminCustomersPage() {
  const [result, setResult] =
    useState<CustomerResponse | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function load(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);

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

      const response = await apiFetch<CustomerResponse>(
        `/admin/customers?${params.toString()}`,
      );

      setResult(response);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load customers.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [page, search, status]);

  return (
    <div className="admin-page admin-customers-page">
      <div className="page-header">
        <div>
          <div className="admin-eyebrow">
            <Users size={15} />
            Customer operations
          </div>
          <h1 className="page-title">Customers</h1>
          <p className="page-description">
            Search, review and manage customer accounts
            across Zarova.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() => void load(true)}
          disabled={refreshing}
        >
          <RefreshCw
            size={16}
            className={
              refreshing
                ? 'admin-refresh-spin'
                : ''
            }
          />
          Refresh
        </button>
      </div>

      {error && (
        <div className="admin-alert admin-alert-error">
          {error}
        </div>
      )}

      <div className="admin-customer-stat-grid">
        <div className="admin-customer-stat-card">
          <span>Total customers</span>
          <strong>{result?.statistics.total ?? '—'}</strong>
        </div>
        <div className="admin-customer-stat-card">
          <span>Active</span>
          <strong>{result?.statistics.active ?? '—'}</strong>
        </div>
        <div className="admin-customer-stat-card">
          <span>Suspended</span>
          <strong>{result?.statistics.suspended ?? '—'}</strong>
        </div>
        <div className="admin-customer-stat-card">
          <span>Deactivated</span>
          <strong>{result?.statistics.deactivated ?? '—'}</strong>
        </div>
      </div>

      <section className="admin-panel">
        <div className="admin-customer-toolbar">
          <div className="admin-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by name, email or customer ID..."
            />
          </div>

          <div className="admin-filter">
            <Filter size={16} />
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="DEACTIVATED">Deactivated</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="admin-loading">
            <div className="admin-loader" />
            <span>Loading customers...</span>
          </div>
        ) : result?.data.length === 0 ? (
          <div className="admin-empty">
            <Users size={28} />
            <h3>No customers found</h3>
            <p>
              Try changing your search or status filter.
            </p>
          </div>
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="data-table admin-customer-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Wallets</th>
                    <th>Transactions</th>
                    <th>Joined</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {result?.data.map((customer) => (
                    <tr key={`customer-${customer.id}`}>
                      <td>
                        <div className="admin-customer-cell">
                          <div className="admin-customer-avatar">
                            {customer.firstName[0]}
                            {customer.lastName[0]}
                          </div>
                          <div>
                            <strong>
                              {customer.firstName}{' '}
                              {customer.lastName}
                            </strong>
                            <span>{customer.email}</span>
                            <small>
                              CUS-
                              {String(customer.id).padStart(5, '0')}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${statusClass(
                            customer.status,
                          )}`}
                        >
                          <span className="status-dot" />
                          {customer.status}
                        </span>
                      </td>
                      <td>{customer.walletCount}</td>
                      <td>{customer.transactionCount}</td>
                      <td>{formatDate(customer.createdAt)}</td>
                      <td>
                        <Link
                          href={`/admin/customers/${customer.id}`}
                          className="admin-table-action"
                        >
                          <Eye size={15} />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {result && result.pagination.totalPages > 1 && (
              <div className="admin-pagination">
                <span>
                  Page {result.pagination.page} of{' '}
                  {result.pagination.totalPages}
                </span>

                <div>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage((current) =>
                        Math.max(1, current - 1),
                      )
                    }
                  >
                    <ChevronLeft size={15} />
                    Previous
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    disabled={
                      page >=
                      result.pagination.totalPages
                    }
                    onClick={() =>
                      setPage((current) =>
                        Math.min(
                          result.pagination.totalPages,
                          current + 1,
                        ),
                      )
                    }
                  >
                    Next
                    <ChevronRight size={15} />
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
