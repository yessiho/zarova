'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
  UserCog,
  Activity,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

/* ============================================================
   TYPES
   ============================================================ */

interface DayPoint { date: string; count: number; volume?: number }

interface DashboardStats {
  totals: { users: number; admins: number; transactions: number; volume: number };
  transactionChart: DayPoint[];
  userGrowthChart: DayPoint[];
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

/* ============================================================
   STAT CARD
   ============================================================ */

function StatCard({
  label,
  value,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div className={`admin-stat-card${accent ? ' admin-stat-card-accent' : ''}`}>
      <Icon size={20} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

/* ============================================================
   PAGE
   ============================================================ */

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function load(opts?: { refresh?: boolean }) {
    const isRefresh = opts?.refresh === true;
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const data = await apiFetch<DashboardStats>('/admins/dashboard/stats');
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load dashboard stats.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const txChart = (stats?.transactionChart ?? []).map((d) => ({
    ...d,
    label: formatDay(d.date),
  }));

  const userChart = (stats?.userGrowthChart ?? []).map((d) => ({
    ...d,
    label: formatDay(d.date),
  }));

  return (
    <div className="admin-page">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="page-header">
        <div>
          <div className="admin-eyebrow"><ShieldCheck size={15} />Zarova Control Center</div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-description">Platform overview — last 7 days of activity.</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => void load({ refresh: true })}
            disabled={loading || refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'admin-refresh-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && <div className="admin-alert admin-alert-error" role="alert">{error}</div>}

      {/* ── Stat cards ─────────────────────────────────────────── */}
      <section className="admin-stat-grid" aria-label="Platform summary">
        <StatCard
          label="Total users"
          value={loading ? '—' : (stats?.totals.users ?? 0).toLocaleString()}
          icon={Users}
          accent
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
        />
        <StatCard
          label="Transaction volume"
          value={loading ? '—' : formatNGN(stats?.totals.volume ?? 0)}
          icon={TrendingUp}
          accent
        />
      </section>

      {/* ── Charts ─────────────────────────────────────────────── */}
      <div className="admin-overview-grid">

        {/* Transaction volume chart */}
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <span className="admin-eyebrow">7-day trend</span>
              <h2>Transaction Volume (NGN)</h2>
              <p>Daily completed transaction value over the last week.</p>
            </div>
          </div>
          {loading ? (
            <div className="admin-loading"><div className="admin-loader" /><span>Loading chart...</span></div>
          ) : (
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <AreaChart data={txChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f4c81" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0f4c81" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                    tickFormatter={(v: number) => v >= 1000 ? `₦${Math.round(v / 1000)}k` : `₦${v}`} />
                  <Tooltip
                    formatter={(v) => [formatNGN(Number(v ?? 0)), 'Volume']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Area type="monotone" dataKey="volume" stroke="#0f4c81" strokeWidth={2}
                    fill="url(#volumeGrad)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* User registrations chart */}
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <span className="admin-eyebrow">7-day trend</span>
              <h2>User Registrations</h2>
              <p>New user accounts created per day over the last week.</p>
            </div>
            <Link href="/admin/customers" className="admin-view-link">View all <ArrowRight size={14} /></Link>
          </div>
          {loading ? (
            <div className="admin-loading"><div className="admin-loader" /><span>Loading chart...</span></div>
          ) : (
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={userChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    formatter={(v) => [Number(v ?? 0), 'New users']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="count" fill="#0f4c81" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

      </div>

      {/* ── Quick links ────────────────────────────────────────── */}
      <section className="admin-panel admin-quick-actions" style={{ marginTop: 24 }}>
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
            <div><strong>Transactions</strong><span>Review transaction activity and exceptions.</span></div>
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
  );
}
