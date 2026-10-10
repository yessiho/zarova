'use client';

import { useEffect, useState } from 'react';

import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Save,
  ShieldCheck,
  User,
} from 'lucide-react';

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

  useEffect(() => {
    loadProfile();
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

      </div>
    </div>
  );
}