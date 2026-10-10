'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileText,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

type ComplianceCase = {
  id: number;
  reference: string;
  type: string;
  priority:
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH'
    | 'CRITICAL';
  status:
    | 'OPEN'
    | 'UNDER_REVIEW'
    | 'ESCALATED'
    | 'RESOLVED'
    | 'DISMISSED';

  title: string;
  description: string;

  transactionId?: number | null;
  walletId?: number | null;
  alertCode?: string | null;

  createdByAdminId: number;
  assignedToAdminId?: number | null;

  resolutionNotes?: string | null;

  escalationReason?: string | null;
  escalatedByAdminId?: number | null;
  escalatedAt?: string | null;

  createdAt: string;
  updatedAt: string;
};

function formatLabel(
  value?: string | null,
) {
  if (!value) return '—';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) =>
      char.toUpperCase(),
    );
}

function formatDate(
  value?: string | null,
) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat(
    'en-NG',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(date);
}

function statusClass(
  status: ComplianceCase['status'],
) {
  return `compliance-detail-status compliance-detail-status-${status
    .toLowerCase()
    .replaceAll('_', '-')}`;
}

function priorityClass(
  priority: ComplianceCase['priority'],
) {
  return `compliance-detail-priority compliance-detail-priority-${priority.toLowerCase()}`;
}

export default function ComplianceDetailsPage() {
  const params = useParams<{
    id: string;
  }>();

  const router = useRouter();

  const id = params?.id;

  const [complianceCase, setComplianceCase] =
    useState<ComplianceCase | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [actionLoading, setActionLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const loadCase =
    useCallback(async () => {
      if (!id || !/^\d+$/.test(id)) {
        router.replace('/admin/compliance');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const result =
          await apiFetch<ComplianceCase>(
            `/admin/compliance/cases/${id}`,
          );

        setComplianceCase(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load compliance case',
        );
      } finally {
        setLoading(false);
      }
    }, [id, router]);

  useEffect(() => {
    void loadCase();
  }, [loadCase]);

  async function performAction(
    endpoint: string,
    options?: RequestInit,
  ) {
    try {
      setActionLoading(true);
      setError(null);

      await apiFetch(
        endpoint,
        options,
      );

      await loadCase();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to complete action',
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAssign() {
    await performAction(
      `/admin/compliance/cases/${id}/assign`,
      {
        method: 'POST',
      },
    );
  }

  async function handleUnderReview() {
    await performAction(
      `/admin/compliance/cases/${id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          status:
            'UNDER_REVIEW',
        }),
      },
    );
  }

  async function handleResolve() {
    const resolutionNotes =
      window.prompt(
        'Enter resolution notes:',
      );

    if (
      resolutionNotes === null
    ) {
      return;
    }

    if (
      !resolutionNotes.trim()
    ) {
      setError(
        'Resolution notes are required.',
      );

      return;
    }

    await performAction(
      `/admin/compliance/cases/${id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          status: 'RESOLVED',
          resolutionNotes:
            resolutionNotes.trim(),
        }),
      },
    );
  }

  async function handleDismiss() {
    const resolutionNotes =
      window.prompt(
        'Enter dismissal reason:',
      );

    if (
      resolutionNotes === null
    ) {
      return;
    }

    if (
      !resolutionNotes.trim()
    ) {
      setError(
        'Dismissal reason is required.',
      );

      return;
    }

    await performAction(
      `/admin/compliance/cases/${id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          status:
            'DISMISSED',
          resolutionNotes:
            resolutionNotes.trim(),
        }),
      },
    );
  }

  async function handleEscalate() {
    const reason =
      window.prompt(
        'Enter escalation reason:',
      );

    if (reason === null) {
      return;
    }

    if (!reason.trim()) {
      setError(
        'Escalation reason is required.',
      );

      return;
    }

    await performAction(
      `/admin/compliance/cases/${id}/escalate`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          reason:
            reason.trim(),
        }),
      },
    );
  }

  if (loading) {
    return (
      <main className="compliance-detail-page">
        <div className="compliance-detail-state">
          <RefreshCw
            size={30}
            className="compliance-spin"
          />

          <h2>
            Loading compliance case
          </h2>

          <p>
            Retrieving case information...
          </p>
        </div>
      </main>
    );
  }

  if (error && !complianceCase) {
    return (
      <main className="compliance-detail-page">
        <Link
          href="/admin/compliance"
          className="compliance-back-link"
        >
          <ArrowLeft size={17} />
          Back to Compliance
        </Link>

        <div className="compliance-detail-state compliance-error-state">
          <XCircle size={32} />

          <h2>
            Unable to load case
          </h2>

          <p>{error}</p>

          <button
            type="button"
            onClick={() =>
              void loadCase()
            }
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!complianceCase) {
    return null;
  }

  const isClosed =
    complianceCase.status ===
      'RESOLVED' ||
    complianceCase.status ===
      'DISMISSED';

  return (
    <main className="compliance-detail-page">
      <div className="compliance-detail-topbar">
        <Link
          href="/admin/compliance"
          className="compliance-back-link"
        >
          <ArrowLeft size={17} />
          Back to Compliance
        </Link>

        <button
          type="button"
          className="compliance-refresh-button"
          onClick={() =>
            void loadCase()
          }
          disabled={actionLoading}
        >
          <RefreshCw
            size={17}
            className={
              actionLoading
                ? 'compliance-spin'
                : ''
            }
          />
          Refresh
        </button>
      </div>

      {error && (
        <div className="compliance-detail-alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      <section className="compliance-detail-hero">
        <div className="compliance-detail-hero-main">
          <div className="compliance-detail-icon">
            <ShieldCheck size={28} />
          </div>

          <div>
            <div className="compliance-detail-breadcrumb">
              Admin / Compliance /{' '}
              {complianceCase.reference}
            </div>

            <div className="compliance-detail-reference-row">
              <h1>
                {complianceCase.reference}
              </h1>

              <span
                className={statusClass(
                  complianceCase.status,
                )}
              >
                {formatLabel(
                  complianceCase.status,
                )}
              </span>

              <span
                className={priorityClass(
                  complianceCase.priority,
                )}
              >
                {complianceCase.priority}
              </span>
            </div>

            <p className="compliance-detail-subtitle">
              {complianceCase.title}
            </p>
          </div>
        </div>

        <div className="compliance-detail-actions">
          {!isClosed && (
            <>
              {complianceCase.status ===
                'OPEN' && (
                <button
                  type="button"
                  className="compliance-action-secondary"
                  onClick={
                    handleUnderReview
                  }
                  disabled={
                    actionLoading
                  }
                >
                  <Clock3 size={16} />
                  Start Review
                </button>
              )}

              {!complianceCase.assignedToAdminId && (
                <button
                  type="button"
                  className="compliance-action-secondary"
                  onClick={
                    handleAssign
                  }
                  disabled={
                    actionLoading
                  }
                >
                  <UserCheck
                    size={16}
                  />
                  Assign to Me
                </button>
              )}

              {complianceCase.status !==
                'ESCALATED' && (
                <button
                  type="button"
                  className="compliance-action-danger"
                  onClick={
                    handleEscalate
                  }
                  disabled={
                    actionLoading
                  }
                >
                  <AlertTriangle
                    size={16}
                  />
                  Escalate
                </button>
              )}

              <button
                type="button"
                className="compliance-action-success"
                onClick={
                  handleResolve
                }
                disabled={
                  actionLoading
                }
              >
                <CheckCircle2
                  size={16}
                />
                Resolve
              </button>

              <button
                type="button"
                className="compliance-action-muted"
                onClick={
                  handleDismiss
                }
                disabled={
                  actionLoading
                }
              >
                <XCircle size={16} />
                Dismiss
              </button>
            </>
          )}
        </div>
      </section>

      <div className="compliance-detail-grid">
        <section className="compliance-detail-card compliance-detail-description-card">
          <div className="compliance-detail-card-header">
            <div>
              <span className="compliance-section-eyebrow">
                CASE INFORMATION
              </span>

              <h2>
                Investigation Summary
              </h2>
            </div>

            <FileText size={21} />
          </div>

          <div className="compliance-description">
            {complianceCase.description}
          </div>

          <div className="compliance-detail-info-grid">
            <div>
              <span>Case Type</span>
              <strong>
                {formatLabel(
                  complianceCase.type,
                )}
              </strong>
            </div>

            <div>
              <span>Priority</span>
              <strong>
                {complianceCase.priority}
              </strong>
            </div>

            <div>
              <span>Status</span>
              <strong>
                {formatLabel(
                  complianceCase.status,
                )}
              </strong>
            </div>

            <div>
              <span>Alert Code</span>
              <strong>
                {complianceCase.alertCode ||
                  '—'}
              </strong>
            </div>
          </div>
        </section>

        <section className="compliance-detail-card">
          <div className="compliance-detail-card-header">
            <div>
              <span className="compliance-section-eyebrow">
                OWNERSHIP
              </span>

              <h2>
                Case Assignment
              </h2>
            </div>

            <UserCheck size={21} />
          </div>

          <div className="compliance-detail-meta-list">
            <div>
              <span>
                Created By
              </span>

              <strong>
                Admin #
                {
                  complianceCase.createdByAdminId
                }
              </strong>
            </div>

            <div>
              <span>
                Assigned To
              </span>

              <strong>
                {complianceCase.assignedToAdminId
                  ? `Admin #${complianceCase.assignedToAdminId}`
                  : 'Unassigned'}
              </strong>
            </div>

            <div>
              <span>
                Created
              </span>

              <strong>
                {formatDate(
                  complianceCase.createdAt,
                )}
              </strong>
            </div>

            <div>
              <span>
                Last Updated
              </span>

              <strong>
                {formatDate(
                  complianceCase.updatedAt,
                )}
              </strong>
            </div>
          </div>
        </section>

        <section className="compliance-detail-card">
          <div className="compliance-detail-card-header">
            <div>
              <span className="compliance-section-eyebrow">
                RELATED DATA
              </span>

              <h2>
                Transaction & Wallet
              </h2>
            </div>

            <FileText size={21} />
          </div>

          <div className="compliance-detail-meta-list">
            <div>
              <span>
                Transaction ID
              </span>

              <strong>
                {complianceCase.transactionId ??
                  '—'}
              </strong>
            </div>

            <div>
              <span>
                Wallet ID
              </span>

              <strong>
                {complianceCase.walletId ??
                  '—'}
              </strong>
            </div>

            <div>
              <span>
                Alert Reference
              </span>

              <strong>
                {complianceCase.alertCode ||
                  '—'}
              </strong>
            </div>
          </div>
        </section>

        {complianceCase.status ===
          'ESCALATED' && (
          <section className="compliance-detail-card compliance-escalation-card">
            <div className="compliance-detail-card-header">
              <div>
                <span className="compliance-section-eyebrow">
                  ESCALATION
                </span>

                <h2>
                  Escalation Details
                </h2>
              </div>

              <AlertTriangle
                size={21}
              />
            </div>

            <div className="compliance-detail-meta-list">
              <div>
                <span>
                  Escalated By
                </span>

                <strong>
                  {complianceCase.escalatedByAdminId
                    ? `Admin #${complianceCase.escalatedByAdminId}`
                    : '—'}
                </strong>
              </div>

              <div>
                <span>
                  Escalated At
                </span>

                <strong>
                  {formatDate(
                    complianceCase.escalatedAt,
                  )}
                </strong>
              </div>
            </div>

            <div className="compliance-resolution-box">
              <span>
                Escalation Reason
              </span>

              <p>
                {complianceCase.escalationReason ||
                  'No escalation reason recorded.'}
              </p>
            </div>
          </section>
        )}

        {(complianceCase.status ===
          'RESOLVED' ||
          complianceCase.status ===
            'DISMISSED') && (
          <section className="compliance-detail-card compliance-resolution-card">
            <div className="compliance-detail-card-header">
              <div>
                <span className="compliance-section-eyebrow">
                  OUTCOME
                </span>

                <h2>
                  Resolution
                </h2>
              </div>

              {complianceCase.status ===
              'RESOLVED' ? (
                <CheckCircle2
                  size={21}
                />
              ) : (
                <XCircle
                  size={21}
                />
              )}
            </div>

            <div className="compliance-resolution-box">
              <span>
                {complianceCase.status ===
                'RESOLVED'
                  ? 'Resolution Notes'
                  : 'Dismissal Reason'}
              </span>

              <p>
                {complianceCase.resolutionNotes ||
                  'No resolution notes recorded.'}
              </p>
            </div>
          </section>
        )}
      </div>

      <div className="compliance-detail-footer">
        <Link
          href="/admin/compliance"
          className="compliance-back-link"
        >
          <ArrowLeft size={16} />
          Return to Compliance
        </Link>

        <span>
          Case ID #{complianceCase.id}
        </span>
      </div>
    </main>
  );
}