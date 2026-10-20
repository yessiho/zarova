'use client';

import {
  FormEvent,
  Suspense,
  useEffect,
  useState,
} from 'react';

import {
  useRouter,
  useSearchParams,
} from 'next/navigation';

import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';

import ZarovaLogo from '@/components/ui/ZarovaLogo';

import { apiFetch } from '@/lib/api';

import {
  clearAuthSession,
  getAccessToken,
  getAuthUser,
  saveAuthSession,
} from '@/lib/auth';

/* ============================================================
   TYPES
   ============================================================ */

type AdminUser = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  type: 'ADMIN';
};

type AdminLoginResponse = {
  accessToken: string;

  admin: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
  };
};

interface JwtPayload {
  sub?: number | string;
  email?: string;
  type?: string;
  exp?: number;
  iat?: number;
}

/* ============================================================
   JWT HELPERS
   ============================================================ */

/**
 * Decode JWT payload for client-side routing decisions.
 *
 * IMPORTANT:
 * This does NOT verify the JWT signature.
 *
 * Real authentication and authorization are enforced
 * by the backend.
 */
function decodeJwtPayload(
  token: string,
): JwtPayload | null {
  try {
    const parts = token.split('.');

    if (parts.length !== 3) {
      return null;
    }

    const base64Url = parts[1];

    const base64 = base64Url
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const padded = base64.padEnd(
      base64.length +
        ((4 - (base64.length % 4)) % 4),
      '=',
    );

    const decoded = atob(padded);

    return JSON.parse(
      decoded,
    ) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Check whether the JWT has expired.
 */
function isTokenExpired(
  payload: JwtPayload,
): boolean {
  if (!payload.exp) {
    return false;
  }

  return payload.exp * 1000 <= Date.now();
}

/* ============================================================
   REDIRECT HELPERS
   ============================================================ */

/**
 * Only allow redirects to internal Admin routes.
 *
 * Examples:
 *
 * /admin
 * /admin/3
 * /admin/new
 *
 * Invalid examples:
 *
 * https://example.com
 * //example.com
 * /login
 * /admin/login
 */
function getSafeRedirectPath(
  redirect: string | null,
): string {
  if (!redirect) {
    return '/admin';
  }

  if (!redirect.startsWith('/')) {
    return '/admin';
  }

  if (redirect.startsWith('//')) {
    return '/admin';
  }

  if (!redirect.startsWith('/admin')) {
    return '/admin';
  }

  /*
   * Never redirect an already authenticated Admin
   * back to the login page.
   */
  if (
    redirect === '/admin/login' ||
    redirect.startsWith('/admin/login?')
  ) {
    return '/admin';
  }

  return redirect;
}

/* ============================================================
   ERROR HELPER
   ============================================================ */

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return (
    'Unable to sign in. Please check your ' +
    'administrator credentials and try again.'
  );
}

/* ============================================================
   ADMIN LOGIN PAGE
   ============================================================ */

function AdminLoginContent() {
  const router = useRouter();

  const searchParams =
    useSearchParams();

  /*
   * Preserve the page the Admin originally attempted
   * to access.
   *
   * Example:
   *
   * /admin/3
   *
   * becomes:
   *
   * /admin/login?redirect=/admin/3
   */
  const redirectPath =
    getSafeRedirectPath(
      searchParams.get('redirect'),
    );

  /* ----------------------------------------------------------
     FORM STATE
     ---------------------------------------------------------- */

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  /* ----------------------------------------------------------
     REQUEST STATE
     ---------------------------------------------------------- */

  const [loading, setLoading] =
    useState(false);

  const [checkingSession, setCheckingSession] =
    useState(true);

  const [error, setError] =
    useState('');


  /* ==========================================================
     EXISTING SESSION CHECK
     ========================================================== */

  useEffect(() => {
    let mounted = true;

    function checkExistingAdminSession() {
      try {
        const token =
          getAccessToken();

        const user =
          getAuthUser();

        /*
         * ----------------------------------------------------
         * No session.
         *
         * Stay on Admin login.
         * ----------------------------------------------------
         */

        if (!token || !user) {
          if (mounted) {
            setCheckingSession(false);
          }

          return;
        }

        /*
         * ----------------------------------------------------
         * Decode JWT.
         * ----------------------------------------------------
         */

        const payload =
          decodeJwtPayload(token);

        /*
         * ----------------------------------------------------
         * Invalid JWT.
         * ----------------------------------------------------
         */

        if (!payload) {
          clearAuthSession();

          if (mounted) {
            setCheckingSession(false);
          }

          return;
        }

        /*
         * ----------------------------------------------------
         * Expired JWT.
         * ----------------------------------------------------
         */

        if (
          isTokenExpired(payload)
        ) {
          clearAuthSession();

          if (mounted) {
            setCheckingSession(false);
          }

          return;
        }

        /*
         * ----------------------------------------------------
         * Existing ADMIN session.
         *
         * If the current session is already an Admin
         * session, send the Admin directly to the
         * requested page.
         * ----------------------------------------------------
         */

        if (
          payload.type === 'ADMIN' &&
          (user as AdminUser).type === 'ADMIN'
        ) {
          router.replace(
            redirectPath,
          );

          return;
        }

        /*
         * ----------------------------------------------------
         * Existing USER session.
         *
         * Do NOT clear the session here.
         *
         * The user can still use the normal application.
         *
         * If they submit this Admin login form, the existing
         * session will be replaced with the Admin session.
         * ----------------------------------------------------
         */

        if (mounted) {
          setCheckingSession(false);
        }
      } catch (caughtError) {
        console.error(
          'Admin session check failed:',
          caughtError,
        );

        /*
         * A malformed local session should not remain.
         */
        clearAuthSession();

        if (mounted) {
          setCheckingSession(false);
        }
      }
    }

    checkExistingAdminSession();

    return () => {
      mounted = false;
    };
  }, [
    redirectPath,
    router,
  ]);


  /* ==========================================================
     ADMIN LOGIN SUBMISSION
     ========================================================== */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    /*
     * --------------------------------------------------------
     * Validate email.
     * --------------------------------------------------------
     */

    if (!normalizedEmail) {
      setError(
        'Email address is required.',
      );

      return;
    }

    /*
     * --------------------------------------------------------
     * Validate password.
     * --------------------------------------------------------
     */

    if (!password) {
      setError(
        'Password is required.',
      );

      return;
    }

    try {
      setLoading(true);
      setError('');

      /*
       * ------------------------------------------------------
       * Clear existing USER or ADMIN session.
       *
       * Zarova currently uses one frontend auth storage
       * session.
       * ------------------------------------------------------
       */

      clearAuthSession();

      /*
       * ------------------------------------------------------
       * Authenticate against the Admin API.
       * ------------------------------------------------------
       */

      const response =
        await apiFetch<AdminLoginResponse>(
          '/auth/admin/login',
          {
            method: 'POST',

            body: JSON.stringify({
              email: normalizedEmail,
              password,
            }),
          },
        );

      /*
       * ------------------------------------------------------
       * Validate API response.
       * ------------------------------------------------------
       */

      if (
        !response ||
        !response.accessToken ||
        !response.admin
      ) {
        throw new Error(
          'Invalid administrator login response from server.',
        );
      }

      /*
       * ------------------------------------------------------
       * Convert backend Admin response into the frontend
       * authentication format.
       * ------------------------------------------------------
       */

      const adminUser: AdminUser = {
        id: response.admin.id,

        email: response.admin.email,

        firstName:
          response.admin.firstName,

        lastName:
          response.admin.lastName,

        status:
          response.admin.status,

        type: 'ADMIN',
      };

      /*
       * ------------------------------------------------------
       * Only ACTIVE administrators should enter the Admin
       * console.
       *
       * Backend authentication also enforces this.
       * ------------------------------------------------------
       */

      if (
        adminUser.status !== 'ACTIVE'
      ) {
        throw new Error(
          'This administrator account is not active.',
        );
      }

      /*
       * ------------------------------------------------------
       * Save Admin session.
       *
       * The AdminAuthGuard will later read:
       *
       * accessToken
       * user.type === ADMIN
       * ------------------------------------------------------
       */

      saveAuthSession(
        response.accessToken,
        adminUser,
      );

      /*
       * ------------------------------------------------------
       * Notify components that authentication state changed.
       * ------------------------------------------------------
       */

      window.dispatchEvent(
        new Event(
          'auth-session-updated',
        ),
      );

      /*
       * ------------------------------------------------------
       * Redirect to the original Admin page.
       *
       * Example:
       *
       * /admin/3
       *      ↓
       * /admin/login?redirect=/admin/3
       *      ↓
       * successful login
       *      ↓
       * /admin/3
       * ------------------------------------------------------
       */

      router.replace(
        redirectPath,
      );

      router.refresh();
    } catch (caughtError) {
      console.error(
        'Administrator login error:',
        caughtError,
      );

      /*
       * Never leave an invalid/partial session behind.
       */
      clearAuthSession();

      setError(
        getErrorMessage(
          caughtError,
        ),
      );
    } finally {
      setLoading(false);
    }
  }


  /* ==========================================================
     SESSION CHECK LOADING
     ========================================================== */

  if (checkingSession) {
    return (
      <main className="auth-loading">
        <div className="auth-loading-spinner" />

        <div>
          <strong>
            Verifying administrator access
          </strong>

          <p>
            Checking your administrator
            session...
          </p>
        </div>
      </main>
    );
  }


  /* ==========================================================
     ADMIN LOGIN UI
     ========================================================== */

  return (
    <main className="admin-login-page">

      {/* ------------------------------------------------------
          Background
          ------------------------------------------------------ */}

      <div className="admin-login-background">

        <div
          className="
            admin-login-orb
            admin-login-orb-one
          "
        />

        <div
          className="
            admin-login-orb
            admin-login-orb-two
          "
        />

        <div className="admin-login-grid" />

      </div>


      {/* ------------------------------------------------------
          Login Card
          ------------------------------------------------------ */}

      <section
        className="admin-login-card"
      >

        {/* ----------------------------------------------------
            Brand
            ---------------------------------------------------- */}

        <div className="admin-login-brand">

          <ZarovaLogo size={36} showText={false} />

          <div>
            <strong>
              Zarova
            </strong>

            <span>
              ADMIN CONSOLE
            </span>
          </div>

        </div>


        {/* ----------------------------------------------------
            Heading
            ---------------------------------------------------- */}

        <div
          className="
            admin-login-heading
          "
        >

          <div
            className="
              admin-login-security-icon
            "
          >
            <ShieldCheck
              size={20}
            />
          </div>

          <div>

            <span>
              Secure access
            </span>

            <h1>
              Administrator login
            </h1>

            <p>
              Sign in with your Zarova
              administrator credentials.
            </p>

          </div>

        </div>


        {/* ----------------------------------------------------
            Error Message
            ---------------------------------------------------- */}

        {error && (
          <div
            className="
              admin-login-error
            "
            role="alert"
          >
            {error}
          </div>
        )}


        {/* ----------------------------------------------------
            Login Form
            ---------------------------------------------------- */}

        <form
          className="
            admin-login-form
          "
          onSubmit={handleSubmit}
        >

          {/* Email */}

          <label
            className="
              admin-login-field
            "
          >

            <span>
              Email address
            </span>

            <div
              className="
                admin-login-input
              "
            >

              <Mail
                size={17}
              />

              <input
                type="email"
                value={email}
                onChange={(
                  event,
                ) => {
                  setEmail(
                    event.target.value,
                  );

                  if (error) {
                    setError('');
                  }
                }}
                placeholder="admin@zarova.com"
                autoComplete="username"
                autoFocus
                disabled={loading}
                required
              />

            </div>

          </label>


          {/* Password */}

          <label
            className="
              admin-login-field
            "
          >

            <span>
              Password
            </span>

            <div
              className="
                admin-login-input
              "
            >

              <Lock
                size={17}
              />

              <input
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                value={password}
                onChange={(
                  event,
                ) => {
                  setPassword(
                    event.target.value,
                  );

                  if (error) {
                    setError('');
                  }
                }}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loading}
                required
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) =>
                      !current,
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
                  <EyeOff
                    size={17}
                  />
                ) : (
                  <Eye
                    size={17}
                  />
                )}
              </button>

            </div>

          </label>


          {/* Submit */}

          <button
            type="submit"
            className="
              admin-login-submit
            "
            disabled={loading}
          >

            {loading ? (
              <>
                <Loader2
                  size={17}
                  className="
                    admin-login-spinner
                  "
                />

                Signing in...
              </>
            ) : (
              <>
                <ShieldCheck
                  size={17}
                />

                Sign in to Admin Console
              </>
            )}

          </button>

        </form>


        {/* ----------------------------------------------------
            Security Notice
            ---------------------------------------------------- */}

        <div
          className="
            admin-login-security
          "
        >

          <ShieldCheck
            size={15}
          />

          <span>
            Protected administrator access.
            Your permissions are enforced by
            Zarova RBAC.
          </span>

        </div>


        {/* ----------------------------------------------------
            Regular User Login
            ---------------------------------------------------- */}

        <button
          type="button"
          className="
            admin-login-user-link
          "
          onClick={() => {
            router.push(
              '/login',
            );
          }}
        >
          Return to regular user login
        </button>

      </section>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginContent />
    </Suspense>
  );
}