'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useRouter } from 'next/navigation';

import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BookOpen,
  CircleDollarSign,
  Clock3,
  Landmark,
  Plus,
  RefreshCcw,
  Send,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { apiFetch } from '@/lib/api';
import { getAuthUser } from '@/lib/auth';

/* ============================================================
   TYPES
   ============================================================ */

interface WalletAccount {
  id: number;
  walletId: number;
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode: string | null;
  accountType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface WalletData {
  id: number;
  userId: number;
  balance: string;
  currency: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  account: WalletAccount | null;
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
  updatedAt?: string;
}

interface DashboardListResponse<T> {
  data?: T[];
  items?: T[];
  results?: T[];
}

/* ============================================================
   HELPERS
   ============================================================ */

function getTransactionType(tx: Transaction): string {
  return tx.type ?? tx._type ?? 'TRANSACTION';
}

function normalizeList<T>(
  response: T[] | DashboardListResponse<T> | unknown,
): T[] {
  if (Array.isArray(response)) return response;

  if (typeof response === 'object' && response !== null) {
    const v = response as DashboardListResponse<T>;

    if (Array.isArray(v.data)) return v.data;
    if (Array.isArray(v.items)) return v.items;
    if (Array.isArray(v.results)) return v.results;
  }

  return [];
}

function formatAmount(amount: string | number, currency: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${currency} 0.00`;

  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString('en-NG')}`;
  }
}

function formatDate(date: string): string {
  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return date;

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;

    return new Intl.DateTimeFormat('en-NG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return date;
  }
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function txStatusClass(status: string): string {
  const s = status.toLowerCase();

  if (s === 'completed' || s === 'success') return 'tx-status tx-status-success';
  if (s === 'pending') return 'tx-status tx-status-pending';
  if (s === 'failed' || s === 'reversed') return 'tx-status tx-status-failed';

  return 'tx-status tx-status-default';
}

/* ============================================================
   SPARKLINE DATA — built from wallet balances for decoration
   ============================================================ */

function buildSparkData(total: number) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const base = total > 0 ? total * 0.4 : 50_000;

  return Array.from({ length: 8 }, (_, i) => {
    const monthIdx = (now.getMonth() - 7 + i + 12) % 12;
    const wave = Math.sin((i / 7) * Math.PI) * base * 0.5;
    const noise = (Math.cos(i * 2.7) * 0.2 + 0.9) * base;

    return {
      month: months[monthIdx],
      balance: Math.max(0, Math.round(base * 0.5 + wave + noise)),
    };
  });
}

/* ============================================================
   CUSTOM CHART TOOLTIP
   ============================================================ */

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="dash-chart-tooltip">
      <p className="dash-chart-tooltip-label">{label}</p>
      <p className="dash-chart-tooltip-value">
        ₦{payload[0].value.toLocaleString('en-NG')}
      </p>
    </div>
  );
}

/* ============================================================
   PAGE
   ============================================================ */

export default function DashboardPage() {
  const router = useRouter();

  const authUser = getAuthUser() as { firstName?: string; lastName?: string } | null;
  const firstName = authUser?.firstName ?? 'there';

  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  /* ----------------------------------------------------------
     LOAD
     ---------------------------------------------------------- */

  const loadDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError('');

      const [walletsRes, txRes] = await Promise.all([
        apiFetch<WalletData[] | DashboardListResponse<WalletData>>('/wallets'),
        apiFetch<Transaction[] | DashboardListResponse<Transaction>>(
          '/transactions/recent?limit=8',
        ),
      ]);

      setWallets(normalizeList<WalletData>(walletsRes));
      setTransactions(normalizeList<Transaction>(txRes));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  /* ----------------------------------------------------------
     CALCULATIONS
     ---------------------------------------------------------- */

  const balancesByCurrency = useMemo(() =>
    wallets.reduce((acc, w) => {
      const b = Number(w.balance);
      if (Number.isFinite(b)) acc.set(w.currency, (acc.get(w.currency) ?? 0) + b);
      return acc;
    }, new Map<string, number>()),
    [wallets],
  );

  const currencyBalances = useMemo(
    () => Array.from(balancesByCurrency.entries()).sort(([a], [b]) => a.localeCompare(b)),
    [balancesByCurrency],
  );

  const primaryBalance = currencyBalances[0];
  const activeWallets = wallets.filter((w) => w.status === 'ACTIVE').length;
  const totalAccounts = wallets.filter((w) => w.account !== null).length;

  const chartData = useMemo(
    () => buildSparkData(primaryBalance?.[1] ?? 0),
    [primaryBalance],
  );

  /* ----------------------------------------------------------
     LOADING
     ---------------------------------------------------------- */

  if (loading) {
    return (
      <div className="dashboard-loading-page">
        <div className="dashboard-loading-content">
          <div className="dashboard-loader-logo">
            <Landmark size={26} />
          </div>
          <div className="dashboard-loader-spinner" />
          <p>Loading your financial overview...</p>
        </div>
      </div>
    );
  }

  /* ----------------------------------------------------------
     RENDER
     ---------------------------------------------------------- */

  return (
    <main className="dash-page">

      {/* ======================================================
          GREETING HEADER
          ====================================================== */}

      <header className="dash-greeting">
        <div className="dash-greeting-text">
          <p className="dash-greeting-sub">{greeting()},</p>
          <h1 className="dash-greeting-name">{firstName}.</h1>
          <p className="dash-greeting-caption">
            Here&apos;s a quick snapshot of your account activity.
          </p>
        </div>

        <div className="dash-header-actions">
          <button
            type="button"
            className="dash-action-pill"
            onClick={() => router.push('/wallets')}
          >
            <Plus size={15} />
            Fund Wallet
          </button>

          <button
            type="button"
            className="dash-refresh-btn"
            onClick={() => void loadDashboard(true)}
            disabled={refreshing}
            title="Refresh dashboard"
          >
            <RefreshCcw
              size={17}
              className={refreshing ? 'dash-spin' : ''}
            />
          </button>
        </div>
      </header>

      {/* ======================================================
          ERROR
          ====================================================== */}

      {error && (
        <div className="dash-error" role="alert">
          <strong>Something went wrong.</strong>
          <span>{error}</span>
          <button type="button" onClick={() => void loadDashboard(true)}>
            Try again
          </button>
        </div>
      )}

      {/* ======================================================
          STAT CARDS — 4 column grid
          ====================================================== */}

      <div className="dash-stats-grid">

        {/* TOTAL BALANCE */}
        <div className="dash-stat-card dash-stat-primary">
          <div className="dash-stat-top">
            <span className="dash-stat-label">Total Balance</span>
            <div className="dash-stat-icon-wrap primary">
              <Wallet size={18} />
            </div>
          </div>

          <div className="dash-stat-value">
            {primaryBalance
              ? formatAmount(primaryBalance[1], primaryBalance[0])
              : '₦ 0.00'}
          </div>

          <div className="dash-stat-sub">
            <TrendingUp size={13} />
            {currencyBalances.length > 1
              ? `${currencyBalances.length} currencies`
              : primaryBalance
                ? `${primaryBalance[0]} wallet`
                : 'No balance'}
          </div>

          <div className="dash-stat-bar">
            <div className="dash-stat-bar-fill primary" style={{ width: '72%' }} />
          </div>
        </div>

        {/* ACTIVE WALLETS */}
        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span className="dash-stat-label">Active Wallets</span>
            <div className="dash-stat-icon-wrap blue">
              <CircleDollarSign size={18} />
            </div>
          </div>

          <div className="dash-stat-value">{activeWallets}</div>

          <div className="dash-stat-sub">
            <Activity size={13} />
            {wallets.length} total wallet{wallets.length !== 1 ? 's' : ''}
          </div>

          <div className="dash-stat-bar">
            <div
              className="dash-stat-bar-fill blue"
              style={{
                width: wallets.length
                  ? `${Math.round((activeWallets / wallets.length) * 100)}%`
                  : '0%',
              }}
            />
          </div>
        </div>

        {/* VIRTUAL ACCOUNTS */}
        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span className="dash-stat-label">Virtual Accounts</span>
            <div className="dash-stat-icon-wrap green">
              <Landmark size={18} />
            </div>
          </div>

          <div className="dash-stat-value">{totalAccounts}</div>

          <div className="dash-stat-sub">
            <BadgeCheck size={13} />
            With bank account numbers
          </div>

          <div className="dash-stat-bar">
            <div
              className="dash-stat-bar-fill green"
              style={{
                width: wallets.length
                  ? `${Math.round((totalAccounts / wallets.length) * 100)}%`
                  : '0%',
              }}
            />
          </div>
        </div>

        {/* TRANSACTIONS */}
        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span className="dash-stat-label">Transactions</span>
            <div className="dash-stat-icon-wrap amber">
              <Send size={18} />
            </div>
          </div>

          <div className="dash-stat-value">{transactions.length}</div>

          <div className="dash-stat-sub">
            <Clock3 size={13} />
            Recent activity
          </div>

          <div className="dash-stat-bar">
            <div
              className="dash-stat-bar-fill amber"
              style={{ width: transactions.length > 0 ? '60%' : '0%' }}
            />
          </div>
        </div>

      </div>

      {/* ======================================================
          CHART + QUICK ACTIONS
          ====================================================== */}

      <div className="dash-mid-grid">

        {/* BALANCE TREND CHART */}
        <div className="dash-chart-card">
          <div className="dash-card-header">
            <div>
              <h2>Balance Trend</h2>
              <p>Estimated monthly balance movement</p>
            </div>
            <button
              type="button"
              className="dash-view-link"
              onClick={() => router.push('/wallets')}
            >
              View Wallets
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="dash-chart-area">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart
                data={chartData}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000
                      ? `₦${(v / 1_000_000).toFixed(1)}M`
                      : v >= 1_000
                        ? `₦${(v / 1_000).toFixed(0)}K`
                        : `₦${v}`
                  }
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fill="url(#balanceGrad)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="dash-quick-card">
          <div className="dash-card-header">
            <div>
              <h2>Quick Actions</h2>
              <p>Jump to key features</p>
            </div>
          </div>

          <div className="dash-quick-list">

            <button
              type="button"
              className="dash-quick-item"
              onClick={() => router.push('/wallets')}
            >
              <span className="dash-quick-icon blue">
                <Wallet size={19} />
              </span>
              <span className="dash-quick-text">
                <strong>Manage Wallets</strong>
                <small>View balances & fund</small>
              </span>
              <ArrowRight size={15} className="dash-quick-arrow" />
            </button>

            <button
              type="button"
              className="dash-quick-item"
              onClick={() => router.push('/transactions')}
            >
              <span className="dash-quick-icon green">
                <Send size={19} />
              </span>
              <span className="dash-quick-text">
                <strong>Transactions</strong>
                <small>Send & receive money</small>
              </span>
              <ArrowRight size={15} className="dash-quick-arrow" />
            </button>

            <button
              type="button"
              className="dash-quick-item"
              onClick={() => router.push('/kyc')}
            >
              <span className="dash-quick-icon amber">
                <BadgeCheck size={19} />
              </span>
              <span className="dash-quick-text">
                <strong>KYC Verification</strong>
                <small>Verify your identity</small>
              </span>
              <ArrowRight size={15} className="dash-quick-arrow" />
            </button>

            <button
              type="button"
              className="dash-quick-item"
              onClick={() => router.push('/ledger')}
            >
              <span className="dash-quick-icon purple">
                <BookOpen size={19} />
              </span>
              <span className="dash-quick-text">
                <strong>Ledger</strong>
                <small>Double-entry records</small>
              </span>
              <ArrowRight size={15} className="dash-quick-arrow" />
            </button>

            <button
              type="button"
              className="dash-quick-item"
              onClick={() => router.push('/notifications')}
            >
              <span className="dash-quick-icon slate">
                <Bell size={19} />
              </span>
              <span className="dash-quick-text">
                <strong>Notifications</strong>
                <small>Account alerts & updates</small>
              </span>
              <ArrowRight size={15} className="dash-quick-arrow" />
            </button>

          </div>
        </div>

      </div>

      {/* ======================================================
          WALLETS ROW
          ====================================================== */}

      {wallets.length > 0 && (
        <div className="dash-section-card">
          <div className="dash-card-header">
            <div>
              <h2>My Wallets</h2>
              <p>Your active currency wallets</p>
            </div>
            <button
              type="button"
              className="dash-view-link"
              onClick={() => router.push('/wallets')}
            >
              View All
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="dash-wallets-row">
            {wallets.slice(0, 4).map((wallet) => (
              <button
                key={wallet.id}
                type="button"
                className="dash-wallet-pill"
                onClick={() => router.push(`/wallets/${wallet.id}`)}
              >
                <div className="dash-wallet-pill-top">
                  <span className="dash-wallet-pill-currency">{wallet.currency}</span>
                  <span
                    className={`dash-wallet-pill-status ${wallet.status.toLowerCase()}`}
                  >
                    {wallet.status === 'ACTIVE' ? 'Active' : wallet.status}
                  </span>
                </div>

                <p className="dash-wallet-pill-amount">
                  {formatAmount(wallet.balance, wallet.currency)}
                </p>

                {wallet.account && (
                  <p className="dash-wallet-pill-bank">
                    {wallet.account.bankName} · {wallet.account.accountNumber}
                  </p>
                )}
              </button>
            ))}

            <button
              type="button"
              className="dash-wallet-pill dash-wallet-add"
              onClick={() => router.push('/wallets')}
            >
              <Plus size={20} />
              <span>Add Wallet</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================
          RECENT TRANSACTIONS TABLE
          ====================================================== */}

      <div className="dash-section-card">
        <div className="dash-card-header">
          <div>
            <h2>Recent Transactions</h2>
            <p>Your latest financial activity</p>
          </div>
          <button
            type="button"
            className="dash-view-link"
            onClick={() => router.push('/transactions')}
          >
            View All
            <ArrowRight size={14} />
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="dash-empty">
            <Activity size={32} />
            <h3>No transactions yet</h3>
            <p>Your activity will appear here once transactions are made.</p>
          </div>
        ) : (
          <div className="dash-tx-table-wrap">
            <table className="dash-tx-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const type = getTransactionType(tx);

                  return (
                    <tr
                      key={tx.id}
                      className="dash-tx-row"
                      onClick={() => router.push(`/transactions/${tx.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          router.push(`/transactions/${tx.id}`);
                        }
                      }}
                    >
                      <td>
                        <span className={`dash-tx-type-icon ${type.toLowerCase()}`}>
                          {type === 'DEPOSIT' ? (
                            <ArrowDownLeft size={15} />
                          ) : type === 'WITHDRAWAL' ? (
                            <ArrowUpRight size={15} />
                          ) : (
                            <Activity size={15} />
                          )}
                        </span>
                      </td>
                      <td>
                        <span className="dash-tx-ref">{tx.reference}</span>
                        <span className="dash-tx-type-label">
                          {type.charAt(0) + type.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`dash-tx-amount ${
                            type === 'DEPOSIT' ? 'credit' : 'debit'
                          }`}
                        >
                          {type === 'DEPOSIT' ? '+' : '-'}
                          {formatAmount(tx.amount, tx.currency)}
                        </span>
                      </td>
                      <td>
                        <span className={txStatusClass(tx.status)}>
                          {tx.status.charAt(0) + tx.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="dash-tx-date">{formatDate(tx.createdAt)}</td>
                      <td>
                        <ArrowRight size={14} className="dash-tx-arrow" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </main>
  );
}
