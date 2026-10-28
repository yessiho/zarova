
'use client';

import type { ReactNode } from 'react';

import AuthGuard from '@/components/auth/AuthGuard';
import Sidebar from '@/components/layout/Sidebar';
import LiveNotificationToast from '@/components/ui/LiveNotificationToast';

// ============================================================
// DASHBOARD LAYOUT
// ============================================================
//
// All authentication protection is handled by AuthGuard.
//
// This layout is responsible only for:
//
// - Protecting dashboard routes through AuthGuard
// - Rendering the Sidebar
// - Rendering dashboard page content
//
// IMPORTANT:
//
// Do not access localStorage directly here.
// Authentication storage and session management are centralized
// in:
//
// apps/web/src/lib/auth.ts
//
// ============================================================

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="app-shell">

        <Sidebar />

        <main className="app-main">

          <div className="app-content">
            {children}
          </div>

        </main>

        <LiveNotificationToast />

      </div>
    </AuthGuard>
  );
}
