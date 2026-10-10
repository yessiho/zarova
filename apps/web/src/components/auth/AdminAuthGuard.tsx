'use client';

import { ReactNode, useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

import {
  clearAuthSession,
  getAccessToken,
  getAuthUser,
} from '@/lib/auth';

interface AdminAuthGuardProps {
  children: ReactNode;
}

interface JwtPayload {
  sub?: number | string;
  email?: string;
  type?: string;
  exp?: number;
  iat?: number;
}

/**
 * Decode a JWT payload for client-side routing decisions.
 *
 * IMPORTANT:
 * This does NOT verify the JWT.
 * JWT verification and authorization are still performed
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

    const payload = JSON.parse(
      atob(padded),
    ) as JwtPayload;

    return payload;
  } catch {
    return null;
  }
}

function isTokenExpired(
  payload: JwtPayload,
): boolean {
  if (!payload.exp) {
    return false;
  }

  return payload.exp * 1000 <= Date.now();
}

function getAdminLoginUrl(pathname: string) {
  const redirectPath =
    pathname.startsWith('/admin') &&
    pathname !== '/admin/login'
      ? pathname
      : '/admin';

  return `/admin/login?redirect=${encodeURIComponent(
    redirectPath,
  )}`;
}

export default function AdminAuthGuard({
  children,
}: AdminAuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let mounted = true;

    function checkAdminSession() {
      try {
        const token = getAccessToken();
        const authUser = getAuthUser();

        /*
         * --------------------------------------------------
         * CASE 1:
         * No session exists.
         *
         * Send the administrator to the dedicated
         * Admin login page.
         * --------------------------------------------------
         */
        if (!token) {
          if (mounted) {
            setAuthorized(false);
            setChecking(false);
          }

          router.replace(
            getAdminLoginUrl(pathname),
          );

          return;
        }

        /*
         * --------------------------------------------------
         * Decode JWT.
         *
         * This is only for client-side routing.
         * Backend verification remains authoritative.
         * --------------------------------------------------
         */
        const payload =
          decodeJwtPayload(token);

        /*
         * --------------------------------------------------
         * CASE 2:
         * Invalid JWT.
         *
         * This session cannot be trusted, so clear it
         * and send the browser to Admin login.
         * --------------------------------------------------
         */
        if (!payload) {
          clearAuthSession();

          if (mounted) {
            setAuthorized(false);
            setChecking(false);
          }

          router.replace(
            getAdminLoginUrl(pathname),
          );

          return;
        }

        /*
         * --------------------------------------------------
         * CASE 3:
         * JWT has expired.
         * --------------------------------------------------
         */
        if (isTokenExpired(payload)) {
          clearAuthSession();

          if (mounted) {
            setAuthorized(false);
            setChecking(false);
          }

          router.replace(
            getAdminLoginUrl(pathname),
          );

          return;
        }

        /*
         * --------------------------------------------------
         * CASE 4:
         * Valid USER session.
         *
         * Do NOT clear the session.
         *
         * The user may still be legitimately logged into
         * the normal Zarova application.
         *
         * Simply deny access to the Admin console.
         * --------------------------------------------------
         */
        if (payload.type !== 'ADMIN') {
          if (mounted) {
            setAuthorized(false);
            setChecking(false);
          }

          return;
        }

        /*
         * --------------------------------------------------
         * CASE 5:
         * Admin JWT exists but frontend auth user is
         * missing.
         * --------------------------------------------------
         */
        if (!authUser) {
          if (mounted) {
            setAuthorized(false);
            setChecking(false);
          }

          return;
        }

        /*
         * --------------------------------------------------
         * CASE 6:
         * Admin session is valid.
         * --------------------------------------------------
         */
        if (mounted) {
          setAuthorized(true);
          setChecking(false);
        }
      } catch (error) {
        console.error(
          'Admin authentication check failed:',
          error,
        );

        if (mounted) {
          setAuthorized(false);
          setChecking(false);
        }
      }
    }

    checkAdminSession();

    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  /*
   * ------------------------------------------------------
   * Loading state
   * ------------------------------------------------------
   */
  if (checking) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" />

        <div>
          <strong>
            Verifying administrator access
          </strong>

          <p>
            Please wait while Zarova verifies your
            administrator session.
          </p>
        </div>
      </div>
    );
  }

  /*
   * ------------------------------------------------------
   * Unauthorized state
   *
   * This normally happens when a regular USER session
   * attempts to access /admin.
   *
   * We intentionally DO NOT clear their user session.
   * ------------------------------------------------------
   */
  if (!authorized) {
    return (
      <div className="admin-access-denied">
        <div className="admin-access-denied-icon">
          <ShieldAlert size={28} />
        </div>

        <div>
          <span className="admin-eyebrow">
            <ShieldCheck size={15} />
            Access control
          </span>

          <h1>
            Administrator access required
          </h1>

          <p>
            This area is restricted to authorized
            Zarova administrators.
          </p>

          <p className="admin-access-denied-note">
            Your current session does not contain an
            administrator identity.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            router.push(
              getAdminLoginUrl(pathname),
            );
          }}
        >
          Go to administrator login
        </button>
      </div>
    );
  }

  /*
   * ------------------------------------------------------
   * Authorized Admin
   * ------------------------------------------------------
   */
  return <>{children}</>;
}