'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ExtendedSession } from '@/types/session';
import Link from 'next/link';
import { trackEvent } from '@/components/analytics/AnalyticsProvider';

interface Stats {
  totalProperties: number;
  totalBuyers: number;
  totalRealtors: number;
  pendingDisputes: number;
}

export default function AdminHub() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth');
    } else if (status === 'authenticated' && (session as unknown as ExtendedSession)?.user?.role !== 'admin') {
      router.push('/');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      loadStats();
    }
  }, [status]);

  const loadStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  const adminName = (session as unknown as ExtendedSession)?.user?.name || 'Admin';

  const mainCards = [
    {
      href: '/dashboard',
      icon: '🏠',
      title: 'Properties',
      description: 'Browse properties with the swiper',
      color: 'blue',
    },
    {
      href: '/admin/cash-deals',
      icon: '💰',
      title: 'Cash Deals',
      description: 'Investor deals under $300K',
      color: 'yellow',
    },
    {
      href: '/admin/buyers',
      icon: '👥',
      title: 'Buyer Leads',
      description: 'View and manage buyer profiles',
      color: 'emerald',
    },
    {
      href: '/admin/social-dashboard',
      icon: '📱',
      title: 'Social Media',
      description: 'Manage social content & articles',
      color: 'pink',
    },
    {
      href: '/admin/manage',
      icon: '⚙️',
      title: 'Admin Panel',
      description: 'Properties, realtors, buyers in bulk',
      color: 'purple',
    }
  ];

  const colorClasses: Record<string, { border: string; shadow: string; text: string; bg: string }> = {
    blue: { border: 'hover:border-blue-500/50', shadow: 'hover:shadow-blue-500/10', text: 'text-blue-400', bg: 'from-blue-400 to-blue-600' },
    emerald: { border: 'hover:border-emerald-500/50', shadow: 'hover:shadow-emerald-500/10', text: 'text-emerald-400', bg: 'from-emerald-400 to-emerald-600' },
    purple: { border: 'hover:border-purple-500/50', shadow: 'hover:shadow-purple-500/10', text: 'text-purple-400', bg: 'from-purple-400 to-purple-600' },
    pink: { border: 'hover:border-pink-500/50', shadow: 'hover:shadow-pink-500/10', text: 'text-pink-400', bg: 'from-pink-400 to-pink-600' },
    yellow: { border: 'hover:border-yellow-500/50', shadow: 'hover:shadow-yellow-500/10', text: 'text-yellow-400', bg: 'from-yellow-400 to-yellow-600' }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-auto pb-safe">
      <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50">
        <div className="px-4 py-3 flex items-center justify-between max-w-6xl mx-auto">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">O</span>
            </div>
            <span className="text-lg font-bold text-white">OwnerFi</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm hidden sm:block">Admin</span>
            <button onClick={() => { trackEvent('auth_logout', { method: 'admin_hub' }); signOut({ callbackUrl: '/auth/signout' }); }} className="text-slate-400 hover:text-red-400 transition-colors p-1.5" title="Logout">
              ⏻
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 pb-20">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome, {adminName.split(' ')[0]}</h1>
          <p className="text-slate-400">What would you like to do?</p>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700/50">
              <div className="text-2xl font-bold text-white">{stats.totalProperties}</div>
              <div className="text-slate-400 text-sm">Properties</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700/50">
              <div className="text-2xl font-bold text-white">{stats.totalBuyers}</div>
              <div className="text-slate-400 text-sm">Buyers</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700/50">
              <div className="text-2xl font-bold text-white">{stats.totalRealtors}</div>
              <div className="text-slate-400 text-sm">Realtors</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700/50">
              <div className="text-2xl font-bold text-emerald-400">{stats.pendingDisputes}</div>
              <div className="text-slate-400 text-sm">Disputes</div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {mainCards.map((card) => {
            const colors = colorClasses[card.color];
            return (
              <Link
                key={card.href}
                href={card.href}
                className={`group bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 ${colors.border} transition-all duration-300 hover:shadow-xl ${colors.shadow} hover:scale-[1.02]`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 bg-gradient-to-br ${colors.bg} rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform`}>
                    {card.icon}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-white mb-1">{card.title}</h2>
                    <p className="text-slate-400 text-sm">{card.description}</p>
                  </div>
                  <span className={`${colors.text} group-hover:translate-x-1 transition-transform text-xl`}>→</span>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
