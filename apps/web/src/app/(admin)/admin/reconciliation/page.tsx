'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Plus,
  RefreshCw,
  Scale,
  X,
  XCircle,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

/* ============================================================
   TYPES
   ============================================================ */

type RunStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'APPROVED'
  | 'FAILED';

type RunType = 'MANUAL' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

interface ReconciliationRun {
  id: number;
  reference: string;
  status: RunStatus;
  type: RunType | string;
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
}

interface Statistics {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  approved: number;
  failed: number;
}

interface RunsResponse {
  data: ReconciliationRun[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  statistics: Statistics;
}

/* ============================================================
   CONSTANTS
   ============================================================ */

const STATUS_OPTIONS = [
  'ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'FAILED',
] as const;

const TYPE_OPTIONS = [
  'ALL', 'MANUAL', 'DAILY', 'WEEKLY', 'MONTHLY',
] as const;

const RUN_TYPES = TYPE_OPTIONS.slice(1) as readonly string[];

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

function formatDateInput(v?: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 16);
}

function formatAmount(v?: string | number | null): string {
  if (!v || v === '0') return '₦0.00';
  const n = Number(v) / 100;
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(n);
}

function getStatusClass(s: RunStatus | string): string {
  return `recon-status recon-status-${s.toLowerCase().replaceAll('_', '-')}`;
}

function getMatchRate(run: ReconciliationRun): number {
  if (!run.totalTransactions) return 0;
  return Math.round((run.matchedCount / run.totalTransactions) * 100);
}

/* ============================================================
   PAGE
   ============================================================ */

export default function ReconciliationPage() {
  const [data, setData] = useState<RunsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('ALL');
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]>('ALL');
  const [page, setPage] = useState(1);
  const limit = 20;

  /* New Run modal */
  const [showModal, setShowModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: 'MANUAL' as string,
    periodStart: '',
    periodEnd: '',
    notes: '',
  });

  function openModal() {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    setForm({
      type: 'MANUAL',
      periodStart: formatDateInput(dayAgo.toISOString()),
      periodEnd: formatDateInput(now.toISOString()),
      notes: '',
    });
    setFormError(null);
    setShowModal(true);
  }

  async function handleCreateRun(e: React.FormEvent) {
    e.preventDefault();
    if (!form.periodStart || !form.periodEnd) {
      setFormError('Period start and end are required.');
      return;
    }
    if (new Date(form.periodStart) >= new Date(form.periodEnd)) {
      setFormError('Period start must be before period end.');
      return;
    }
    try {
      setFormLoading(true);
      setFormError(null);
      const body: Record<string, unknown> = {
        type: form.type,
        periodStart: new Date(form.periodStart).toISOString(),
        periodEnd: new Date(form.periodEnd).toISOString(),
      };
      if (form.notes.trim()) body.notes = form.notes.trim();

      await apiFetch('/admin/reconciliation/runs', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setShowModal(false);
      await loadRuns();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to run reconciliation.');
    } finally {
      setFormLoading(false);
    }
  }

  const loadRuns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (status !== 'ALL') params.set('status', status);
      if (type !== 'ALL') params.set('type', type);
      params.set('page', String(page));
      params.set('limit', String(limit));

      const result = await apiFetch<RunsResponse>(
        `/admin/reconciliation/runs?${params.toString()}`,
      );
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load runs.');
    } finally {
      setLoading(false);
    }
  }, [page, status, type]);

  useEffect(() => { void loadRuns(); }, [loadRuns]);

  const runs = useMemo(() => data?.data ?? [], [data]);
  const stats = data?.statistics ?? { total: 0, pending: 0, inProgress: 0, completed: 0, approved: 0, failed: 0 };
  const pagination = data?.pagination ?? { page: 1, limit, total: 0, totalPages: 0 };

  return (
    <main className="compliance-page">
      {/* HEADER */}
      <div className="compliance-page-header">
        <div>
          <div className="compliance-breadcrumb">
            <span>Admin</span><span>/</span><span>Reconciliation</span>
          </div>
          <div className="compliance-title-row">
            <div className="compliance-title-icon"><Scale size={24} /></div>
            <div>
              <h1>Reconciliation</h1>
              <p>Verify that ledger entries balance against completed transactions.</p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="compliance-refresh-button" onClick={openModal}>
            <Plus size={17} /> New Run
          </button>
          <button
            type="button"
            className="compliance-refresh-button"
            onClick={() => void loadRuns()}
            disabled={loading}
          >
            <RefreshCw size={17} className={loading ? 'compliance-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* STATS */}
      <section className="compliance-stat-grid">
        <div className="compliance-stat-card">
          <div className="compliance-stat-icon compliance-stat-icon-blue"><Scale size={20} /></div>
          <div><span>Total Runs</span><strong>{stats.total}</strong></div>
        </div>
        <div className="compliance-stat-card">
          <div className="compliance-stat-icon compliance-stat-icon-amber"><Clock3 size={20} /></div>
          <div><span>Pending</span><strong>{stats.pending + stats.inProgress}</strong></div>
        </div>
        <div className="compliance-stat-card">
          <div className="compliance-stat-icon compliance-stat-icon-purple"><RefreshCw size={20} /></div>
          <div><span>Completed</span><strong>{stats.completed}</strong></div>
        </div>
        <div className="compliance-stat-card">
          <div className="compliance-stat-icon compliance-stat-icon-green"><CheckCircle2 size={20} /></div>
          <div><span>Approved</span><strong>{stats.approved}</strong></div>
        </div>
        <div className="compliance-stat-card">
          <div className="compliance-stat-icon compliance-stat-icon-red"><XCircle size={20} /></div>
          <div><span>Failed</span><strong>{stats.failed}</strong></div>
        </div>
      </section>

      {/* TABLE */}
      <section className="compliance-content-card">
        <div className="compliance-toolbar">
          <div style={{ flex: 1 }} />
          <div className="compliance-filters">
            <select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o} value={o}>{o === 'ALL' ? 'All statuses' : formatLabel(o)}</option>
              ))}
            </select>
            <select value={type} onChange={(e) => { setType(e.target.value as typeof type); setPage(1); }}>
              {TYPE_OPTIONS.map((o) => (
                <option key={o} value={o}>{o === 'ALL' ? 'All types' : formatLabel(o)}</option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <div className="compliance-state compliance-error-state">
            <XCircle size={30} /><h3>Unable to load runs</h3><p>{error}</p>
            <button type="button" onClick={() => void loadRuns()}>Try again</button>
          </div>
        ) : loading ? (
          <div className="compliance-state">
            <RefreshCw size={30} className="compliance-spin" />
            <h3>Loading reconciliation runs</h3>
          </div>
        ) : runs.length === 0 ? (
          <div className="compliance-state">
            <Scale size={34} /><h3>No reconciliation runs found</h3>
            <p>Click "New Run" to start your first reconciliation.</p>
          </div>
        ) : (
          <>
            <div className="compliance-table-wrapper">
              <table className="compliance-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Type</th>
                    <th>Period</th>
                    <th>Transactions</th>
                    <th>Match Rate</th>
                    <th>Discrepancy</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id}>
                      <td>
                        <div className="compliance-case-cell">
                          <strong>{run.reference}</strong>
                        </div>
                      </td>
                      <td><span className="compliance-type">{formatLabel(run.type)}</span></td>
                      <td>
                        <span className="compliance-date">
                          {formatDate(run.periodStart)} → {formatDate(run.periodEnd)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>{run.totalTransactions}</td>
                      <td>
                        {run.totalTransactions > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', minWidth: '60px' }}>
                              <div
                                style={{
                                  height: '100%',
                                  borderRadius: '3px',
                                  width: `${getMatchRate(run)}%`,
                                  background: getMatchRate(run) === 100 ? '#16a34a' : getMatchRate(run) >= 80 ? '#ca8a04' : '#dc2626',
                                }}
                              />
                            </div>
                            <span style={{ fontSize: '12px', color: '#475569', whiteSpace: 'nowrap' }}>
                              {getMatchRate(run)}%
                            </span>
                          </div>
                        ) : '—'}
                      </td>
                      <td>
                        {run.discrepancyCount > 0 ? (
                          <span style={{ color: '#dc2626', fontSize: '12px', fontWeight: 650 }}>
                            {run.discrepancyCount} ({formatAmount(run.totalDiscrepancyAmount)})
                          </span>
                        ) : (
                          <span style={{ color: '#15803d', fontSize: '12px' }}>None</span>
                        )}
                      </td>
                      <td>
                        <span className={getStatusClass(run.status)}>{formatLabel(run.status)}</span>
                      </td>
                      <td><span className="compliance-date">{formatDate(run.createdAt)}</span></td>
                      <td>
                        <Link href={`/admin/reconciliation/${run.id}`} className="compliance-view-link">
                          View <ArrowRight size={15} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="compliance-pagination">
              <span>Showing {runs.length} of {pagination.total} runs</span>
              <div>
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
                <span>Page {page} of {Math.max(1, pagination.totalPages)}</span>
                <button type="button" disabled={page >= Math.max(1, pagination.totalPages)} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* NEW RUN MODAL */}
      {showModal && (
        <div className="compliance-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="compliance-modal" onClick={(e) => e.stopPropagation()}>
            <div className="compliance-modal-header">
              <h2>New Reconciliation Run</h2>
              <button type="button" className="compliance-modal-close" onClick={() => setShowModal(false)} disabled={formLoading}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateRun(e)}>
              {formError && (
                <div className="compliance-modal-error">
                  <AlertTriangle size={15} />{formError}
                </div>
              )}

              <div className="compliance-modal-field">
                <label htmlFor="run-type">Run Type</label>
                <select
                  id="run-type"
                  value={form.type}
                  onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                  disabled={formLoading}
                >
                  {RUN_TYPES.map((t) => (
                    <option key={t} value={t}>{formatLabel(t)}</option>
                  ))}
                </select>
              </div>

              <div className="compliance-modal-field">
                <label htmlFor="period-start">Period Start</label>
                <input
                  id="period-start"
                  type="datetime-local"
                  value={form.periodStart}
                  onChange={(e) => setForm((p) => ({ ...p, periodStart: e.target.value }))}
                  disabled={formLoading}
                />
              </div>

              <div className="compliance-modal-field">
                <label htmlFor="period-end">Period End</label>
                <input
                  id="period-end"
                  type="datetime-local"
                  value={form.periodEnd}
                  onChange={(e) => setForm((p) => ({ ...p, periodEnd: e.target.value }))}
                  disabled={formLoading}
                />
              </div>

              <div className="compliance-modal-field">
                <label htmlFor="run-notes">
                  Notes <span className="compliance-modal-optional">(optional)</span>
                </label>
                <textarea
                  id="run-notes"
                  rows={3}
                  maxLength={5000}
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Any notes about this reconciliation run..."
                  disabled={formLoading}
                />
              </div>

              <div className="compliance-modal-actions">
                <button type="button" className="compliance-refresh-button" onClick={() => setShowModal(false)} disabled={formLoading}>
                  Cancel
                </button>
                <button type="submit" className="compliance-action-success" disabled={formLoading}>
                  {formLoading ? 'Running…' : 'Run Reconciliation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
