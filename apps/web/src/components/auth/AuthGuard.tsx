
'use client';

import {
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  usePathname,
  useRouter,
} from 'next/navigation';

import {
  AUTH_SESSION_UPDATED_EVENT,
  hasAuthSession,
} from '@/lib/auth';

// ============================================================
// TYPES
// ============================================================

interface AuthGuardProps {
  children: ReactNode;
}

// ============================================================
// AUTH GUARD
// ============================================================

export default function AuthGuard({
  children,
}: AuthGuardProps) {
  const router = useRouter();

  const pathname = usePathname();

  const [isChecking, setIsChecking] =
    useState(true);

  const [isAuthenticated, setIsAuthenticated] =
    useState(false);

  useEffect(() => {
    function checkAuthentication() {
      const authenticated =
        hasAuthSession();

      if (!authenticated) {
        setIsAuthenticated(false);

        setIsChecking(false);

        const redirect =
          encodeURIComponent(pathname);

        router.replace(
          `/login?redirect=${redirect}`,
        );

        return;
      }

      setIsAuthenticated(true);

      setIsChecking(false);
    }

    checkAuthentication();

    window.addEventListener(
      AUTH_SESSION_UPDATED_EVENT,
      checkAuthentication,
    );

    return () => {
      window.removeEventListener(
        AUTH_SESSION_UPDATED_EVENT,
        checkAuthentication,
      );
    };
  }, [
    pathname,
    router,
  ]);

  // ============================================================
  // LOADING
  // ============================================================

  if (isChecking) {
    return (
      <main className="auth-loading">
        <div className="auth-loading-spinner" />

        <p>
          Verifying your session...
        </p>
      </main>
    );
  }

  // ============================================================
  // REDIRECTING
  // ============================================================

  if (!isAuthenticated) {
    return null;
  }

  // ============================================================
  // AUTHENTICATED CONTENT
  // ============================================================

  return <>{children}</>;
}

