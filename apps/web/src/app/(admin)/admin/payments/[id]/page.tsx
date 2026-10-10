'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  RefreshCw,
  XCircle,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

/* ============================================================
   TYPES
   ============================================================ */

type PaymentStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

type AdminSummary = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
};

type WalletSummary = {
  id: number;
  currency: string;
  status: string;
};

type Payment = {
  id: number;
  reference: string;
  sourceWalletId: number;
  destinationWalletId: number;
  amount: string;
  currency: string;
  description: string | null;
  status: PaymentStatus;
  createdByAdminId: number;
  approvedByAdminId: number | null;
  rejectedByAdminId: number | null;
  rejectionReason: string | null;
  transactionId: number | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  sourceWallet: WalletSummary | null;
  destinationWallet: WalletSummary | null;
  createdBy: AdminSummary | null;
  approvedBy: AdminSummary | null;
  rejectedBy: AdminSummary | null;
};

/* ============================================================
   HELPERS
   ============================================================ */

function formatAmount(amount: string, currency: string): string {
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

function formatDate(value?: string | null): string {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function adminName(admin: AdminSummary | null): string {
  if (!admin) return '—';

  return `${admin.firstName} ${admin.lastName} (${admin.email})`;
}

function statusClass(status: PaymentStatus): string {
  return `status-badge status-${status.toLowerCase()}`;
}

/* ============================================================
   PAGE
   ============================================================ */

export default function PaymentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [payment, setPayment] =
    useState<Payment | null>(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ==========================================================
     LOAD
     ========================================================== */

  const loadPayment = useCallback(async () => {
    if (!id || !/^\d+$/.test(id)) return;

    try {
      setLoading(true);
      setError(null);

      const result = await apiFetch<{ payment: Payment }>(
        `/admin/payments/${id}`,
      );

      setPayment(result.payment);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load payment',
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadPayment();
  }, [loadPayment]);

  /* ==========================================================
     ACTIONS
     ========================================================== */

  async function performAction(
    endpoint: string,
    options?: RequestInit,
  ) {
    try {
      setActionLoading(true);
      setError(null);

      await apiFetch(endpoint, options);
      await loadPayment();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to complete action',
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprove() {
    if (!id) return;

    await performAction(`/admin/payments/${id}/approve`, {
      method: 'POST',
    });
  }

  async function handleReject() {
    if (!id) return;

    const reason = window.prompt('Enter rejection reason:');

    if (reason === null) return;

    const trimmed = reason.trim();

    if (!trimmed) {
      setError('Rejection reason is required.');
      return;
    }

    await performAction(`/admin/payments/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: trimmed }),
    });
  }

  async function handleExecute() {
    if (!id) return;

    const confirmed = window.confirm(
      'Execute this payment? This will transfer funds and cannot be undone.',
    );

    if (!confirmed) return;

    await performAction(`/admin/payments/${id}/execute`, {
      method: 'POST',
    });
  }

  /* ==========================================================
     LOADING STATE
     ========================================================== */

  if (loading) {
    return (
      <main className="admin-page">
        <div className="compliance-detail-state">
          <RefreshCw size={30} className="compliance-spin" />
          <h2>Loading payment</h2>
          <p>Retrieving payment details...</p>
        </div>
      </main>
    );
  }

  /* ==========================================================
     ERROR STATE
     ========================================================== */

  if (error && !payment) {
    return (
      <main className="admin-page">
        <Link href="/admin/payments" className="compliance-back-link">
          <ArrowLeft size={17} />
          Back to Payments
        </Link>

        <div className="compliance-detail-state compliance-error-state">
          <XCircle size={32} />
          <h2>Unable to load payment</h2>
          <p>{error}</p>
          <button type="button" onClick={() => void loadPayment()}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!payment) return null;

  const isPending = payment.status === 'PENDING';
  const isApproved = payment.status === 'APPROVED';
  const isClosed =
    payment.status === 'COMPLETED' ||
    payment.status === 'REJECTED' ||
    payment.status === 'FAILED';

  /* ==========================================================
     MAIN RENDER
     ========================================================== */

  return (
    <main className="admin-page">
      {/* TOP BAR */}
      <div className="compliance-detail-topbar">
        <Link href="/admin/payments" className="compliance-back-link">
          <ArrowLeft size={17} />
          Back to Payments
        </Link>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void loadPayment()}
          disabled={actionLoading}
        >
          <RefreshCw
            size={15}
            className={actionLoading ? 'compliance-spin' : ''}
          />
          Refresh
        </button>
      </div>

      {/* ACTION ERROR */}
      {error && (
        <div className="alert alert-error" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}

      {/* HEADER */}
      <div className="page-header">
        <div>
          <p className="page-eyebrow">PAYMENT REQUEST</p>
          <h1>{payment.reference}</h1>
          <p className="page-description">
            {payment.description ?? 'No description provided.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className={statusClass(payment.status)}>
            {payment.status}
          </span>
        </div>
      </div>

      {/* ACTIONS */}
      {!isClosed && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {isPending && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleApprove}
                disabled={actionLoading}
              >
                <CheckCircle2 size={16} />
                Approve
              </button>

              <button
                type="button"
                className="btn btn-danger"
                onClick={handleReject}
                disabled={actionLoading}
              >
                <XCircle size={16} />
                Reject
              </button>
            </>
          )}

          {isApproved && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExecute}
              disabled={actionLoading}
            >
              <Clock3 size={16} />
              Execute Payment
            </button>
          )}
        </div>
      )}

      {/* DETAILS GRID */}
      <div className="compliance-detail-grid">

        {/* PAYMENT SUMMARY */}
        <section className="compliance-detail-card compliance-detail-description-card">
          <div className="compliance-detail-card-header">
            <div>
              <span className="compliance-section-eyebrow">SUMMARY</span>
              <h2>Payment Details</h2>
            </div>
          </div>

          <div className="compliance-detail-info-grid">
            <div>
              <span>Status</span>
              <strong>
                <span className={statusClass(payment.status)}>
                  {payment.status}
                </span>
              </strong>
            </div>

            <div>
              <span>Amount</span>
              <strong>{formatAmount(payment.amount, payment.currency)}</strong>
            </div>

            <div>
              <span>Currency</span>
              <strong>{payment.currency}</strong>
            </div>

            <div>
              <span>Transaction ID</span>
              <strong>{payment.transactionId ?? '—'}</strong>
            </div>

            <div>
              <span>Created</span>
              <strong>{formatDate(payment.createdAt)}</strong>
            </div>

            <div>
              <span>Last Updated</span>
              <strong>{formatDate(payment.updatedAt)}</strong>
            </div>
          </div>
        </section>

        {/* WALLETS */}
        <section className="compliance-detail-card">
          <div className="compliance-detail-card-header">
            <div>
              <span className="compliance-section-eyebrow">TRANSFER</span>
              <h2>Wallets</h2>
            </div>
          </div>

          <div className="compliance-detail-meta-list">
            <div>
              <span>Source Wallet</span>
              <strong>
                #{payment.sourceWalletId}
                {payment.sourceWallet && (
                  <span style={{ marginLeft: '0.5rem', fontWeight: 'normal', opacity: 0.7 }}>
                    {payment.sourceWallet.currency} · {payment.sourceWallet.status}
                  </span>
                )}
              </strong>
            </div>

            <div>
              <span>Destination Wallet</span>
              <strong>
                #{payment.destinationWalletId}
                {payment.destinationWallet && (
                  <span style={{ marginLeft: '0.5rem', fontWeight: 'normal', opacity: 0.7 }}>
                    {payment.destinationWallet.currency} · {payment.destinationWallet.status}
                  </span>
                )}
              </strong>
            </div>
          </div>
        </section>

        {/* ADMINS */}
        <section className="compliance-detail-card">
          <div className="compliance-detail-card-header">
            <div>
              <span className="compliance-section-eyebrow">APPROVAL CHAIN</span>
              <h2>Administrators</h2>
            </div>
          </div>

          <div className="compliance-detail-meta-list">
            <div>
              <span>Created By</span>
              <strong>{adminName(payment.createdBy)}</strong>
            </div>

            <div>
              <span>Approved By</span>
              <strong>
                {payment.approvedBy
                  ? `${adminName(payment.approvedBy)} at ${formatDate(payment.approvedAt)}`
                  : '—'}
              </strong>
            </div>

            <div>
              <span>Rejected By</span>
              <strong>
                {payment.rejectedBy
                  ? `${adminName(payment.rejectedBy)} at ${formatDate(payment.rejectedAt)}`
                  : '—'}
              </strong>
            </div>
          </div>
        </section>

        {/* REJECTION REASON */}
        {payment.status === 'REJECTED' && payment.rejectionReason && (
          <section className="compliance-detail-card compliance-escalation-card">
            <div className="compliance-detail-card-header">
              <div>
                <span className="compliance-section-eyebrow">OUTCOME</span>
                <h2>Rejection Reason</h2>
              </div>
              <XCircle size={21} />
            </div>

            <div className="compliance-resolution-box">
              <p>{payment.rejectionReason}</p>
            </div>
          </section>
        )}

        {/* COMPLETED */}
        {payment.status === 'COMPLETED' && (
          <section className="compliance-detail-card compliance-resolution-card">
            <div className="compliance-detail-card-header">
              <div>
                <span className="compliance-section-eyebrow">OUTCOME</span>
                <h2>Completed</h2>
              </div>
              <CheckCircle2 size={21} />
            </div>

            <div className="compliance-resolution-box">
              <span>Transaction ID</span>
              <p>{payment.transactionId ?? '—'}</p>
            </div>
          </section>
        )}
      </div>

      {/* FOOTER */}
      <div className="compliance-detail-footer">
        <Link href="/admin/payments" className="compliance-back-link">
          <ArrowLeft size={16} />
          Return to Payments
        </Link>

        <span>Payment ID #{payment.id}</span>
      </div>
    </main>
  );
}
