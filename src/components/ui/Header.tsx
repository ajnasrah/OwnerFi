'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { Button } from './Button';
import { ExtendedSession } from '@/types/session';
import { trackEvent } from '@/components/analytics/AnalyticsProvider';

interface HeaderProps {
  className?: string;
}

export function Header({ className = '' }: HeaderProps) {
  const { data: session } = useSession();

  return (
    <header className={`bg-[#111625]/80 backdrop-blur-lg border-b border-slate-700/50 sticky top-0 z-50 ${className}`}>
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Brand logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <Image
              src="/logo.jpg"
              alt="Ownerfi"
              width={44}
              height={44}
              className="rounded-xl group-hover:scale-110 transition-all duration-300"
            />
            <div>
              <h1 className="text-2xl font-black text-white group-hover:text-[#00BC7D] transition-all duration-300">
                Ownerfi
              </h1>
            </div>
          </Link>

          {/* Dynamic navigation based on auth status */}
          <div className="flex items-center space-x-4">
            {session?.user ? (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  href={
                    (session as unknown as ExtendedSession)?.user?.role === 'admin' ? '/admin' :
                    (session as unknown as ExtendedSession)?.user?.role === 'realtor' ? '/realtor-dashboard' : '/dashboard'
                  }
                  className="font-bold bg-gradient-to-r from-[#00BC7D] to-[#009B66] hover:from-[#00d68f] hover:to-[#00BC7D] px-6 py-2 rounded-xl transition-all duration-300 hover:scale-105 shadow-xl shadow-[#00BC7D]/25"
                >
                  DASHBOARD
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    trackEvent('auth_logout', { method: 'header_button' });
                    signOut({ callbackUrl: '/auth/signout' });
                  }}
                  className="font-bold text-slate-300 hover:text-white px-4 py-2 rounded-xl hover:bg-slate-700/50 transition-all duration-300"
                >
                  SIGN OUT
                </Button>
              </>
            ) : (
              <>
                <Link
                  href="/for-realtors"
                  className="hidden sm:block text-slate-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  For Realtors
                </Link>
                <Button
                  variant="primary"
                  size="sm"
                  href="/auth"
                  className="font-bold bg-gradient-to-r from-[#00BC7D] to-[#009B66] hover:from-[#00d68f] hover:to-[#00BC7D] px-6 py-2 rounded-xl transition-all duration-300 hover:scale-105 shadow-xl shadow-[#00BC7D]/25"
                >
                  GET STARTED
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
