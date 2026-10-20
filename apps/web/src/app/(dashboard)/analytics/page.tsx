'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart2,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { apiFetch } from '@/lib/api';

/* ============================================================ TYPES */

interface Summary {
  totalTransactions: number;
  totalDeposits:     number;
  totalWithdrawals:  number;
  totalTransfers:    number;
  totalDepositAmount:    string;
  totalWithdrawalAmount: string;
}

interface AnalyticsPoint {
  date:  string;
  count: number;
  volume: string;
}

interface Transaction {
  id: number;
  reference: string;
  amount: string;
  currency: string;
  type?: string;
  _type?: string;
  status: string;
  createdAt: string;
}

type Period = '7' | '30' | '90' | '365';

/* ============================================================ HELPERS */

function fmt(amount: string | number | undefined | null, currency = 'NGN') {
  if (amount === undefined || amount === null) return '—';
  const n = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (!isFinite(n)) return '—';
  if (Math.abs(n) >= 1e15) {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(n);
  }
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function shortDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-NG', { month: 'short', day: 'numeric' }).format(new Date(iso));
  } catch { return iso; }
}

function txType(tx: Transaction) { return tx.type ?? tx._type ?? 'TRANSACTION'; }

const PIE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#dc2626'];

/* ---- custom bar tooltip ---- */
function BarTip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="analytics-tooltip">
      <p className="analytics-tooltip-label">{label}</p>
      <p className="analytics-tooltip-value">{payload[0].value} transactions</p>
    </div>
  );
}

/* ---- custom pie tooltip ---- */
function PieTip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="analytics-tooltip">
      <p className="analytics-tooltip-label">{payload[0].name}</p>
      <p className="analytics-tooltip-value">{payload[0].value} transactions</p>
    </div>
  );
}

/* ============================================================ PAGE */

export default function AnalyticsPage() {
  const router = useRouter();

  const [period,     setPeriod]     = useState<Period>('30');
  const [summary,    setSummary]    = useState<Summary | null>(null);
  const [analytics,  setAnalytics]  = useState<AnalyticsPoint[]>([]);
  const [recent,     setRecent]     = useState<Transaction[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      setError('');

      const [sum, pts, txs] = await Promise.all([
        apiFetch<Summary>('/transactions/summary'),
        apiFetch<AnalyticsPoint[] | { data: AnalyticsPoint[] }>(`/transactions/analytics?days=${period}`),
        apiFetch<Transaction[] | { data: Transaction[] }>('/transactions?limit=8'),
      ]);

      setSummary(sum);
      setAnalytics(Array.isArray(pts) ? pts : (pts as { data: AnalyticsPoint[] }).data ?? []);
      const txArr = Array.isArray(txs) ? txs : (txs as { data: Transaction[] }).data ?? [];
      setRecent(txArr.slice(0, 8));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  /* ---- build pie data ---- */
  const pieData = summary ? [
    { name: 'Deposits',    value: summary.totalDeposits    },
    { name: 'Withdrawals', value: summary.totalWithdrawals },
    { name: 'Transfers',   value: summary.totalTransfers   },
  ].filter((d) => d.value > 0) : [];

  /* ---- bar data: aggregate by week if period > 30 ---- */
  const barData = analytics.slice(-20).map((p) => ({
    date:  shortDate(p.date),
    count: p.count,
  }));

  if (loading) return (
    <main className="analytics-page">
      <div className="analytics-loading">
        <Activity size={28} className="analytics-spin" />
        <p>Loading your spending insights…</p>
      </div>
    </main>
  );

  return (
    <main className="analytics-page">

      {/* ── Header ── */}
      <div className="analytics-header">
        <div>
          <h1><BarChart2 size={22} /> Spending Analytics</h1>
          <p>Track your financial activity over time</p>
        </div>
        <div className="analytics-header-right">
          <div className="analytics-period-tabs">
            {(['7', '30', '90', '365'] as Period[]).map((p) => (
              <button key={p} type="button" className={`analytics-period-tab ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
                {p === '365' ? '1Y' : `${p}D`}
              </button>
            ))}
          </div>
          <button type="button" className="analytics-refresh-btn" onClick={() => void load(true)} disabled={refreshing}>
            <RefreshCcw size={16} className={refreshing ? 'analytics-spin' : ''} />
          </button>
        </div>
      </div>

      {error && <div className="analytics-error">{error}</div>}

      {/* ── Summary cards ── */}
      {summary && (
        <div className="analytics-stats-grid">
          <div className="analytics-stat-card">
            <div className="analytics-stat-top">
              <span>Total Transactions</span>
              <div className="analytics-stat-icon blue"><Activity size={16} /></div>
            </div>
            <strong className="analytics-stat-num">{summary.totalTransactions}</strong>
            <span className="analytics-stat-sub">Last {period} days</span>
          </div>

          <div className="analytics-stat-card">
            <div className="analytics-stat-top">
              <span>Money In</span>
              <div className="analytics-stat-icon green"><ArrowDownLeft size={16} /></div>
            </div>
            <strong className="analytics-stat-num green">{fmt(summary.totalDepositAmount)}</strong>
            <span className="analytics-stat-sub">{summary.totalDeposits} deposits</span>
          </div>

          <div className="analytics-stat-card">
            <div className="analytics-stat-top">
              <span>Money Out</span>
              <div className="analytics-stat-icon red"><ArrowUpRight size={16} /></div>
            </div>
            <strong className="analytics-stat-num red">{fmt(summary.totalWithdrawalAmount)}</strong>
            <span className="analytics-stat-sub">{summary.totalWithdrawals} withdrawals</span>
          </div>

          <div className="analytics-stat-card">
            <div className="analytics-stat-top">
              <span>Net Flow</span>
              <div className="analytics-stat-icon purple">
                {parseFloat(summary.totalDepositAmount ?? '0') >= parseFloat(summary.totalWithdrawalAmount ?? '0')
                  ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              </div>
            </div>
            <strong className={`analytics-stat-num ${parseFloat(summary.totalDepositAmount ?? '0') >= parseFloat(summary.totalWithdrawalAmount ?? '0') ? 'green' : 'red'}`}>
              {fmt(Math.abs(parseFloat(summary.totalDepositAmount ?? '0') - parseFloat(summary.totalWithdrawalAmount ?? '0')))}
            </strong>
            <span className="analytics-stat-sub">Deposits minus withdrawals</span>
          </div>
        </div>
      )}

      {/* ── Charts row ── */}
      <div className="analytics-charts-grid">

        {/* Bar chart */}
        <div className="analytics-chart-card">
          <div className="analytics-chart-header">
            <h2>Transaction Volume</h2>
            <p>Daily count over the selected period</p>
          </div>
          <div className="analytics-chart-area">
            {barData.length === 0 ? (
              <div className="analytics-chart-empty"><Activity size={28} /><p>No data for this period</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<BarTip />} />
                  <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Pie chart */}
        <div className="analytics-chart-card">
          <div className="analytics-chart-header">
            <h2>Transaction Breakdown</h2>
            <p>By transaction type</p>
          </div>
          <div className="analytics-chart-area">
            {pieData.length === 0 ? (
              <div className="analytics-chart-empty"><Activity size={28} /><p>No transactions yet</p></div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTip />} />
                    <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="analytics-pie-legend">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="analytics-pie-leg-item">
                      <span className="analytics-pie-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span>{d.name}</span>
                      <strong>{d.value}</strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {/* ── Recent transactions ── */}
      <div className="analytics-recent-card">
        <div className="analytics-card-header">
          <div>
            <h2>Recent Transactions</h2>
            <p>Your latest financial activity</p>
          </div>
          <button type="button" className="analytics-view-link" onClick={() => router.push('/transactions')}>
            View All <ArrowRight size={14} />
          </button>
        </div>

        {recent.length === 0 ? (
          <div className="analytics-empty"><Activity size={28} /><p>No transactions found</p></div>
        ) : (
          <div className="analytics-tx-list">
            {recent.map((tx) => {
              const type = txType(tx);
              return (
                <div
                  key={tx.id}
                  className="analytics-tx-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/transactions/${tx.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/transactions/${tx.id}`); }}
                >
                  <div className={`analytics-tx-icon ${type.toLowerCase()}`}>
                    {type === 'DEPOSIT' ? <ArrowDownLeft size={15} /> : type === 'WITHDRAWAL' ? <ArrowUpRight size={15} /> : <Activity size={15} />}
                  </div>
                  <div className="analytics-tx-info">
                    <strong>{type.charAt(0) + type.slice(1).toLowerCase()}</strong>
                    <span className="analytics-tx-ref">{tx.reference}</span>
                  </div>
                  <div className="analytics-tx-right">
                    <strong className={type === 'DEPOSIT' ? 'green' : 'red'}>
                      {type === 'DEPOSIT' ? '+' : '-'}{fmt(tx.amount, tx.currency)}
                    </strong>
                    <small>{shortDate(tx.createdAt)}</small>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </main>
  );
}
