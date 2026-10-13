'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  ArrowLeftRight,
  Bell,
  CheckCheck,
  ClipboardCheck,
  CreditCard,
  Info,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

/* ============================================================
   TYPES
   ============================================================ */

type NotificationType =
  | 'TRANSACTION'
  | 'SECURITY'
  | 'SYSTEM'
  | 'COMPLIANCE'
  | 'PAYMENT';

interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  data: Notification[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

/* ============================================================
   HELPERS
   ============================================================ */

function formatTime(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function NotificationIcon({ type }: { type: NotificationType }) {
  const map: Record<
    NotificationType,
    { icon: React.ReactNode; className: string }
  > = {
    TRANSACTION: {
      icon: <ArrowLeftRight size={18} />,
      className: 'notif-icon notif-icon-transaction',
    },
    SECURITY: {
      icon: <ShieldAlert size={18} />,
      className: 'notif-icon notif-icon-security',
    },
    SYSTEM: {
      icon: <Info size={18} />,
      className: 'notif-icon notif-icon-system',
    },
    COMPLIANCE: {
      icon: <ClipboardCheck size={18} />,
      className: 'notif-icon notif-icon-compliance',
    },
    PAYMENT: {
      icon: <CreditCard size={18} />,
      className: 'notif-icon notif-icon-payment',
    },
  };

  const { icon, className } = map[type] ?? map.SYSTEM;

  return <div className={className}>{icon}</div>;
}

/* ============================================================
   PAGE
   ============================================================ */

export default function NotificationsPage() {
  const [result, setResult] =
    useState<NotificationsResponse | null>(null);

  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const [markingAll, setMarkingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [markingId, setMarkingId] = useState<number | null>(null);

  /* ----------------------------------------------------------
     LOAD UNREAD COUNT
     ---------------------------------------------------------- */

  async function loadUnreadCount() {
    try {
      const data = await apiFetch<{ unreadCount: number }>(
        '/notifications/unread-count',
      );
      setUnreadCount(data.unreadCount);
    } catch {
      /* silent — badge is non-critical */
    }
  }

  /* ----------------------------------------------------------
     LOAD NOTIFICATIONS
     ---------------------------------------------------------- */

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      setError('');

      try {
        const params = new URLSearchParams({ limit: '25', offset: '0' });

        if (filter === 'unread') {
          params.set('read', 'false');
        }

        const data =
          await apiFetch<NotificationsResponse>(
            `/notifications?${params.toString()}`,
          );

        setResult(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load notifications.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
      void loadUnreadCount();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [load]);

  /* ----------------------------------------------------------
     MARK ALL AS READ
     ---------------------------------------------------------- */

  async function markAllRead() {
    try {
      setMarkingAll(true);

      await apiFetch('/notifications/read-all', { method: 'PATCH' });

      setResult((prev) =>
        prev
          ? {
              ...prev,
              data: prev.data.map((n) => ({ ...n, read: true })),
            }
          : prev,
      );

      setUnreadCount(0);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to mark notifications as read.',
      );
    } finally {
      setMarkingAll(false);
    }
  }

  /* ----------------------------------------------------------
     MARK SINGLE AS READ
     ---------------------------------------------------------- */

  async function markRead(id: number) {
    try {
      setMarkingId(id);

      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });

      setResult((prev) =>
        prev
          ? {
              ...prev,
              data: prev.data.map((n) =>
                n.id === id ? { ...n, read: true } : n,
              ),
            }
          : prev,
      );

      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      /* silent */
    } finally {
      setMarkingId(null);
    }
  }

  /* ----------------------------------------------------------
     DELETE
     ---------------------------------------------------------- */

  async function deleteNotification(id: number) {
    try {
      setDeletingId(id);

      await apiFetch(`/notifications/${id}`, { method: 'DELETE' });

      setResult((prev) => {
        if (!prev) return prev;

        const removed = prev.data.find((n) => n.id === id);

        return {
          ...prev,
          data: prev.data.filter((n) => n.id !== id),
          pagination: {
            ...prev.pagination,
            total: prev.pagination.total - 1,
          },
        };

        void removed;
      });
    } catch {
      /* silent */
    } finally {
      setDeletingId(null);
    }
  }

  /* ----------------------------------------------------------
     RENDER
     ---------------------------------------------------------- */

  const notifications = result?.data ?? [];
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="notif-page">

      {/* ======================================================
          HEADER
          ====================================================== */}

      <div className="notif-header">
        <div>
          <p className="page-eyebrow">ACCOUNT</p>
          <h1>
            Notifications
            {unreadCount > 0 && (
              <span className="notif-count-badge">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </h1>
          <p>Stay updated on your account activity and alerts.</p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() => void load(true)}
          disabled={refreshing}
        >
          <RefreshCw
            size={16}
            className={refreshing ? 'notif-spin' : ''}
          />
          Refresh
        </button>
      </div>

      {/* ======================================================
          ERROR
          ====================================================== */}

      {error && (
        <div className="notif-error">
          <X size={16} />
          {error}
        </div>
      )}

      {/* ======================================================
          TOOLBAR
          ====================================================== */}

      <div className="notif-toolbar">

        {/* Filter tabs */}
        <div className="notif-filter-tabs">
          <button
            type="button"
            className={`notif-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>

          <button
            type="button"
            className={`notif-tab ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Unread
            {unreadCount > 0 && (
              <span className="notif-tab-badge">{unreadCount}</span>
            )}
          </button>
        </div>

        {/* Mark all as read */}
        {hasUnread && (
          <button
            type="button"
            className="notif-mark-all-button"
            onClick={() => void markAllRead()}
            disabled={markingAll}
          >
            {markingAll ? (
              <Loader2 size={15} className="notif-spin" />
            ) : (
              <CheckCheck size={15} />
            )}
            Mark all as read
          </button>
        )}
      </div>

      {/* ======================================================
          LIST
          ====================================================== */}

      <div className="notif-list-panel">

        {loading ? (
          <div className="notif-loading">
            <Loader2 size={28} className="notif-spin" />
            <span>Loading notifications...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="notif-empty">
            <Bell size={36} />
            <h3>
              {filter === 'unread'
                ? 'No unread notifications'
                : 'No notifications yet'}
            </h3>
            <p>
              {filter === 'unread'
                ? "You're all caught up! Switch to \"All\" to see your history."
                : "We'll notify you about transactions, security events, and account updates."}
            </p>
          </div>
        ) : (
          <ul className="notif-list">
            {notifications.map((notif) => (
              <li
                key={notif.id}
                className={`notif-item ${!notif.read ? 'unread' : ''}`}
              >
                <NotificationIcon type={notif.type} />

                <div className="notif-body">
                  <div className="notif-meta">
                    <span className="notif-type-label">
                      {notif.type.charAt(0) +
                        notif.type.slice(1).toLowerCase()}
                    </span>
                    <span className="notif-time">
                      {formatTime(notif.createdAt)}
                    </span>
                  </div>

                  <p className="notif-title">{notif.title}</p>
                  <p className="notif-message">{notif.message}</p>
                </div>

                <div className="notif-actions">
                  {!notif.read && (
                    <button
                      type="button"
                      className="notif-action-btn"
                      title="Mark as read"
                      onClick={() => void markRead(notif.id)}
                      disabled={markingId === notif.id}
                    >
                      {markingId === notif.id ? (
                        <Loader2 size={15} className="notif-spin" />
                      ) : (
                        <CheckCheck size={15} />
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    className="notif-action-btn danger"
                    title="Delete notification"
                    onClick={() => void deleteNotification(notif.id)}
                    disabled={deletingId === notif.id}
                  >
                    {deletingId === notif.id ? (
                      <Loader2 size={15} className="notif-spin" />
                    ) : (
                      <Trash2 size={15} />
                    )}
                  </button>
                </div>

                {!notif.read && (
                  <span className="notif-unread-dot" aria-label="Unread" />
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Total count footer */}
        {!loading && notifications.length > 0 && (
          <div className="notif-footer">
            Showing {notifications.length} of{' '}
            {result?.pagination.total ?? notifications.length} notifications
          </div>
        )}
      </div>
    </div>
  );
}
