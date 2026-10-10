'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock3, Plus, RefreshCw, ShieldCheck, UserCog, Users } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type Status = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
type Admin = { id: number; email: string; firstName: string; lastName: string; status: Status; createdAt?: string };

const formatDate = (value?: string) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
};

const getInitials = (firstName?: string, lastName?: string) => {
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
  return initials || 'AD';
};

const getStatusLabel = (status: Status) => {
  if (status === 'ACTIVE') return 'Active';
  if (status === 'SUSPENDED') return 'Suspended';
  if (status === 'DEACTIVATED') return 'Deactivated';
  return status;
};

export default function AdminOverviewPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function load(options?: { refresh?: boolean }) {
    const isRefresh = options?.refresh === true;
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError('');

    try {
      const data = await apiFetch<Admin[]>('/admins');
      setAdmins(Array.isArray(data) ? data : []);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load administrator overview.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const stats = useMemo(() => ({
    total: admins.length,
    active: admins.filter((admin) => admin.status === 'ACTIVE').length,
    suspended: admins.filter((admin) => admin.status === 'SUSPENDED').length,
    deactivated: admins.filter((admin) => admin.status === 'DEACTIVATED').length,
  }), [admins]);

  const recentAdmins = useMemo(() => [...admins].sort((a, b) => {
    const first = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const second = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return second - first;
  }).slice(0, 5), [admins]);

  return (
    <div className="admin-page">
      <header className="page-header">
        <div>
          <div className="admin-eyebrow"><ShieldCheck size={15} />Zarova Control Center</div>
          <h1 className="page-title">Admin Overview</h1>
          <p className="page-description">Monitor administrator access and move quickly between Zarova operational controls.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="secondary-button" onClick={() => void load({ refresh: true })} disabled={loading || refreshing}>
            <RefreshCw size={16} className={refreshing ? 'admin-refresh-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <Link href="/admin/administrators/new" className="primary-button"><Plus size={16} />Add administrator</Link>
        </div>
      </header>

      {error && <div className="admin-alert admin-alert-error" role="alert">{error}</div>}

      <section className="admin-stat-grid" aria-label="Administrator summary">
        <div className="admin-stat-card"><Users size={20} /><div><span>Total administrators</span><strong>{loading ? '—' : stats.total}</strong></div></div>
        <div className="admin-stat-card"><ShieldCheck size={20} /><div><span>Active access</span><strong>{loading ? '—' : stats.active}</strong></div></div>
        <div className="admin-stat-card"><Clock3 size={20} /><div><span>Suspended</span><strong>{loading ? '—' : stats.suspended}</strong></div></div>
        <div className="admin-stat-card"><UserCog size={20} /><div><span>Deactivated</span><strong>{loading ? '—' : stats.deactivated}</strong></div></div>
      </section>

      <div className="admin-overview-grid">
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div><span className="admin-eyebrow">Access management</span><h2>Administrator accounts</h2><p>Review privileged users and manage their access.</p></div>
            <Link href="/admin/administrators" className="admin-view-link">View all <ArrowRight size={14} /></Link>
          </div>

          {loading ? <div className="admin-loading"><div className="admin-loader" /><span>Loading administrator accounts...</span></div> : recentAdmins.length === 0 ? (
            <div className="admin-empty"><UserCog size={28} /><h3>No administrators yet</h3><p>Create the first administrator account to begin managing privileged access.</p><Link href="/admin/administrators/new" className="primary-button"><Plus size={15} />Add administrator</Link></div>
          ) : (
            <div className="admin-table-wrap"><table className="data-table admin-table"><thead><tr><th>Administrator</th><th>Status</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
              {recentAdmins.map((admin) => <tr key={admin.id}>
                <td><div className="admin-person"><div className="admin-avatar">{getInitials(admin.firstName, admin.lastName)}</div><div><strong>{admin.firstName} {admin.lastName}</strong><span>{admin.email}</span></div></div></td>
                <td><span className={`status-badge ${admin.status.toLowerCase()}`}><span className="status-dot" />{getStatusLabel(admin.status)}</span></td>
                <td>{formatDate(admin.createdAt)}</td>
                <td><Link className="admin-view-link" href={`/admin/administrators/${admin.id}`}>View <ArrowRight size={14} /></Link></td>
              </tr>)}
            </tbody></table></div>
          )}
        </section>

        <section className="admin-panel admin-quick-actions">
          <div className="admin-panel-header"><div><span className="admin-eyebrow">Operations</span><h2>Quick access</h2><p>Core areas of the Zarova administration console.</p></div></div>
          <div className="admin-quick-action-list">
            <Link href="/admin/administrators" className="admin-quick-action"><div className="admin-quick-action-icon"><UserCog size={18} /></div><div><strong>Administrators</strong><span>Manage privileged accounts and roles.</span></div><ArrowRight size={16} /></Link>
            <Link href="/admin/transactions" className="admin-quick-action"><div className="admin-quick-action-icon"><Clock3 size={18} /></div><div><strong>Transactions</strong><span>Review transaction activity and exceptions.</span></div><ArrowRight size={16} /></Link>
            <Link href="/admin/audit-logs" className="admin-quick-action"><div className="admin-quick-action-icon"><ShieldCheck size={18} /></div><div><strong>Audit Logs</strong><span>Review privileged administrative activity.</span></div><ArrowRight size={16} /></Link>
          </div>
        </section>
      </div>
    </div>
  );
}
