'use client';

import {
  useState,
} from 'react';

import Link from 'next/link';

import { useRouter } from 'next/navigation';

import {
  ArrowLeft,
  ArrowRight,
  Landmark,
  Loader2,
  Mail,
  ShieldCheck,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

interface ForgotPasswordResponse {
  message: string;

  /*
   * Available during development.
   *
   * Remove from production response later when
   * email delivery is implemented.
   */
  resetToken?: string;

  expiresIn?: string;
}

interface ApiError {
  message?: string | string[];
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error
  ) {
    const message =
      (error as ApiError).message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (typeof message === 'string') {
      return message;
    }
  }

  return 'Unable to process your password reset request.';
}

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  // ============================================================
  // SUBMIT FORGOT PASSWORD
  // ============================================================

  async function handleSubmit(
    event: { preventDefault(): void },
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    try {
      setLoading(true);

      setError('');

      setSuccess('');

      const response =
        await apiFetch<ForgotPasswordResponse>(
          '/auth/user/forgot-password',
          {
            method: 'POST',

            body: JSON.stringify({
              email: email.trim().toLowerCase(),
            }),
          },
        );

      setSuccess(response.message);

      /*
       * DEVELOPMENT FLOW
       *
       * Backend currently returns resetToken.
       *
       * Navigate directly to reset page.
       *
       * PRODUCTION:
       * The backend should send the token by email instead.
       */
      if (response.resetToken) {
        setTimeout(() => {
          router.push(
            `/reset-password?token=${encodeURIComponent(
              response.resetToken!,
            )}`,
          );
        }, 1200);
      }
    } catch (caughtError: unknown) {
      console.error(
        'Forgot password error:',
        caughtError,
      );

      setError(
        getErrorMessage(caughtError),
      );
    } finally {
      setLoading(false);
    }
  }

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

        <Link
          href="/login"
          className="auth-logo"
        >

          <div className="auth-logo-icon">
            <Landmark size={24} />
          </div>

          <span>
            Zarova
          </span>

        </Link>

        {/* BACK */}

        <Link
          href="/login"
          className="auth-back-link"
        >

          <ArrowLeft size={17} />

          Back to sign in

        </Link>

        {/* HEADER */}

        <div className="auth-heading">

          <span className="auth-eyebrow">
            PASSWORD RECOVERY
          </span>

          <h1>
            Forgot your password?
          </h1>

          <p>
            Enter your email address and we&apos;ll help you reset your password.
          </p>

        </div>

        {/* ERROR */}

        {error && (
          <div
            className="auth-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* SUCCESS */}

        {success && (
          <div
            className="auth-success"
            role="status"
          >
            <ShieldCheck size={18} />

            <span>
              {success}
            </span>
          </div>
        )}

        {/* FORM */}

        {!success && (
          <form
            onSubmit={handleSubmit}
            className="auth-form"
          >

            <div className="login-field">

              <label htmlFor="email">
                Email Address
              </label>

              <div className="login-input-wrapper">

                <Mail
                  size={19}
                  className="login-input-icon"
                />

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="Enter your registered email"
                  autoComplete="email"
                  required
                  disabled={loading}
                />

              </div>

            </div>

            <button
              type="submit"
              className="login-submit-button"
              disabled={loading}
            >

              {loading ? (
                <>
                  <Loader2
                    size={19}
                    className="login-spinner"
                  />

                  Processing...
                </>
              ) : (
                <>
                  Continue

                  <ArrowRight size={19} />
                </>
              )}

            </button>

          </form>
        )}

        {/* SECURITY */}

        <div className="auth-security-note">

          <ShieldCheck size={16} />

          <span>
            For your security, reset links expire after 15 minutes.
          </span>

        </div>

      </section>

    </main>
  );
}