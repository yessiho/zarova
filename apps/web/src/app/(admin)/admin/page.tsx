'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
  UserCog,
  Activity,
  Clock,
  Receipt,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

/* ============================================================
   TYPES
   ============================================================ */

interface DayPoint { date: string; count: number; volume?: number }

interface RecentTxn {
  id: number;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  createdAt: string;
}

interface DashboardStats {
  totals: { users: number; admins: number; transactions: number; volume: number };
  transactionChart: DayPoint[];
  userGrowthChart: DayPoint[];
  breakdown: { completed: number; pending: number; processing: number; failed: number; reversed: number };
  recentTransactions: RecentTxn[];
}

/* ============================================================
   HELPERS
   ============================================================ */

const formatNGN = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

const formatDay = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric' });
};

const formatDateTime = (raw: string) => {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function computeTrend(values: number[]): number {
  if (values.length < 7) return 0;
  const prev = values[0]! + values[1]! + values[2]!;
  const curr = values[4]! + values[5]! + values[6]!;
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

/* ============================================================
   TREND BADGE
   ============================================================ */

function TrendBadge({ pct }: { pct: number | undefined }) {
  if (pct === undefined) return null;
  if (pct > 0) {
    return (
      <span className="admin-stat-trend up">
        <ArrowUpRight size={11} />
        {Math.min(pct, 999)}%
      </span>
    );
  }
  if (pct < 0) {
    return (
      <span className="admin-stat-trend down">
        <ArrowDownRight size={11} />
        {Math.min(Math.abs(pct), 999)}%
      </span>
    );
  }
  return (
    <span className="admin-stat-trend neutral">
      <Minus size={10} />
      0%
    </span>
  );
}

/* ============================================================
   STAT CARD
   ============================================================ */

function StatCard({
  label,
  value,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: number;
}) {
  return (
    <div className="admin-stat-card">
      <Icon size={20} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <TrendBadge pct={trend} />
    </div>
  );
}

/* ============================================================
   STATUS PILL
   ============================================================ */

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: '#16a34a',
  PENDING: '#d97706',
  PROCESSING: '#2563eb',
  FAILED: '#dc2626',
  REVERSED: '#64748b',
};

function StatusPill({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? '#64748b';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 650,
        background: `${color}18`,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {status}
    </span>
  );
}

/* ============================================================
   TYPE CHIP
   ============================================================ */

function TypeChip({ type }: { type: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: 'var(--primary-light)',
        color: 'var(--primary)',
        border: '1px solid #dbeafe',
      }}
    >
      {type}
    </span>
  );
}

/* ============================================================
   PAGE
   ============================================================ */

const BREAKDOWN_COLORS: Record<string, string> = {
  Completed: '#16a34a',
  Pending: '#d97706',
  Processing: '#2563eb',
  Failed: '#dc2626',
  Reversed: '#94a3b8',
};

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load(opts?: { refresh?: boolean }) {
    const isRefresh = opts?.refresh === true;
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const data = await apiFetch<DashboardStats>('/admins/dashboard/stats');
      setStats(data);
      setLastUpdated(
        new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load dashboard stats.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
    intervalRef.current = setInterval(() => void load({ refresh: true }), 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const txChart = (stats?.transactionChart ?? []).map((d) => ({
    ...d,
    label: formatDay(d.date),
  }));

  const userChart = (stats?.userGrowthChart ?? []).map((d) => ({
    ...d,
    label: formatDay(d.date),
  }));

  const volumeTrend = computeTrend(txChart.map((d) => d.volume ?? 0));
  const countTrend = computeTrend(txChart.map((d) => d.count));
  const userTrend = computeTrend(userChart.map((d) => d.count));

  const bd = stats?.breakdown;
  const breakdownPieData = bd
    ? (
        [
          { name: 'Completed', value: bd.completed },
          { name: 'Pending', value: bd.pending },
          { name: 'Processing', value: bd.processing },
          { name: 'Failed', value: bd.failed },
          { name: 'Reversed', value: bd.reversed },
        ] as { name: string; value: number }[]
      ).filter((d) => d.value > 0)
    : [];

  const totalBdCount = breakdownPieData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="admin-page">

      {/* ── Header ───────────────────────────────────────────── */}
      <header className="page-header">
        <div>
          <div className="admin-eyebrow"><ShieldCheck size={15} />Zarova Control Center</div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-description">
            Platform overview — last 7 days of activity.
            {lastUpdated && (
              <span className="admin-last-updated">
                <Clock size={11} /> Updated {lastUpdated}
              </span>
            )}
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => void load({ refresh: true })}
            disabled={loading || refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'admin-refresh-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && <div className="admin-alert admin-alert-error" role="alert">{error}</div>}

      {/* ── Stat cards ───────────────────────────────────────── */}
      <section className="admin-stat-grid" aria-label="Platform summary">
        <StatCard
          label="Total users"
          value={loading ? '—' : (stats?.totals.users ?? 0).toLocaleString()}
          icon={Users}
          trend={loading ? undefined : userTrend}
        />
        <StatCard
          label="Administrators"
          value={loading ? '—' : (stats?.totals.admins ?? 0).toLocaleString()}
          icon={UserCog}
        />
        <StatCard
          label="Total transactions"
          value={loading ? '—' : (stats?.totals.transactions ?? 0).toLocaleString()}
          icon={Activity}
          trend={loading ? undefined : countTrend}
        />
        <StatCard
          label="Transaction volume"
          value={loading ? '—' : formatNGN(stats?.totals.volume ?? 0)}
          icon={TrendingUp}
          trend={loading ? undefined : volumeTrend}
        />
      </section>

      {/* ── Charts row ───────────────────────────────────────── */}
      <div className="admin-overview-grid">

        {/* Transaction volume area chart */}
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <span className="admin-eyebrow">7-day trend</span>
              <h2>Transaction Volume</h2>
              <p>Daily completed transaction value over the last week.</p>
            </div>
            <Link href="/admin/transactions" className="admin-view-link">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {loading ? (
            <div className="admin-loading"><div className="admin-loader" /><span>Loading chart…</span></div>
          ) : (
            <div style={{ padding: '16px 0 8px', width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <AreaChart data={txChart} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => v >= 1_000_000 ? `₦${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `₦${Math.round(v / 1000)}k` : `₦${v}`}
                    width={58}
                  />
                  <Tooltip
                    formatter={(v) => [formatNGN(Number(v ?? 0)), 'Volume']}
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="volume"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fill="url(#volumeGrad)"
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 0, fill: '#2563eb' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Transaction status donut */}
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <span className="admin-eyebrow">breakdown</span>
              <h2>Transaction Status</h2>
              <p>All-time distribution by outcome.</p>
            </div>
          </div>
          {loading ? (
            <div className="admin-loading"><div className="admin-loader" /><span>Loading…</span></div>
          ) : breakdownPieData.length === 0 ? (
            <div className="admin-loading" style={{ padding: '32px 0' }}>
              <Activity size={28} style={{ opacity: 0.25 }} />
              <span>No transactions yet</span>
            </div>
          ) : (
            <div className="admin-donut-wrap">
              <div style={{ position: 'relative', width: '100%', height: 160 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={breakdownPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={70}
                      strokeWidth={2}
                      stroke="var(--surface)"
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {breakdownPieData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={BREAKDOWN_COLORS[entry.name] ?? '#94a3b8'}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v, name) => [`${v} transactions`, name]}
                      contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="admin-donut-center">
                  <strong>{totalBdCount.toLocaleString()}</strong>
                  <span>total</span>
                </div>
              </div>
              <div className="admin-donut-legend">
                {breakdownPieData.map((entry) => (
                  <div key={entry.name} className="admin-donut-legend-item">
                    <span
                      className="admin-donut-legend-dot"
                      style={{ background: BREAKDOWN_COLORS[entry.name] ?? '#94a3b8' }}
                    />
                    <span className="admin-donut-legend-name">{entry.name}</span>
                    <strong className="admin-donut-legend-val">{entry.value.toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

      </div>

      {/* ── Recent transactions ──────────────────────────────── */}
      <section className="admin-panel" style={{ marginTop: 20 }}>
        <div className="admin-panel-header">
          <div>
            <span className="admin-eyebrow"><Receipt size={12} />Latest activity</span>
            <h2>Recent Transactions</h2>
            <p>Most recent 5 transactions across all users.</p>
          </div>
          <Link href="/admin/transactions" className="admin-view-link">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        {loading ? (
          <div className="admin-loading"><div className="admin-loader" /><span>Loading…</span></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Currency</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.recentTransactions ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="admin-loading" style={{ padding: '24px 0' }}>
                        <Activity size={24} style={{ opacity: 0.25 }} />
                        <span>No transactions yet</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  (stats?.recentTransactions ?? []).map((txn) => (
                    <tr key={txn.id}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
                          {txn.reference}
                        </span>
                      </td>
                      <td><TypeChip type={txn.type} /></td>
                      <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {formatNGN(txn.amount)}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>
                        {txn.currency}
                      </td>
                      <td><StatusPill status={txn.status} /></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {formatDateTime(txn.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Bottom row: user chart + quick links ─────────────── */}
      <div className="admin-bottom-grid">

        {/* User registrations bar chart */}
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <span className="admin-eyebrow">7-day trend</span>
              <h2>User Registrations</h2>
              <p>New accounts created per day over the last week.</p>
            </div>
            <Link href="/admin/customers" className="admin-view-link">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {loading ? (
            <div className="admin-loading"><div className="admin-loader" /><span>Loading chart…</span></div>
          ) : (
            <div style={{ padding: '16px 0 8px', width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={userChart} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                  <Tooltip
                    formatter={(v) => [Number(v ?? 0), 'New users']}
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}
                  />
                  <Bar dataKey="count" fill="#2563eb" radius={[5, 5, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Quick links */}
        <section className="admin-panel admin-quick-actions">
          <div className="admin-panel-header">
            <div><span className="admin-eyebrow">Operations</span><h2>Quick access</h2></div>
          </div>
          <div className="admin-quick-action-list">
            <Link href="/admin/customers" className="admin-quick-action">
              <div className="admin-quick-action-icon"><Users size={18} /></div>
              <div><strong>Customers</strong><span>Manage user accounts and KYC status.</span></div>
              <ArrowRight size={16} />
            </Link>
            <Link href="/admin/transactions" className="admin-quick-action">
              <div className="admin-quick-action-icon"><Activity size={18} /></div>
              <div><strong>Transactions</strong><span>Review activity and exceptions.</span></div>
              <ArrowRight size={16} />
            </Link>
            <Link href="/admin/administrators" className="admin-quick-action">
              <div className="admin-quick-action-icon"><UserCog size={18} /></div>
              <div><strong>Administrators</strong><span>Manage privileged accounts and roles.</span></div>
              <ArrowRight size={16} />
            </Link>
            <Link href="/admin/audit-logs" className="admin-quick-action">
              <div className="admin-quick-action-icon"><ShieldCheck size={18} /></div>
              <div><strong>Audit Logs</strong><span>Review all administrative actions.</span></div>
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>

      </div>

    </div>
  );
}
