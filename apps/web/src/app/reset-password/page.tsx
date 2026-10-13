'use client';

import { Suspense, useEffect, useState } from 'react';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Eye,
  EyeOff,
  KeyRound,
  Landmark,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

// ============================================================
// TYPES
// ============================================================

interface ApiError {
  message?: string | string[];
}

interface ResetPasswordResponse {
  message: string;
}

// ============================================================
// ERROR HELPER
// ============================================================

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error
  ) {
    const message = (error as ApiError).message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (typeof message === 'string') {
      return message;
    }
  }

  return 'Unable to reset your password. Please request a new link.';
}

// ============================================================
// PASSWORD STRENGTH
// ============================================================

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Weak', color: '#dc2626' };
  if (score === 2) return { score, label: 'Fair', color: '#d97706' };
  if (score === 3) return { score, label: 'Good', color: '#2563eb' };

  return { score, label: 'Strong', color: '#16a34a' };
}

// ============================================================
// PAGE CONTENT
// ============================================================

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get('token') ?? '';

  // ============================================================
  // STATE
  // ============================================================

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const strength = getPasswordStrength(newPassword);

  // ============================================================
  // REDIRECT TO LOGIN IF NO TOKEN
  // ============================================================

  useEffect(() => {
    if (!token) {
      router.replace('/forgot-password');
    }
  }, [token, router]);

  // ============================================================
  // SUBMIT
  // ============================================================

  async function handleSubmit(event: { preventDefault(): void }) {
    event.preventDefault();

    if (loading) {
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await apiFetch<ResetPasswordResponse>(
        '/auth/user/reset-password',
        {
          method: 'POST',
          body: JSON.stringify({ token, newPassword, confirmPassword }),
        },
      );

      void response;

      setSuccess(true);

      window.setTimeout(() => {
        router.replace('/login');
      }, 3000);
    } catch (caughtError: unknown) {
      console.error('Reset password error:', caughtError);
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // SUCCESS STATE
  // ============================================================

  if (success) {
    return (
      <main className="auth-page">
        <div className="login-background">
          <div className="login-orb login-orb-one" />
          <div className="login-orb login-orb-two" />
          <div className="login-grid-pattern" />
        </div>

        <section className="auth-card">
          <Link href="/login" className="auth-logo">
            <div className="auth-logo-icon">
              <Landmark size={22} />
            </div>
            Zarova
          </Link>

          <div className="auth-success">
            <CheckCircle size={18} />
            <span>
              Your password has been reset successfully. Redirecting you to
              sign in...
            </span>
          </div>

          <Link href="/login" className="login-submit-button" style={{ textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            Sign In Now
            <ArrowRight size={17} />
          </Link>
        </section>
      </main>
    );
  }

  // ============================================================
  // FORM
  // ============================================================

  return (
    <main className="auth-page">

      {/* BACKGROUND */}

      <div className="login-background">
        <div className="login-orb login-orb-one" />
        <div className="login-orb login-orb-two" />
        <div className="login-grid-pattern" />
      </div>

      <section className="auth-card">

        {/* LOGO */}

        <Link href="/login" className="auth-logo">
          <div className="auth-logo-icon">
            <Landmark size={22} />
          </div>
          Zarova
        </Link>

        {/* BACK */}

        <Link href="/login" className="auth-back-link">
          <ArrowLeft size={16} />
          Back to sign in
        </Link>

        {/* HEADER */}

        <div className="auth-heading">
          <span className="auth-eyebrow">ACCOUNT SECURITY</span>

          <h1>Set a new password</h1>

          <p>
            Choose a strong password you haven&apos;t used before.
          </p>
        </div>

        {/* ERROR */}

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        {/* FORM */}

        <form onSubmit={handleSubmit} className="auth-form">

          {/* NEW PASSWORD */}

          <div className="login-field">
            <label htmlFor="new-password">
              New Password
            </label>

            <div className="login-input-wrapper">
              <KeyRound size={18} className="login-input-icon" />

              <input
                id="new-password"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                required
                disabled={loading}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowNew((p) => !p)}
                aria-label={showNew ? 'Hide password' : 'Show password'}
                disabled={loading}
              >
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* STRENGTH METER */}

            {newPassword.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div
                  style={{
                    height: 4,
                    borderRadius: 4,
                    background: '#e2e8f0',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${(strength.score / 5) * 100}%`,
                      background: strength.color,
                      borderRadius: 4,
                      transition: 'width 0.3s ease, background 0.3s ease',
                    }}
                  />
                </div>

                <p
                  style={{
                    marginTop: 5,
                    fontSize: 12,
                    color: strength.color,
                    fontWeight: 600,
                  }}
                >
                  {strength.label}
                </p>
              </div>
            )}
          </div>

          {/* CONFIRM PASSWORD */}

          <div className="login-field">
            <label htmlFor="confirm-password">
              Confirm Password
            </label>

            <div className="login-input-wrapper">
              <KeyRound size={18} className="login-input-icon" />

              <input
                id="confirm-password"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                autoComplete="new-password"
                required
                disabled={loading}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirm((p) => !p)}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
                disabled={loading}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* SUBMIT */}

          <button
            type="submit"
            className="login-submit-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="login-spinner" />
                Resetting password...
              </>
            ) : (
              <>
                Reset Password
                <ArrowRight size={18} />
              </>
            )}
          </button>

        </form>

        {/* SECURITY NOTE */}

        <div className="auth-security-note">
          <ShieldCheck size={15} />
          <span>
            Reset links are single-use and expire after 15 minutes.
          </span>
        </div>

      </section>

    </main>
  );
}

// ============================================================
// EXPORT — Suspense wrapper required for useSearchParams
// ============================================================

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
