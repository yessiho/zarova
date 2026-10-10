'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Scale,
  XCircle,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

/* ============================================================
   TYPES
   ============================================================ */

type RunStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'FAILED';

interface ReconciliationEntry {
  id: number;
  transactionId: number;
  status: 'MATCHED' | 'UNMATCHED' | 'DISCREPANCY';
  transactionAmount: string;
  ledgerDebitTotal: string;
  ledgerCreditTotal: string;
  discrepancyAmount: string;
  currency: string;
  notes?: string | null;
}

interface ReconciliationRun {
  id: number;
  reference: string;
  status: RunStatus;
  type: string;
  periodStart: string;
  periodEnd: string;
  totalTransactions: number;
  matchedCount: number;
  unmatchedCount: number;
  discrepancyCount: number;
  totalDiscrepancyAmount: string;
  notes?: string | null;
  failureReason?: string | null;
  createdByAdminId: number;
  approvedByAdminId?: number | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  entries: ReconciliationEntry[];
}

/* ============================================================
   HELPERS
   ============================================================ */

function formatLabel(v?: string | null): string {
  if (!v) return '—';
  return v.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

function formatAmount(v?: string | number | null): string {
  if (!v || v === '0') return '₦0.00';
  const n = Number(v) / 100;
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(n);
}

function getStatusClass(s: string): string {
  return `recon-status recon-status-${s.toLowerCase().replaceAll('_', '-')}`;
}

function getEntryStatusClass(s: string): string {
  return `recon-entry-status recon-entry-status-${s.toLowerCase()}`;
}

function getMatchRate(run: ReconciliationRun): number {
  if (!run.totalTransactions) return 0;
  return Math.round((run.matchedCount / run.totalTransactions) * 100);
}

/* ============================================================
   PAGE
   ============================================================ */

export default function ReconciliationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';

  const [run, setRun] = useState<ReconciliationRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approveNotes, setApproveNotes] = useState('');
  const [showApprove, setShowApprove] = useState(false);
  const [entryFilter, setEntryFilter] = useState<'ALL' | 'MATCHED' | 'UNMATCHED' | 'DISCREPANCY'>('ALL');

  const loadRun = useCallback(async () => {
    if (!id || !/^\d+$/.test(id)) {
      router.replace('/admin/reconciliation');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await apiFetch<ReconciliationRun>(`/admin/reconciliation/runs/${id}`);
      setRun(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load run.');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { void loadRun(); }, [loadRun]);

  async function handleApprove(e: React.FormEvent) {
    e.preventDefault();
    try {
      setActionLoading(true);
      setActionError(null);
      await apiFetch(`/admin/reconciliation/runs/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ notes: approveNotes.trim() || undefined }),
      });
      setShowApprove(false);
      await loadRun();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Approval failed.');
    } finally {
      setActionLoading(false);
    }
  }

  /* ---- loading / error states ---- */

  if (loading) {
    return (
      <main className="compliance-page">
        <div className="compliance-detail-state">
          <RefreshCw size={32} className="compliance-spin" /><h3>Loading run…</h3>
        </div>
      </main>
    );
  }

  if (error || !run) {
    return (
      <main className="compliance-page">
        <div className="compliance-detail-state compliance-error-state">
          <XCircle size={34} /><h3>Unable to load run</h3>
          <p>{error ?? 'Run not found.'}</p>
          <Link href="/admin/reconciliation">Back to Reconciliation</Link>
        </div>
      </main>
    );
  }

  const matchRate = getMatchRate(run);
  const filteredEntries = run.entries.filter(
    (e) => entryFilter === 'ALL' || e.status === entryFilter,
  );

  return (
    <main className="compliance-page">
      {/* HEADER */}
      <div className="compliance-page-header">
        <div>
          <div className="compliance-breadcrumb">
            <span>Admin</span><span>/</span>
            <Link href="/admin/reconciliation">Reconciliation</Link>
            <span>/</span><span>{run.reference}</span>
          </div>
          <div className="compliance-title-row">
            <div className="compliance-title-icon"><Scale size={24} /></div>
            <div>
              <h1>{run.reference}</h1>
              <p>{formatLabel(run.type)} · {formatDate(run.periodStart)} → {formatDate(run.periodEnd)}</p>
            </div>
          </div>
        </div>
        <Link href="/admin/reconciliation" className="compliance-back-link">
          <ArrowLeft size={16} /> Back
        </Link>
      </div>

      {/* ACTION ERROR */}
      {actionError && (
        <div style={{ margin: '0 0 16px', padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <AlertTriangle size={15} />{actionError}
        </div>
      )}

      <div className="compliance-detail-grid">
        {/* LEFT */}
        <div>
          {/* Summary card */}
          <section className="compliance-content-card" style={{ marginBottom: '16px' }}>
            <div className="compliance-detail-section-header">
              <Scale size={17} /><h2>Run Summary</h2>
            </div>

            <dl className="compliance-detail-list">
              <div><dt>Reference</dt><dd>{run.reference}</dd></div>
              <div><dt>Status</dt><dd><span className={getStatusClass(run.status)}>{formatLabel(run.status)}</span></dd></div>
              <div><dt>Type</dt><dd>{formatLabel(run.type)}</dd></div>
              <div><dt>Period Start</dt><dd>{formatDate(run.periodStart)}</dd></div>
              <div><dt>Period End</dt><dd>{formatDate(run.periodEnd)}</dd></div>
              <div><dt>Created By</dt><dd>Admin #{run.createdByAdminId}</dd></div>
              <div><dt>Created At</dt><dd>{formatDate(run.createdAt)}</dd></div>
              {run.approvedByAdminId && (
                <>
                  <div><dt>Approved By</dt><dd>Admin #{run.approvedByAdminId}</dd></div>
                  <div><dt>Approved At</dt><dd>{formatDate(run.approvedAt)}</dd></div>
                </>
              )}
              {run.failureReason && (
                <div><dt>Failure Reason</dt><dd style={{ color: '#dc2626' }}>{run.failureReason}</dd></div>
              )}
              {run.notes && (
                <div><dt>Notes</dt><dd>{run.notes}</dd></div>
              )}
            </dl>
          </section>

          {/* Match breakdown */}
          {run.status !== 'PENDING' && run.status !== 'IN_PROGRESS' && (
            <section className="compliance-content-card" style={{ marginBottom: '16px' }}>
              <div className="compliance-detail-section-header">
                <CheckCircle2 size={17} /><h2>Results</h2>
              </div>

              <div style={{ padding: '20px 16px' }}>
                {/* Progress bar */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', color: '#64748b' }}>
                    <span>Match Rate</span>
                    <strong style={{ color: matchRate === 100 ? '#15803d' : matchRate >= 80 ? '#b45309' : '#dc2626' }}>
                      {matchRate}%
                    </strong>
                  </div>
                  <div style={{ height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${matchRate}%`, background: matchRate === 100 ? '#16a34a' : matchRate >= 80 ? '#ca8a04' : '#dc2626', borderRadius: '5px', transition: 'width 0.4s ease' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  {[
                    { label: 'Total', value: run.totalTransactions, color: '#2563eb' },
                    { label: 'Matched', value: run.matchedCount, color: '#15803d' },
                    { label: 'Unmatched', value: run.unmatchedCount, color: '#b45309' },
                    { label: 'Discrepancy', value: run.discrepancyCount, color: '#dc2626' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ textAlign: 'center', padding: '12px 8px', background: '#f8fafc', borderRadius: '8px' }}>
                      <div style={{ fontSize: '22px', fontWeight: 750, color }}>{value}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{label}</div>
                    </div>
                  ))}
                </div>

                {run.discrepancyCount > 0 && (
                  <div style={{ marginTop: '16px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={14} />
                    Total discrepancy: <strong>{formatAmount(run.totalDiscrepancyAmount)}</strong>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Entries table */}
          {run.entries.length > 0 && (
            <section className="compliance-content-card">
              <div className="compliance-detail-section-header">
                <Scale size={17} />
                <h2>Transaction Entries</h2>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                  {(['ALL', 'MATCHED', 'UNMATCHED', 'DISCREPANCY'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setEntryFilter(f)}
                      style={{
                        padding: '3px 10px',
                        borderRadius: '12px',
                        border: '1px solid',
                        fontSize: '11px',
                        fontWeight: 650,
                        cursor: 'pointer',
                        borderColor: entryFilter === f ? '#2563eb' : '#e2e8f0',
                        background: entryFilter === f ? '#eff6ff' : '#fff',
                        color: entryFilter === f ? '#2563eb' : '#64748b',
                      }}
                    >
                      {f === 'ALL' ? `All (${run.entries.length})` : `${formatLabel(f)} (${run.entries.filter((e) => e.status === f).length})`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="compliance-table-wrapper">
                <table className="compliance-table">
                  <thead>
                    <tr>
                      <th>Tx ID</th>
                      <th>Status</th>
                      <th>Tx Amount</th>
                      <th>Debit Total</th>
                      <th>Credit Total</th>
                      <th>Discrepancy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <Link href={`/admin/transactions/${entry.transactionId}`} style={{ color: '#2563eb', fontSize: '12px', fontFamily: 'monospace' }}>
                            #{entry.transactionId}
                          </Link>
                        </td>
                        <td><span className={getEntryStatusClass(entry.status)}>{formatLabel(entry.status)}</span></td>
                        <td style={{ fontSize: '12px', fontFamily: 'monospace' }}>{formatAmount(entry.transactionAmount)}</td>
                        <td style={{ fontSize: '12px', fontFamily: 'monospace' }}>{formatAmount(entry.ledgerDebitTotal)}</td>
                        <td style={{ fontSize: '12px', fontFamily: 'monospace' }}>{formatAmount(entry.ledgerCreditTotal)}</td>
                        <td style={{ fontSize: '12px', fontFamily: 'monospace', color: entry.discrepancyAmount !== '0' ? '#dc2626' : '#15803d' }}>
                          {entry.discrepancyAmount !== '0' ? formatAmount(entry.discrepancyAmount) : '—'}
                        </td>
                      </tr>
                    ))}
                    {filteredEntries.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '24px', fontSize: '13px' }}>
                          No entries match this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* RIGHT — actions */}
        <div>
          <section className="compliance-content-card">
            <div className="compliance-detail-section-header">
              <Scale size={17} /><h2>Actions</h2>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {run.status === 'COMPLETED' && (
                <>
                  <button
                    type="button"
                    className="compliance-action-success"
                    onClick={() => { setShowApprove((v) => !v); setActionError(null); }}
                    disabled={actionLoading}
                  >
                    <CheckCircle2 size={15} /> Approve Run
                  </button>

                  {showApprove && (
                    <form onSubmit={(e) => void handleApprove(e)} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#15803d' }}>Approval Notes (optional)</label>
                      <textarea
                        rows={3}
                        value={approveNotes}
                        onChange={(e) => setApproveNotes(e.target.value)}
                        placeholder="Any notes for this approval..."
                        disabled={actionLoading}
                        style={{ resize: 'vertical', padding: '8px', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '13px' }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="submit" className="compliance-action-success" disabled={actionLoading} style={{ flex: 1 }}>
                          {actionLoading ? 'Approving…' : 'Confirm Approval'}
                        </button>
                        <button type="button" className="compliance-refresh-button" onClick={() => setShowApprove(false)} disabled={actionLoading}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}

              {run.status === 'APPROVED' && (
                <div style={{ textAlign: 'center', padding: '12px', background: '#f0fdf4', borderRadius: '8px', color: '#15803d', fontSize: '13px', fontWeight: 650 }}>
                  <CheckCircle2 size={16} style={{ display: 'inline', marginRight: '6px' }} />
                  Approved by Admin #{run.approvedByAdminId}
                </div>
              )}

              {(run.status === 'PENDING' || run.status === 'IN_PROGRESS') && (
                <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center' }}>Run is in progress…</p>
              )}

              {run.status === 'FAILED' && (
                <p style={{ fontSize: '13px', color: '#dc2626', textAlign: 'center' }}>This run failed and cannot be approved.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
