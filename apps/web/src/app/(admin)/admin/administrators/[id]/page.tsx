'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Edit3,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCog,
  UserRoundCheck,
  UserRoundX,
  X,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

type AdminStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

type Admin = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  status: AdminStatus;
  createdAt?: string;
  updatedAt?: string;
};

type Role = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
};

type AssignedRole = Role & {
  assignmentId?: number;
  createdAt?: string;
};

type ConfirmAction =
  | 'suspend'
  | 'reactivate'
  | 'remove-role'
  | null;

function formatDateTime(value?: string) {
  if (!value) return '—';

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function getInitials(
  firstName?: string,
  lastName?: string,
) {
  const initials =
    `${firstName?.trim()?.[0] ?? ''}${lastName?.trim()?.[0] ?? ''}`
      .toUpperCase();

  return initials || 'AD';
}

function statusLabel(status?: AdminStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'Active';
    case 'SUSPENDED':
      return 'Suspended';
    case 'DEACTIVATED':
      return 'Deactivated';
    default:
      return status ?? 'Unknown';
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

/*
 * The API is the source of truth, but the UI still normalizes
 * the response before rendering it. This prevents malformed or
 * duplicated role records from producing unstable React keys.
 */
function normalizeRoles(value: unknown): AssignedRole[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: AssignedRole[] = [];
  const seenIds = new Set<number>();

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const candidate = item as Partial<AssignedRole>;

    const id = Number(candidate.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      continue;
    }

    if (seenIds.has(id)) {
      continue;
    }

    if (
      typeof candidate.code !== 'string' ||
      typeof candidate.name !== 'string'
    ) {
      continue;
    }

    seenIds.add(id);

    normalized.push({
      id,
      code: candidate.code,
      name: candidate.name,
      description:
        typeof candidate.description === 'string'
          ? candidate.description
          : null,
      isActive:
        candidate.isActive !== false,
      assignmentId:
        Number.isSafeInteger(candidate.assignmentId)
          ? candidate.assignmentId
          : undefined,
      createdAt:
        typeof candidate.createdAt === 'string'
          ? candidate.createdAt
          : undefined,
    });
  }

  return normalized;
}

function normalizeAvailableRoles(value: unknown): Role[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: Role[] = [];
  const seenIds = new Set<number>();

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const candidate = item as Partial<Role>;
    const id = Number(candidate.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      continue;
    }

    if (seenIds.has(id)) {
      continue;
    }

    if (
      typeof candidate.code !== 'string' ||
      typeof candidate.name !== 'string'
    ) {
      continue;
    }

    seenIds.add(id);

    normalized.push({
      id,
      code: candidate.code,
      name: candidate.name,
      description:
        typeof candidate.description === 'string'
          ? candidate.description
          : null,
      isActive:
        candidate.isActive !== false,
    });
  }

  return normalized;
}

export default function AdministratorDetailsPage() {
  const params = useParams<{ id: string }>();

  const adminId = Number(params.id);

  const [admin, setAdmin] = useState<Admin | null>(null);
  const [roles, setRoles] = useState<AssignedRole[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [editing, setEditing] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const [confirmAction, setConfirmAction] =
    useState<ConfirmAction>(null);

  const [roleToRemove, setRoleToRemove] =
    useState<AssignedRole | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const validId =
    Number.isSafeInteger(adminId) && adminId > 0;

  const assignedRoleIds = useMemo(
    () => new Set(roles.map((role) => role.id)),
    [roles],
  );

  const assignableRoles = useMemo(
    () =>
      availableRoles.filter(
        (role) =>
          role.isActive !== false &&
          !assignedRoleIds.has(role.id),
      ),
    [availableRoles, assignedRoleIds],
  );

  async function load(options?: { refresh?: boolean }) {
    if (!validId) {
      setError('Invalid administrator ID.');
      setLoading(false);
      return;
    }

    const refresh = options?.refresh === true;

    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const [adminData, adminRoles, allRoles] =
        await Promise.all([
          apiFetch<Admin>(`/admins/${adminId}`),
          apiFetch<unknown>(
            `/admin/${adminId}/roles`,
          ),
          apiFetch<unknown>('/admin/roles'),
        ]);

      if (!adminData?.id) {
        throw new Error(
          'Administrator record is invalid.',
        );
      }

      const normalizedAssignedRoles =
        normalizeRoles(adminRoles);

      const normalizedAvailableRoles =
        normalizeAvailableRoles(allRoles);

      setAdmin(adminData);
      setRoles(normalizedAssignedRoles);
      setAvailableRoles(normalizedAvailableRoles);

      setFirstName(adminData.firstName ?? '');
      setLastName(adminData.lastName ?? '');
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, [adminId]);

  function startEditing() {
    if (!admin) return;

    setFirstName(admin.firstName);
    setLastName(admin.lastName);
    setError('');
    setSuccess('');
    setEditing(true);
  }

  function cancelEditing() {
    if (!admin) return;

    setFirstName(admin.firstName);
    setLastName(admin.lastName);
    setEditing(false);
  }

  async function handleProfileSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!admin || savingProfile) return;

    const normalizedFirstName =
      firstName.trim();

    const normalizedLastName =
      lastName.trim();

    if (!normalizedFirstName) {
      setError('First name is required.');
      return;
    }

    if (!normalizedLastName) {
      setError('Last name is required.');
      return;
    }

    setSavingProfile(true);
    setError('');
    setSuccess('');

    try {
      const updated = await apiFetch<Admin>(
        `/admins/${admin.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            firstName: normalizedFirstName,
            lastName: normalizedLastName,
          }),
        },
      );

      setAdmin(updated);
      setFirstName(updated.firstName);
      setLastName(updated.lastName);
      setEditing(false);
      setSuccess(
        'Administrator profile updated successfully.',
      );
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAssignRole(roleId: number) {
    if (!admin || savingRole) return;

    setSavingRole(true);
    setError('');
    setSuccess('');
    setShowRoleMenu(false);

    try {
      await apiFetch(
        `/admin/${admin.id}/roles/${roleId}`,
        {
          method: 'POST',
        },
      );

      await load({ refresh: true });

      setSuccess('Role assigned successfully.');
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSavingRole(false);
    }
  }

  function requestRemoveRole(
    role: AssignedRole,
  ) {
    setRoleToRemove(role);
    setConfirmAction('remove-role');
  }

  async function handleRemoveRole() {
    if (!admin || !roleToRemove || savingRole) {
      return;
    }

    setSavingRole(true);
    setError('');
    setSuccess('');

    try {
      await apiFetch(
        `/admin/${admin.id}/roles/${roleToRemove.id}`,
        {
          method: 'DELETE',
        },
      );

      setConfirmAction(null);
      setRoleToRemove(null);

      await load({ refresh: true });

      setSuccess('Role removed successfully.');
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSavingRole(false);
    }
  }

  function requestStatusChange() {
    if (!admin || changingStatus) return;

    if (admin.status === 'ACTIVE') {
      setConfirmAction('suspend');
      return;
    }

    if (admin.status === 'SUSPENDED') {
      setConfirmAction('reactivate');
    }
  }

  async function handleStatusChange() {
    if (!admin || changingStatus) return;

    const nextStatus =
      admin.status === 'ACTIVE'
        ? 'SUSPENDED'
        : 'ACTIVE';

    setChangingStatus(true);
    setError('');
    setSuccess('');

    try {
      const updated = await apiFetch<Admin>(
        `/admins/${admin.id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: nextStatus,
          }),
        },
      );

      setAdmin(updated);
      setConfirmAction(null);

      setSuccess(
        nextStatus === 'ACTIVE'
          ? 'Administrator account reactivated successfully.'
          : 'Administrator account suspended successfully.',
      );
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setChangingStatus(false);
    }
  }

  function closeConfirmation() {
    if (changingStatus || savingRole) {
      return;
    }

    setConfirmAction(null);
    setRoleToRemove(null);
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading admin-detail-loading">
          <div className="admin-loader" />
          <span>
            Loading administrator profile...
          </span>
        </div>
      </div>
    );
  }

  if (!validId || !admin) {
    return (
      <div className="admin-page">
        <div
          className="admin-alert admin-alert-error"
          role="alert"
        >
          {error || 'Administrator not found.'}
        </div>

        <Link
          href="/admin/administrators"
          className="admin-back-link"
        >
          <ArrowLeft size={16} />
          Back to administrators
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-detail-topbar">
        <Link
          href="/admin/administrators"
          className="admin-back-link"
        >
          <ArrowLeft size={16} />
          Back to administrators
        </Link>

        <button
          type="button"
          className="secondary-button"
          onClick={() => void load({ refresh: true })}
          disabled={refreshing}
        >
          <RefreshCw
            size={16}
            className={
              refreshing
                ? 'admin-refresh-spin'
                : ''
            }
          />
          {refreshing
            ? 'Refreshing...'
            : 'Refresh'}
        </button>
      </div>

      {error && (
        <div
          className="admin-alert admin-alert-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="admin-alert admin-alert-success"
          role="status"
        >
          <CheckCircle2 size={17} />
          <span>{success}</span>
        </div>
      )}

      <section className="admin-profile-hero">
        <div className="admin-profile-identity">
          <div className="admin-profile-avatar">
            {getInitials(
              admin.firstName,
              admin.lastName,
            )}
          </div>

          <div className="admin-profile-copy">
            <div className="admin-eyebrow">
              <ShieldCheck size={15} />
              Administrator account
            </div>

            <h1>
              {admin.firstName} {admin.lastName}
            </h1>

            <p>
              <Mail size={14} />
              {admin.email}
            </p>
          </div>
        </div>

        <div className="admin-profile-actions">
          <span
            className={`status-badge ${admin.status.toLowerCase()}`}
          >
            <span className="status-dot" />
            {statusLabel(admin.status)}
          </span>

          <button
            type="button"
            className="secondary-button"
            onClick={startEditing}
          >
            <Edit3 size={15} />
            Edit profile
          </button>

          {admin.status !== 'DEACTIVATED' && (
            <button
              type="button"
              className={
                admin.status === 'ACTIVE'
                  ? 'danger-button'
                  : 'primary-button'
              }
              onClick={requestStatusChange}
              disabled={changingStatus}
            >
              {admin.status === 'ACTIVE' ? (
                <>
                  <UserRoundX size={15} />
                  Suspend
                </>
              ) : (
                <>
                  <UserRoundCheck size={15} />
                  Reactivate
                </>
              )}
            </button>
          )}
        </div>
      </section>

      <section className="admin-detail-summary-grid">
        <div className="admin-detail-summary-card">
          <span>Administrator ID</span>
          <strong>
            ADM-{String(admin.id).padStart(4, '0')}
          </strong>
        </div>

        <div className="admin-detail-summary-card">
          <span>Account status</span>
          <strong>
            {statusLabel(admin.status)}
          </strong>
        </div>

        <div className="admin-detail-summary-card">
          <span>Assigned roles</span>
          <strong>{roles.length}</strong>
        </div>

        <div className="admin-detail-summary-card">
          <span>Created</span>
          <strong>
            {formatDateTime(admin.createdAt)}
          </strong>
        </div>
      </section>

      <div className="admin-detail-grid">
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <span className="admin-eyebrow">
                Account information
              </span>
              <h2>Administrator profile</h2>
              <p>
                Identity and account metadata for this
                administrator.
              </p>
            </div>
          </div>

          {editing ? (
            <form
              className="admin-create-form"
              onSubmit={handleProfileSubmit}
            >
              <div className="admin-form-grid">
                <label className="admin-form-field">
                  <span>
                    First name <b>*</b>
                  </span>

                  <input
                    type="text"
                    value={firstName}
                    onChange={(event) => {
                      setFirstName(
                        event.target.value,
                      );
                      setError('');
                    }}
                    disabled={savingProfile}
                    required
                  />
                </label>

                <label className="admin-form-field">
                  <span>
                    Last name <b>*</b>
                  </span>

                  <input
                    type="text"
                    value={lastName}
                    onChange={(event) => {
                      setLastName(
                        event.target.value,
                      );
                      setError('');
                    }}
                    disabled={savingProfile}
                    required
                  />
                </label>
              </div>

              <div className="admin-detail-info-grid">
                <div>
                  <span>Email address</span>
                  <strong>{admin.email}</strong>
                </div>

                <div>
                  <span>Last updated</span>
                  <strong>
                    {formatDateTime(
                      admin.updatedAt,
                    )}
                  </strong>
                </div>
              </div>

              <div className="admin-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={cancelEditing}
                  disabled={savingProfile}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <>
                      <Loader2
                        size={16}
                        className="admin-refresh-spin"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Save changes
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="admin-detail-info-grid">
              <div>
                <span>First name</span>
                <strong>
                  {admin.firstName}
                </strong>
              </div>

              <div>
                <span>Last name</span>
                <strong>
                  {admin.lastName}
                </strong>
              </div>

              <div>
                <span>Email address</span>
                <strong>{admin.email}</strong>
              </div>

              <div>
                <span>Created</span>
                <strong>
                  {formatDateTime(
                    admin.createdAt,
                  )}
                </strong>
              </div>

              <div>
                <span>Last updated</span>
                <strong>
                  {formatDateTime(
                    admin.updatedAt,
                  )}
                </strong>
              </div>

              <div>
                <span>Account status</span>
                <strong>
                  {statusLabel(admin.status)}
                </strong>
              </div>
            </div>
          )}
        </section>

        <section className="admin-panel admin-security-panel">
          <div className="admin-panel-header">
            <div>
              <span className="admin-eyebrow">
                Security
              </span>
              <h2>Access controls</h2>
              <p>
                Privileged account controls are
                enforced by the API.
              </p>
            </div>
          </div>

          <div className="admin-security-content">
            <div className="admin-security-item">
              <div className="admin-security-icon">
                <ShieldCheck size={18} />
              </div>

              <div>
                <strong>RBAC protected</strong>
                <span>
                  Access is determined by assigned
                  roles and permissions.
                </span>
              </div>
            </div>

            <div className="admin-security-item">
              <div className="admin-security-icon">
                <UserCog size={18} />
              </div>

              <div>
                <strong>Role assignments</strong>
                <span>
                  {roles.length === 0
                    ? 'No active roles are assigned.'
                    : `${roles.length} active role${roles.length === 1 ? '' : 's'} assigned.`}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="admin-panel admin-role-panel">
          <div className="admin-panel-header">
            <div>
              <span className="admin-eyebrow">
                Authorization
              </span>
              <h2>Role assignments</h2>
              <p>
                Manage the roles that determine this
                administrator's permissions.
              </p>
            </div>

            <div className="admin-role-action">
              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  setShowRoleMenu(
                    (current) => !current,
                  )
                }
                disabled={
                  savingRole ||
                  assignableRoles.length === 0
                }
              >
                <Plus size={15} />
                Assign role
                <ChevronDown size={14} />
              </button>

              {showRoleMenu && (
                <div className="admin-role-menu">
                  {assignableRoles.length === 0 ? (
                    <div className="admin-role-menu-empty">
                      All available roles are already
                      assigned.
                    </div>
                  ) : (
                    assignableRoles.map((role) => (
                      <button
                        key={`available-role-${role.id}`}
                        type="button"
                        onClick={() =>
                          void handleAssignRole(
                            role.id,
                          )
                        }
                      >
                        <span>
                          <strong>
                            {role.name}
                          </strong>
                          <small>
                            {role.code}
                          </small>
                        </span>
                        <Plus size={14} />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="admin-role-list">
            {roles.length === 0 ? (
              <div className="admin-empty admin-role-empty">
                <ShieldCheck size={27} />
                <h3>No roles assigned</h3>
                <p>
                  Assign an RBAC role to grant this
                  administrator access to Zarova
                  operational functions.
                </p>
              </div>
            ) : (
              roles.map((role) => (
                <div
                  key={`assigned-role-${role.id}`}
                  className="admin-role-card"
                >
                  <div className="admin-role-icon">
                    <ShieldCheck size={17} />
                  </div>

                  <div className="admin-role-copy">
                    <strong>{role.name}</strong>
                    <span>{role.code}</span>

                    {role.description && (
                      <p>{role.description}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    className="admin-icon-danger"
                    onClick={() =>
                      requestRemoveRole(role)
                    }
                    disabled={savingRole}
                    aria-label={`Remove ${role.name} role`}
                    title={`Remove ${role.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {confirmAction && (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeConfirmation();
            }
          }}
        >
          <div
            className="admin-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-confirm-title"
          >
            <button
              type="button"
              className="admin-modal-close"
              onClick={closeConfirmation}
              aria-label="Close confirmation"
              disabled={
                changingStatus || savingRole
              }
            >
              <X size={18} />
            </button>

            <div
              className={
                confirmAction === 'remove-role'
                  ? 'admin-confirm-icon warning'
                  : 'admin-confirm-icon'
              }
            >
              {confirmAction ===
              'remove-role' ? (
                <Trash2 size={22} />
              ) : confirmAction ===
                'suspend' ? (
                <UserRoundX size={22} />
              ) : (
                <UserRoundCheck size={22} />
              )}
            </div>

            <h2 id="admin-confirm-title">
              {confirmAction ===
              'remove-role'
                ? 'Remove role?'
                : confirmAction === 'suspend'
                  ? 'Suspend administrator?'
                  : 'Reactivate administrator?'}
            </h2>

            <p>
              {confirmAction ===
              'remove-role'
                ? `This will remove the ${roleToRemove?.name ?? 'selected'} role from ${admin.firstName} ${admin.lastName}. The API will enforce RBAC safeguards before completing the action.`
                : confirmAction ===
                    'suspend'
                  ? `This will suspend ${admin.firstName} ${admin.lastName}'s administrator access. Their current administrator session will no longer be accepted by the backend.`
                  : `This will reactivate ${admin.firstName} ${admin.lastName}'s administrator account.`}
            </p>

            <div className="admin-confirm-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={closeConfirmation}
                disabled={
                  changingStatus || savingRole
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className={
                  confirmAction ===
                    'suspend' ||
                  confirmAction ===
                    'remove-role'
                    ? 'danger-button'
                    : 'primary-button'
                }
                onClick={() => {
                  if (
                    confirmAction ===
                    'remove-role'
                  ) {
                    void handleRemoveRole();
                  } else {
                    void handleStatusChange();
                  }
                }}
                disabled={
                  changingStatus || savingRole
                }
              >
                {changingStatus ||
                savingRole ? (
                  <>
                    <Loader2
                      size={16}
                      className="admin-refresh-spin"
                    />
                    Processing...
                  </>
                ) : confirmAction ===
                  'remove-role' ? (
                  <>
                    <Trash2 size={16} />
                    Remove role
                  </>
                ) : confirmAction ===
                  'suspend' ? (
                  <>
                    <UserRoundX size={16} />
                    Suspend administrator
                  </>
                ) : (
                  <>
                    <UserRoundCheck size={16} />
                    Reactivate administrator
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
