'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export default function LogoutSuccess() {
  const router = useRouter();

  useEffect(() => {
    // Auto redirect to home after 3 seconds
    const timer = setTimeout(() => {
      router.push('/');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="text-center max-w-md mx-auto">
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          Successfully Logged Out
        </h1>
        
        <p className="text-gray-600 mb-8 leading-relaxed">
          Thank you for using OwnerFi. You&apos;ve been safely signed out of your account.
        </p>
        
        <div className="space-y-4">
          <Button variant="primary" size="lg" href="/" className="w-full">
            Return to Home
          </Button>
          <Button variant="outline" size="lg" href="/auth" className="w-full">
            Sign In Again
          </Button>
        </div>
        
        <p className="text-sm text-gray-500 mt-6">
          Redirecting automatically in 3 seconds...
        </p>
      </div>
    </div>
  );
}