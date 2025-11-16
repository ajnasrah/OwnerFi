
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Button } from './Button';
import { ExtendedSession } from '@/types/session';

interface HeaderProps {
  className?: string;
}

export function Header({ className = '' }: HeaderProps) {
  const { data: session } = useSession();

  return (
    <header className={`bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 sticky top-0 z-50 ${className}`}>
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Masculine logo design */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-xl flex items-center justify-center shadow-2xl group-hover:scale-110 transition-all duration-300">
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-black text-white group-hover:text-emerald-400 transition-all duration-300">
                OwnerFi
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
                  className="font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-6 py-2 rounded-xl transition-all duration-300 hover:scale-105 shadow-xl shadow-emerald-500/25"
                >
                  DASHBOARD
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: '/auth/signout' })}
                  className="font-bold text-slate-300 hover:text-white px-4 py-2 rounded-xl hover:bg-slate-700/50 transition-all duration-300"
                >
                  SIGN OUT
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  href="/auth/signin" 
                  className="hidden sm:inline-flex font-bold text-slate-300 hover:text-white px-4 py-2 rounded-xl hover:bg-slate-700/50 transition-all duration-300"
                >
                  SIGN IN
                </Button>
                <Button 
                  variant="primary" 
                  size="sm" 
                  href="/signup" 
                  className="font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-6 py-2 rounded-xl transition-all duration-300 hover:scale-105 shadow-xl shadow-emerald-500/25"
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