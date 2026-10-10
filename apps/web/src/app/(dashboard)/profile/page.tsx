'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  Calendar,
  CheckCircle2,
  Mail,
  Pencil,
  Save,
  User,
  X,
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

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] =
    useState<UserProfile | null>(null);

  const [firstName, setFirstName] =
    useState('');

  const [lastName, setLastName] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [editing, setEditing] =
    useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  /*
   * ==========================================
   * LOAD PROFILE
   * ==========================================
   */
  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      setError('');

      const data =
        await apiFetch<UserProfile>(
          '/users/profile',
        );

      setProfile(data);

      setFirstName(data.firstName);
      setLastName(data.lastName);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load profile';

      setError(message);

      if (
        message
          .toLowerCase()
          .includes('unauthorized')
      ) {
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }

  /*
   * ==========================================
   * SAVE PROFILE
   * ==========================================
   */
  async function handleSave() {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const trimmedFirstName =
        firstName.trim();

      const trimmedLastName =
        lastName.trim();

      if (!trimmedFirstName) {
        throw new Error(
          'First name is required',
        );
      }

      if (!trimmedLastName) {
        throw new Error(
          'Last name is required',
        );
      }

      const updatedProfile =
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

      setProfile(updatedProfile);

      setFirstName(
        updatedProfile.firstName,
      );

      setLastName(
        updatedProfile.lastName,
      );

      updateAuthUser({
        firstName: updatedProfile.firstName,
        lastName: updatedProfile.lastName,
      });

      setSuccess(
        'Profile updated successfully',
      );

      setEditing(false);

      /*
       * Automatically remove success message.
       */
      window.setTimeout(() => {
        setSuccess('');
      }, 4000);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to update profile',
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * ==========================================
   * CANCEL EDIT
   * ==========================================
   */
  function handleCancel() {
    if (profile) {
      setFirstName(profile.firstName);
      setLastName(profile.lastName);
    }

    setEditing(false);
    setError('');
    setSuccess('');
  }

  /*
   * ==========================================
   * GET USER INITIALS
   * ==========================================
   */
  function getInitials() {
    if (!profile) return 'U';

    const first =
      profile.firstName?.charAt(0) || '';

    const last =
      profile.lastName?.charAt(0) || '';

    return (
      `${first}${last}`.toUpperCase() ||
      'U'
    );
  }

  /*
   * ==========================================
   * FORMAT DATE
   * ==========================================
   */
  function formatDate(date: string) {
    if (!date) return 'N/A';

    return new Intl.DateTimeFormat(
      'en-NG',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      },
    ).format(new Date(date));
  }

  /*
   * ==========================================
   * LOADING
   * ==========================================
   */
  if (loading) {
    return (
      <div className="profile-loading">
        <div className="profile-spinner" />

        <span>Loading your profile...</span>
      </div>
    );
  }

  /*
   * ==========================================
   * ERROR
   * ==========================================
   */
  if (!profile) {
    return (
      <div className="profile-empty-state">
        <User size={42} />

        <h2>Unable to load profile</h2>

        <p>
          We could not retrieve your account
          information.
        </p>

        <button
          type="button"
          className="primary-button"
          onClick={loadProfile}
        >
          Try Again
        </button>
      </div>
    );
  }

  const isActive =
    profile.status?.toUpperCase() === 'ACTIVE';

  return (
    <div className="profile-page">

      {/* ======================================
          PAGE HEADER
      ====================================== */}
      <div className="page-header profile-page-header">
        <div>
          <h1>My Profile</h1>

          <p>
            Manage your personal account
            information.
          </p>
        </div>

        {!editing ? (
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setEditing(true);
              setSuccess('');
              setError('');
            }}
          >
            <Pencil size={18} />

            Edit Profile
          </button>
        ) : (
          <div className="profile-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={handleCancel}
              disabled={saving}
            >
              <X size={18} />

              Cancel
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={handleSave}
              disabled={saving}
            >
              <Save size={18} />

              {saving
                ? 'Saving...'
                : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* ======================================
          ALERTS
      ====================================== */}
      {error && (
        <div className="profile-alert error">
          <X size={18} />

          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="profile-alert success">
          <CheckCircle2 size={18} />

          <span>{success}</span>
        </div>
      )}

      {/* ======================================
          PROFILE HERO
      ====================================== */}
      <section className="profile-hero">
        <div className="profile-hero-left">

          <div className="profile-avatar-large">
            {getInitials()}
          </div>

          <div className="profile-hero-info">
            <h2>
              {profile.firstName}{' '}
              {profile.lastName}
            </h2>

            <span className="profile-email">
              {profile.email}
            </span>

            <div className="profile-member-info">
              <Calendar size={14} />

              Member since{' '}
              {formatDate(profile.createdAt)}
            </div>
          </div>
        </div>

        <div
          className={`profile-status ${
            isActive
              ? 'active'
              : 'inactive'
          }`}
        >
          <span className="profile-status-dot" />

          {profile.status}
        </div>
      </section>

      {/* ======================================
          PROFILE INFORMATION
      ====================================== */}
      <section className="profile-card">

        <div className="profile-card-title">
          <div className="profile-title-icon">
            <User size={20} />
          </div>

          <div>
            <h2>Profile Information</h2>

            <p>
              Update your personal details and
              account information.
            </p>
          </div>
        </div>

        <div className="profile-divider" />

        <div className="profile-form">

          {/* FIRST NAME */}
          <div className="form-field">
            <label>
              <User size={16} />

              First Name
            </label>

            <input
              type="text"
              value={firstName}
              disabled={!editing || saving}
              onChange={(event) =>
                setFirstName(
                  event.target.value,
                )
              }
            />
          </div>

          {/* LAST NAME */}
          <div className="form-field">
            <label>
              <User size={16} />

              Last Name
            </label>

            <input
              type="text"
              value={lastName}
              disabled={!editing || saving}
              onChange={(event) =>
                setLastName(
                  event.target.value,
                )
              }
            />
          </div>

          {/* EMAIL */}
          <div className="form-field full-width">
            <label>
              <Mail size={16} />

              Email Address
            </label>

            <div className="profile-readonly-field">
              <input
                type="email"
                value={profile.email}
                disabled
              />

              <Mail
                size={17}
                className="profile-readonly-icon"
              />
            </div>

            <small>
              Your email address is managed by
              your account administrator and
              cannot currently be changed.
            </small>
          </div>

        </div>
      </section>

      {/* ======================================
          ACCOUNT INFORMATION
      ====================================== */}
      <section className="profile-card">

        <div className="profile-card-title">
          <div className="profile-title-icon">
            <CheckCircle2 size={20} />
          </div>

          <div>
            <h2>Account Information</h2>

            <p>
              Details and status of your Zarova
              account.
            </p>
          </div>
        </div>

        <div className="profile-divider" />

        <div className="account-info-grid">

          <div className="account-info-item">
            <div className="account-info-icon">
              <Calendar size={20} />
            </div>

            <div>
              <span>Account Created</span>

              <strong>
                {formatDate(
                  profile.createdAt,
                )}
              </strong>
            </div>
          </div>

          <div className="account-info-item">
            <div className="account-info-icon success">
              <CheckCircle2 size={20} />
            </div>

            <div>
              <span>Account Status</span>

              <strong>
                {profile.status}
              </strong>
            </div>
          </div>

          <div className="account-info-item">
            <div className="account-info-icon">
              <User size={20} />
            </div>

            <div>
              <span>Account ID</span>

              <strong>
                #{profile.id}
              </strong>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}