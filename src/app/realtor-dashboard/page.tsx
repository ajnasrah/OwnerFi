'use client';

import { useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ExtendedSession } from '@/types/session';
import Link from 'next/link';

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
            <Link
              href="/realtor-dashboard/settings"
              className="text-slate-400 hover:text-white transition-colors p-1.5"
              title="Settings"
            >
              ⚙️
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/signout' })}
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
                Browse owner-financed properties in your area to show to your buyers
              </p>
              <div className="inline-flex items-center gap-2 text-blue-400 font-semibold">
                <span>View Properties</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </Link>

        </div>

        {/* Quick Actions */}
        <div className="mt-12 text-center">
          <p className="text-slate-400 text-sm mb-4">Quick Actions</p>
          <div className="flex justify-center gap-4">
            <Link
              href="/buy-credits"
              className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 text-white px-6 py-3 rounded-xl font-medium transition-all"
            >
              💳 Buy Credits
            </Link>
            <Link
              href="/realtor-dashboard/settings"
              className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 text-white px-6 py-3 rounded-xl font-medium transition-all"
            >
              ⚙️ Settings
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
