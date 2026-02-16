'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ExtendedSession } from '@/types/session';
import Link from 'next/link';
import { trackEvent } from '@/components/analytics/AnalyticsProvider';

interface Stats {
  totalProperties: number;
  ownerFinanceProperties: number;
  cashDealProperties: number;
  totalBuyers: number;
  totalRealtors: number;
  pendingDisputes: number;
}

export default function AdminHub() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth');
    } else if (status === 'authenticated' && (session as unknown as ExtendedSession)?.user?.role !== 'admin') {
      router.replace('/');
    }
  }, [status, session, router]);

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      loadStats();
    }
  }, [status, loadStats]);

  if (status !== 'authenticated' || (session as unknown as ExtendedSession)?.user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  const adminName = (session as unknown as ExtendedSession)?.user?.name || 'Admin';

  const mainCards = [
    {
      href: '/dashboard/investor',
      icon: '📊',
      title: 'Investor Experience',
      description: 'Preview investor deals, filters & alerts',
      color: 'amber',
    },
    {
      href: '/realtor-dashboard',
      icon: '🏡',
      title: 'Realtor Experience',
      description: 'Preview the realtor dashboard, leads & credits',
      color: 'indigo',
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
      href: '/admin/cre-analysis',
      icon: '🏢',
      title: 'CRE Analysis',
      description: 'Commercial RE market analysis',
      color: 'cyan',
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

  const quickLinks = [
    { href: '/admin/realtors', label: 'Realtors' },
    { href: '/admin/scraper', label: 'Scraper Upload' },
    { href: '/admin/manual-upload', label: 'Zillow Upload' },
    { href: '/admin/logs', label: 'System Logs' },
    { href: '/admin/ghl-logs', label: 'GHL Logs' },
    { href: '/admin/costs', label: 'API Costs' },
    { href: '/admin/analytics', label: 'Analytics' },
    { href: '/admin/youtube-analytics', label: 'YouTube' },
    { href: '/admin/blog', label: 'Blog' },
    { href: '/admin/articles', label: 'Articles' },
    { href: '/admin/workflow-failures', label: 'Workflow Failures' },
    { href: '/admin/late-failures', label: 'Late Failures' },
    { href: '/admin/ab-tests', label: 'A/B Tests' },
    { href: '/admin/add-credits-manual', label: 'Add Credits' },
  ];

  const colorClasses: Record<string, { border: string; shadow: string; text: string; bg: string }> = {
    blue: { border: 'hover:border-blue-500/50', shadow: 'hover:shadow-blue-500/10', text: 'text-blue-400', bg: 'from-blue-400 to-blue-600' },
    emerald: { border: 'hover:border-emerald-500/50', shadow: 'hover:shadow-emerald-500/10', text: 'text-emerald-400', bg: 'from-emerald-400 to-emerald-600' },
    purple: { border: 'hover:border-purple-500/50', shadow: 'hover:shadow-purple-500/10', text: 'text-purple-400', bg: 'from-purple-400 to-purple-600' },
    pink: { border: 'hover:border-pink-500/50', shadow: 'hover:shadow-pink-500/10', text: 'text-pink-400', bg: 'from-pink-400 to-pink-600' },
    yellow: { border: 'hover:border-yellow-500/50', shadow: 'hover:shadow-yellow-500/10', text: 'text-yellow-400', bg: 'from-yellow-400 to-yellow-600' },
    cyan: { border: 'hover:border-cyan-500/50', shadow: 'hover:shadow-cyan-500/10', text: 'text-cyan-400', bg: 'from-cyan-400 to-cyan-600' },
    amber: { border: 'hover:border-amber-500/50', shadow: 'hover:shadow-amber-500/10', text: 'text-amber-400', bg: 'from-amber-400 to-amber-600' },
    indigo: { border: 'hover:border-indigo-500/50', shadow: 'hover:shadow-indigo-500/10', text: 'text-indigo-400', bg: 'from-indigo-400 to-indigo-600' }
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

        {/* Stats */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
          {statsLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700/50 animate-pulse">
                <div className="h-7 w-12 bg-slate-700 rounded mx-auto mb-1" />
                <div className="h-4 w-16 bg-slate-700/50 rounded mx-auto" />
              </div>
            ))
          ) : stats ? (
            <>
              <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700/50">
                <div className="text-2xl font-bold text-white">{stats.totalProperties}</div>
                <div className="text-slate-400 text-xs">Properties</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700/50">
                <div className="text-2xl font-bold text-amber-400">{stats.ownerFinanceProperties}</div>
                <div className="text-slate-400 text-xs">Owner Finance</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700/50">
                <div className="text-2xl font-bold text-yellow-400">{stats.cashDealProperties}</div>
                <div className="text-slate-400 text-xs">Cash Deals</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700/50">
                <div className="text-2xl font-bold text-white">{stats.totalBuyers}</div>
                <div className="text-slate-400 text-xs">Buyers</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700/50">
                <div className="text-2xl font-bold text-white">{stats.totalRealtors}</div>
                <div className="text-slate-400 text-xs">Realtors</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700/50">
                <div className="text-2xl font-bold text-emerald-400">{stats.pendingDisputes}</div>
                <div className="text-slate-400 text-xs">Disputes</div>
              </div>
            </>
          ) : (
            <div className="col-span-full text-center text-slate-500 text-sm py-2">Failed to load stats</div>
          )}
        </div>

        {/* Main Cards */}
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

        {/* Quick Links */}
        <div className="mt-10">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Quick Links</h3>
          <div className="flex flex-wrap gap-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-slate-300 hover:text-white hover:border-slate-500/50 hover:bg-slate-700/50 transition-all"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
