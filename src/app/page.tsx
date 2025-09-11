'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect signed-in users to their dashboard
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      if (session.user.role === 'buyer') {
        router.push('/dashboard');
      } else if (session.user.role === 'realtor') {
        router.push('/realtor-dashboard');
      } else {
        router.push('/dashboard');
      }
    }
  }, [status, session, router]);

  // Show loading state while checking auth
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  const isSignedIn = status === 'authenticated' && session?.user;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <nav className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex items-center">
                <div className="h-10 w-10 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center shadow-lg">
                  <span className="text-white font-black text-lg">O</span>
                </div>
                <span className="ml-3 text-xl font-black text-white">OwnerFi</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {!isSignedIn && (
                <a
                  href="/auth/signin"
                  className="text-slate-300 hover:text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors hover:bg-slate-700/50"
                >
                  Sign In
                </a>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* COMPACT HERO SECTION - Optimized spacing */}
      <div className="relative py-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"></div>
        
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <div className="space-y-6">
            {/* Compact Heading */}
            <div className="space-y-6">
              <div className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-400/30 rounded-full text-emerald-400 text-sm font-medium">
                Trusted by 1,247+ families
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                <span className="text-white">Find homes with</span><br/>
                <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">flexible financing</span>
              </h1>
              
              <p className="text-lg md:text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto">
                Connect directly with homeowners who offer financing. Perfect for entrepreneurs and self-employed professionals.
              </p>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href="/signup"
                className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 rounded-lg text-lg font-semibold shadow-xl shadow-emerald-500/25 transition-all duration-300 hover:scale-105"
              >
                Start your search →
              </a>
              
              <a
                href="/realtor-signup"
                className="px-8 py-3 border border-slate-500 hover:border-slate-400 rounded-lg text-lg font-medium text-slate-300 hover:text-white transition-all duration-300"
              >
                I'm a real estate agent
              </a>
            </div>

            {/* Trust Indicators - Compact */}
            <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-slate-400">
              <span>✓ No credit checks</span>
              <span>✓ Direct communication</span>
              <span>✓ Agent support</span>
            </div>

            {/* Social Proof - Inline */}
            <div className="pt-8">
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 max-w-lg mx-auto">
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-400">1,247</div>
                    <div className="text-xs text-slate-400">homes found</div>
                  </div>
                  <div className="w-px h-8 bg-slate-600"></div>
                  <div className="flex space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-4 h-4 text-emerald-400 fill-current" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-slate-300 font-medium">5.0</div>
                    <div className="text-xs text-slate-400">rating</div>
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