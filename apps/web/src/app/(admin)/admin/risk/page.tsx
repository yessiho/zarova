'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  Flag,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  X,
  XCircle,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

/* ============================================================
   TYPES
   ============================================================ */

type RiskAlertStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'FLAGGED'
  | 'RELEASED'
  | 'FALSE_POSITIVE';

type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

type RiskAlertType =
  | 'UNUSUAL_TRANSACTION'
  | 'VELOCITY_CHECK'
  | 'LARGE_TRANSFER'
  | 'SUSPICIOUS_LOGIN'
  | 'ACCOUNT_TAKEOVER'
  | 'MONEY_LAUNDERING'
  | 'SANCTIONS_MATCH'
  | 'MANUAL_REVIEW';

interface RiskAlert {
  id: number;
  reference: string;
  type: RiskAlertType | string;
  severity: RiskSeverity;
  status: RiskAlertStatus;
  title: string;
  description?: string | null;
  transactionId?: number | null;
  walletId?: number | null;
  userId?: number | null;
  complianceCaseId?: number | null;
  alertCode?: string | null;
  createdByAdminId?: number | null;
  assignedToAdminId?: number | null;
  flaggedByAdminId?: number | null;
  flaggedAt?: string | null;
  releasedByAdminId?: number | null;
  releasedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RiskStatistics {
  total: number;
  open: number;
  underReview: number;
  flagged: number;
  released: number;
  falsePositive: number;
  critical: number;
  high: number;
}

interface RiskPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface RiskAlertsResponse {
  data: RiskAlert[];
  pagination: RiskPagination;
  statistics: RiskStatistics;
}

/* ============================================================
   FILTER OPTIONS
   ============================================================ */

const STATUS_OPTIONS = [
  'ALL',
  'OPEN',
  'UNDER_REVIEW',
  'FLAGGED',
  'RELEASED',
  'FALSE_POSITIVE',
] as const;

const SEVERITY_OPTIONS = [
  'ALL',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;

const TYPE_OPTIONS = [
  'ALL',
  'UNUSUAL_TRANSACTION',
  'VELOCITY_CHECK',
  'LARGE_TRANSFER',
  'SUSPICIOUS_LOGIN',
  'ACCOUNT_TAKEOVER',
  'MONEY_LAUNDERING',
  'SANCTIONS_MATCH',
  'MANUAL_REVIEW',
] as const;

const RISK_ALERT_TYPES = TYPE_OPTIONS.slice(1) as readonly string[];
const RISK_SEVERITIES = SEVERITY_OPTIONS.slice(1) as readonly string[];

/* ============================================================
   HELPERS
   ============================================================ */

function formatLabel(value?: string | null): string {
  if (!value) return '—';
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

function getSeverityClass(severity: RiskSeverity): string {
  return `risk-severity risk-severity-${severity.toLowerCase()}`;
}

function getStatusClass(status: RiskAlertStatus): string {
  return `risk-status risk-status-${status
    .toLowerCase()
    .replaceAll('_', '-')}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unable to load risk alerts.';
}

/* ============================================================
   PAGE
   ============================================================ */

export default function RiskPage() {
  const [data, setData] = useState<RiskAlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] =
    useState<(typeof STATUS_OPTIONS)[number]>('ALL');
  const [severity, setSeverity] =
    useState<(typeof SEVERITY_OPTIONS)[number]>('ALL');
  const [type, setType] =
    useState<(typeof TYPE_OPTIONS)[number]>('ALL');
  const [page, setPage] = useState(1);
  const limit = 20;

  /* ==========================================================
     NEW ALERT MODAL
     ========================================================== */

  const [showModal, setShowModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: RISK_ALERT_TYPES[0] as string,
    severity: 'HIGH' as string,
    title: '',
    description: '',
    alertCode: '',
  });

  function openModal() {
    setForm({
      type: RISK_ALERT_TYPES[0],
      severity: 'HIGH',
      title: '',
      description: '',
      alertCode: '',
    });
    setFormError(null);
    setShowModal(true);
  }

  async function handleCreateAlert(event: React.FormEvent) {
    event.preventDefault();

    const title = form.title.trim();
    const description = form.description.trim();

    if (!title) {
      setFormError('Title is required.');
      return;
    }

    if (!description) {
      setFormError('Description is required.');
      return;
    }

    try {
      setFormLoading(true);
      setFormError(null);

      const body: Record<string, unknown> = {
        type: form.type,
        severity: form.severity,
        title,
        description,
      };

      if (form.alertCode.trim()) {
        body.alertCode = form.alertCode.trim();
      }

      await apiFetch('/admin/risk/alerts', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      setShowModal(false);
      await loadAlerts();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to create alert.',
      );
    } finally {
      setFormLoading(false);
    }
  }

  /* ==========================================================
     LOAD ALERTS
     ========================================================== */

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status !== 'ALL') params.set('status', status);
      if (severity !== 'ALL') params.set('severity', severity);
      if (type !== 'ALL') params.set('type', type);
      params.set('page', String(page));
      params.set('limit', String(limit));

      const result = await apiFetch<RiskAlertsResponse>(
        `/admin/risk/alerts?${params.toString()}`,
      );

      setData(result);
    } catch (err: unknown) {
      console.error('Risk loading error:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, severity, search, status, type]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  /* ==========================================================
     DEFAULTS
     ========================================================== */

  const statistics = data?.statistics ?? {
    total: 0,
    open: 0,
    underReview: 0,
    flagged: 0,
    released: 0,
    falsePositive: 0,
    critical: 0,
    high: 0,
  };

  const alerts = useMemo(() => data?.data ?? [], [data]);

  const pagination = data?.pagination ?? {
    page: 1,
    limit,
    total: 0,
    totalPages: 0,
  };

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <main className="compliance-page">
      {/* HEADER */}
      <div className="compliance-page-header">
        <div>
          <div className="compliance-breadcrumb">
            <span>Admin</span>
            <span>/</span>
            <span>Risk &amp; Fraud</span>
          </div>

          <div className="compliance-title-row">
            <div className="compliance-title-icon">
              <ShieldAlert size={24} />
            </div>

            <div>
              <h1>Risk &amp; Fraud</h1>
              <p>
                Monitor, investigate and action risk alerts
                across Zarova.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="compliance-refresh-button"
            onClick={openModal}
          >
            <Plus size={17} />
            New Alert
          </button>

          <button
            type="button"
            className="compliance-refresh-button"
            onClick={() => void loadAlerts()}
            disabled={loading}
          >
            <RefreshCw
              size={17}
              className={loading ? 'compliance-spin' : ''}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* STATISTICS */}
      <section className="compliance-stat-grid">
        <div className="compliance-stat-card">
          <div className="compliance-stat-icon compliance-stat-icon-blue">
            <Shield size={20} />
          </div>
          <div>
            <span>Total Alerts</span>
            <strong>{statistics.total}</strong>
          </div>
        </div>

        <div className="compliance-stat-card">
          <div className="compliance-stat-icon compliance-stat-icon-amber">
            <Eye size={20} />
          </div>
          <div>
            <span>Open</span>
            <strong>{statistics.open}</strong>
          </div>
        </div>

        <div className="compliance-stat-card">
          <div className="compliance-stat-icon compliance-stat-icon-purple">
            <RefreshCw size={20} />
          </div>
          <div>
            <span>Under Review</span>
            <strong>{statistics.underReview}</strong>
          </div>
        </div>

        <div className="compliance-stat-card">
          <div className="compliance-stat-icon compliance-stat-icon-red">
            <Flag size={20} />
          </div>
          <div>
            <span>Flagged</span>
            <strong>{statistics.flagged}</strong>
          </div>
        </div>

        <div className="compliance-stat-card">
          <div className="compliance-stat-icon compliance-stat-icon-danger">
            <AlertTriangle size={20} />
          </div>
          <div>
            <span>Critical</span>
            <strong>{statistics.critical}</strong>
          </div>
        </div>

        <div className="compliance-stat-card">
          <div className="compliance-stat-icon compliance-stat-icon-green">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span>Released</span>
            <strong>{statistics.released}</strong>
          </div>
        </div>
      </section>

      {/* CONTENT CARD */}
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
              placeholder="Search reference, title, alert code..."
              type="search"
            />
          </div>

          <div className="compliance-filters">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as typeof status);
                setPage(1);
              }}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o === 'ALL' ? 'All statuses' : formatLabel(o)}
                </option>
              ))}
            </select>

            <select
              value={severity}
              onChange={(e) => {
                setSeverity(e.target.value as typeof severity);
                setPage(1);
              }}
            >
              {SEVERITY_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o === 'ALL' ? 'All severities' : formatLabel(o)}
                </option>
              ))}
            </select>

            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as typeof type);
                setPage(1);
              }}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o === 'ALL' ? 'All types' : formatLabel(o)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* STATES */}
        {error ? (
          <div className="compliance-state compliance-error-state">
            <XCircle size={30} />
            <h3>Unable to load risk alerts</h3>
            <p>{error}</p>
            <button type="button" onClick={() => void loadAlerts()}>
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="compliance-state">
            <RefreshCw size={30} className="compliance-spin" />
            <h3>Loading risk alerts</h3>
            <p>Retrieving the latest risk activity...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="compliance-state">
            <ShieldAlert size={34} />
            <h3>No risk alerts found</h3>
            <p>No alerts match the current filters.</p>
          </div>
        ) : (
          <>
            <div className="compliance-table-wrapper">
              <table className="compliance-table">
                <thead>
                  <tr>
                    <th>Alert</th>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Linked</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {alerts.map((alert) => (
                    <tr key={alert.id}>
                      <td>
                        <div className="compliance-case-cell">
                          <strong>{alert.reference}</strong>
                          <span>{alert.title}</span>
                          {alert.alertCode && (
                            <small>Code: {alert.alertCode}</small>
                          )}
                        </div>
                      </td>

                      <td>
                        <span className="compliance-type">
                          {formatLabel(alert.type)}
                        </span>
                      </td>

                      <td>
                        <span className={getSeverityClass(alert.severity)}>
                          {alert.severity}
                        </span>
                      </td>

                      <td>
                        <span className={getStatusClass(alert.status)}>
                          {formatLabel(alert.status)}
                        </span>
                      </td>

                      <td>
                        {alert.complianceCaseId
                          ? `Case #${alert.complianceCaseId}`
                          : '—'}
                      </td>

                      <td>
                        <span className="compliance-date">
                          {formatDate(alert.createdAt)}
                        </span>
                      </td>

                      <td>
                        <Link
                          href={`/admin/risk/${alert.id}`}
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
                Showing {alerts.length} of {pagination.total} alerts
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
                  Page {page} of {Math.max(1, pagination.totalPages)}
                </span>

                <button
                  type="button"
                  disabled={page >= Math.max(1, pagination.totalPages)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* NEW ALERT MODAL */}
      {showModal && (
        <div
          className="compliance-modal-backdrop"
          onClick={() => setShowModal(false)}
        >
          <div
            className="compliance-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="compliance-modal-header">
              <h2>New Risk Alert</h2>
              <button
                type="button"
                className="compliance-modal-close"
                onClick={() => setShowModal(false)}
                disabled={formLoading}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateAlert(e)}>
              {formError && (
                <div className="compliance-modal-error">
                  <AlertTriangle size={15} />
                  {formError}
                </div>
              )}

              <div className="compliance-modal-field">
                <label htmlFor="alert-type">Alert Type</label>
                <select
                  id="alert-type"
                  value={form.type}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, type: e.target.value }))
                  }
                  disabled={formLoading}
                >
                  {RISK_ALERT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="compliance-modal-field">
                <label htmlFor="alert-severity">Severity</label>
                <select
                  id="alert-severity"
                  value={form.severity}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      severity: e.target.value,
                    }))
                  }
                  disabled={formLoading}
                >
                  {RISK_SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="compliance-modal-field">
                <label htmlFor="alert-title">Title</label>
                <input
                  id="alert-title"
                  type="text"
                  maxLength={200}
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Brief summary of the alert"
                  disabled={formLoading}
                />
              </div>

              <div className="compliance-modal-field">
                <label htmlFor="alert-description">Description</label>
                <textarea
                  id="alert-description"
                  rows={4}
                  maxLength={5000}
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Detailed description of the risk concern"
                  disabled={formLoading}
                />
              </div>

              <div className="compliance-modal-field">
                <label htmlFor="alert-code">
                  Alert Code{' '}
                  <span className="compliance-modal-optional">
                    (optional)
                  </span>
                </label>
                <input
                  id="alert-code"
                  type="text"
                  maxLength={100}
                  value={form.alertCode}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      alertCode: e.target.value,
                    }))
                  }
                  placeholder="e.g. RSK-2024-001"
                  disabled={formLoading}
                />
              </div>

              <div className="compliance-modal-actions">
                <button
                  type="button"
                  className="compliance-refresh-button"
                  onClick={() => setShowModal(false)}
                  disabled={formLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="compliance-action-success"
                  disabled={formLoading}
                >
                  {formLoading ? 'Creating...' : 'Create Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
