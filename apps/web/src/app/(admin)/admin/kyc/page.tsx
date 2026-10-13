'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  RefreshCw,
  Shield,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

/* ============================================================
   TYPES
   ============================================================ */

type KycStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

type DocumentType =
  | 'NATIONAL_ID'
  | 'PASSPORT'
  | 'DRIVERS_LICENSE'
  | 'RESIDENCE_PERMIT';

interface KycSubmission {
  id: number;
  userId: number;
  status: KycStatus;
  tier: number | null;
  firstName: string | null;
  lastName: string | null;
  documentType: DocumentType | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
  };
}

interface KycListResponse {
  data: KycSubmission[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/* ============================================================
   HELPERS
   ============================================================ */

function formatDate(value?: string | null): string {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatDocumentType(type: DocumentType | null): string {
  if (!type) return '—';

  const labels: Record<DocumentType, string> = {
    NATIONAL_ID: 'National ID',
    PASSPORT: 'Passport',
    DRIVERS_LICENSE: "Driver's License",
    RESIDENCE_PERMIT: 'Residence Permit',
  };

  return labels[type] ?? type;
}

function kycStatusClass(status: KycStatus): string {
  const map: Record<KycStatus, string> = {
    PENDING: 'kyc-badge kyc-badge-pending',
    UNDER_REVIEW: 'kyc-badge kyc-badge-under-review',
    APPROVED: 'kyc-badge kyc-badge-approved',
    REJECTED: 'kyc-badge kyc-badge-rejected',
  };

  return map[status] ?? 'kyc-badge';
}

function kycStatusLabel(status: KycStatus): string {
  const map: Record<KycStatus, string> = {
    PENDING: 'Pending',
    UNDER_REVIEW: 'Under Review',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
  };

  return map[status] ?? status;
}

/* ============================================================
   PAGE
   ============================================================ */

export default function AdminKycPage() {
  const [result, setResult] =
    useState<KycListResponse | null>(null);

  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      setError('');

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '20',
        });

        if (status) {
          params.set('status', status);
        }

        const response = await apiFetch<KycListResponse>(
          `/admin/kyc?${params.toString()}`,
        );

        setResult(response);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Unable to load KYC submissions.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, status],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <div className="admin-page">

      {/* ======================================================
          PAGE HEADER
          ====================================================== */}

      <div className="page-header">
        <div>
          <div className="admin-eyebrow">
            <Shield size={15} />
            Compliance
          </div>
          <h1 className="page-title">KYC Review</h1>
          <p className="page-description">
            Review and manage customer identity verification submissions.
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
            className={refreshing ? 'admin-refresh-spin' : ''}
          />
          Refresh
        </button>
      </div>

      {/* ======================================================
          ERROR
          ====================================================== */}

      {error && (
        <div className="admin-alert admin-alert-error">{error}</div>
      )}

      {/* ======================================================
          PANEL
          ====================================================== */}

      <section className="admin-panel">

        {/* Toolbar */}
        <div className="admin-customer-toolbar">
          <div />

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
              <option value="PENDING">Pending</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="admin-loading">
            <div className="admin-loader" />
            <span>Loading KYC submissions...</span>
          </div>
        ) : result?.data.length === 0 ? (
          <div className="admin-empty">
            <Shield size={28} />
            <h3>No KYC submissions found</h3>
            <p>Try changing your status filter.</p>
          </div>
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Document Type</th>
                    <th>Tier</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {result?.data.map((submission) => (
                    <tr key={`kyc-${submission.id}`}>
                      <td>
                        <div className="admin-customer-cell">
                          <div className="admin-customer-avatar">
                            {submission.user.firstName[0]}
                            {submission.user.lastName[0]}
                          </div>
                          <div>
                            <strong>
                              {submission.user.firstName}{' '}
                              {submission.user.lastName}
                            </strong>
                            <span>{submission.user.email}</span>
                            <small>
                              KYC-{String(submission.id).padStart(5, '0')}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        {formatDocumentType(submission.documentType)}
                      </td>
                      <td>
                        {submission.tier != null
                          ? `Tier ${submission.tier}`
                          : '—'}
                      </td>
                      <td>
                        <span
                          className={kycStatusClass(submission.status)}
                        >
                          <span className="kyc-badge-dot" />
                          {kycStatusLabel(submission.status)}
                        </span>
                      </td>
                      <td>{formatDate(submission.submittedAt)}</td>
                      <td>
                        <Link
                          href={`/admin/kyc/${submission.id}`}
                          className="admin-table-action"
                        >
                          <Eye size={15} />
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
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
                      setPage((current) => Math.max(1, current - 1))
                    }
                  >
                    <ChevronLeft size={15} />
                    Previous
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    disabled={page >= result.pagination.totalPages}
                    onClick={() =>
                      setPage((current) =>
                        Math.min(result.pagination.totalPages, current + 1),
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
