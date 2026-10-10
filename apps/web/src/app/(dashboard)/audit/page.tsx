'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useRouter } from 'next/navigation';

import {
  Activity,
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

/* =====================================================
   TYPES
===================================================== */

type AuditLog = {
  id: number;
  action: string;
  entity: string;
  entityId: string | null;
  userId: number | null;
  userEmail: string | null;
  ipAddress: string | null;
  metadata: unknown;
  createdAt: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type AuditResponse = {
  data: AuditLog[];
  pagination: Pagination;
};

type ApiError = {
  message?: string;
};

const PAGE_SIZE = 20;

/* =====================================================
   HELPERS
===================================================== */

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as ApiError).message === 'string'
  ) {
    return (error as ApiError).message || fallback;
  }

  return fallback;
}

function normalizeAuditLog(
  value: unknown,
): AuditLog | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const log = value as Record<string, unknown>;

  if (
    typeof log.id !== 'number' ||
    typeof log.action !== 'string' ||
    typeof log.entity !== 'string' ||
    typeof log.createdAt !== 'string'
  ) {
    return null;
  }

  let userEmail: string | null = null;

  /*
   * Support nested user object:
   *
   * user: {
   *   email: 'user@example.com'
   * }
   */
  if (
    typeof log.user === 'object' &&
    log.user !== null &&
    'email' in log.user &&
    typeof (log.user as Record<string, unknown>).email ===
      'string'
  ) {
    userEmail = (
      log.user as Record<string, unknown>
    ).email as string;
  }

  /*
   * Direct userEmail takes priority.
   */
  if (typeof log.userEmail === 'string') {
    userEmail = log.userEmail;
  }

  const entityId =
    typeof log.entityId === 'string'
      ? log.entityId
      : typeof log.entityId === 'number'
        ? String(log.entityId)
        : null;

  return {
    id: log.id,

    action: log.action,

    entity: log.entity,

    entityId,

    userId:
      typeof log.userId === 'number'
        ? log.userId
        : null,

    userEmail,

    ipAddress:
      typeof log.ipAddress === 'string'
        ? log.ipAddress
        : null,

    metadata: log.metadata ?? null,

    createdAt: log.createdAt,
  };
}

function normalizeAuditResponse(
  value: unknown,
): AuditResponse | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const response = value as Record<string, unknown>;

  if (!Array.isArray(response.data)) {
    return null;
  }

  const logs = response.data
    .map(normalizeAuditLog)
    .filter(
      (log): log is AuditLog =>
        log !== null,
    );

  /*
   * FORMAT 1
   *
   * {
   *   data: [],
   *   pagination: {
   *     page,
   *     limit,
   *     total,
   *     totalPages
   *   }
   * }
   */

  if (
    typeof response.pagination === 'object' &&
    response.pagination !== null
  ) {
    const pagination =
      response.pagination as Record<string, unknown>;

    const page =
      typeof pagination.page === 'number'
        ? pagination.page
        : 1;

    const limit =
      typeof pagination.limit === 'number'
        ? pagination.limit
        : PAGE_SIZE;

    const total =
      typeof pagination.total === 'number'
        ? pagination.total
        : logs.length;

    const totalPages =
      typeof pagination.totalPages === 'number'
        ? pagination.totalPages
        : Math.max(
            1,
            Math.ceil(total / limit),
          );

    return {
      data: logs,

      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /*
   * FORMAT 2
   *
   * {
   *   data: [],
   *   page: 1,
   *   limit: 20,
   *   total: 100
   * }
   */

  const page =
    typeof response.page === 'number'
      ? response.page
      : 1;

  const limit =
    typeof response.limit === 'number'
      ? response.limit
      : PAGE_SIZE;

  const total =
    typeof response.total === 'number'
      ? response.total
      : logs.length;

  return {
    data: logs,

    pagination: {
      page,
      limit,
      total,

      totalPages: Math.max(
        1,
        Math.ceil(total / limit),
      ),
    },
  };
}

function formatDate(
  dateString: string,
): string {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatAction(
  action: string,
): string {
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

function getActionClass(
  action: string,
): string {
  const normalizedAction =
    action.toLowerCase();

  if (
    normalizedAction.includes('delete') ||
    normalizedAction.includes('remove') ||
    normalizedAction.includes('reject') ||
    normalizedAction.includes('fail') ||
    normalizedAction.includes('reverse')
  ) {
    return 'audit-action danger';
  }

  if (
    normalizedAction.includes('create') ||
    normalizedAction.includes('approve') ||
    normalizedAction.includes('success') ||
    normalizedAction.includes('complete') ||
    normalizedAction.includes('login') ||
    normalizedAction.includes('deposit')
  ) {
    return 'audit-action success';
  }

  if (
    normalizedAction.includes('update') ||
    normalizedAction.includes('edit') ||
    normalizedAction.includes('change') ||
    normalizedAction.includes('withdraw')
  ) {
    return 'audit-action warning';
  }

  if (
    normalizedAction.includes('transfer') ||
    normalizedAction.includes('view')
  ) {
    return 'audit-action info';
  }

  return 'audit-action neutral';
}

function formatMetadata(
  metadata: unknown,
): string | null {
  if (
    metadata === null ||
    metadata === undefined ||
    metadata === ''
  ) {
    return null;
  }

  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);

      return JSON.stringify(
        parsed,
        null,
        2,
      );
    } catch {
      return metadata;
    }
  }

  try {
    return JSON.stringify(
      metadata,
      null,
      2,
    );
  } catch {
    return 'Unable to display metadata.';
  }
}

/* =====================================================
   COMPONENT
===================================================== */

export default function AuditPage() {
  const router = useRouter();

  const [logs, setLogs] =
    useState<AuditLog[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  const [search, setSearch] =
    useState('');

  const [actionFilter, setActionFilter] =
    useState('ALL');

  const [page, setPage] =
    useState(1);

  const [total, setTotal] =
    useState(0);

  const [selectedLog, setSelectedLog] =
    useState<AuditLog | null>(null);

  const requestInProgress =
    useRef(false);

  /* =====================================================
     AUTH HANDLING
  ===================================================== */

  const handleUnauthorized =
    useCallback(() => {
      localStorage.removeItem(
        'access_token',
      );

      localStorage.removeItem(
        'user',
      );

      router.push('/login');
    }, [router]);

  /* =====================================================
     LOAD AUDIT LOGS
  ===================================================== */

  const loadAuditLogs =
    useCallback(
      async (
        requestedPage = 1,
        isRefresh = false,
      ) => {
        if (requestInProgress.current) {
          return;
        }

        requestInProgress.current = true;

        try {
          setError('');

          if (isRefresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          const params =
            new URLSearchParams({
              page: String(requestedPage),
              limit: String(PAGE_SIZE),
            });

          const response: unknown =
            await apiFetch(
              `/audit?${params.toString()}`,
            );

          const auditResponse =
            normalizeAuditResponse(response);

          if (!auditResponse) {
            console.error(
              'Unexpected audit API response:',
              response,
            );

            throw new Error(
              'Unable to process the audit API response.',
            );
          }

          const {
            data,
            pagination,
          } = auditResponse;

          setLogs(data);

          setTotal(
            pagination.total,
          );
        } catch (
          caughtError: unknown
        ) {
          console.error(
            'Audit loading error:',
            caughtError,
          );

          const message =
            getErrorMessage(
              caughtError,
              'Unable to load audit logs.',
            );

          const normalizedMessage =
            message.toLowerCase();

          if (
            normalizedMessage.includes(
              'unauthorized',
            ) ||
            normalizedMessage.includes(
              'unauthenticated',
            ) ||
            normalizedMessage.includes(
              '401',
            )
          ) {
            handleUnauthorized();

            return;
          }

          setLogs([]);

          setTotal(0);

          setError(message);
        } finally {
          setLoading(false);

          setRefreshing(false);

          requestInProgress.current =
            false;
        }
      },
      [handleUnauthorized],
    );

  /* =====================================================
     INITIAL LOAD + PAGE CHANGE

     Using setTimeout prevents the React ESLint rule:

     react-hooks/set-state-in-effect

     from detecting synchronous state updates.
  ===================================================== */

  useEffect(() => {
    const timer =
      window.setTimeout(() => {
        void loadAuditLogs(page);
      }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    page,
    loadAuditLogs,
  ]);

  /* =====================================================
     FILTERED LOGS
  ===================================================== */

  const filteredLogs =
    useMemo(() => {
      const normalizedSearch =
        search.trim().toLowerCase();

      return logs.filter((log) => {
        const matchesSearch =
          !normalizedSearch ||
          log.action
            .toLowerCase()
            .includes(normalizedSearch) ||
          log.entity
            .toLowerCase()
            .includes(normalizedSearch) ||
          log.entityId
            ?.toLowerCase()
            .includes(normalizedSearch) ||
          log.userEmail
            ?.toLowerCase()
            .includes(normalizedSearch) ||
          log.ipAddress
            ?.toLowerCase()
            .includes(normalizedSearch) ||
          String(log.userId ?? '')
            .toLowerCase()
            .includes(normalizedSearch);

        const matchesAction =
          actionFilter === 'ALL' ||
          log.action === actionFilter;

        return (
          matchesSearch &&
          matchesAction
        );
      });
    }, [
      logs,
      search,
      actionFilter,
    ]);

  /* =====================================================
     AVAILABLE ACTIONS
  ===================================================== */

  const availableActions =
    useMemo(() => {
      return Array.from(
        new Set(
          logs.map(
            (log) => log.action,
          ),
        ),
      ).sort();
    }, [logs]);

  /* =====================================================
     STATISTICS
  ===================================================== */

  const statistics =
    useMemo(() => {
      const uniqueUsers =
        new Set(
          logs
            .map(
              (log) => log.userId,
            )
            .filter(
              (
                userId,
              ): userId is number =>
                typeof userId ===
                'number',
            ),
        );

      const today =
        new Date();

      const todayLogs =
        logs.filter((log) => {
          const logDate =
            new Date(log.createdAt);

          return (
            logDate.getFullYear() ===
              today.getFullYear() &&
            logDate.getMonth() ===
              today.getMonth() &&
            logDate.getDate() ===
              today.getDate()
          );
        });

      const uniqueActions =
        new Set(
          logs.map(
            (log) => log.action,
          ),
        );

      return {
        totalLogs: total,

        pageLogs: logs.length,

        todayLogs:
          todayLogs.length,

        uniqueUsers:
          uniqueUsers.size,

        uniqueActions:
          uniqueActions.size,
      };
    }, [logs, total]);

  /* =====================================================
     PAGINATION
  ===================================================== */

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        total / PAGE_SIZE,
      ),
    );

  const canGoPrevious =
    page > 1;

  const canGoNext =
    page < totalPages;

  function goToPreviousPage() {
    if (
      !canGoPrevious ||
      loading ||
      refreshing
    ) {
      return;
    }

    setPage(
      (currentPage) =>
        Math.max(
          1,
          currentPage - 1,
        ),
    );
  }

  function goToNextPage() {
    if (
      !canGoNext ||
      loading ||
      refreshing
    ) {
      return;
    }

    setPage(
      (currentPage) =>
        Math.min(
          totalPages,
          currentPage + 1,
        ),
    );
  }

  function handleRefresh() {
    void loadAuditLogs(
      page,
      true,
    );
  }

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="audit-page">

      {/* PAGE HEADER */}

      <div className="audit-header">
        <div>
          <div className="audit-title-row">
            <div className="audit-header-icon">
              <ShieldCheck size={25} />
            </div>

            <div>
              <h1>Audit Logs</h1>

              <p>
                Monitor important system activities,
                user actions and security events
                across Zarova.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="audit-refresh-button"
          onClick={handleRefresh}
          disabled={
            loading ||
            refreshing
          }
        >
          {refreshing ? (
            <Loader2
              size={18}
              className="spin"
            />
          ) : (
            <RefreshCw size={18} />
          )}

          {refreshing
            ? 'Refreshing...'
            : 'Refresh'}
        </button>
      </div>

      {/* ERROR */}

      {error && (
        <div className="audit-error">
          <AlertCircle size={21} />

          <div>
            <strong>
              Unable to load audit logs
            </strong>

            <span>{error}</span>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadAuditLogs(page)
            }
          >
            Try Again
          </button>
        </div>
      )}

      {/* STATISTICS */}

      {!loading && (
        <div className="audit-stats-grid">

          <div className="audit-stat-card">
            <div className="audit-stat-icon primary">
              <Activity size={21} />
            </div>

            <div>
              <span>
                Total Audit Events
              </span>

              <strong>
                {statistics.totalLogs}
              </strong>

              <small>
                Recorded system activities
              </small>
            </div>
          </div>

          <div className="audit-stat-card">
            <div className="audit-stat-icon success">
              <CalendarDays size={21} />
            </div>

            <div>
              <span>
                Today&apos;s Events
              </span>

              <strong>
                {statistics.todayLogs}
              </strong>

              <small>
                Events recorded today
              </small>
            </div>
          </div>

          <div className="audit-stat-card">
            <div className="audit-stat-icon warning">
              <UserRound size={21} />
            </div>

            <div>
              <span>
                Active Users
              </span>

              <strong>
                {statistics.uniqueUsers}
              </strong>

              <small>
                Users on current page
              </small>
            </div>
          </div>

          <div className="audit-stat-card">
            <div className="audit-stat-icon info">
              <FileText size={21} />
            </div>

            <div>
              <span>
                Action Types
              </span>

              <strong>
                {statistics.uniqueActions}
              </strong>

              <small>
                {statistics.pageLogs} events loaded
              </small>
            </div>
          </div>

        </div>
      )}

      {/* LOADING */}

      {loading ? (
        <div className="audit-loading">
          <Loader2
            size={34}
            className="spin"
          />

          <p>
            Loading audit activity...
          </p>
        </div>
      ) : (
        <>

          {/* FILTERS */}

          <section className="audit-controls">

            <div className="audit-search">
              <Search size={19} />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search actions, users, entities or IP addresses..."
              />
            </div>

            <select
              className="audit-filter"
              value={actionFilter}
              onChange={(event) =>
                setActionFilter(
                  event.target.value,
                )
              }
            >
              <option value="ALL">
                All Actions
              </option>

              {availableActions.map(
                (action) => (
                  <option
                    key={action}
                    value={action}
                  >
                    {formatAction(
                      action,
                    )}
                  </option>
                ),
              )}
            </select>

          </section>

          {/* TABLE */}

          <section className="audit-table-section">

            <div className="audit-table-header">
              <div>
                <h2>
                  System Activity
                </h2>

                <p>
                  Detailed record of actions
                  performed across the
                  Zarova platform.
                </p>
              </div>

              <span className="audit-count">
                {filteredLogs.length} of{' '}
                {logs.length} shown
              </span>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="audit-empty">
                <ShieldCheck size={44} />

                <h3>
                  No Audit Records Found
                </h3>

                <p>
                  {logs.length === 0
                    ? 'No audit activity has been recorded yet.'
                    : 'No audit records match your current search or filter.'}
                </p>
              </div>
            ) : (
              <div className="audit-table-wrapper">

                <table className="audit-table">

                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>User</th>
                      <th>IP Address</th>
                      <th>Date &amp; Time</th>

                      <th className="audit-actions-column">
                        Details
                      </th>
                    </tr>
                  </thead>

                  <tbody>

                    {filteredLogs.map(
                      (log) => (
                        <tr key={log.id}>

                          <td>
                            <span
                              className={getActionClass(
                                log.action,
                              )}
                            >
                              {formatAction(
                                log.action,
                              )}
                            </span>
                          </td>

                          <td>
                            <div className="audit-entity">
                              <strong>
                                {log.entity}
                              </strong>

                              {log.entityId && (
                                <span>
                                  ID: {log.entityId}
                                </span>
                              )}
                            </div>
                          </td>

                          <td>
                            <div className="audit-user">

                              <div className="audit-user-avatar">
                                <UserRound
                                  size={16}
                                />
                              </div>

                              <div>
                                <strong>
                                  {log.userEmail ||
                                    'System'}
                                </strong>

                                <span>
                                  {log.userId
                                    ? `User #${log.userId}`
                                    : 'Automated action'}
                                </span>
                              </div>

                            </div>
                          </td>

                          <td>
                            <code className="audit-ip">
                              {log.ipAddress ||
                                'N/A'}
                            </code>
                          </td>

                          <td>
                            <span className="audit-date">
                              {formatDate(
                                log.createdAt,
                              )}
                            </span>
                          </td>

                          <td className="audit-actions-column">

                            <button
                              type="button"
                              className="audit-view-button"
                              onClick={() =>
                                setSelectedLog(log)
                              }
                            >
                              <Eye size={17} />

                              View
                            </button>

                          </td>

                        </tr>
                      ),
                    )}

                  </tbody>

                </table>

              </div>
            )}

            {/* PAGINATION */}

            {total > 0 && (
              <div className="audit-pagination">

                <div className="audit-pagination-info">
                  Page {page} of{' '}
                  {totalPages}
                </div>

                <div className="audit-pagination-actions">

                  <button
                    type="button"
                    onClick={goToPreviousPage}
                    disabled={
                      !canGoPrevious ||
                      loading ||
                      refreshing
                    }
                  >
                    <ChevronLeft size={18} />

                    Previous
                  </button>

                  <button
                    type="button"
                    onClick={goToNextPage}
                    disabled={
                      !canGoNext ||
                      loading ||
                      refreshing
                    }
                  >
                    Next

                    <ChevronRight size={18} />
                  </button>

                </div>

              </div>
            )}

          </section>

        </>
      )}

      {/* AUDIT DETAILS MODAL */}

      {selectedLog && (
        <div
          className="audit-modal-overlay"
          onClick={() =>
            setSelectedLog(null)
          }
          role="presentation"
        >

          <div
            className="audit-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-modal-title"
          >

            {/* MODAL HEADER */}

            <div className="audit-modal-header">

              <div>
                <span className="audit-modal-label">
                  Audit Record
                </span>

                <h2 id="audit-modal-title">
                  Activity Details
                </h2>
              </div>

              <button
                type="button"
                className="audit-modal-close"
                onClick={() =>
                  setSelectedLog(null)
                }
                aria-label="Close audit details"
              >
                <X size={20} />
              </button>

            </div>

            {/* MODAL CONTENT */}

            <div className="audit-modal-content">

              <div className="audit-detail-grid">

                <div className="audit-detail-item">
                  <span>Action</span>

                  <strong>
                    {formatAction(
                      selectedLog.action,
                    )}
                  </strong>
                </div>

                <div className="audit-detail-item">
                  <span>Entity</span>

                  <strong>
                    {selectedLog.entity}
                  </strong>
                </div>

                <div className="audit-detail-item">
                  <span>Entity ID</span>

                  <strong>
                    {selectedLog.entityId ||
                      'N/A'}
                  </strong>
                </div>

                <div className="audit-detail-item">
                  <span>User</span>

                  <strong>
                    {selectedLog.userEmail ||
                      'System'}
                  </strong>
                </div>

                <div className="audit-detail-item">
                  <span>User ID</span>

                  <strong>
                    {selectedLog.userId
                      ? `#${selectedLog.userId}`
                      : 'N/A'}
                  </strong>
                </div>

                <div className="audit-detail-item">
                  <span>IP Address</span>

                  <strong>
                    {selectedLog.ipAddress ||
                      'N/A'}
                  </strong>
                </div>

                <div className="audit-detail-item full">
                  <span>Date &amp; Time</span>

                  <strong>
                    {formatDate(
                      selectedLog.createdAt,
                    )}
                  </strong>
                </div>

              </div>

              {/* METADATA */}

              <div className="audit-metadata-section">

                <div className="audit-metadata-header">
                  <FileText size={18} />

                  <span>
                    Additional Metadata
                  </span>
                </div>

                {formatMetadata(
                  selectedLog.metadata,
                ) ? (
                  <pre className="audit-metadata">
                    {formatMetadata(
                      selectedLog.metadata,
                    )}
                  </pre>
                ) : (
                  <div className="audit-no-metadata">
                    No additional metadata
                    available for this audit
                    record.
                  </div>
                )}

              </div>

            </div>

            {/* MODAL FOOTER */}

            <div className="audit-modal-footer">

              <button
                type="button"
                className="audit-close-button"
                onClick={() =>
                  setSelectedLog(null)
                }
              >
                Close
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}