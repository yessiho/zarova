'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  BadgeCheck,
  BarChart3,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  FileSearch,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Scale,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  clearAuthSession,
  getAuthUser,
} from '@/lib/auth';

import ZarovaLogo from '@/components/ui/ZarovaLogo';

type AuthUser = {
  id?: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  status?: string;
  type?: string;
};

type NavigationItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
  }>;
};

const mainNavigation: NavigationItem[] = [
  {
    label: 'Overview',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    label: 'Administrators',
    href: '/admin',
    icon: UserCog,
  },
  {
    label: 'Customers',
    href: '/admin/customers',
    icon: Users,
  },
  {
    label: 'Accounts',
    href: '/admin/accounts',
    icon: WalletCards,
  },
  {
    label: 'Transactions',
    href: '/admin/transactions',
    icon: ReceiptText,
  },
  {
    label: 'Payments',
    href: '/admin/payments',
    icon: Activity,
  },
  {
    label: 'Ledger',
    href: '/admin/ledger',
    icon: BookOpen,
  },
];

const controlNavigation: NavigationItem[] = [
  {
    label: 'KYC Review',
    href: '/admin/kyc',
    icon: BadgeCheck,
  },
  {
    label: 'Compliance',
    href: '/admin/compliance',
    icon: ClipboardCheck,
  },
  {
    label: 'Risk & Fraud',
    href: '/admin/risk',
    icon: ShieldCheck,
  },
  {
    label: 'Reconciliation',
    href: '/admin/reconciliation',
    icon: Scale,
  },
  {
    label: 'Audit Logs',
    href: '/admin/audit-logs',
    icon: FileSearch,
  },
  {
    label: 'Reports',
    href: '/admin/reports',
    icon: BarChart3,
  },
];

const systemNavigation: NavigationItem[] = [
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
  },
];

function getInitials(
  firstName?: string,
  lastName?: string,
) {
  const first = firstName?.trim()?.[0] ?? '';
  const last = lastName?.trim()?.[0] ?? '';

  const initials = `${first}${last}`.toUpperCase();

  return initials || 'AD';
}

function isNavigationActive(
  pathname: string,
  href: string,
) {
  if (href === '/admin') {
    return pathname === '/admin';
  }

  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const currentUser = getAuthUser();

    setUser(
      currentUser
        ? (currentUser as AuthUser)
        : null,
    );
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function handleLogout() {
    clearAuthSession();

    router.replace('/login');
  }

  function renderNavigation(
    items: NavigationItem[],
  ) {
    return items.map((item) => {
      const Icon = item.icon;

      const active = isNavigationActive(
        pathname,
        item.href,
      );

      return (
        <Link
          key={item.label}
          href={item.href}
          className={`admin-nav-item ${
            active ? 'active' : ''
          }`}
          aria-current={active ? 'page' : undefined}
        >
          <Icon
            size={18}
            strokeWidth={active ? 2.2 : 1.8}
          />

          <span>{item.label}</span>

          {active && (
            <ChevronRight
              className="admin-nav-active-arrow"
              size={15}
            />
          )}
        </Link>
      );
    });
  }

  return (
    <>
      <button
        type="button"
        className="admin-mobile-menu-button"
        onClick={() =>
          setMobileOpen((current) => !current)
        }
        aria-label={
          mobileOpen
            ? 'Close administrator navigation'
            : 'Open administrator navigation'
        }
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? (
          <X size={21} />
        ) : (
          <Menu size={21} />
        )}
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="admin-sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          aria-label="Close administrator navigation"
        />
      )}

      <aside
        className={`admin-sidebar ${
          mobileOpen ? 'mobile-open' : ''
        }`}
      >
        <div className="admin-sidebar-brand">
          <Link
            href="/admin"
            className="admin-brand-link"
          >
            <ZarovaLogo size={34} showText={false} />

            <div>
              <strong>Zarova</strong>
              <span>ADMIN CONSOLE</span>
            </div>
          </Link>
        </div>

        <div className="admin-sidebar-body">
          <nav
            className="admin-sidebar-nav"
            aria-label="Administrator navigation"
          >
            <div className="admin-nav-section">
              <span className="admin-nav-section-title">
                Management
              </span>

              {renderNavigation(mainNavigation)}
            </div>

            <div className="admin-nav-section">
              <span className="admin-nav-section-title">
                Controls
              </span>

              {renderNavigation(controlNavigation)}
            </div>

            <div className="admin-nav-section">
              <span className="admin-nav-section-title">
                System
              </span>

              {renderNavigation(systemNavigation)}
            </div>
          </nav>
        </div>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">
            <div className="admin-sidebar-avatar">
              {getInitials(
                user?.firstName,
                user?.lastName,
              )}
            </div>

            <div className="admin-sidebar-user-info">
              <strong>
                {user?.firstName || 'Administrator'}{' '}
                {user?.lastName || ''}
              </strong>

              <span>
                {user?.email || 'Admin account'}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="admin-sidebar-logout"
            onClick={handleLogout}
          >
            <LogOut size={17} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}