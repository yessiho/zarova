'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Flag,
  Link2,
  RefreshCw,
  Shield,
  ShieldAlert,
  XCircle,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

type RiskAlert = {
  id: number;
  reference: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status:
    | 'OPEN'
    | 'UNDER_REVIEW'
    | 'FLAGGED'
    | 'RELEASED'
    | 'FALSE_POSITIVE';
  title: string;
  description: string;
  transactionId?: number | null;
  walletId?: number | null;
  userId?: number | null;
  complianceCaseId?: number | null;
  alertCode?: string | null;
  createdByAdminId: number;
  assignedToAdminId?: number | null;
  resolutionNotes?: string | null;
  falsePositiveReason?: string | null;
  flaggedByAdminId?: number | null;
  flaggedAt?: string | null;
  releasedByAdminId?: number | null;
  releasedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

function formatLabel(v?: string | null): string {
  if (!v) return '—';
  return v
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

function getSeverityClass(s: string): string {
  return `risk-severity risk-severity-${s.toLowerCase()}`;
}

function getStatusClass(s: string): string {
  return `risk-status risk-status-${s.toLowerCase().replaceAll('_', '-')}`;
}

export default function RiskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';

  const [alert, setAlert] = useState<RiskAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  /* Prompt inputs */
  const [flagReason, setFlagReason] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [linkCaseId, setLinkCaseId] = useState('');

  /* Panel visibility */
  const [showFlagPanel, setShowFlagPanel] = useState(false);
  const [showReleasePanel, setShowReleasePanel] = useState(false);
  const [showLinkPanel, setShowLinkPanel] = useState(false);

  const loadAlert = useCallback(async () => {
    if (!id || !/^\d+$/.test(id)) {
      router.replace('/admin/risk');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await apiFetch<RiskAlert>(
        `/admin/risk/alerts/${id}`,
      );
      setAlert(result);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Unable to load alert.',
      );
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void loadAlert();
  }, [loadAlert]);

  async function performAction(
    endpoint: string,
    body: Record<string, unknown>,
  ) {
    try {
      setActionLoading(true);
      setActionError(null);
      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      await loadAlert();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Action failed.',
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleFlag(e: React.FormEvent) {
    e.preventDefault();
    const reason = flagReason.trim();
    if (!reason) {
      setActionError('Flag reason is required.');
      return;
    }
    await performAction(`/admin/risk/alerts/${id}/flag`, { reason });
    setFlagReason('');
    setShowFlagPanel(false);
  }

  async function handleRelease(e: React.FormEvent) {
    e.preventDefault();
    const notes = releaseNotes.trim();
    if (!notes) {
      setActionError('Release notes are required.');
      return;
    }
    await performAction(`/admin/risk/alerts/${id}/release`, { notes });
    setReleaseNotes('');
    setShowReleasePanel(false);
  }

  async function handleLinkCompliance(e: React.FormEvent) {
    e.preventDefault();
    const caseId = parseInt(linkCaseId.trim(), 10);
    if (!caseId || Number.isNaN(caseId)) {
      setActionError('A valid compliance case ID is required.');
      return;
    }
    await performAction(`/admin/risk/alerts/${id}/link-compliance`, {
      complianceCaseId: caseId,
    });
    setLinkCaseId('');
    setShowLinkPanel(false);
  }

  /* ============================================================
     LOADING / ERROR / NOT FOUND STATES
     ============================================================ */

  if (loading) {
    return (
      <main className="compliance-page">
        <div className="compliance-detail-state">
          <RefreshCw size={32} className="compliance-spin" />
          <h3>Loading alert...</h3>
        </div>
      </main>
    );
  }

  if (error || !alert) {
    return (
      <main className="compliance-page">
        <div className="compliance-detail-state compliance-error-state">
          <XCircle size={34} />
          <h3>Unable to load alert</h3>
          <p>{error ?? 'Alert not found.'}</p>
          <Link href="/admin/risk">Back to Risk &amp; Fraud</Link>
        </div>
      </main>
    );
  }

  const isClosed =
    alert.status === 'RELEASED' ||
    alert.status === 'FALSE_POSITIVE';

  return (
    <main className="compliance-page">
      {/* HEADER */}
      <div className="compliance-page-header">
        <div>
          <div className="compliance-breadcrumb">
            <span>Admin</span>
            <span>/</span>
            <Link href="/admin/risk">Risk &amp; Fraud</Link>
            <span>/</span>
            <span>{alert.reference}</span>
          </div>

          <div className="compliance-title-row">
            <div className="compliance-title-icon">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h1>{alert.title}</h1>
              <p>{alert.reference}</p>
            </div>
          </div>
        </div>

        <Link href="/admin/risk" className="compliance-back-link">
          <ArrowLeft size={16} />
          Back
        </Link>
      </div>

      {/* ACTION ERROR */}
      {actionError && (
        <div
          className="compliance-action-error"
          style={{
            margin: '0 0 16px',
            padding: '12px 16px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
          }}
        >
          <AlertTriangle size={15} />
          {actionError}
        </div>
      )}

      <div className="compliance-detail-grid">
        {/* LEFT — MAIN INFO */}
        <div>
          {/* Details card */}
          <section className="compliance-content-card" style={{ marginBottom: '16px' }}>
            <div className="compliance-detail-section-header">
              <Shield size={17} />
              <h2>Alert Details</h2>
            </div>

            <dl className="compliance-detail-list">
              <div>
                <dt>Reference</dt>
                <dd>{alert.reference}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{formatLabel(alert.type)}</dd>
              </div>
              <div>
                <dt>Severity</dt>
                <dd>
                  <span className={getSeverityClass(alert.severity)}>
                    {alert.severity}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span className={getStatusClass(alert.status)}>
                    {formatLabel(alert.status)}
                  </span>
                </dd>
              </div>
              {alert.alertCode && (
                <div>
                  <dt>Alert Code</dt>
                  <dd>{alert.alertCode}</dd>
                </div>
              )}
              {alert.transactionId && (
                <div>
                  <dt>Transaction ID</dt>
                  <dd>#{alert.transactionId}</dd>
                </div>
              )}
              {alert.walletId && (
                <div>
                  <dt>Wallet ID</dt>
                  <dd>#{alert.walletId}</dd>
                </div>
              )}
              {alert.userId && (
                <div>
                  <dt>User ID</dt>
                  <dd>#{alert.userId}</dd>
                </div>
              )}
              {alert.complianceCaseId && (
                <div>
                  <dt>Compliance Case</dt>
                  <dd>
                    <Link href={`/admin/compliance/${alert.complianceCaseId}`}>
                      Case #{alert.complianceCaseId}
                    </Link>
                  </dd>
                </div>
              )}
              <div>
                <dt>Created By</dt>
                <dd>Admin #{alert.createdByAdminId}</dd>
              </div>
              <div>
                <dt>Assigned To</dt>
                <dd>
                  {alert.assignedToAdminId
                    ? `Admin #${alert.assignedToAdminId}`
                    : 'Unassigned'}
                </dd>
              </div>
              <div>
                <dt>Created At</dt>
                <dd>{formatDate(alert.createdAt)}</dd>
              </div>
              <div>
                <dt>Updated At</dt>
                <dd>{formatDate(alert.updatedAt)}</dd>
              </div>
            </dl>

            <div
              style={{
                padding: '16px',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <h3
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px',
                }}
              >
                Description
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: '#334155',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {alert.description}
              </p>
            </div>
          </section>

          {/* Flag trail */}
          {(alert.flaggedByAdminId || alert.flaggedAt) && (
            <section
              className="compliance-content-card"
              style={{ marginBottom: '16px' }}
            >
              <div className="compliance-detail-section-header">
                <Flag size={17} />
                <h2>Flag Details</h2>
              </div>
              <dl className="compliance-detail-list">
                <div>
                  <dt>Flagged By</dt>
                  <dd>Admin #{alert.flaggedByAdminId}</dd>
                </div>
                <div>
                  <dt>Flagged At</dt>
                  <dd>{formatDate(alert.flaggedAt)}</dd>
                </div>
                {alert.falsePositiveReason && (
                  <div>
                    <dt>Reason</dt>
                    <dd>{alert.falsePositiveReason}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {/* Release trail */}
          {(alert.releasedByAdminId || alert.releasedAt) && (
            <section
              className="compliance-content-card"
              style={{ marginBottom: '16px' }}
            >
              <div className="compliance-detail-section-header">
                <CheckCircle2 size={17} />
                <h2>Release Details</h2>
              </div>
              <dl className="compliance-detail-list">
                <div>
                  <dt>Released By</dt>
                  <dd>Admin #{alert.releasedByAdminId}</dd>
                </div>
                <div>
                  <dt>Released At</dt>
                  <dd>{formatDate(alert.releasedAt)}</dd>
                </div>
                {alert.resolutionNotes && (
                  <div>
                    <dt>Resolution Notes</dt>
                    <dd
                      style={{
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {alert.resolutionNotes}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </div>

        {/* RIGHT — ACTIONS */}
        <div>
          <section className="compliance-content-card">
            <div className="compliance-detail-section-header">
              <ShieldAlert size={17} />
              <h2>Actions</h2>
            </div>

            <div
              style={{
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {/* FLAG */}
              {!isClosed && alert.status !== 'FLAGGED' && (
                <button
                  type="button"
                  className="compliance-action-warning"
                  onClick={() => {
                    setShowFlagPanel((v) => !v);
                    setShowReleasePanel(false);
                    setShowLinkPanel(false);
                    setActionError(null);
                  }}
                  disabled={actionLoading}
                >
                  <Flag size={15} />
                  Flag Alert
                </button>
              )}

              {showFlagPanel && (
                <form
                  onSubmit={(e) => void handleFlag(e)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    background: '#fff7ed',
                    border: '1px solid #fed7aa',
                    borderRadius: '8px',
                    padding: '12px',
                  }}
                >
                  <label
                    style={{ fontSize: '12px', fontWeight: 700, color: '#c2410c' }}
                  >
                    Flag Reason
                  </label>
                  <textarea
                    rows={3}
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    placeholder="Reason for flagging this alert..."
                    maxLength={5000}
                    disabled={actionLoading}
                    style={{
                      resize: 'vertical',
                      padding: '8px',
                      border: '1px solid #fed7aa',
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="submit"
                      className="compliance-action-warning"
                      disabled={actionLoading}
                      style={{ flex: 1 }}
                    >
                      {actionLoading ? 'Flagging...' : 'Confirm Flag'}
                    </button>
                    <button
                      type="button"
                      className="compliance-refresh-button"
                      onClick={() => setShowFlagPanel(false)}
                      disabled={actionLoading}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* RELEASE */}
              {!isClosed && (
                <button
                  type="button"
                  className="compliance-action-success"
                  onClick={() => {
                    setShowReleasePanel((v) => !v);
                    setShowFlagPanel(false);
                    setShowLinkPanel(false);
                    setActionError(null);
                  }}
                  disabled={actionLoading}
                >
                  <CheckCircle2 size={15} />
                  Release Alert
                </button>
              )}

              {showReleasePanel && (
                <form
                  onSubmit={(e) => void handleRelease(e)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    padding: '12px',
                  }}
                >
                  <label
                    style={{ fontSize: '12px', fontWeight: 700, color: '#15803d' }}
                  >
                    Release Notes
                  </label>
                  <textarea
                    rows={3}
                    value={releaseNotes}
                    onChange={(e) => setReleaseNotes(e.target.value)}
                    placeholder="Describe why this alert is being released..."
                    maxLength={5000}
                    disabled={actionLoading}
                    style={{
                      resize: 'vertical',
                      padding: '8px',
                      border: '1px solid #bbf7d0',
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="submit"
                      className="compliance-action-success"
                      disabled={actionLoading}
                      style={{ flex: 1 }}
                    >
                      {actionLoading ? 'Releasing...' : 'Confirm Release'}
                    </button>
                    <button
                      type="button"
                      className="compliance-refresh-button"
                      onClick={() => setShowReleasePanel(false)}
                      disabled={actionLoading}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* LINK COMPLIANCE */}
              {!alert.complianceCaseId && !isClosed && (
                <button
                  type="button"
                  className="compliance-refresh-button"
                  onClick={() => {
                    setShowLinkPanel((v) => !v);
                    setShowFlagPanel(false);
                    setShowReleasePanel(false);
                    setActionError(null);
                  }}
                  disabled={actionLoading}
                >
                  <Link2 size={15} />
                  Link Compliance Case
                </button>
              )}

              {showLinkPanel && (
                <form
                  onSubmit={(e) => void handleLinkCompliance(e)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                  }}
                >
                  <label
                    style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}
                  >
                    Compliance Case ID
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={linkCaseId}
                    onChange={(e) => setLinkCaseId(e.target.value)}
                    placeholder="e.g. 42"
                    disabled={actionLoading}
                    style={{
                      padding: '8px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="submit"
                      className="compliance-action-success"
                      disabled={actionLoading}
                      style={{ flex: 1 }}
                    >
                      {actionLoading ? 'Linking...' : 'Link Case'}
                    </button>
                    <button
                      type="button"
                      className="compliance-refresh-button"
                      onClick={() => setShowLinkPanel(false)}
                      disabled={actionLoading}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {isClosed && (
                <p
                  style={{
                    fontSize: '13px',
                    color: '#64748b',
                    textAlign: 'center',
                    padding: '8px 0',
                  }}
                >
                  This alert is closed. No further actions available.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
