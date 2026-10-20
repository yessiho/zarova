'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Landmark,
  Printer,
  Share2,
  XCircle,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

/* ============================================================ TYPES */

interface TransactionDetail {
  id: number;
  reference: string;
  amount: string;
  currency: string;
  type?: string;
  _type?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  sourceWalletId?: number | null;
  destinationWalletId?: number | null;
  sourceWallet?: {
    id: number;
    currency: string;
    account?: { accountName: string; accountNumber: string; bankName: string } | null;
  } | null;
  destinationWallet?: {
    id: number;
    currency: string;
    account?: { accountName: string; accountNumber: string; bankName: string } | null;
  } | null;
}

/* ============================================================ HELPERS */

function fmt(amount: string | number, currency: string) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(amount));
}

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-NG', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    }).format(new Date(iso));
  } catch { return iso; }
}

function txType(tx: TransactionDetail): string { return tx.type ?? tx._type ?? 'TRANSACTION'; }

function statusMeta(status: string): { icon: React.ElementType; label: string; cls: string } {
  switch (status.toUpperCase()) {
    case 'COMPLETED': return { icon: CheckCircle2, label: 'Successful',  cls: 'receipt-status-success' };
    case 'PENDING':   return { icon: Clock,        label: 'Pending',     cls: 'receipt-status-pending' };
    case 'FAILED':    return { icon: XCircle,      label: 'Failed',      cls: 'receipt-status-failed'  };
    case 'REVERSED':  return { icon: ArrowLeft,    label: 'Reversed',    cls: 'receipt-status-reversed'};
    default:          return { icon: Clock,        label: status,        cls: 'receipt-status-default' };
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

/* ============================================================ PAGE */

export default function ReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [tx,      setTx]      = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [copied,  setCopied]  = useState(false);

  useEffect(() => {
    apiFetch<TransactionDetail>(`/transactions/${id}`)
      .then(setTx)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Transaction not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCopy = () => {
    if (!tx) return;
    copyToClipboard(tx.reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <main className="receipt-page">
      <div className="receipt-loading">
        <div className="receipt-loader" />
        <p>Loading receipt…</p>
      </div>
    </main>
  );

  if (error || !tx) return (
    <main className="receipt-page">
      <div className="receipt-error">
        <XCircle size={36} />
        <h2>Transaction not found</h2>
        <p>{error}</p>
        <button type="button" onClick={() => router.push('/transactions')}>
          <ArrowLeft size={16} /> Back to Transactions
        </button>
      </div>
    </main>
  );

  const type   = txType(tx);
  const status = statusMeta(tx.status);
  const StatusIcon = status.icon;
  const isCredit = type === 'DEPOSIT';

  return (
    <main className="receipt-page">

      {/* ── Back bar ── */}
      <div className="receipt-topbar no-print">
        <button type="button" className="receipt-back-btn" onClick={() => router.push('/transactions')}>
          <ArrowLeft size={17} /> Transactions
        </button>
        <div className="receipt-topbar-actions">
          <button type="button" className="receipt-action-btn" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </button>
          <button type="button" className="receipt-action-btn" onClick={() => window.print()}>
            <Download size={16} /> Save
          </button>
          <button type="button" className="receipt-action-btn" onClick={() => copyToClipboard(window.location.href)}>
            <Share2 size={16} /> Share
          </button>
        </div>
      </div>

      {/* ── Receipt card ── */}
      <div className="receipt-card" id="receipt-printable">

        {/* Header */}
        <div className="receipt-header">
          <div className="receipt-brand">
            <Landmark size={22} />
            <span>Zarova</span>
          </div>
          <p className="receipt-doc-label">TRANSACTION RECEIPT</p>
        </div>

        {/* Status hero */}
        <div className={`receipt-status-hero ${status.cls}`}>
          <StatusIcon size={38} />
          <h2>{status.label}</h2>
          <div className="receipt-amount-hero">
            <span>{isCredit ? '+' : '-'}</span>
            <strong>{fmt(tx.amount, tx.currency)}</strong>
          </div>
          <p className="receipt-type-label">
            {isCredit ? <><ArrowDownLeft size={14} /> Received</> : type === 'WITHDRAWAL' ? <><ArrowUpRight size={14} /> Sent</> : <><ArrowRight size={14} /> Transferred</>}
          </p>
        </div>

        {/* Divider + details */}
        <div className="receipt-divider"><span>Transaction Details</span></div>

        <div className="receipt-rows">
          <div className="receipt-row">
            <span>Reference</span>
            <div className="receipt-ref-row">
              <strong>{tx.reference}</strong>
              <button type="button" className="receipt-copy-btn no-print" onClick={handleCopy} title="Copy reference">
                {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <div className="receipt-row">
            <span>Date & Time</span>
            <strong>{fmtDate(tx.createdAt)}</strong>
          </div>

          <div className="receipt-row">
            <span>Type</span>
            <strong>{type.charAt(0) + type.slice(1).toLowerCase()}</strong>
          </div>

          <div className="receipt-row">
            <span>Status</span>
            <span className={`receipt-status-badge ${status.cls}`}>{status.label}</span>
          </div>

          <div className="receipt-row">
            <span>Amount</span>
            <strong>{fmt(tx.amount, tx.currency)}</strong>
          </div>

          <div className="receipt-row">
            <span>Currency</span>
            <strong>{tx.currency}</strong>
          </div>

          {tx.sourceWallet && (
            <>
              <div className="receipt-divider small"><span>Sender</span></div>
              {tx.sourceWallet.account && (
                <>
                  <div className="receipt-row"><span>Name</span><strong>{tx.sourceWallet.account.accountName}</strong></div>
                  <div className="receipt-row"><span>Account</span><strong>{tx.sourceWallet.account.accountNumber}</strong></div>
                  <div className="receipt-row"><span>Bank</span><strong>{tx.sourceWallet.account.bankName}</strong></div>
                </>
              )}
            </>
          )}

          {tx.destinationWallet && (
            <>
              <div className="receipt-divider small"><span>Recipient</span></div>
              {tx.destinationWallet.account && (
                <>
                  <div className="receipt-row"><span>Name</span><strong>{tx.destinationWallet.account.accountName}</strong></div>
                  <div className="receipt-row"><span>Account</span><strong>{tx.destinationWallet.account.accountNumber}</strong></div>
                  <div className="receipt-row"><span>Bank</span><strong>{tx.destinationWallet.account.bankName}</strong></div>
                </>
              )}
            </>
          )}

          <div className="receipt-row">
            <span>Transaction Fee</span>
            <strong className="receipt-free">Free</strong>
          </div>
        </div>

        {/* Footer */}
        <div className="receipt-footer">
          <p>This is an electronically generated receipt.</p>
          <p>Zarova Financial Management Platform · <span className="receipt-footer-ref">{tx.reference}</span></p>
        </div>

      </div>

      {/* ── Actions ── */}
      <div className="receipt-bottom-actions no-print">
        <button type="button" className="receipt-outline-btn" onClick={() => router.push('/transactions')}>
          <ArrowLeft size={16} /> All Transactions
        </button>
        <button type="button" className="receipt-primary-btn" onClick={() => router.push('/send')}>
          Send Money <ArrowRight size={16} />
        </button>
      </div>

    </main>
  );
}
