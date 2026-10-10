'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileSearch,
  RefreshCw,
  XCircle,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

interface AuditLog {
  id: number;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | string | null;
  userId?: number | null;
  adminId?: number | null;
  createdAt: string;
}

function formatDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'long',
    timeStyle: 'medium',
  }).format(d);
}

function getActionClass(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes('creat') || lower.includes('add'))
    return 'audit-badge audit-badge-green';
  if (
    lower.includes('delet') ||
    lower.includes('remov') ||
    lower.includes('reject')
  )
    return 'audit-badge audit-badge-red';
  if (
    lower.includes('updat') ||
    lower.includes('edit') ||
    lower.includes('assign')
  )
    return 'audit-badge audit-badge-blue';
  if (
    lower.includes('flag') ||
    lower.includes('suspend') ||
    lower.includes('escalat')
  )
    return 'audit-badge audit-badge-amber';
  if (
    lower.includes('approv') ||
    lower.includes('releas') ||
    lower.includes('complet')
  )
    return 'audit-badge audit-badge-teal';
  return 'audit-badge audit-badge-gray';
}

function getEntityLink(
  entity: string,
  entityId?: string | null,
): string | null {
  if (!entityId) return null;
  const routes: Record<string, string> = {
    ComplianceCase: '/admin/compliance',
    RiskAlert: '/admin/risk',
    Payment: '/admin/payments',
    Transaction: '/admin/transactions',
    Wallet: '/admin/accounts',
    Admin: '/admin/administrators',
    User: '/admin/customers',
  };
  const base = routes[entity];
  if (!base) return null;
  return `${base}/${entityId}`;
}

export default function AuditLogDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';

  const [log, setLog] = useState<AuditLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLog = useCallback(async () => {
    if (!id || !/^\d+$/.test(id)) {
      router.replace('/admin/audit-logs');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await apiFetch<AuditLog>(
        `/admin/audit-logs/${id}`,
      );
      setLog(result);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Unable to load log.',
      );
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void loadLog();
  }, [loadLog]);

  if (loading) {
    return (
      <main className="compliance-page">
        <div className="compliance-detail-state">
          <RefreshCw size={32} className="compliance-spin" />
          <h3>Loading audit log...</h3>
        </div>
      </main>
    );
  }

  if (error || !log) {
    return (
      <main className="compliance-page">
        <div
          className="compliance-detail-state compliance-error-state"
        >
          <XCircle size={34} />
          <h3>Unable to load audit log</h3>
          <p>{error ?? 'Log not found.'}</p>
          <Link href="/admin/audit-logs">
            Back to Audit Logs
          </Link>
        </div>
      </main>
    );
  }

  const entityLink = getEntityLink(log.entity, log.entityId);

  const metadataObj =
    log.metadata && typeof log.metadata === 'object'
      ? (log.metadata as Record<string, unknown>)
      : null;

  return (
    <main className="compliance-page">
      {/* HEADER */}
      <div className="compliance-page-header">
        <div>
          <div className="compliance-breadcrumb">
            <span>Admin</span>
            <span>/</span>
            <Link href="/admin/audit-logs">Audit Logs</Link>
            <span>/</span>
            <span>#{log.id}</span>
          </div>

          <div className="compliance-title-row">
            <div className="compliance-title-icon">
              <FileSearch size={24} />
            </div>
            <div>
              <h1>Audit Log #{log.id}</h1>
              <p>{log.action.replaceAll('_', ' ')}</p>
            </div>
          </div>
        </div>

        <Link
          href="/admin/audit-logs"
          className="compliance-back-link"
        >
          <ArrowLeft size={16} />
          Back
        </Link>
      </div>

      <div className="compliance-detail-grid">
        {/* MAIN */}
        <div>
          <section
            className="compliance-content-card"
            style={{ marginBottom: '16px' }}
          >
            <div className="compliance-detail-section-header">
              <FileSearch size={17} />
              <h2>Log Details</h2>
            </div>

            <dl className="compliance-detail-list">
              <div>
                <dt>Log ID</dt>
                <dd>#{log.id}</dd>
              </div>
              <div>
                <dt>Action</dt>
                <dd>
                  <span className={getActionClass(log.action)}>
                    {log.action.replaceAll('_', ' ')}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Entity</dt>
                <dd
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '13px',
                  }}
                >
                  {log.entity}
                </dd>
              </div>
              <div>
                <dt>Entity ID</dt>
                <dd>
                  {entityLink ? (
                    <Link
                      href={entityLink}
                      style={{
                        color: '#2563eb',
                        fontFamily: 'monospace',
                        fontSize: '13px',
                      }}
                    >
                      {log.entityId}
                    </Link>
                  ) : (
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '13px',
                      }}
                    >
                      {log.entityId ?? '—'}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Actor</dt>
                <dd>
                  {log.adminId
                    ? `Admin #${log.adminId}`
                    : log.userId
                    ? `User #${log.userId}`
                    : 'System'}
                </dd>
              </div>
              <div>
                <dt>Timestamp</dt>
                <dd>{formatDate(log.createdAt)}</dd>
              </div>
            </dl>
          </section>

          {/* METADATA */}
          {metadataObj &&
            Object.keys(metadataObj).length > 0 && (
              <section className="compliance-content-card">
                <div className="compliance-detail-section-header">
                  <FileSearch size={17} />
                  <h2>Metadata</h2>
                </div>

                <dl className="compliance-detail-list">
                  {Object.entries(metadataObj).map(
                    ([key, val]) => (
                      <div key={key}>
                        <dt
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            color: '#94a3b8',
                          }}
                        >
                          {key}
                        </dt>
                        <dd
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            wordBreak: 'break-all',
                          }}
                        >
                          {val === null || val === undefined
                            ? '—'
                            : typeof val === 'object'
                            ? JSON.stringify(val)
                            : String(val)}
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
              </section>
            )}

          {/* Raw metadata fallback */}
          {log.metadata &&
            typeof log.metadata === 'string' && (
              <section className="compliance-content-card">
                <div className="compliance-detail-section-header">
                  <FileSearch size={17} />
                  <h2>Raw Metadata</h2>
                </div>
                <div style={{ padding: '16px' }}>
                  <pre
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      color: '#475569',
                      background: '#f8fafc',
                      padding: '12px',
                      borderRadius: '8px',
                      overflowX: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {log.metadata}
                  </pre>
                </div>
              </section>
            )}
        </div>

        {/* SIDE */}
        <div>
          <section className="compliance-content-card">
            <div className="compliance-detail-section-header">
              <FileSearch size={17} />
              <h2>Linked Record</h2>
            </div>

            <div style={{ padding: '16px' }}>
              {entityLink ? (
                <Link
                  href={entityLink}
                  className="compliance-view-link"
                  style={{ fontSize: '13px' }}
                >
                  View {log.entity} #{log.entityId}
                  <ArrowLeft
                    size={14}
                    style={{ transform: 'rotate(180deg)' }}
                  />
                </Link>
              ) : (
                <p
                  style={{
                    fontSize: '13px',
                    color: '#94a3b8',
                  }}
                >
                  No direct link available for{' '}
                  <strong>{log.entity}</strong>.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
