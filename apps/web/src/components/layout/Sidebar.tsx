
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  usePathname,
  useRouter,
} from 'next/navigation';

import {
  BadgeCheck,
  BarChart2,
  Bell,
  BookOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Phone,
  ReceiptText,
  Send,
  Settings,
  ShieldCheck,
  WalletCards,
  X,
} from 'lucide-react';

import ZarovaLogo from '@/components/ui/ZarovaLogo';

import type { User } from '@/types';

import {
  AUTH_SESSION_UPDATED_EVENT,
  USER_PROFILE_UPDATED_EVENT,
  clearAuthSession,
  getAuthUser,
} from '@/lib/auth';

// ============================================================
// NAVIGATION ITEMS
// ============================================================

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Wallets',
    href: '/wallets',
    icon: WalletCards,
  },
  {
    name: 'Send Money',
    href: '/send',
    icon: Send,
  },
  {
    name: 'Pay Bills',
    href: '/bills',
    icon: Phone,
  },
  {
    name: 'Transactions',
    href: '/transactions',
    icon: ReceiptText,
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart2,
  },
  {
    name: 'Ledger',
    href: '/ledger',
    icon: BookOpen,
  },
  {
    name: 'Audit Logs',
    href: '/audit',
    icon: ShieldCheck,
  },
  {
    name: 'KYC Verification',
    href: '/kyc',
    icon: BadgeCheck,
  },
  {
    name: 'Notifications',
    href: '/notifications',
    icon: Bell,
  },
];

// ============================================================
// SIDEBAR COMPONENT
// ============================================================

export default function Sidebar() {
  const pathname = usePathname();

  const router = useRouter();

  const [user, setUser] =
    useState<User | null>(null);

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [mobileOpen, setMobileOpen] =
    useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // ============================================================
  // LOAD AUTHENTICATED USER
  //
  // Authentication data is centrally managed through auth.ts.
  //
  // Sidebar reacts to:
  //
  // - Login
  // - Logout
  // - Session expiration
  // - Profile updates
  // - Multi-tab authentication changes
  // ============================================================

  useEffect(() => {
    function loadUser() {
      const authenticatedUser =
        getAuthUser();

      if (!authenticatedUser) {
        setUser(null);
        return;
      }

      setUser(authenticatedUser as User);
    }

    // Load authenticated user immediately.
    loadUser();

    // Listen for complete authentication session changes.
    window.addEventListener(
      AUTH_SESSION_UPDATED_EVENT,
      loadUser,
    );

    // Listen for profile updates.
    window.addEventListener(
      USER_PROFILE_UPDATED_EVENT,
      loadUser,
    );

    /*
     * Listen for authentication changes from other browser tabs.
     *
     * The storage event does not fire in the same tab that made
     * the change, which is why custom auth events are also used.
     */
    window.addEventListener(
      'storage',
      loadUser,
    );

    return () => {
      window.removeEventListener(
        AUTH_SESSION_UPDATED_EVENT,
        loadUser,
      );

      window.removeEventListener(
        USER_PROFILE_UPDATED_EVENT,
        loadUser,
      );

      window.removeEventListener(
        'storage',
        loadUser,
      );
    };
  }, []);

  // ============================================================
  // LOGOUT
  // ============================================================

  function logout() {
    /*
     * Prevent duplicate logout actions.
     */
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    /*
     * Clear centralized authentication session.
     *
     * auth.ts removes:
     *
     * - zarova_access_token
     * - zarova_user
     *
     * It also dispatches authentication events.
     */
    clearAuthSession();

    /*
     * Immediately update Sidebar UI.
     */
    setUser(null);

    /*
     * Redirect to login.
     *
     * replace() prevents the user from returning to the
     * protected dashboard using the browser Back button.
     */
    router.replace('/login');
  }

  // ============================================================
  // CHECK ACTIVE NAVIGATION
  // ============================================================

  function isActive(href: string) {
    /*
     * Dashboard should only match exactly.
     */
    if (href === '/dashboard') {
      return pathname === href;
    }

    /*
     * Other routes support nested pages.
     *
     * Examples:
     *
     * /wallets
     * /wallets/1
     *
     * /transactions
     * /transactions/123
     */
    return (
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  }

  // ============================================================
  // CHECK PROFILE ACTIVE STATE
  // ============================================================

  function isProfileActive() {
    return (
      pathname === '/profile' ||
      pathname.startsWith('/profile/')
    );
  }

  // ============================================================
  // CHECK SETTINGS ACTIVE STATE
  // ============================================================

  function isSettingsActive() {
    return (
      pathname === '/settings' ||
      pathname.startsWith('/settings/')
    );
  }

  // ============================================================
  // GET USER INITIALS
  // ============================================================

  function getInitials() {
    if (!user) {
      return 'U';
    }

    const firstInitial =
      user.firstName?.charAt(0) || '';

    const lastInitial =
      user.lastName?.charAt(0) || '';

    const initials =
      `${firstInitial}${lastInitial}`.toUpperCase();

    return initials || 'U';
  }

  // ============================================================
  // GET USER FULL NAME
  // ============================================================

  function getUserFullName() {
    if (!user) {
      return 'User';
    }

    const fullName =
      `${user.firstName || ''} ${
        user.lastName || ''
      }`.trim();

    return fullName || 'User';
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <>
      <button
        type="button"
        className="mobile-menu-button"
        onClick={() => setMobileOpen((o) => !o)}
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X size={21} /> : <Menu size={21} />}
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside className={`sidebar${mobileOpen ? ' mobile-open' : ''}`}>

      {/* ======================================================
          BRAND
      ====================================================== */}

      <div className="sidebar-brand">
        <ZarovaLogo size={34} showText variant="light" />
      </div>

      {/* ======================================================
          MAIN NAVIGATION
      ====================================================== */}

      <nav
        className="sidebar-nav"
        aria-label="Main navigation"
      >
        {navigation.map((item) => {
          const Icon = item.icon;

          const active = isActive(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`nav-item ${
                active ? 'active' : ''
              }`}
              aria-current={
                active
                  ? 'page'
                  : undefined
              }
            >
              <Icon
                size={20}
                strokeWidth={2}
              />

              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* ======================================================
          USER PROFILE
      ====================================================== */}

      {user && (
        <div className="sidebar-user-wrapper">
          <Link
            href="/profile"
            className={`sidebar-user ${
              isProfileActive()
                ? 'active'
                : ''
            }`}
            aria-current={
              isProfileActive()
                ? 'page'
                : undefined
            }
          >
            <div className="sidebar-user-avatar">
              {getInitials()}
            </div>

            <div className="sidebar-user-details">
              <strong>
                {getUserFullName()}
              </strong>

              <span>
                {user.email}
              </span>
            </div>
          </Link>
        </div>
      )}

      {/* ======================================================
          BOTTOM NAVIGATION
      ====================================================== */}

      <div className="sidebar-bottom">

        {/* ====================================================
            SETTINGS
        ==================================================== */}

        <Link
          href="/settings"
          className={`nav-item ${
            isSettingsActive()
              ? 'active'
              : ''
          }`}
          aria-current={
            isSettingsActive()
              ? 'page'
              : undefined
          }
        >
          <Settings
            size={20}
            strokeWidth={2}
          />

          <span>Settings</span>
        </Link>

        {/* ====================================================
            LOGOUT
        ==================================================== */}

        <button
          type="button"
          className="nav-item logout-button"
          onClick={logout}
          disabled={loggingOut}
          aria-label="Logout"
        >
          <LogOut
            size={20}
            strokeWidth={2}
          />

          <span>
            {loggingOut
              ? 'Logging out...'
              : 'Logout'}
          </span>
        </button>

      </div>
    </aside>
    </>
  );
}
