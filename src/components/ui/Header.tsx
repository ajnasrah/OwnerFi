
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
    <header className={`bg-surface-bg shadow-soft border-b border-neutral-border sticky top-0 z-50 ${className}`}>
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Modern logo design */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-200">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                </svg>
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-400 rounded-full animate-pulse"></div>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent group-hover:from-blue-600 group-hover:to-blue-500 transition-all duration-200">
                OwnerFi
              </h1>
            </div>
          </Link>
          
          {/* Dynamic navigation based on auth status */}
          <div className="flex items-center space-x-2">
            {session?.user ? (
              <>
                <Button 
                  variant="primary" 
                  size="sm" 
                  href={
                    (session as ExtendedSession)?.user?.role === 'admin' ? '/admin' :
                    (session as ExtendedSession)?.user?.role === 'realtor' ? '/realtor/dashboard' : '/dashboard'
                  } 
                  className="font-semibold"
                >
                  Dashboard
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="font-semibold"
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" href="/auth/signin" className="hidden sm:inline-flex">
                  Sign In
                </Button>
                <Button variant="primary" size="sm" href="/unified-signup" className="font-semibold">
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}