'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Dashboard switcher for admin users
 * Shows tabs to switch between admin, buyer, and settings dashboards
 */
export default function AdminDashboardSwitcher() {
  const { data: session } = useSession();
  const pathname = usePathname();

  // Only show for admin users
  if (session?.user?.role !== 'admin') {
    return null;
  }

  const isAdminDashboard = pathname?.startsWith('/admin');
  const isBuyerDashboard = pathname?.startsWith('/dashboard');

  return (
    <div className="bg-slate-800 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex gap-1">
          <Link
            href="/admin/manage"
            className={`px-6 py-3 font-semibold text-sm transition-colors ${
              isAdminDashboard
                ? 'bg-slate-900 text-emerald-400 border-b-2 border-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Admin Dashboard
          </Link>
          <Link
            href="/dashboard"
            className={`px-6 py-3 font-semibold text-sm transition-colors ${
              isBuyerDashboard
                ? 'bg-slate-900 text-emerald-400 border-b-2 border-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Buyer Dashboard
          </Link>
          <Link
            href="/dashboard/settings"
            className={`px-6 py-3 font-semibold text-sm transition-colors ${
              pathname === '/dashboard/settings'
                ? 'bg-slate-900 text-emerald-400 border-b-2 border-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
