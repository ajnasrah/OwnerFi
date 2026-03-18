'use client';

import { useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ExtendedSession } from '@/types/session';
import Link from 'next/link';
import { trackEvent } from '@/components/analytics/AnalyticsProvider';

export default function RealtorDashboardHub() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth');
    } else if (status === 'authenticated' && (session as unknown as ExtendedSession)?.user?.role !== 'realtor' && (session as unknown as ExtendedSession)?.user?.role !== 'admin') {
      router.replace('/');
    }
  }, [status, session, router]);

  // On mobile, skip the hub and go straight to buyer leads
  useEffect(() => {
    if (status === 'authenticated' && window.innerWidth < 768) {
      router.replace('/realtor-dashboard/buyers');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  const realtorName = (session as unknown as ExtendedSession)?.user?.name || 'Realtor';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50">
        <div className="px-4 py-3 flex items-center justify-between max-w-6xl mx-auto">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">O</span>
            </div>
            <span className="text-lg font-bold text-white">OwnerFi</span>
          </Link>

          <div className="flex items-center gap-2">
            {(session as unknown as ExtendedSession)?.user?.role === 'admin' && (
              <Link href="/admin" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors mr-2">
                ← Admin
              </Link>
            )}
            <button
              onClick={() => {
                trackEvent('auth_logout', { method: 'realtor_dashboard' });
                signOut({ callbackUrl: '/auth/signout' });
              }}
              className="text-slate-400 hover:text-red-400 transition-colors p-1.5"
              title="Logout"
            >
              ⏻
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12 pb-20 md:pb-12">
        {/* Welcome Section */}
        <div className="text-center mb-6 md:mb-12">
          <h1 className="text-2xl md:text-4xl font-bold text-white mb-2 md:mb-3">
            Welcome, {realtorName.split(' ')[0]}
          </h1>
          <p className="text-slate-300 text-sm md:text-lg">
            What would you like to do today?
          </p>
          {/* Mobile hint */}
          <p className="text-slate-500 text-xs mt-2 md:hidden">Use the tabs below to navigate</p>
        </div>

        {/* Hub Cards - hidden on mobile, tab bar handles nav */}
        <div className="hidden md:grid md:grid-cols-2 gap-6">

          {/* View Buyer Leads */}
          <Link
            href="/realtor-dashboard/buyers"
            className="group bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 hover:border-emerald-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/10 hover:scale-[1.02]"
          >
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">
                👥
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                Buyer Leads
              </h2>
              <p className="text-slate-300 mb-4">
                View available buyer leads in your area and manage your purchased leads
              </p>
              <div className="inline-flex items-center gap-2 text-emerald-400 font-semibold">
                <span>View Buyers</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </Link>

          {/* View Deals — all cash deals + owner finance in their area */}
          <Link
            href="/dashboard/investor"
            className="group bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 hover:border-amber-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/10 hover:scale-[1.02]"
          >
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">
                🏠
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                Deals
              </h2>
              <p className="text-slate-300 mb-4">
                Browse cash deals and owner-financed properties in your area
              </p>
              <div className="inline-flex items-center gap-2 text-amber-400 font-semibold">
                <span>View Deals</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </Link>

          {/* Profile */}
          <Link
            href="/dashboard/settings"
            className="group bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 hover:border-purple-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 hover:scale-[1.02]"
          >
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">
                ⚙️
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                Profile
              </h2>
              <p className="text-slate-300 mb-4">
                Manage your search preferences and property filters
              </p>
              <div className="inline-flex items-center gap-2 text-purple-400 font-semibold">
                <span>View Profile</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </Link>

        </div>

        {/* Mobile Quick Actions */}
        <div className="md:hidden mt-4 space-y-3">
          <Link
            href="/buy-credits"
            className="block w-full text-center bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 px-6 py-3 rounded-xl font-semibold transition-all"
          >
            Buy Credits
          </Link>
        </div>

        {/* Desktop Quick Actions */}
        <div className="hidden md:block mt-12 text-center">
          <p className="text-slate-400 text-sm mb-4">Need more leads?</p>
          <div className="flex justify-center">
            <Link
              href="/buy-credits"
              className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 px-8 py-3 rounded-xl font-semibold transition-all hover:scale-105"
            >
              Buy Credits
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
