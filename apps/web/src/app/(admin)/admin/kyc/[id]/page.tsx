'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Shield,
  X,
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

type ReviewStatus =
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

type DocumentType =
  | 'NATIONAL_ID'
  | 'PASSPORT'
  | 'DRIVERS_LICENSE'
  | 'RESIDENCE_PERMIT';

interface KycDetail {
  id: number;
  userId: number;
  status: KycStatus;
  tier: number | null;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  documentType: DocumentType | null;
  documentNumber: string | null;
  documentFrontUrl: string | null;
  documentBackUrl: string | null;
  selfieUrl: string | null;
  address: string | null;
  reviewNotes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
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
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
   DOCUMENT LINK
   ============================================================ */

function DocumentLink({
  label,
  url,
}: {
  label: string;
  url: string | null;
}) {
  if (!url) {
    return (
      <div className="kyc-doc-field">
        <span>{label}</span>
        <span className="kyc-doc-missing">Not provided</span>
      </div>
    );
  }

  return (
    <div className="kyc-doc-field">
      <span>{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="kyc-doc-link"
      >
        <ExternalLink size={14} />
        View document
      </a>
    </div>
  );
}

/* ============================================================
   PAGE
   ============================================================ */

export default function AdminKycDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [kyc, setKyc] = useState<KycDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [reviewStatus, setReviewStatus] =
    useState<ReviewStatus>('UNDER_REVIEW');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');

  /* ----------------------------------------------------------
     LOAD
     ---------------------------------------------------------- */

  async function load(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError('');

    try {
      const data = await apiFetch<KycDetail>(`/admin/kyc/${id}`);

      setKyc(data);

      if (data.reviewNotes) {
        setReviewNotes(data.reviewNotes);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load KYC submission.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  /* ----------------------------------------------------------
     SUBMIT REVIEW
     ---------------------------------------------------------- */

  async function handleReview(event: React.FormEvent) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setReviewError('');
      setSuccess('');

      await apiFetch(`/admin/kyc/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: reviewStatus,
          reviewNotes: reviewNotes.trim() || undefined,
        }),
      });

      setSuccess(
        `KYC submission has been marked as ${reviewStatus.toLowerCase().replace('_', ' ')}.`,
      );

      window.setTimeout(() => {
        router.push('/admin/kyc');
      }, 1800);
    } catch (caught) {
      setReviewError(
        caught instanceof Error
          ? caught.message
          : 'Failed to submit review. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* ----------------------------------------------------------
     LOADING
     ---------------------------------------------------------- */

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          <div className="admin-loader" />
          <span>Loading KYC submission...</span>
        </div>
      </div>
    );
  }

  /* ----------------------------------------------------------
     NOT FOUND / ERROR
     ---------------------------------------------------------- */

  if (!kyc) {
    return (
      <div className="admin-page">
        <div className="admin-alert admin-alert-error">
          {error || 'KYC submission not found.'}
        </div>
        <Link href="/admin/kyc" className="admin-back-link">
          <ArrowLeft size={16} />
          Back to KYC list
        </Link>
      </div>
    );
  }

  const canReview =
    kyc.status === 'PENDING' || kyc.status === 'UNDER_REVIEW';

  /* ----------------------------------------------------------
     RENDER
     ---------------------------------------------------------- */

  return (
    <div className="admin-page">

      {/* ======================================================
          TOPBAR
          ====================================================== */}

      <div className="admin-detail-topbar">
        <Link href="/admin/kyc" className="admin-back-link">
          <ArrowLeft size={16} />
          Back to KYC list
        </Link>

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
          ALERTS
          ====================================================== */}

      {error && (
        <div className="admin-alert admin-alert-error">
          <X size={17} />
          {error}
        </div>
      )}

      {success && (
        <div className="admin-alert admin-alert-success">
          <CheckCircle2 size={17} />
          {success}
        </div>
      )}

      {/* ======================================================
          HERO
          ====================================================== */}

      <section className="admin-profile-hero">
        <div className="admin-profile-identity">
          <div className="admin-profile-avatar">
            {kyc.user.firstName[0]}
            {kyc.user.lastName[0]}
          </div>
          <div className="admin-profile-copy">
            <div className="admin-eyebrow">
              <Shield size={13} />
              KYC Submission
            </div>
            <h1>
              {kyc.user.firstName} {kyc.user.lastName}
            </h1>
            <p>{kyc.user.email}</p>
          </div>
        </div>

        <div className="admin-profile-actions">
          <span className={kycStatusClass(kyc.status)}>
            <span className="kyc-badge-dot" />
            {kycStatusLabel(kyc.status)}
          </span>
          {kyc.tier != null && (
            <span className="kyc-tier-badge">Tier {kyc.tier}</span>
          )}
        </div>
      </section>

      {/* ======================================================
          SUMMARY CARDS
          ====================================================== */}

      <div className="admin-detail-summary-grid">
        <div className="admin-detail-summary-card">
          <span>Submission ID</span>
          <strong>KYC-{String(kyc.id).padStart(5, '0')}</strong>
        </div>
        <div className="admin-detail-summary-card">
          <span>Submitted</span>
          <strong>{formatDate(kyc.submittedAt)}</strong>
        </div>
        <div className="admin-detail-summary-card">
          <span>Last Reviewed</span>
          <strong>{formatDate(kyc.reviewedAt)}</strong>
        </div>
        <div className="admin-detail-summary-card">
          <span>User Status</span>
          <strong>{kyc.user.status}</strong>
        </div>
      </div>

      <div className="admin-detail-grid">

        {/* ======================================================
            PERSONAL INFORMATION
            ====================================================== */}

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <span className="admin-eyebrow">Applicant</span>
              <h2>Personal Information</h2>
            </div>
          </div>

          <div className="admin-detail-info-grid">
            <div>
              <span>First Name</span>
              <strong>{kyc.firstName || '—'}</strong>
            </div>
            <div>
              <span>Last Name</span>
              <strong>{kyc.lastName || '—'}</strong>
            </div>
            <div>
              <span>Date of Birth</span>
              <strong>
                {kyc.dateOfBirth
                  ? new Intl.DateTimeFormat('en-NG', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }).format(new Date(kyc.dateOfBirth))
                  : '—'}
              </strong>
            </div>
            <div>
              <span>Nationality</span>
              <strong>{kyc.nationality || '—'}</strong>
            </div>
            <div className="full-width">
              <span>Residential Address</span>
              <strong>{kyc.address || '—'}</strong>
            </div>
          </div>
        </section>

        {/* ======================================================
            DOCUMENT INFORMATION
            ====================================================== */}

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <span className="admin-eyebrow">Identity Document</span>
              <h2>Document Details</h2>
            </div>
          </div>

          <div className="admin-detail-info-grid">
            <div>
              <span>Document Type</span>
              <strong>{formatDocumentType(kyc.documentType)}</strong>
            </div>
            <div>
              <span>Document Number</span>
              <strong>{kyc.documentNumber || '—'}</strong>
            </div>
          </div>

          <div className="kyc-doc-links">
            <DocumentLink
              label="Document Front"
              url={kyc.documentFrontUrl}
            />
            <DocumentLink
              label="Document Back"
              url={kyc.documentBackUrl}
            />
            <DocumentLink
              label="Selfie with Document"
              url={kyc.selfieUrl}
            />
          </div>
        </section>

        {/* ======================================================
            REVIEW NOTES (READ-ONLY IF ALREADY DECIDED)
            ====================================================== */}

        {kyc.reviewNotes && !canReview && (
          <section className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <span className="admin-eyebrow">Decision</span>
                <h2>Review Notes</h2>
              </div>
            </div>
            <p
              style={{
                padding: '0 1.5rem 1.5rem',
                color: 'var(--text-secondary, #6b7280)',
                lineHeight: 1.6,
              }}
            >
              {kyc.reviewNotes}
            </p>
          </section>
        )}

        {/* ======================================================
            REVIEW FORM
            ====================================================== */}

        {canReview && (
          <section className="admin-panel admin-full-width">
            <div className="admin-panel-header">
              <div>
                <span className="admin-eyebrow">Action</span>
                <h2>Submit Review Decision</h2>
              </div>
            </div>

            <form
              onSubmit={(e) => void handleReview(e)}
              className="kyc-review-form"
            >
              {reviewError && (
                <div className="admin-alert admin-alert-error">
                  <X size={17} />
                  {reviewError}
                </div>
              )}

              <div className="kyc-review-form-fields">
                <div className="form-field">
                  <label htmlFor="review-status">Review Decision</label>
                  <select
                    id="review-status"
                    value={reviewStatus}
                    onChange={(e) =>
                      setReviewStatus(e.target.value as ReviewStatus)
                    }
                    disabled={submitting}
                  >
                    <option value="UNDER_REVIEW">Under Review</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                  <small>
                    Select the outcome of your review for this KYC
                    submission.
                  </small>
                </div>

                <div className="form-field">
                  <label htmlFor="review-notes">
                    Review Notes{' '}
                    <span
                      style={{
                        fontWeight: 400,
                        color: 'var(--text-tertiary, #9ca3af)',
                      }}
                    >
                      (optional)
                    </span>
                  </label>
                  <textarea
                    id="review-notes"
                    rows={4}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add notes about your decision, e.g. reason for rejection or any conditions..."
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="kyc-review-form-footer">
                <Link
                  href="/admin/kyc"
                  className="secondary-button"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  className={
                    reviewStatus === 'REJECTED'
                      ? 'danger-button'
                      : 'primary-button'
                  }
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <RefreshCw
                        size={16}
                        className="admin-refresh-spin"
                      />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      {reviewStatus === 'APPROVED'
                        ? 'Approve KYC'
                        : reviewStatus === 'REJECTED'
                          ? 'Reject KYC'
                          : 'Mark Under Review'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        )}

      </div>
    </div>
  );
}
