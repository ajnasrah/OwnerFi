'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Button } from './Button';
import { OwnerfiLogo } from './OwnerfiLogo';
import { ExtendedSession } from '@/types/session';
import { trackEvent } from '@/components/analytics/AnalyticsProvider';

interface HeaderProps {
  className?: string;
}

export function Header({ className = '' }: HeaderProps) {
  const { data: session } = useSession();

  return (
    <header className={`bg-[#111625]/90 backdrop-blur-xl border-b border-white/[0.06] sticky top-0 z-50 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <OwnerfiLogo size={40} />
            <span className="text-2xl font-bold text-white tracking-tight group-hover:text-[#00BC7D] transition-colors duration-200">
              Ownerfi
            </span>
          </Link>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Link
              href="/how-owner-finance-works"
              className="hidden sm:inline-flex text-sm text-slate-400 hover:text-white px-3 py-2 rounded-lg transition-colors"
            >
              How It Works
            </Link>
            {session?.user ? (
              <div className="flex items-center gap-2 ml-2">
                <Link
                  href="/dashboard/settings"
                  className="hidden sm:inline-flex text-sm text-slate-400 hover:text-white px-3 py-2 rounded-lg transition-colors"
                >
                  Manage Search
                </Link>
                <Button
                  variant="primary"
                  size="sm"
                  href={
                    (session as unknown as ExtendedSession)?.user?.role === 'admin' ? '/admin' :
                    (session as unknown as ExtendedSession)?.user?.role === 'realtor' ? '/realtor-dashboard/buyers' :
                    (session?.user as any)?.isInvestor === true ? '/dashboard/investor' : '/dashboard'
                  }
                  className="bg-[#00BC7D] hover:bg-[#00d68f] text-white px-5 py-2 rounded-lg font-semibold text-sm transition-all duration-200"
                >
                  Dashboard
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    trackEvent('auth_logout', { method: 'header_button' });
                    signOut({ callbackUrl: '/auth/signout' });
                  }}
                  className="text-sm text-slate-400 hover:text-white px-3 py-2 rounded-lg transition-colors"
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <Link
                href="/auth"
                className="ml-2 bg-[#00BC7D] hover:bg-[#00d68f] text-white px-5 py-2 rounded-lg font-semibold text-sm transition-all duration-200"
              >
                Get Started
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
