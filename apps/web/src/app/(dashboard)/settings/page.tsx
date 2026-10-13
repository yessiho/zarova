'use client';

import { useEffect, useState } from 'react';

import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  QrCode,
  Save,
  ShieldCheck,
  ShieldOff,
  X,
} from 'lucide-react';
import { User } from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { updateAuthUser } from '@/lib/auth';

interface UserProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface TwoFactorStatus {
  enabled: boolean;
  hasSecret: boolean;
}

interface TwoFactorSetup {
  qrCode: string;
  secret: string;
  backupCodes: string[];
}

export default function SettingsPage() {
  /*
   * ==========================================
   * STATE
   * ==========================================
   */
  const [user, setUser] = useState<UserProfile | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loadingProfile, setLoadingProfile] = useState(true);

  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  /* 2FA state */
  const [twoFactorStatus, setTwoFactorStatus] =
    useState<TwoFactorStatus | null>(null);
  const [twoFactorSetup, setTwoFactorSetup] =
    useState<TwoFactorSetup | null>(null);
  const [twoFactorStep, setTwoFactorStep] =
    useState<'idle' | 'setup' | 'disable'>('idle');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorMessage, setTwoFactorMessage] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');

  /*
   * ==========================================
   * LOAD USER PROFILE
   * ==========================================
   */
  async function loadProfile() {
    try {
      setLoadingProfile(true);

      const data = await apiFetch<UserProfile>(
        '/users/profile',
      );

      setUser(data);

      setFirstName(data.firstName || '');
      setLastName(data.lastName || '');
    } catch (error) {
      console.error(error);

      setProfileError(
        error instanceof Error
          ? error.message
          : 'Unable to load profile',
      );
    } finally {
      setLoadingProfile(false);
    }
  }

  async function loadTwoFactorStatus() {
    try {
      const data = await apiFetch<TwoFactorStatus>('/auth/2fa/status');
      setTwoFactorStatus(data);
    } catch {
      /* non-critical */
    }
  }

  useEffect(() => {
    loadProfile();
    loadTwoFactorStatus();
  }, []);

  /*
   * ==========================================
   * UPDATE PROFILE
   * ==========================================
   */
  async function handleUpdateProfile(
    event: { preventDefault(): void },
  ) {
    event.preventDefault();

    setProfileMessage('');
    setProfileError('');

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedFirstName || !trimmedLastName) {
      setProfileError(
        'First name and last name are required',
      );

      return;
    }

    try {
      setSavingProfile(true);

      const updatedUser =
        await apiFetch<UserProfile>(
          '/users/profile',
          {
            method: 'PATCH',

            body: JSON.stringify({
              firstName: trimmedFirstName,
              lastName: trimmedLastName,
            }),
          },
        );

      setUser(updatedUser);

      setFirstName(updatedUser.firstName);
      setLastName(updatedUser.lastName);

      updateAuthUser({
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
      });

      setProfileMessage(
        'Profile updated successfully',
      );
    } catch (error) {
      setProfileError(
        error instanceof Error
          ? error.message
          : 'Unable to update profile',
      );
    } finally {
      setSavingProfile(false);
    }
  }

  /*
   * ==========================================
   * CHANGE PASSWORD
   * ==========================================
   */
  async function handleChangePassword(
    event: { preventDefault(): void },
  ) {
    event.preventDefault();

    setPasswordMessage('');
    setPasswordError('');

    /*
     * Validate password confirmation.
     */
    if (newPassword !== confirmPassword) {
      setPasswordError(
        'New passwords do not match',
      );

      return;
    }

    /*
     * Basic password validation.
     */
    if (newPassword.length < 6) {
      setPasswordError(
        'New password must be at least 6 characters',
      );

      return;
    }

    try {
      setChangingPassword(true);

      const response =
        await apiFetch<{ message: string }>(
          '/users/change-password',
          {
            method: 'PATCH',

            body: JSON.stringify({
              currentPassword,
              newPassword,
            }),
          },
        );

      setPasswordMessage(
        response.message ||
          'Password changed successfully',
      );

      /*
       * Clear password fields.
       */
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : 'Unable to change password',
      );
    } finally {
      setChangingPassword(false);
    }
  }

  /* ==========================================
   * 2FA — START SETUP
   * ========================================== */
  async function startTwoFactorSetup() {
    try {
      setTwoFactorLoading(true);
      setTwoFactorError('');
      setTwoFactorMessage('');

      const data = await apiFetch<TwoFactorSetup>('/auth/2fa/setup', {
        method: 'POST',
      });

      setTwoFactorSetup(data);
      setTwoFactorStep('setup');
      setTwoFactorToken('');
    } catch (err) {
      setTwoFactorError(
        err instanceof Error ? err.message : 'Failed to start 2FA setup.',
      );
    } finally {
      setTwoFactorLoading(false);
    }
  }

  /* ==========================================
   * 2FA — CONFIRM ENABLE
   * ========================================== */
  async function confirmEnable(event: { preventDefault(): void }) {
    event.preventDefault();

    if (twoFactorToken.length !== 6) {
      setTwoFactorError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    try {
      setTwoFactorLoading(true);
      setTwoFactorError('');

      await apiFetch('/auth/2fa/enable', {
        method: 'POST',
        body: JSON.stringify({ token: twoFactorToken }),
      });

      setTwoFactorStatus({ enabled: true, hasSecret: true });
      setTwoFactorStep('idle');
      setTwoFactorSetup(null);
      setTwoFactorToken('');
      setTwoFactorMessage('Two-factor authentication has been enabled.');
    } catch (err) {
      setTwoFactorError(
        err instanceof Error ? err.message : 'Invalid code. Please try again.',
      );
    } finally {
      setTwoFactorLoading(false);
    }
  }

  /* ==========================================
   * 2FA — CONFIRM DISABLE
   * ========================================== */
  async function confirmDisable(event: { preventDefault(): void }) {
    event.preventDefault();

    if (twoFactorToken.length !== 6) {
      setTwoFactorError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    try {
      setTwoFactorLoading(true);
      setTwoFactorError('');

      await apiFetch('/auth/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ token: twoFactorToken }),
      });

      setTwoFactorStatus({ enabled: false, hasSecret: false });
      setTwoFactorStep('idle');
      setTwoFactorToken('');
      setTwoFactorMessage('Two-factor authentication has been disabled.');
    } catch (err) {
      setTwoFactorError(
        err instanceof Error ? err.message : 'Invalid code. Please try again.',
      );
    } finally {
      setTwoFactorLoading(false);
    }
  }

  /*
   * ==========================================
   * LOADING STATE
   * ==========================================
   */
  if (loadingProfile) {
    return (
      <div className="settings-loading">
        <Loader2
          className="settings-spinner"
          size={32}
        />

        <p>Loading your settings...</p>
      </div>
    );
  }

  /*
   * ==========================================
   * PAGE
   * ==========================================
   */
  return (
    <div className="settings-page">

      {/* ======================================
          PAGE HEADER
      ====================================== */}
      <div className="settings-header">
        <div>
          <p className="page-eyebrow">
            ACCOUNT SETTINGS
          </p>

          <h1>Settings</h1>

          <p>
            Manage your personal information and
            account security.
          </p>
        </div>
      </div>

      <div className="settings-grid">

        {/* ======================================
            PROFILE INFORMATION
        ====================================== */}
        <section className="settings-card">

          <div className="settings-card-header">
            <div className="settings-icon">
              <User size={20} />
            </div>

            <div>
              <h2>Profile Information</h2>

              <p>
                Update your personal account details.
              </p>
            </div>
          </div>

          {profileMessage && (
            <div className="settings-success">
              <CheckCircle2 size={18} />

              <span>{profileMessage}</span>
            </div>
          )}

          {profileError && (
            <div className="settings-error">
              <AlertCircle size={18} />

              <span>{profileError}</span>
            </div>
          )}

          <form
            onSubmit={handleUpdateProfile}
            className="settings-form"
          >
            <div className="form-row">

              <div className="form-group">
                <label>First Name</label>

                <input
                  type="text"
                  value={firstName}
                  onChange={(event) =>
                    setFirstName(event.target.value)
                  }
                  placeholder="Enter first name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Last Name</label>

                <input
                  type="text"
                  value={lastName}
                  onChange={(event) =>
                    setLastName(event.target.value)
                  }
                  placeholder="Enter last name"
                  required
                />
              </div>

            </div>

            <div className="form-group">
              <label>Email Address</label>

              <input
                type="email"
                value={user?.email || ''}
                disabled
              />

              <small>
                Email address cannot currently be changed.
              </small>
            </div>

            <div className="settings-form-footer">
              <button
                type="submit"
                className="settings-primary-button"
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <>
                    <Loader2
                      className="button-spinner"
                      size={18}
                    />

                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />

                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* ======================================
            CHANGE PASSWORD
        ====================================== */}
        <section className="settings-card">

          <div className="settings-card-header">
            <div className="settings-icon security">
              <KeyRound size={20} />
            </div>

            <div>
              <h2>Password & Security</h2>

              <p>
                Update your password to keep your
                account secure.
              </p>
            </div>
          </div>

          {passwordMessage && (
            <div className="settings-success">
              <CheckCircle2 size={18} />

              <span>{passwordMessage}</span>
            </div>
          )}

          {passwordError && (
            <div className="settings-error">
              <AlertCircle size={18} />

              <span>{passwordError}</span>
            </div>
          )}

          <form
            onSubmit={handleChangePassword}
            className="settings-form"
          >
            <div className="form-group">
              <label>Current Password</label>

              <input
                type="password"
                value={currentPassword}
                onChange={(event) =>
                  setCurrentPassword(
                    event.target.value,
                  )
                }
                placeholder="Enter current password"
                required
              />
            </div>

            <div className="form-row">

              <div className="form-group">
                <label>New Password</label>

                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) =>
                    setNewPassword(
                      event.target.value,
                    )
                  }
                  placeholder="Enter new password"
                  required
                />
              </div>

              <div className="form-group">
                <label>Confirm Password</label>

                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value,
                    )
                  }
                  placeholder="Confirm new password"
                  required
                />
              </div>

            </div>

            <div className="settings-form-footer">
              <button
                type="submit"
                className="settings-primary-button"
                disabled={changingPassword}
              >
                {changingPassword ? (
                  <>
                    <Loader2
                      className="button-spinner"
                      size={18}
                    />

                    Updating...
                  </>
                ) : (
                  <>
                    <KeyRound size={18} />

                    Change Password
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* ======================================
            ACCOUNT INFORMATION
        ====================================== */}
        <section className="settings-card account-card">

          <div className="settings-card-header">
            <div className="settings-icon account">
              <ShieldCheck size={20} />
            </div>

            <div>
              <h2>Account Information</h2>

              <p>
                General information about your
                Zarova account.
              </p>
            </div>
          </div>

          <div className="account-information">

            <div className="account-info-row">
              <span>Account ID</span>

              <strong>#{user?.id}</strong>
            </div>

            <div className="account-info-row">
              <span>Account Status</span>

              <strong className="account-status">
                {user?.status}
              </strong>
            </div>

            <div className="account-info-row">
              <span>Account Email</span>

              <strong>{user?.email}</strong>
            </div>

            <div className="account-info-row">
              <span>Member Since</span>

              <strong>
                {user?.createdAt
                  ? new Date(
                      user.createdAt,
                    ).toLocaleDateString()
                  : '-'}
              </strong>
            </div>

          </div>
        </section>

        {/* ======================================
            TWO-FACTOR AUTHENTICATION
        ====================================== */}
        <section className="settings-card">

          <div className="settings-card-header">
            <div className={`settings-icon ${twoFactorStatus?.enabled ? 'security' : ''}`}>
              {twoFactorStatus?.enabled
                ? <ShieldCheck size={20} />
                : <QrCode size={20} />}
            </div>

            <div>
              <h2>Two-Factor Authentication</h2>
              <p>
                {twoFactorStatus?.enabled
                  ? 'Your account is protected with 2FA.'
                  : 'Add an extra layer of security with a TOTP authenticator.'}
              </p>
            </div>
          </div>

          {/* 2FA feedback */}
          {twoFactorMessage && (
            <div className="settings-success">
              <CheckCircle2 size={18} />
              <span>{twoFactorMessage}</span>
            </div>
          )}

          {twoFactorError && (
            <div className="settings-error">
              <AlertCircle size={18} />
              <span>{twoFactorError}</span>
            </div>
          )}

          {/* ── IDLE: show status + action button ── */}
          {twoFactorStep === 'idle' && (
            <div className="twofa-idle">
              <div className="twofa-status-row">
                <span className={`twofa-badge ${twoFactorStatus?.enabled ? 'enabled' : 'disabled'}`}>
                  {twoFactorStatus?.enabled ? 'Enabled' : 'Disabled'}
                </span>
                <p className="twofa-hint">
                  {twoFactorStatus?.enabled
                    ? 'Use Google Authenticator, Authy, or any TOTP app.'
                    : 'Use Google Authenticator, Authy, or any TOTP app to protect your account.'}
                </p>
              </div>

              {twoFactorStatus?.enabled ? (
                <button
                  type="button"
                  className="twofa-disable-button"
                  onClick={() => {
                    setTwoFactorStep('disable');
                    setTwoFactorToken('');
                    setTwoFactorError('');
                  }}
                >
                  <ShieldOff size={17} />
                  Disable 2FA
                </button>
              ) : (
                <button
                  type="button"
                  className="settings-primary-button"
                  onClick={() => void startTwoFactorSetup()}
                  disabled={twoFactorLoading}
                >
                  {twoFactorLoading ? (
                    <>
                      <Loader2 size={17} className="button-spinner" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <QrCode size={17} />
                      Set Up 2FA
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* ── SETUP: show QR + backup codes + verify ── */}
          {twoFactorStep === 'setup' && twoFactorSetup && (
            <div className="twofa-setup">
              <div className="twofa-steps-list">
                <div className="twofa-step">
                  <span className="twofa-step-num">1</span>
                  <div>
                    <strong>Scan the QR code</strong>
                    <p>
                      Open your authenticator app (Google Authenticator, Authy,
                      etc.) and scan the code below.
                    </p>
                  </div>
                </div>
              </div>

              <div className="twofa-qr-wrapper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={twoFactorSetup.qrCode}
                  alt="2FA QR Code"
                  width={180}
                  height={180}
                />
              </div>

              <div className="twofa-secret-row">
                <span>Manual entry key:</span>
                <code className="twofa-secret">
                  {showSecret
                    ? twoFactorSetup.secret
                    : '•'.repeat(Math.min(twoFactorSetup.secret.length, 16))}
                </code>
                <button
                  type="button"
                  className="twofa-toggle-secret"
                  onClick={() => setShowSecret((s) => !s)}
                  aria-label={showSecret ? 'Hide key' : 'Show key'}
                >
                  {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              <div className="twofa-backup-section">
                <strong>Save your backup codes</strong>
                <p>
                  Store these codes safely. Each can be used once if you lose
                  access to your authenticator app.
                </p>
                <div className="twofa-backup-codes">
                  {twoFactorSetup.backupCodes.map((code) => (
                    <code key={code} className="twofa-backup-code">
                      {code}
                    </code>
                  ))}
                </div>
              </div>

              <form onSubmit={(e) => void confirmEnable(e)} className="twofa-verify-form">
                <div className="twofa-steps-list">
                  <div className="twofa-step">
                    <span className="twofa-step-num">2</span>
                    <div>
                      <strong>Verify setup</strong>
                      <p>Enter the 6-digit code from your authenticator app.</p>
                    </div>
                  </div>
                </div>

                <div className="twofa-token-row">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="000000"
                    value={twoFactorToken}
                    onChange={(e) =>
                      setTwoFactorToken(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    className="twofa-token-input"
                    autoComplete="one-time-code"
                    required
                  />

                  <button
                    type="submit"
                    className="settings-primary-button"
                    disabled={twoFactorLoading || twoFactorToken.length !== 6}
                  >
                    {twoFactorLoading ? (
                      <>
                        <Loader2 size={17} className="button-spinner" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={17} />
                        Enable 2FA
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="twofa-cancel-button"
                    onClick={() => {
                      setTwoFactorStep('idle');
                      setTwoFactorSetup(null);
                      setTwoFactorError('');
                      setTwoFactorToken('');
                    }}
                    disabled={twoFactorLoading}
                  >
                    <X size={16} />
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── DISABLE: confirm with TOTP ── */}
          {twoFactorStep === 'disable' && (
            <form
              onSubmit={(e) => void confirmDisable(e)}
              className="twofa-setup"
            >
              <p className="twofa-hint">
                Enter the 6-digit code from your authenticator app to confirm
                disabling 2FA.
              </p>

              <div className="twofa-token-row">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={twoFactorToken}
                  onChange={(e) =>
                    setTwoFactorToken(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  className="twofa-token-input"
                  autoComplete="one-time-code"
                  required
                />

                <button
                  type="submit"
                  className="twofa-disable-button"
                  disabled={twoFactorLoading || twoFactorToken.length !== 6}
                >
                  {twoFactorLoading ? (
                    <>
                      <Loader2 size={17} className="button-spinner" />
                      Disabling...
                    </>
                  ) : (
                    <>
                      <ShieldOff size={17} />
                      Confirm Disable
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="twofa-cancel-button"
                  onClick={() => {
                    setTwoFactorStep('idle');
                    setTwoFactorError('');
                    setTwoFactorToken('');
                  }}
                  disabled={twoFactorLoading}
                >
                  <X size={16} />
                  Cancel
                </button>
              </div>
            </form>
          )}

        </section>

      </div>
    </div>
  );
}