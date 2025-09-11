'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Get dashboard URL for logged-in users
  const getDashboardUrl = () => {
    if (status !== 'authenticated' || !session?.user) return null;
    
    if ((session.user as any).role === 'buyer') return '/dashboard';
    if ((session.user as any).role === 'realtor') return '/realtor-dashboard';
    if ((session.user as any).role === 'admin') return '/admin';
    return '/dashboard';
  };

  // Show loading state while checking auth
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Clean Header */}
      <nav className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 px-4 py-4">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">O</span>
            </div>
            <span className="text-lg font-bold text-white">OwnerFi</span>
          </div>
          {status === 'authenticated' ? (
            <Link
              href={getDashboardUrl() || '/dashboard'}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Go to Dashboard
            </Link>
          ) : (
            <Link
              href="/auth/signin"
              className="text-slate-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </nav>

      {/* Main Content - Compact spacing */}
      <div className="flex flex-col min-h-[calc(100vh-120px)] px-6">
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto text-center">
          <div className="space-y-6">
          
          {/* Hero Section */}
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-white leading-tight">
              Find homes with <span className="text-emerald-400">flexible financing</span>
            </h1>
            <p className="text-slate-300 text-base leading-relaxed">
              Connect directly with homeowners who offer financing
            </p>
          </div>

          {/* Primary Action */}
          <Link
            href="/signup"
            className="w-full block bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg"
          >
            Start your search
          </Link>

          {/* Secondary Action */}
          <Link
            href="/realtor-signup"
            className="w-full block bg-slate-800/50 border-2 border-slate-600 hover:border-slate-400 hover:bg-slate-700/50 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] backdrop-blur-sm"
          >
            I'm a real estate agent
          </Link>

          {/* Simple Benefits */}
          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-center gap-3 text-slate-300 text-sm">
              <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
              </div>
              <span>No credit checks</span>
            </div>
            
            <div className="flex items-center justify-center gap-3 text-slate-300 text-sm">
              <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
              </div>
              <span>Direct communication</span>
            </div>
            
            <div className="flex items-center justify-center gap-3 text-slate-300 text-sm">
              <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
              </div>
              <span>Professional support</span>
            </div>
          </div>

          {/* Compact Social Proof */}
          <div className="pt-6">
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
              <div className="flex items-center justify-center gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-emerald-400">1,247</div>
                  <div className="text-xs text-slate-400">homes found</div>
                </div>
                <div className="w-px h-8 bg-slate-600"></div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-3 h-3 text-emerald-400 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <span className="text-sm text-slate-300 ml-1 font-medium">5.0</span>
                </div>
              </div>
            </div>
          </div>

          </div>
        </div>
      </div>

      {/* Comprehensive Footer */}
      <footer className="bg-slate-900 border-t border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Footer Content */}
          <div className="py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Company Info */}
            <div className="col-span-1 md:col-span-2">
              <div className="mb-4">
                <span className="text-xl font-black text-white">OwnerFi</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed mb-6 max-w-md">
                Connecting homebuyers with owner-financed properties. Find your dream home with flexible financing options and professional support.
              </p>
              <div className="flex space-x-4">
                <a href="mailto:support@ownerfi.com" className="text-slate-400 hover:text-emerald-400 transition-colors">
                  <span className="sr-only">Email</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </a>
                <a href="tel:+1-555-OWNERFI" className="text-slate-400 hover:text-emerald-400 transition-colors">
                  <span className="sr-only">Phone</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Quick Links</h3>
              <ul className="space-y-3 text-sm">
                <li><a href="/signup" className="text-slate-400 hover:text-white transition-colors">Get Started</a></li>
                <li><a href="/realtor-signup" className="text-slate-400 hover:text-white transition-colors">For Realtors</a></li>
                <li><a href="/auth/signin" className="text-slate-400 hover:text-white transition-colors">Sign In</a></li>
                <li><a href="/dashboard" className="text-slate-400 hover:text-white transition-colors">Dashboard</a></li>
                <li><a href="/buy-credits" className="text-slate-400 hover:text-white transition-colors">Buy Credits</a></li>
              </ul>
            </div>

            {/* Support & Legal */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Support & Legal</h3>
              <ul className="space-y-3 text-sm">
                <li><a href="mailto:support@ownerfi.com" className="text-slate-400 hover:text-white transition-colors">Contact Us</a></li>
                <li><a href="/admin" className="text-slate-400 hover:text-white transition-colors">Admin Portal</a></li>
                <li><a href="/terms" className="text-slate-400 hover:text-white transition-colors">Terms & Conditions</a></li>
                <li><a href="/privacy" className="text-slate-400 hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="/auth/forgot-password" className="text-slate-400 hover:text-white transition-colors">Reset Password</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-slate-700/50 py-6 flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-slate-400 mb-4 md:mb-0">
              &copy; 2025 OwnerFi. All rights reserved. 
              <span className="hidden md:inline ml-2">|</span>
              <span className="block md:inline md:ml-2">Licensed Real Estate Platform</span>
            </div>
            <div className="flex items-center space-x-6 text-sm">
              <a href="/sitemap" className="text-slate-400 hover:text-white transition-colors">Sitemap</a>
              <a href="/accessibility" className="text-slate-400 hover:text-white transition-colors">Accessibility</a>
              <div className="flex items-center text-slate-400">
                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Secure Platform
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}