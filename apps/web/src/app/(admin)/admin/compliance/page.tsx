'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

/* ============================================================
   TYPES
   ============================================================ */

type ComplianceCaseStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'DISMISSED';

type CompliancePriority =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

type ComplianceCaseType =
  | 'TRANSACTION_MONITORING'
  | 'SUSPICIOUS_TRANSACTION'
  | 'FRAUD_REVIEW'
  | 'KYC_REVIEW'
  | 'AML_REVIEW'
  | 'ACCOUNT_REVIEW'
  | 'MANUAL_REVIEW';

interface ComplianceCase {
  id: number;
  reference: string;
  type: ComplianceCaseType | string;
  priority: CompliancePriority;
  status: ComplianceCaseStatus;
  title: string;
  description?: string | null;

  transactionId?: number | null;
  walletId?: number | null;
  alertCode?: string | null;

  createdByAdminId?: number | null;
  assignedToAdminId?: number | null;

  resolutionNotes?: string | null;

  escalationReason?: string | null;
  escalatedByAdminId?: number | null;
  escalatedAt?: string | null;

  createdAt: string;
  updatedAt: string;
}

interface ComplianceStatistics {
  total: number;
  open: number;
  underReview: number;
  escalated: number;
  resolved: number;
  dismissed: number;
  critical: number;
  high: number;
}

interface CompliancePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ComplianceCasesResponse {
  data: ComplianceCase[];
  pagination: CompliancePagination;
  statistics: ComplianceStatistics;
}

/* ============================================================
   FILTERS
   ============================================================ */

const STATUS_OPTIONS = [
  'ALL',
  'OPEN',
  'UNDER_REVIEW',
  'ESCALATED',
  'RESOLVED',
  'DISMISSED',
] as const;

const PRIORITY_OPTIONS = [
  'ALL',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;

const TYPE_OPTIONS = [
  'ALL',
  'TRANSACTION_MONITORING',
  'SUSPICIOUS_TRANSACTION',
  'FRAUD_REVIEW',
  'KYC_REVIEW',
  'AML_REVIEW',
  'ACCOUNT_REVIEW',
  'MANUAL_REVIEW',
] as const;

const COMPLIANCE_CASE_TYPES = TYPE_OPTIONS.slice(1) as readonly string[];
const COMPLIANCE_PRIORITIES = PRIORITY_OPTIONS.slice(1) as readonly string[];

/* ============================================================
   HELPERS
   ============================================================ */

function formatLabel(value?: string | null): string {
  if (!value) {
    return '—';
  }

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

function formatDate(value?: string | null): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getStatusClass(
  status: ComplianceCaseStatus,
): string {
  return `compliance-status compliance-status-${status
    .toLowerCase()
    .replaceAll('_', '-')}`;
}

function getPriorityClass(
  priority: CompliancePriority,
): string {
  return `compliance-priority compliance-priority-${priority.toLowerCase()}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unable to load compliance cases.';
}

/* ============================================================
   PAGE
   ============================================================ */

export default function CompliancePage() {
  const [data, setData] =
    useState<ComplianceCasesResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState('');

  const [status, setStatus] =
    useState<(typeof STATUS_OPTIONS)[number]>('ALL');

  const [priority, setPriority] =
    useState<(typeof PRIORITY_OPTIONS)[number]>('ALL');

  const [type, setType] =
    useState<(typeof TYPE_OPTIONS)[number]>('ALL');

  const [page, setPage] =
    useState(1);

  const limit = 20;

  /* ==========================================================
     NEW CASE MODAL
     ========================================================== */

  const [showModal, setShowModal] =
    useState(false);

  const [formLoading, setFormLoading] =
    useState(false);

  const [formError, setFormError] =
    useState<string | null>(null);

  const [form, setForm] = useState({
    type: COMPLIANCE_CASE_TYPES[0] as string,
    priority: 'MEDIUM' as string,
    title: '',
    description: '',
    alertCode: '',
  });

  function openModal() {
    setForm({
      type: COMPLIANCE_CASE_TYPES[0],
      priority: 'MEDIUM',
      title: '',
      description: '',
      alertCode: '',
    });
    setFormError(null);
    setShowModal(true);
  }

  async function handleCreateCase(
    event: React.FormEvent,
  ) {
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
        priority: form.priority,
        title,
        description,
      };

      if (form.alertCode.trim()) {
        body.alertCode = form.alertCode.trim();
      }

      await apiFetch('/admin/compliance/cases', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      setShowModal(false);
      await loadCases();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to create case.',
      );
    } finally {
      setFormLoading(false);
    }
  }

  /* ==========================================================
     LOAD CASES
     ========================================================== */

  const loadCases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();

      if (search.trim()) {
        params.set(
          'search',
          search.trim(),
        );
      }

      if (status !== 'ALL') {
        params.set(
          'status',
          status,
        );
      }

      if (priority !== 'ALL') {
        params.set(
          'priority',
          priority,
        );
      }

      if (type !== 'ALL') {
        params.set(
          'type',
          type,
        );
      }

      params.set(
        'page',
        String(page),
      );

      params.set(
        'limit',
        String(limit),
      );

      const query =
        params.toString();

      /*
       * IMPORTANT:
       *
       * apiFetch() already:
       *
       * 1. Sends the request.
       * 2. Parses JSON.
       * 3. Handles HTTP errors.
       * 4. Throws an Error when the API fails.
       *
       * Therefore we DO NOT use:
       *
       * response.ok
       * response.status
       * response.json()
       */

      const result =
        await apiFetch<ComplianceCasesResponse>(
          `/admin/compliance/cases?${query}`,
        );

      setData(result);
    } catch (error: unknown) {
      console.error(
        'Compliance loading error:',
        error,
      );

      setError(
        getErrorMessage(error),
      );
    } finally {
      setLoading(false);
    }
  }, [
    page,
    priority,
    search,
    status,
    type,
  ]);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  /* ==========================================================
     DEFAULT VALUES
     ========================================================== */

  const statistics =
    data?.statistics ?? {
      total: 0,
      open: 0,
      underReview: 0,
      escalated: 0,
      resolved: 0,
      dismissed: 0,
      critical: 0,
      high: 0,
    };

  const cases =
    useMemo(
      () => data?.data ?? [],
      [data],
    );

  const pagination =
    data?.pagination ?? {
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
      {/* ======================================================
          HEADER
          ====================================================== */}

      <div className="compliance-page-header">
        <div>
          <div className="compliance-breadcrumb">
            <span>Admin</span>
            <span>/</span>
            <span>Compliance</span>
          </div>

          <div className="compliance-title-row">
            <div className="compliance-title-icon">
              <ShieldCheck size={24} />
            </div>

            <div>
              <h1>Compliance</h1>

              <p>
                Monitor, investigate and manage
                compliance cases across Zarova.
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
            New Case
          </button>

          <button
            type="button"
            className="compliance-refresh-button"
            onClick={() => void loadCases()}
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

      {/* ======================================================
          STATISTICS
          ====================================================== */}

      <section className="compliance-stat-grid">
        <div className="compliance-stat-card">
          <div className="compliance-stat-icon compliance-stat-icon-blue">
            <ClipboardCheck size={20} />
          </div>

          <div>
            <span>Total Cases</span>
            <strong>
              {statistics.total}
            </strong>
          </div>
        </div>

        <div className="compliance-stat-card">
          <div className="compliance-stat-icon compliance-stat-icon-amber">
            <Clock3 size={20} />
          </div>

          <div>
            <span>Open</span>
            <strong>
              {statistics.open}
            </strong>
          </div>
        </div>

        <div className="compliance-stat-card">
          <div className="compliance-stat-icon compliance-stat-icon-purple">
            <ShieldCheck size={20} />
          </div>

          <div>
            <span>Under Review</span>
            <strong>
              {statistics.underReview}
            </strong>
          </div>
        </div>

        <div className="compliance-stat-card">
          <div className="compliance-stat-icon compliance-stat-icon-red">
            <AlertTriangle size={20} />
          </div>

          <div>
            <span>Escalated</span>
            <strong>
              {statistics.escalated}
            </strong>
          </div>
        </div>

        <div className="compliance-stat-card">
          <div className="compliance-stat-icon compliance-stat-icon-danger">
            <AlertTriangle size={20} />
          </div>

          <div>
            <span>Critical</span>
            <strong>
              {statistics.critical}
            </strong>
          </div>
        </div>

        <div className="compliance-stat-card">
          <div className="compliance-stat-icon compliance-stat-icon-green">
            <CheckCircle2 size={20} />
          </div>

          <div>
            <span>Resolved</span>
            <strong>
              {statistics.resolved}
            </strong>
          </div>
        </div>
      </section>

      {/* ======================================================
          CASES
          ====================================================== */}

      <section className="compliance-content-card">
        {/* ====================================================
            TOOLBAR
            ==================================================== */}

        <div className="compliance-toolbar">
          <div className="compliance-search">
            <Search size={18} />

            <input
              value={search}
              onChange={(event) => {
                setSearch(
                  event.target.value,
                );

                setPage(1);
              }}
              placeholder="Search reference, title, alert..."
              type="search"
            />
          </div>

          <div className="compliance-filters">
            <select
              value={status}
              onChange={(event) => {
                setStatus(
                  event.target.value as typeof status,
                );

                setPage(1);
              }}
            >
              {STATUS_OPTIONS.map(
                (option) => (
                  <option
                    key={option}
                    value={option}
                  >
                    {option === 'ALL'
                      ? 'All statuses'
                      : formatLabel(option)}
                  </option>
                ),
              )}
            </select>

            <select
              value={priority}
              onChange={(event) => {
                setPriority(
                  event.target.value as typeof priority,
                );

                setPage(1);
              }}
            >
              {PRIORITY_OPTIONS.map(
                (option) => (
                  <option
                    key={option}
                    value={option}
                  >
                    {option === 'ALL'
                      ? 'All priorities'
                      : formatLabel(option)}
                  </option>
                ),
              )}
            </select>

            <select
              value={type}
              onChange={(event) => {
                setType(
                  event.target.value as typeof type,
                );

                setPage(1);
              }}
            >
              {TYPE_OPTIONS.map(
                (option) => (
                  <option
                    key={option}
                    value={option}
                  >
                    {option === 'ALL'
                      ? 'All case types'
                      : formatLabel(option)}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>

        {/* ====================================================
            ERROR
            ==================================================== */}

        {error ? (
          <div className="compliance-state compliance-error-state">
            <XCircle size={30} />

            <h3>
              Unable to load compliance cases
            </h3>

            <p>{error}</p>

            <button
              type="button"
              onClick={() =>
                void loadCases()
              }
            >
              Try again
            </button>
          </div>
        ) : loading ? (
          /* ==================================================
             LOADING
             ================================================== */

          <div className="compliance-state">
            <RefreshCw
              size={30}
              className="compliance-spin"
            />

            <h3>
              Loading compliance cases
            </h3>

            <p>
              Retrieving the latest compliance
              activity...
            </p>
          </div>
        ) : cases.length === 0 ? (
          /* ==================================================
             EMPTY
             ================================================== */

          <div className="compliance-state">
            <ShieldCheck size={34} />

            <h3>
              No compliance cases found
            </h3>

            <p>
              No cases match the current
              filters.
            </p>
          </div>
        ) : (
          /* ==================================================
             TABLE
             ================================================== */

          <>
            <div className="compliance-table-wrapper">
              <table className="compliance-table">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Type</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Assigned</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {cases.map(
                    (complianceCase) => (
                      <tr
                        key={
                          complianceCase.id
                        }
                      >
                        <td>
                          <div className="compliance-case-cell">
                            <strong>
                              {
                                complianceCase.reference
                              }
                            </strong>

                            <span>
                              {
                                complianceCase.title
                              }
                            </span>

                            {complianceCase.alertCode && (
                              <small>
                                Alert:{' '}
                                {
                                  complianceCase.alertCode
                                }
                              </small>
                            )}
                          </div>
                        </td>

                        <td>
                          <span className="compliance-type">
                            {formatLabel(
                              complianceCase.type,
                            )}
                          </span>
                        </td>

                        <td>
                          <span
                            className={getPriorityClass(
                              complianceCase.priority,
                            )}
                          >
                            {
                              complianceCase.priority
                            }
                          </span>
                        </td>

                        <td>
                          <span
                            className={getStatusClass(
                              complianceCase.status,
                            )}
                          >
                            {formatLabel(
                              complianceCase.status,
                            )}
                          </span>
                        </td>

                        <td>
                          {complianceCase.assignedToAdminId
                            ? `Admin #${complianceCase.assignedToAdminId}`
                            : 'Unassigned'}
                        </td>

                        <td>
                          <span className="compliance-date">
                            {formatDate(
                              complianceCase.createdAt,
                            )}
                          </span>
                        </td>

                        <td>
                          <Link
                            href={`/admin/compliance/${complianceCase.id}`}
                            className="compliance-view-link"
                          >
                            View
                            <ArrowRight size={15} />
                          </Link>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            {/* ==================================================
                PAGINATION
                ================================================== */}

            <div className="compliance-pagination">
              <span>
                Showing{' '}
                {cases.length} of{' '}
                {pagination.total} cases
              </span>

              <div>
                <button
                  type="button"
                  disabled={
                    page <= 1
                  }
                  onClick={() =>
                    setPage(
                      (current) =>
                        Math.max(
                          1,
                          current - 1,
                        ),
                    )
                  }
                >
                  Previous
                </button>

                <span>
                  Page {page} of{' '}
                  {Math.max(
                    1,
                    pagination.totalPages,
                  )}
                </span>

                <button
                  type="button"
                  disabled={
                    page >=
                    Math.max(
                      1,
                      pagination.totalPages,
                    )
                  }
                  onClick={() =>
                    setPage(
                      (current) =>
                        current + 1,
                    )
                  }
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
      {/* ======================================================
          NEW CASE MODAL
          ====================================================== */}

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
              <h2>New Compliance Case</h2>
              <button
                type="button"
                className="compliance-modal-close"
                onClick={() => setShowModal(false)}
                disabled={formLoading}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateCase(e)}>
              {formError && (
                <div className="compliance-modal-error">
                  <AlertTriangle size={15} />
                  {formError}
                </div>
              )}

              <div className="compliance-modal-field">
                <label htmlFor="case-type">Case Type</label>
                <select
                  id="case-type"
                  value={form.type}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, type: e.target.value }))
                  }
                  disabled={formLoading}
                >
                  {COMPLIANCE_CASE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="compliance-modal-field">
                <label htmlFor="case-priority">Priority</label>
                <select
                  id="case-priority"
                  value={form.priority}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, priority: e.target.value }))
                  }
                  disabled={formLoading}
                >
                  {COMPLIANCE_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="compliance-modal-field">
                <label htmlFor="case-title">Title</label>
                <input
                  id="case-title"
                  type="text"
                  maxLength={200}
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Brief summary of the case"
                  disabled={formLoading}
                />
              </div>

              <div className="compliance-modal-field">
                <label htmlFor="case-description">Description</label>
                <textarea
                  id="case-description"
                  rows={4}
                  maxLength={5000}
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Detailed description of the compliance concern"
                  disabled={formLoading}
                />
              </div>

              <div className="compliance-modal-field">
                <label htmlFor="case-alert-code">
                  Alert Code{' '}
                  <span className="compliance-modal-optional">(optional)</span>
                </label>
                <input
                  id="case-alert-code"
                  type="text"
                  maxLength={100}
                  value={form.alertCode}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, alertCode: e.target.value }))
                  }
                  placeholder="e.g. AML-2024-001"
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
                  {formLoading ? 'Creating...' : 'Create Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}