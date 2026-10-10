'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  Scale,
  Shield,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
  Zap,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

/* ============================================================
   TYPES
   ============================================================ */

interface ReportSummary {
  transactions: {
    total: number;
    byStatus: { pending: number; processing: number; completed: number; failed: number; reversed: number };
    byType: { deposit: number; withdrawal: number; transfer: number };
    completedVolume: string;
  };
  payments: {
    total: number;
    byStatus: { pending: number; approved: number; rejected: number; processing: number; completed: number; failed: number };
    completedVolume: string;
  };
  wallets: {
    total: number;
    byStatus: { active: number; frozen: number; closed: number };
    byCurrency: { ngn: number; usd: number; eur: number; gbp: number };
  };
  users: {
    total: number;
    byStatus: { active: number; suspended: number; deactivated: number };
  };
  compliance: {
    total: number;
    byStatus: { open: number; underReview: number; escalated: number; resolved: number; dismissed: number };
    byPriority: { critical: number; high: number; medium: number; low: number };
  };
  risk: {
    total: number;
    byStatus: { open: number; underReview: number; flagged: number; released: number; falsePositive: number };
    bySeverity: { critical: number; high: number; medium: number; low: number };
  };
  reconciliation: {
    total: number;
    byStatus: { pending: number; inProgress: number; completed: number; approved: number; failed: number };
    overallMatchRate: number;
    totalDiscrepancy: string;
  };
  activity: { totalAuditLogs: number };
}

/* ============================================================
   HELPERS
   ============================================================ */

function fmt(v: string | number | null | undefined): string {
  if (!v || v === '0') return '₦0.00';
  const n = Number(v) / 100;
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(n);
}

function pct(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function num(n: number): string {
  return n.toLocaleString('en-NG');
}

/* ============================================================
   BreakdownBar
   ============================================================ */

function BreakdownBar({
  items,
  delay = 0,
}: {
  items: { label: string; value: number; color: string }[];
  delay?: number;
}) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return <p className="rpt-no-data">No data available</p>;

  return (
    <div>
      <div className="rpt-bar-track">
        {items.map((item, idx) =>
          item.value > 0 ? (
            <div
              key={item.label}
              className="rpt-bar-seg"
              style={{
                flex: item.value,
                background: item.color,
                animationDelay: `${delay + idx * 60}ms`,
              }}
              title={`${item.label}: ${item.value}`}
            />
          ) : null,
        )}
      </div>
      <div className="rpt-legend">
        {items.map((item) => (
          <div key={item.label} className="rpt-legend-item">
            <div className="rpt-legend-dot" style={{ background: item.color }} />
            <span>
              {item.label}:{' '}
              <strong>{num(item.value)}</strong>
              <span className="rpt-legend-pct"> ({pct(item.value, total)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   RingChart — pure SVG donut
   ============================================================ */

function RingChart({
  percent,
  color,
  label,
}: {
  percent: number;
  color: string;
  label: string;
}) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(percent, 100) / 100) * circ;

  return (
    <div className="rpt-ring">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle className="rpt-ring-bg" cx="48" cy="48" r={r} />
        <circle
          className="rpt-ring-fg"
          cx="48"
          cy="48"
          r={r}
          stroke={color}
          strokeDasharray={`${dash} ${circ}`}
          strokeDashoffset="0"
        />
      </svg>
      <div className="rpt-ring-center">
        <span className="rpt-ring-pct">{percent}%</span>
        <span className="rpt-ring-lbl">{label}</span>
      </div>
    </div>
  );
}

/* ============================================================
   PAGE
   ============================================================ */

export default function ReportsPage() {
  const [data, setData] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const result = await apiFetch<ReportSummary>('/admin/reports/summary');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load report.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* derived health signals */
  const matchRate = data?.reconciliation.overallMatchRate ?? 0;
  const matchColor = matchRate >= 95 ? '#16a34a' : matchRate >= 80 ? '#ca8a04' : '#dc2626';
  const matchBadge = matchRate >= 95 ? 'good' : matchRate >= 80 ? 'warn' : 'alert';

  const openRisk = data
    ? data.risk.byStatus.open + data.risk.byStatus.underReview + data.risk.byStatus.flagged
    : 0;
  const openCompliance = data
    ? data.compliance.byStatus.open + data.compliance.byStatus.underReview + data.compliance.byStatus.escalated
    : 0;

  return (
    <main className="rpt-page">

      {/* ======================================================
          HERO
      ====================================================== */}

      <div className="rpt-hero">
        <div className="rpt-hero-top">
          <div>
            <div className="rpt-hero-eyebrow">
              <span />
              Platform Analytics
            </div>
            <h1>Financial Overview</h1>
            <p className="rpt-hero-sub">
              Real-time platform-wide metrics across all modules
            </p>
          </div>

          <div className="rpt-hero-actions">
            <button
              type="button"
              className="rpt-btn-refresh"
              onClick={() => void load(true)}
              disabled={loading || refreshing}
            >
              <RefreshCw
                size={16}
                className={refreshing ? 'spin' : ''}
              />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {data && (
          <div className="rpt-hero-scores">
            <div className="rpt-score-pill">
              <div className="rpt-score-label">Total Transactions</div>
              <div className="rpt-score-value">{num(data.transactions.total)}</div>
              <div className="rpt-score-sub">{num(data.transactions.byStatus.completed)} completed</div>
              <div className={`rpt-score-badge ${pct(data.transactions.byStatus.completed, data.transactions.total) >= 80 ? 'good' : 'warn'}`}>
                {pct(data.transactions.byStatus.completed, data.transactions.total)}% success rate
              </div>
            </div>

            <div className="rpt-score-pill">
              <div className="rpt-score-label">Completed Volume</div>
              <div className="rpt-score-value" style={{ fontSize: '18px' }}>
                {fmt(data.transactions.completedVolume)}
              </div>
              <div className="rpt-score-sub">across completed transactions</div>
              <div className="rpt-score-badge good">
                <CheckCircle2 size={10} /> Settled
              </div>
            </div>

            <div className="rpt-score-pill">
              <div className="rpt-score-label">Reconciliation</div>
              <div className="rpt-score-value">{matchRate}%</div>
              <div className="rpt-score-sub">overall match rate</div>
              <div className={`rpt-score-badge ${matchBadge}`}>
                {matchRate >= 95 ? 'Excellent' : matchRate >= 80 ? 'Needs attention' : 'Critical'}
              </div>
            </div>

            <div className="rpt-score-pill">
              <div className="rpt-score-label">Active Users</div>
              <div className="rpt-score-value">{num(data.users.byStatus.active)}</div>
              <div className="rpt-score-sub">{num(data.users.total)} registered total</div>
              <div className="rpt-score-badge info">
                {pct(data.users.byStatus.active, data.users.total)}% active
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ERROR */}
      {error && (
        <div className="rpt-error">
          <XCircle size={22} />
          <p>{error}</p>
          <button type="button" onClick={() => void load()}>Try again</button>
        </div>
      )}

      {/* LOADING */}
      {loading && !data && (
        <div className="rpt-loading">
          <div className="rpt-loading-ring" />
          <p>Loading platform data…</p>
        </div>
      )}

      {data && (
        <>

          {/* ====================================================
              KPI STRIP
          ==================================================== */}

          <div className="rpt-kpi-grid">

            <Link href="/admin/transactions" className="rpt-kpi">
              <div className="rpt-kpi-top">
                <div className="rpt-kpi-icon blue"><TrendingUp size={18} /></div>
                <ArrowRight size={14} className="rpt-kpi-arrow" />
              </div>
              <div className="rpt-kpi-value">{num(data.transactions.total)}</div>
              <div className="rpt-kpi-label">Total Transactions</div>
              <div className="rpt-kpi-sub">{num(data.transactions.byStatus.completed)} completed</div>
            </Link>

            <div className="rpt-kpi">
              <div className="rpt-kpi-top">
                <div className="rpt-kpi-icon green"><CreditCard size={18} /></div>
              </div>
              <div className="rpt-kpi-value" style={{ fontSize: '16px' }}>
                {fmt(data.transactions.completedVolume)}
              </div>
              <div className="rpt-kpi-label">Settled Volume</div>
              <div className="rpt-kpi-sub">from transactions</div>
            </div>

            <Link href="/admin/accounts" className="rpt-kpi">
              <div className="rpt-kpi-top">
                <div className="rpt-kpi-icon purple"><Wallet size={18} /></div>
                <ArrowRight size={14} className="rpt-kpi-arrow" />
              </div>
              <div className="rpt-kpi-value">{num(data.wallets.byStatus.active)}</div>
              <div className="rpt-kpi-label">Active Wallets</div>
              <div className="rpt-kpi-sub">{num(data.wallets.total)} total</div>
            </Link>

            <Link href="/admin/customers" className="rpt-kpi">
              <div className="rpt-kpi-top">
                <div className="rpt-kpi-icon teal"><Users size={18} /></div>
                <ArrowRight size={14} className="rpt-kpi-arrow" />
              </div>
              <div className="rpt-kpi-value">{num(data.users.byStatus.active)}</div>
              <div className="rpt-kpi-label">Active Users</div>
              <div className="rpt-kpi-sub">{num(data.users.total)} total</div>
            </Link>

            <Link href="/admin/compliance" className="rpt-kpi">
              <div className="rpt-kpi-top">
                <div className="rpt-kpi-icon amber"><Shield size={18} /></div>
                <ArrowRight size={14} className="rpt-kpi-arrow" />
              </div>
              <div className="rpt-kpi-value">{num(openCompliance)}</div>
              <div className="rpt-kpi-label">Open Compliance</div>
              <div className="rpt-kpi-sub">{num(data.compliance.total)} total cases</div>
            </Link>

            <Link href="/admin/risk" className="rpt-kpi">
              <div className="rpt-kpi-top">
                <div className="rpt-kpi-icon red"><AlertTriangle size={18} /></div>
                <ArrowRight size={14} className="rpt-kpi-arrow" />
              </div>
              <div className="rpt-kpi-value">{num(openRisk)}</div>
              <div className="rpt-kpi-label">Open Risk Alerts</div>
              <div className="rpt-kpi-sub">{num(data.risk.total)} total alerts</div>
            </Link>

          </div>

          {/* ====================================================
              ROW 1 — Transactions + Payments
          ==================================================== */}

          <div className="rpt-main-grid">

            {/* TRANSACTIONS */}
            <div className="rpt-card">
              <div className="rpt-card-header">
                <div className="rpt-card-title">
                  <div className="rpt-card-icon blue"><TrendingUp size={17} /></div>
                  <h3>Transactions</h3>
                </div>
                <Link href="/admin/transactions" className="rpt-view-link">
                  View all <ArrowRight size={13} />
                </Link>
              </div>

              <div className="rpt-stat-row">
                <div className="rpt-stat-mini">
                  <div className="rpt-stat-mini-label">Total</div>
                  <div className="rpt-stat-mini-value">{num(data.transactions.total)}</div>
                </div>
                <div className="rpt-stat-mini">
                  <div className="rpt-stat-mini-label">Completed</div>
                  <div className="rpt-stat-mini-value" style={{ color: '#16a34a' }}>
                    {num(data.transactions.byStatus.completed)}
                  </div>
                </div>
                <div className="rpt-stat-mini">
                  <div className="rpt-stat-mini-label">Failed</div>
                  <div className="rpt-stat-mini-value" style={{ color: '#dc2626' }}>
                    {num(data.transactions.byStatus.failed)}
                  </div>
                </div>
              </div>

              <div className="rpt-section-label">By Status</div>
              <BreakdownBar
                delay={0}
                items={[
                  { label: 'Completed',  value: data.transactions.byStatus.completed,  color: '#16a34a' },
                  { label: 'Pending',    value: data.transactions.byStatus.pending,    color: '#ca8a04' },
                  { label: 'Processing', value: data.transactions.byStatus.processing, color: '#2563eb' },
                  { label: 'Failed',     value: data.transactions.byStatus.failed,     color: '#dc2626' },
                  { label: 'Reversed',   value: data.transactions.byStatus.reversed,   color: '#7c3aed' },
                ]}
              />

              <div className="rpt-divider" />

              <div className="rpt-section-label">By Type</div>
              <BreakdownBar
                delay={100}
                items={[
                  { label: 'Deposit',    value: data.transactions.byType.deposit,    color: '#0ea5e9' },
                  { label: 'Withdrawal', value: data.transactions.byType.withdrawal, color: '#f97316' },
                  { label: 'Transfer',   value: data.transactions.byType.transfer,   color: '#8b5cf6' },
                ]}
              />
            </div>

            {/* PAYMENTS */}
            <div className="rpt-card">
              <div className="rpt-card-header">
                <div className="rpt-card-title">
                  <div className="rpt-card-icon green"><CreditCard size={17} /></div>
                  <h3>Payments</h3>
                </div>
                <Link href="/admin/payments" className="rpt-view-link">
                  View all <ArrowRight size={13} />
                </Link>
              </div>

              <div className="rpt-volume-box">
                <div className="rpt-volume-tag">Completed payment volume</div>
                <div className="rpt-volume-amount">{fmt(data.payments.completedVolume)}</div>
              </div>

              <div className="rpt-stat-row">
                <div className="rpt-stat-mini">
                  <div className="rpt-stat-mini-label">Total</div>
                  <div className="rpt-stat-mini-value">{num(data.payments.total)}</div>
                </div>
                <div className="rpt-stat-mini">
                  <div className="rpt-stat-mini-label">Completed</div>
                  <div className="rpt-stat-mini-value" style={{ color: '#16a34a' }}>
                    {num(data.payments.byStatus.completed)}
                  </div>
                </div>
                <div className="rpt-stat-mini">
                  <div className="rpt-stat-mini-label">Rejected</div>
                  <div className="rpt-stat-mini-value" style={{ color: '#dc2626' }}>
                    {num(data.payments.byStatus.rejected)}
                  </div>
                </div>
              </div>

              <div className="rpt-section-label">By Status</div>
              <BreakdownBar
                delay={80}
                items={[
                  { label: 'Completed',  value: data.payments.byStatus.completed,  color: '#16a34a' },
                  { label: 'Approved',   value: data.payments.byStatus.approved,   color: '#2563eb' },
                  { label: 'Processing', value: data.payments.byStatus.processing, color: '#0ea5e9' },
                  { label: 'Pending',    value: data.payments.byStatus.pending,    color: '#ca8a04' },
                  { label: 'Rejected',   value: data.payments.byStatus.rejected,   color: '#dc2626' },
                  { label: 'Failed',     value: data.payments.byStatus.failed,     color: '#9f1239' },
                ]}
              />
            </div>

          </div>

          {/* ====================================================
              ROW 2 — Risk + Compliance
          ==================================================== */}

          <div className="rpt-main-grid">

            {/* RISK */}
            <div className="rpt-card">
              <div className="rpt-card-header">
                <div className="rpt-card-title">
                  <div className="rpt-card-icon red"><AlertTriangle size={17} /></div>
                  <h3>Risk Alerts</h3>
                </div>
                <Link href="/admin/risk" className="rpt-view-link">
                  View all <ArrowRight size={13} />
                </Link>
              </div>

              <div className="rpt-section-label">By Severity</div>
              <div className="rpt-severity-grid">
                <div className="rpt-severity-pill critical">
                  <div className="rpt-severity-pill-val">{data.risk.bySeverity.critical}</div>
                  <div className="rpt-severity-pill-label">Critical</div>
                </div>
                <div className="rpt-severity-pill high">
                  <div className="rpt-severity-pill-val">{data.risk.bySeverity.high}</div>
                  <div className="rpt-severity-pill-label">High</div>
                </div>
                <div className="rpt-severity-pill medium">
                  <div className="rpt-severity-pill-val">{data.risk.bySeverity.medium}</div>
                  <div className="rpt-severity-pill-label">Medium</div>
                </div>
                <div className="rpt-severity-pill low">
                  <div className="rpt-severity-pill-val">{data.risk.bySeverity.low}</div>
                  <div className="rpt-severity-pill-label">Low</div>
                </div>
              </div>

              <div className="rpt-section-label">By Status</div>
              <BreakdownBar
                delay={60}
                items={[
                  { label: 'Open',           value: data.risk.byStatus.open,          color: '#dc2626' },
                  { label: 'Flagged',        value: data.risk.byStatus.flagged,       color: '#f97316' },
                  { label: 'Under Review',   value: data.risk.byStatus.underReview,   color: '#2563eb' },
                  { label: 'Released',       value: data.risk.byStatus.released,      color: '#16a34a' },
                  { label: 'False Positive', value: data.risk.byStatus.falsePositive, color: '#94a3b8' },
                ]}
              />
            </div>

            {/* COMPLIANCE */}
            <div className="rpt-card">
              <div className="rpt-card-header">
                <div className="rpt-card-title">
                  <div className="rpt-card-icon amber"><Shield size={17} /></div>
                  <h3>Compliance Cases</h3>
                </div>
                <Link href="/admin/compliance" className="rpt-view-link">
                  View all <ArrowRight size={13} />
                </Link>
              </div>

              <div className="rpt-section-label">By Priority</div>
              <div className="rpt-severity-grid">
                <div className="rpt-severity-pill critical">
                  <div className="rpt-severity-pill-val">{data.compliance.byPriority.critical}</div>
                  <div className="rpt-severity-pill-label">Critical</div>
                </div>
                <div className="rpt-severity-pill high">
                  <div className="rpt-severity-pill-val">{data.compliance.byPriority.high}</div>
                  <div className="rpt-severity-pill-label">High</div>
                </div>
                <div className="rpt-severity-pill medium">
                  <div className="rpt-severity-pill-val">{data.compliance.byPriority.medium}</div>
                  <div className="rpt-severity-pill-label">Medium</div>
                </div>
                <div className="rpt-severity-pill low">
                  <div className="rpt-severity-pill-val">{data.compliance.byPriority.low}</div>
                  <div className="rpt-severity-pill-label">Low</div>
                </div>
              </div>

              <div className="rpt-section-label">By Status</div>
              <BreakdownBar
                delay={60}
                items={[
                  { label: 'Open',         value: data.compliance.byStatus.open,        color: '#ca8a04' },
                  { label: 'Escalated',    value: data.compliance.byStatus.escalated,   color: '#dc2626' },
                  { label: 'Under Review', value: data.compliance.byStatus.underReview, color: '#2563eb' },
                  { label: 'Resolved',     value: data.compliance.byStatus.resolved,    color: '#16a34a' },
                  { label: 'Dismissed',    value: data.compliance.byStatus.dismissed,   color: '#94a3b8' },
                ]}
              />
            </div>

          </div>

          {/* ====================================================
              ROW 3 — Reconciliation + Wallets
          ==================================================== */}

          <div className="rpt-main-grid">

            {/* RECONCILIATION */}
            <div className="rpt-card">
              <div className="rpt-card-header">
                <div className="rpt-card-title">
                  <div className="rpt-card-icon teal"><Scale size={17} /></div>
                  <h3>Reconciliation</h3>
                </div>
                <Link href="/admin/reconciliation" className="rpt-view-link">
                  View all <ArrowRight size={13} />
                </Link>
              </div>

              <div className="rpt-ring-wrap">
                <RingChart
                  percent={matchRate}
                  color={matchColor}
                  label="match"
                />
                <div className="rpt-ring-info">
                  <div className="rpt-ring-info-title">
                    {matchRate >= 95
                      ? 'Excellent match rate'
                      : matchRate >= 80
                        ? 'Match rate needs attention'
                        : 'Critical: low match rate'}
                  </div>
                  <div className="rpt-ring-info-sub">
                    {num(data.reconciliation.total)} reconciliation{' '}
                    {data.reconciliation.total === 1 ? 'run' : 'runs'} total
                  </div>
                  <div className="rpt-discrepancy-box">
                    <XCircle size={15} style={{ color: '#dc2626', flexShrink: 0 }} />
                    <div>
                      <div className="rpt-discrepancy-label">Total Discrepancy</div>
                      <div className="rpt-discrepancy-value">{fmt(data.reconciliation.totalDiscrepancy)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rpt-section-label">Run Status</div>
              <BreakdownBar
                delay={120}
                items={[
                  { label: 'Approved',    value: data.reconciliation.byStatus.approved,   color: '#16a34a' },
                  { label: 'Completed',   value: data.reconciliation.byStatus.completed,  color: '#2563eb' },
                  { label: 'In Progress', value: data.reconciliation.byStatus.inProgress, color: '#ca8a04' },
                  { label: 'Pending',     value: data.reconciliation.byStatus.pending,    color: '#94a3b8' },
                  { label: 'Failed',      value: data.reconciliation.byStatus.failed,     color: '#dc2626' },
                ]}
              />
            </div>

            {/* WALLETS */}
            <div className="rpt-card">
              <div className="rpt-card-header">
                <div className="rpt-card-title">
                  <div className="rpt-card-icon purple"><Wallet size={17} /></div>
                  <h3>Wallets</h3>
                </div>
                <Link href="/admin/accounts" className="rpt-view-link">
                  View all <ArrowRight size={13} />
                </Link>
              </div>

              <div className="rpt-stat-row">
                <div className="rpt-stat-mini">
                  <div className="rpt-stat-mini-label">Total</div>
                  <div className="rpt-stat-mini-value">{num(data.wallets.total)}</div>
                </div>
                <div className="rpt-stat-mini">
                  <div className="rpt-stat-mini-label">Active</div>
                  <div className="rpt-stat-mini-value" style={{ color: '#16a34a' }}>
                    {num(data.wallets.byStatus.active)}
                  </div>
                </div>
                <div className="rpt-stat-mini">
                  <div className="rpt-stat-mini-label">Frozen</div>
                  <div className="rpt-stat-mini-value" style={{ color: '#2563eb' }}>
                    {num(data.wallets.byStatus.frozen)}
                  </div>
                </div>
              </div>

              <div className="rpt-section-label">By Status</div>
              <BreakdownBar
                delay={80}
                items={[
                  { label: 'Active', value: data.wallets.byStatus.active, color: '#16a34a' },
                  { label: 'Frozen', value: data.wallets.byStatus.frozen, color: '#2563eb' },
                  { label: 'Closed', value: data.wallets.byStatus.closed, color: '#94a3b8' },
                ]}
              />

              <div className="rpt-divider" />

              <div className="rpt-section-label">By Currency</div>
              <div className="rpt-currency-grid">
                <div className="rpt-currency-tile">
                  <div className="rpt-currency-code">NGN</div>
                  <div className="rpt-currency-count">{num(data.wallets.byCurrency.ngn)}</div>
                  <div className="rpt-currency-sub">wallets</div>
                </div>
                <div className="rpt-currency-tile">
                  <div className="rpt-currency-code">USD</div>
                  <div className="rpt-currency-count">{num(data.wallets.byCurrency.usd)}</div>
                  <div className="rpt-currency-sub">wallets</div>
                </div>
                <div className="rpt-currency-tile">
                  <div className="rpt-currency-code">EUR</div>
                  <div className="rpt-currency-count">{num(data.wallets.byCurrency.eur)}</div>
                  <div className="rpt-currency-sub">wallets</div>
                </div>
                <div className="rpt-currency-tile">
                  <div className="rpt-currency-code">GBP</div>
                  <div className="rpt-currency-count">{num(data.wallets.byCurrency.gbp)}</div>
                  <div className="rpt-currency-sub">wallets</div>
                </div>
              </div>
            </div>

          </div>

          {/* ====================================================
              ACTIVITY FOOTER
          ==================================================== */}

          <div className="rpt-activity-bar">
            <div className="rpt-activity-icon">
              <Activity size={20} />
            </div>
            <div>
              <div className="rpt-activity-count">
                {num(data.activity.totalAuditLogs)} audit events
              </div>
              <div className="rpt-activity-desc">
                recorded across all admin actions on this platform
              </div>
            </div>
            <Link href="/admin/audit-logs" className="rpt-activity-link">
              <Zap size={14} />
              View audit logs
              <ArrowRight size={14} />
            </Link>
          </div>

        </>
      )}

    </main>
  );
}
