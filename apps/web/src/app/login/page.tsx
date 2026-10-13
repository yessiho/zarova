
'use client';


import {
  Suspense,
  useEffect,
  useState,
} from 'react';

import Link from 'next/link';

import {
  useRouter,
  useSearchParams,
} from 'next/navigation';

import {
  ArrowRight,
  Eye,
  EyeOff,
  Landmark,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

import {
  clearAuthSession,
  getAccessToken,
  getAuthUser,
  saveAuthSession,
} from '@/lib/auth';

import type { User } from '@/types';

// ============================================================
// API ERROR TYPE
// ============================================================

interface ApiError {
  message?: string | string[];
}

// ============================================================
// LOGIN RESPONSE
// ============================================================

interface LoginResponse {
  accessToken: string;
  user: User;
}

// ============================================================
// ERROR MESSAGE HELPER
// ============================================================

function getErrorMessage(
  error: unknown,
): string {
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

  return 'Unable to sign in. Please check your credentials.';
}

// ============================================================
// SAFE REDIRECT PATH
//
// Prevent external redirects.
//
// Only internal application routes are allowed.
// ============================================================

function getSafeRedirectPath(
  redirect: string | null,
): string {
  if (
    !redirect ||
    !redirect.startsWith('/') ||
    redirect.startsWith('//')
  ) {
    return '/dashboard';
  }

  return redirect;
}

// ============================================================
// LOGIN PAGE
// ============================================================

function LoginPageContent() {
  const router = useRouter();

  const searchParams =
    useSearchParams();

  // ==========================================================
  // REDIRECT DESTINATION
  // ==========================================================

  const redirectPath =
    getSafeRedirectPath(
      searchParams.get('redirect'),
    );

  // ==========================================================
  // FORM STATE
  // ==========================================================

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const [checkingSession, setCheckingSession] =
    useState(true);

  // ==========================================================
  // CHECK EXISTING SESSION
  //
  // Only clean incomplete/corrupted sessions.
  //
  // IMPORTANT:
  //
  // Do NOT automatically redirect simply because a token exists.
  //
  // Token validity is confirmed by protected API requests.
  // ==========================================================

  useEffect(() => {
    try {
      const token =
        getAccessToken();

      const user =
        getAuthUser();

      /*
       * If only one authentication value exists,
       * the session is incomplete.
       */
      if (
        (token && !user) ||
        (!token && user)
      ) {
        clearAuthSession();
      }
    } catch (error) {
      console.error(
        'Session check error:',
        error,
      );

      clearAuthSession();
    } finally {
      setCheckingSession(false);
    }
  }, []);

  // ==========================================================
  // LOGIN SUBMIT
  // ==========================================================

  async function handleSubmit(
    event: { preventDefault(): void },
  ) {
    event.preventDefault();

    /*
     * Prevent duplicate submissions.
     */
    if (loading) {
      return;
    }

    // ========================================================
    // NORMALIZE INPUT
    // ========================================================

    const normalizedEmail =
      email.trim().toLowerCase();

    // ========================================================
    // FRONTEND VALIDATION
    // ========================================================

    if (!normalizedEmail) {
      setError(
        'Email address is required.',
      );

      return;
    }

    if (!password) {
      setError(
        'Password is required.',
      );

      return;
    }

    try {
      setLoading(true);

      setError('');

      // ======================================================
      // LOGIN REQUEST
      //
      // IMPORTANT:
      //
      // Do NOT save anything before this request succeeds.
      //
      // api.ts will throw an error for:
      //
      // - 400 Bad Request
      // - 401 Invalid credentials
      // - 403 Forbidden
      // - 500 Server errors
      //
      // The redirect below will only happen when this request
      // successfully resolves.
      // ======================================================

      const response =
        await apiFetch<LoginResponse>(
          '/auth/user/login',
          {
            method: 'POST',

            body: JSON.stringify({
              email: normalizedEmail,
              password,
            }),
          },
        );

      // ======================================================
      // VALIDATE BACKEND RESPONSE
      // ======================================================

      if (
        !response ||
        typeof response.accessToken !==
          'string' ||
        !response.accessToken ||
        !response.user
      ) {
        throw new Error(
          'Invalid login response from server.',
        );
      }

      // ======================================================
      // SAVE AUTH SESSION
      //
      // This is the FIRST point where authentication data
      // is written to localStorage.
      //
      // auth.ts handles:
      //
      // - zarova_access_token
      // - zarova_user
      // - auth-session-updated event
      // - user-profile-updated event
      //
      // Do NOT manually dispatch auth events here.
      // ======================================================

      saveAuthSession(
        response.accessToken,
        response.user,
      );

      // ======================================================
      // REDIRECT AFTER SUCCESSFUL LOGIN
      //
      // This only executes after:
      //
      // 1. API request succeeds
      // 2. accessToken exists
      // 3. user exists
      // 4. Session is successfully saved
      // ======================================================

      router.replace(redirectPath);
    } catch (caughtError: unknown) {
      console.error(
        'Login error:',
        caughtError,
      );

      /*
       * Failed authentication must never leave
       * a partial session behind.
       */
      clearAuthSession();

      setError(
        getErrorMessage(caughtError),
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================
  // SESSION CHECK LOADING
  // ==========================================================

  if (checkingSession) {
    return (
      <main className="auth-loading">
        <div className="auth-loading-spinner" />

        <p>
          Checking your session...
        </p>
      </main>
    );
  }

  // ==========================================================
  // PAGE UI
  // ==========================================================

  return (
    <main className="login-page">

      {/* ======================================================
          BACKGROUND
      ====================================================== */}

      <div className="login-background">
        <div className="login-orb login-orb-one" />

        <div className="login-orb login-orb-two" />

        <div className="login-grid-pattern" />
      </div>

      {/* ======================================================
          MAIN WRAPPER
      ====================================================== */}

      <div className="login-wrapper">

        {/* ====================================================
            BRAND PANEL
        ==================================================== */}

        <section className="login-brand-panel">
          <div className="login-brand-content">

            <div className="login-brand-logo">
              <Landmark size={30} />
            </div>

            <div className="login-brand-name">
              Zarova
            </div>

            <h1>
              Smart financial
              <br />
              management made simple.
            </h1>

            <p>
              Manage wallets, transactions, and financial
              records from one secure platform.
            </p>

            {/* FEATURES */}

            <div className="login-features">

              <div className="login-feature">
                <div className="login-feature-icon">
                  <ShieldCheck size={18} />
                </div>

                <div>
                  <strong>
                    Secure Financial Platform
                  </strong>

                  <span>
                    Built with security and accountability
                    in mind.
                  </span>
                </div>
              </div>

              <div className="login-feature">
                <div className="login-feature-icon">
                  <Landmark size={18} />
                </div>

                <div>
                  <strong>
                    Multi-Currency Wallets
                  </strong>

                  <span>
                    Manage NGN, USD, GBP and EUR balances
                    in one place.
                  </span>
                </div>
              </div>

            </div>
          </div>

          <div className="login-brand-footer">
            © {new Date().getFullYear()} Zarova.
            Financial Management Platform.
          </div>
        </section>

        {/* ====================================================
            LOGIN PANEL
        ==================================================== */}

        <section className="login-form-panel">
          <div className="login-form-container">

            {/* MOBILE BRAND */}

            <div className="login-mobile-brand">
              <div className="login-mobile-logo">
                <Landmark size={24} />
              </div>

              <span>
                Zarova
              </span>
            </div>

            {/* HEADING */}

            <div className="login-heading">
              <span className="login-welcome">
                Welcome back
              </span>

              <h2>
                Sign in to your account
              </h2>

              <p>
                Enter your credentials to access your
                financial workspace.
              </p>
            </div>

            {/* ERROR */}

            {error && (
              <div
                className="login-error"
                role="alert"
                aria-live="polite"
              >
                {error}
              </div>
            )}

            {/* =================================================
                LOGIN FORM
            ================================================= */}

            <form
              onSubmit={handleSubmit}
              className="login-form"
            >

              {/* EMAIL */}

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
                    placeholder="Enter your email"
                    required
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* PASSWORD */}

              <div className="login-field">

                <div className="login-password-label-row">
                  <label htmlFor="password">
                    Password
                  </label>

                  <Link
                    href="/forgot-password"
                    className="forgot-password-link"
                  >
                    Forgot password?
                  </Link>
                </div>

                <div className="login-input-wrapper">
                  <Lock
                    size={19}
                    className="login-input-icon"
                  />

                  <input
                    id="password"
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    disabled={loading}
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword(
                        (previous) => !previous,
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
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
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
                    <Loader2
                      size={19}
                      className="login-spinner"
                    />

                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In

                    <ArrowRight size={19} />
                  </>
                )}
              </button>

            </form>

            {/* REGISTER */}

            <div className="login-register-link">
              <span>
                Don&apos;t have an account?
              </span>

              <Link href="/register">
                Create an account
              </Link>
            </div>

            {/* SECURITY */}

            <p className="login-security-text">
              <ShieldCheck size={15} />

              Your connection is secure and encrypted.
            </p>

          </div>
        </section>

      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}
