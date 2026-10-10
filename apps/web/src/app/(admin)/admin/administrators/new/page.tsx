'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  ShieldCheck,
  UserPlus,
  UserRound,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

type Admin = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  createdAt?: string;
};

type CreateAdminResponse = Admin;

const MIN_PASSWORD_LENGTH = 8;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to create administrator. Please try again.';
}

export default function CreateAdministratorPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function validate() {
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedFirstName) {
      return 'First name is required.';
    }

    if (!normalizedLastName) {
      return 'Last name is required.';
    }

    if (!normalizedEmail) {
      return 'Email address is required.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return 'Enter a valid email address.';
    }

    if (!password) {
      return 'Temporary password is required.';
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
    }

    if (!confirmPassword) {
      return 'Please confirm the temporary password.';
    }

    if (password !== confirmPassword) {
      return 'Passwords do not match.';
    }

    return '';
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (loading) return;

    setError('');
    setSuccess('');

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const created = await apiFetch<CreateAdminResponse>(
        '/admins',
        {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
          }),
        },
      );

      if (!created?.id) {
        throw new Error(
          'Administrator was created, but the server returned an invalid response.',
        );
      }

      setSuccess(
        'Administrator account created successfully. Redirecting...',
      );

      /*
       * Give the success state a brief moment so the operator
       * receives clear confirmation before moving to details.
       */
      window.setTimeout(() => {
        router.replace(
          `/admin/administrators/${created.id}`,
        );
      }, 500);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-page">
      {/* =====================================================
          TOP BAR
          ===================================================== */}

      <div className="admin-detail-topbar">
        <Link
          href="/admin/administrators"
          className="admin-back-link"
        >
          <ArrowLeft size={16} />
          Back to administrators
        </Link>
      </div>

      {/* =====================================================
          PAGE HEADER
          ===================================================== */}

      <header className="page-header">
        <div>
          <div className="admin-eyebrow">
            <UserPlus size={15} />
            Access & Security
          </div>

          <h1 className="page-title">
            Create administrator
          </h1>

          <p className="page-description">
            Create a privileged Zarova administrator account.
            Access permissions can be assigned after the account
            is created.
          </p>
        </div>
      </header>

      {/* =====================================================
          CONTENT
          ===================================================== */}

      <div className="admin-form-layout">
        <section className="admin-form-panel">
          <div className="admin-form-panel-header">
            <div className="admin-form-panel-icon">
              <UserRound size={20} />
            </div>

            <div>
              <h2>Administrator information</h2>
              <p>
                Enter the administrator's identity and login
                credentials.
              </p>
            </div>
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

          <form
            className="admin-create-form"
            onSubmit={handleSubmit}
          >
            {/* =================================================
                NAME
                ================================================= */}

            <div className="admin-form-section">
              <div className="admin-form-section-heading">
                <span>Personal details</span>
              </div>

              <div className="admin-form-grid">
                <label className="admin-form-field">
                  <span>
                    First name
                    <b>*</b>
                  </span>

                  <input
                    type="text"
                    value={firstName}
                    onChange={(event) => {
                      setFirstName(event.target.value);
                      if (error) setError('');
                    }}
                    placeholder="e.g. John"
                    autoComplete="given-name"
                    disabled={loading}
                    required
                  />
                </label>

                <label className="admin-form-field">
                  <span>
                    Last name
                    <b>*</b>
                  </span>

                  <input
                    type="text"
                    value={lastName}
                    onChange={(event) => {
                      setLastName(event.target.value);
                      if (error) setError('');
                    }}
                    placeholder="e.g. Doe"
                    autoComplete="family-name"
                    disabled={loading}
                    required
                  />
                </label>
              </div>
            </div>

            {/* =================================================
                EMAIL
                ================================================= */}

            <div className="admin-form-section">
              <div className="admin-form-section-heading">
                <span>Login credentials</span>
              </div>

              <label className="admin-form-field">
                <span>
                  Email address
                  <b>*</b>
                </span>

                <div className="admin-form-input-with-icon">
                  <Mail size={17} />

                  <input
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (error) setError('');
                    }}
                    placeholder="administrator@zarova.com"
                    autoComplete="email"
                    disabled={loading}
                    required
                  />
                </div>

                <small>
                  This email address will be used for administrator
                  authentication.
                </small>
              </label>

              <div className="admin-form-grid">
                <label className="admin-form-field">
                  <span>
                    Temporary password
                    <b>*</b>
                  </span>

                  <div className="admin-password-field">
                    <input
                      type={
                        showPassword
                          ? 'text'
                          : 'password'
                      }
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        if (error) setError('');
                      }}
                      placeholder="Minimum 8 characters"
                      autoComplete="new-password"
                      disabled={loading}
                      required
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          (current) => !current,
                        )
                      }
                      aria-label={
                        showPassword
                          ? 'Hide password'
                          : 'Show password'
                      }
                      disabled={loading}
                    >
                      {showPassword ? (
                        <EyeOff size={17} />
                      ) : (
                        <Eye size={17} />
                      )}
                    </button>
                  </div>

                  <small>
                    Use a temporary password and communicate it
                    through an approved secure channel.
                  </small>
                </label>

                <label className="admin-form-field">
                  <span>
                    Confirm password
                    <b>*</b>
                  </span>

                  <div className="admin-password-field">
                    <input
                      type={
                        showConfirmPassword
                          ? 'text'
                          : 'password'
                      }
                      value={confirmPassword}
                      onChange={(event) => {
                        setConfirmPassword(
                          event.target.value,
                        );
                        if (error) setError('');
                      }}
                      placeholder="Repeat temporary password"
                      autoComplete="new-password"
                      disabled={loading}
                      required
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(
                          (current) => !current,
                        )
                      }
                      aria-label={
                        showConfirmPassword
                          ? 'Hide password'
                          : 'Show password'
                      }
                      disabled={loading}
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={17} />
                      ) : (
                        <Eye size={17} />
                      )}
                    </button>
                  </div>
                </label>
              </div>
            </div>

            {/* =================================================
                ACCESS NOTICE
                ================================================= */}

            <div className="admin-form-security-note">
              <ShieldCheck size={18} />

              <div>
                <strong>Access control</strong>

                <p>
                  New administrators are created as active accounts.
                  Role assignments are managed separately through
                  Zarova RBAC.
                </p>
              </div>
            </div>

            {/* =================================================
                ACTIONS
                ================================================= */}

            <div className="admin-form-actions">
              <Link
                href="/admin/administrators"
                className="secondary-button"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="primary-button"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2
                      size={16}
                      className="admin-refresh-spin"
                    />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    Create administrator
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* =====================================================
            SIDE INFORMATION
            ===================================================== */}

        <aside className="admin-form-side-panel">
          <div className="admin-form-side-icon">
            <ShieldCheck size={20} />
          </div>

          <span className="admin-eyebrow">
            Privileged access
          </span>

          <h2>Administrator security</h2>

          <p>
            Administrator accounts have access to sensitive
            operational functions. Grant only the roles and
            permissions required for the administrator's duties.
          </p>

          <div className="admin-form-side-list">
            <div>
              <span>01</span>
              <p>Use a unique administrator email.</p>
            </div>

            <div>
              <span>02</span>
              <p>Use a strong temporary password.</p>
            </div>

            <div>
              <span>03</span>
              <p>Assign only the required RBAC roles.</p>
            </div>

            <div>
              <span>04</span>
              <p>Review privileged access regularly.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
