'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  FileSearch,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

/* ============================================================
   TYPES
   ============================================================ */

interface AuditLog {
  id: number;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | string | null;
  userId?: number | null;
  adminId?: number | null;
  createdAt: string;
}

interface AuditPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AuditLogsResponse {
  data: AuditLog[];
  pagination: AuditPagination;
}

/* ============================================================
   CONSTANTS
   ============================================================ */

const ENTITY_OPTIONS = [
  'ALL',
  'ComplianceCase',
  'RiskAlert',
  'Payment',
  'Transaction',
  'Wallet',
  'Admin',
  'User',
  'AuditLog',
] as const;

/* ============================================================
   HELPERS
   ============================================================ */

function formatDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

function getActionClass(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes('creat') || lower.includes('add'))
    return 'audit-badge audit-badge-green';
  if (
    lower.includes('delet') ||
    lower.includes('remov') ||
    lower.includes('reject')
  )
    return 'audit-badge audit-badge-red';
  if (
    lower.includes('updat') ||
    lower.includes('edit') ||
    lower.includes('assign')
  )
    return 'audit-badge audit-badge-blue';
  if (
    lower.includes('flag') ||
    lower.includes('suspend') ||
    lower.includes('escalat')
  )
    return 'audit-badge audit-badge-amber';
  if (
    lower.includes('approv') ||
    lower.includes('releas') ||
    lower.includes('complet')
  )
    return 'audit-badge audit-badge-teal';
  return 'audit-badge audit-badge-gray';
}

function getActorLabel(log: AuditLog): string {
  if (log.adminId) return `Admin #${log.adminId}`;
  if (log.userId) return `User #${log.userId}`;
  return 'System';
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unable to load audit logs.';
}

/* ============================================================
   PAGE
   ============================================================ */

export default function AuditLogsPage() {
  const [data, setData] = useState<AuditLogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [entity, setEntity] =
    useState<(typeof ENTITY_OPTIONS)[number]>('ALL');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (entity !== 'ALL') params.set('entity', entity);
      if (action.trim())
        params.set('action', action.trim().toUpperCase());
      params.set('page', String(page));
      params.set('limit', String(limit));

      const result = await apiFetch<AuditLogsResponse>(
        `/admin/audit-logs?${params.toString()}`,
      );

      setData(result);
    } catch (err: unknown) {
      console.error('Audit logs error:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, entity, action]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const logs = useMemo(() => data?.data ?? [], [data]);
  const pagination = data?.pagination ?? {
    page: 1,
    limit,
    total: 0,
    totalPages: 0,
  };

  return (
    <main className="compliance-page">
      {/* HEADER */}
      <div className="compliance-page-header">
        <div>
          <div className="compliance-breadcrumb">
            <span>Admin</span>
            <span>/</span>
            <span>Audit Logs</span>
          </div>

          <div className="compliance-title-row">
            <div className="compliance-title-icon">
              <FileSearch size={24} />
            </div>
            <div>
              <h1>Audit Logs</h1>
              <p>
                Immutable record of all admin and system
                actions across Zarova.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="compliance-refresh-button"
          onClick={() => void loadLogs()}
          disabled={loading}
        >
          <RefreshCw
            size={17}
            className={loading ? 'compliance-spin' : ''}
          />
          Refresh
        </button>
      </div>

      {/* CONTENT */}
      <section className="compliance-content-card">
        {/* TOOLBAR */}
        <div className="compliance-toolbar">
          <div className="compliance-search">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search action, entity, ID..."
              type="search"
            />
          </div>

          <div className="compliance-filters">
            <select
              value={entity}
              onChange={(e) => {
                setEntity(e.target.value as typeof entity);
                setPage(1);
              }}
            >
              {ENTITY_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o === 'ALL' ? 'All entities' : o}
                </option>
              ))}
            </select>

            <input
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by action..."
              style={{
                padding: '0 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '13px',
                height: '38px',
                minWidth: '180px',
                color: '#334155',
                background: '#fff',
              }}
            />
          </div>
        </div>

        {/* STATES */}
        {error ? (
          <div className="compliance-state compliance-error-state">
            <XCircle size={30} />
            <h3>Unable to load audit logs</h3>
            <p>{error}</p>
            <button type="button" onClick={() => void loadLogs()}>
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="compliance-state">
            <RefreshCw size={30} className="compliance-spin" />
            <h3>Loading audit logs</h3>
            <p>Retrieving the latest activity records...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="compliance-state">
            <FileSearch size={34} />
            <h3>No audit logs found</h3>
            <p>No records match the current filters.</p>
          </div>
        ) : (
          <>
            <div className="compliance-table-wrapper">
              <table className="compliance-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Entity ID</th>
                    <th>Actor</th>
                    <th>Timestamp</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td
                        style={{
                          color: '#94a3b8',
                          fontSize: '12px',
                        }}
                      >
                        {log.id}
                      </td>

                      <td>
                        <span className={getActionClass(log.action)}>
                          {log.action.replaceAll('_', ' ')}
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            color: '#475569',
                          }}
                        >
                          {log.entity}
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            color: '#64748b',
                          }}
                        >
                          {log.entityId ?? '—'}
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: '12px',
                            color: '#475569',
                          }}
                        >
                          {getActorLabel(log)}
                        </span>
                      </td>

                      <td>
                        <span className="compliance-date">
                          {formatDate(log.createdAt)}
                        </span>
                      </td>

                      <td>
                        <Link
                          href={`/admin/audit-logs/${log.id}`}
                          className="compliance-view-link"
                        >
                          View
                          <ArrowRight size={15} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <div className="compliance-pagination">
              <span>
                Showing {logs.length} of {pagination.total} logs
              </span>

              <div>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() =>
                    setPage((p) => Math.max(1, p - 1))
                  }
                >
                  Previous
                </button>

                <span>
                  Page {page} of{' '}
                  {Math.max(1, pagination.totalPages)}
                </span>

                <button
                  type="button"
                  disabled={
                    page >= Math.max(1, pagination.totalPages)
                  }
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
