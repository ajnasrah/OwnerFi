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
      router.push('/auth');
    } else if (status === 'authenticated' && (session as unknown as ExtendedSession)?.user?.role !== 'realtor') {
      router.push('/');
    }
  }, [status, session, router]);

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
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Welcome Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">
            Welcome, {realtorName.split(' ')[0]}
          </h1>
          <p className="text-slate-300 text-lg">
            What would you like to do today?
          </p>
        </div>

        {/* Hub Cards */}
        <div className="grid md:grid-cols-2 gap-6">

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

          {/* View Properties */}
          <Link
            href="/dashboard"
            className="group bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 hover:scale-[1.02]"
          >
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">
                🏠
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                Properties
              </h2>
              <p className="text-slate-300 mb-4">
                Browse owner-financed properties to show to your buyers
              </p>
              <div className="inline-flex items-center gap-2 text-blue-400 font-semibold">
                <span>View Properties</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </Link>

          {/* Cash Deals - Hidden for now, only available in certain cities
          <Link
            href="/cash-deals"
            className="group bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 hover:border-yellow-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-yellow-500/10 hover:scale-[1.02]"
          >
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">
                💰
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                Cash Deals
              </h2>
              <p className="text-slate-300 mb-4">
                Find discounted properties under market value for investors
              </p>
              <div className="inline-flex items-center gap-2 text-yellow-400 font-semibold">
                <span>View Deals</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </Link>
          */}

          {/* Account Settings */}
          <Link
            href="/dashboard/settings"
            className="group bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 hover:border-purple-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 hover:scale-[1.02]"
          >
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">
                ⚙️
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                Settings
              </h2>
              <p className="text-slate-300 mb-4">
                Manage your search preferences and property filters
              </p>
              <div className="inline-flex items-center gap-2 text-purple-400 font-semibold">
                <span>View Settings</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </Link>

        </div>

        {/* Quick Actions */}
        <div className="mt-12 text-center">
          <p className="text-slate-400 text-sm mb-4">Need more leads?</p>
          <div className="flex justify-center">
            <Link
              href="/buy-credits"
              className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 px-8 py-3 rounded-xl font-semibold transition-all hover:scale-105"
            >
              💳 Buy Credits
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
