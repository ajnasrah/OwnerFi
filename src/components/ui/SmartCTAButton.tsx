'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ExtendedSession } from '@/types/session';

interface SmartCTAButtonProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary';
}

export function SmartCTAButton({ children, className = '', variant = 'primary' }: SmartCTAButtonProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    // If user is authenticated, route to their dashboard
    if (status === 'authenticated' && session) {
      const extendedSession = session as unknown as ExtendedSession;
      const role = extendedSession?.user?.role;

      if (role === 'realtor') {
        router.push('/realtor-dashboard');
      } else if (role === 'buyer') {
        router.push('/dashboard');
      } else {
        // Fallback to auth if role is unknown
        router.push('/auth');
      }
    } else {
      // Not logged in - go to auth
      router.push('/auth');
    }
  };

  const defaultPrimaryClass = "inline-block bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white py-4 px-8 rounded-xl font-bold text-lg transition-all duration-300 hover:scale-[1.02] shadow-xl";
  const defaultSecondaryClass = "inline-block bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-4 px-8 rounded-xl font-bold text-lg transition-all duration-300 hover:scale-[1.02] shadow-xl";

  return (
    <button
      onClick={handleClick}
      className={className || (variant === 'primary' ? defaultPrimaryClass : defaultSecondaryClass)}
    >
      {children}
    </button>
  );
}
