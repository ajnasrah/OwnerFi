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

      {/* Main Content - Half the fucking space */}
      <div className="flex flex-col min-h-[calc(100vh-240px)] px-6">
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
      </div>

      {/* How It Works - Clean Design */}
      <section className="bg-slate-800/20 py-20">
        <div className="max-w-6xl mx-auto px-8">
          
          {/* For Buyers */}
          <div className="mb-20">
            <div className="text-center mb-16">
              <h2 className="text-2xl font-bold text-emerald-400 mb-3">For Home Buyers</h2>
              <p className="text-slate-300 text-base max-w-2xl mx-auto">Find your dream home with flexible owner financing</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-500/20 border-2 border-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-emerald-400 text-lg font-bold">1</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">Set Preferences</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Tell us your budget and location preferences. No credit check required.
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-500/20 border-2 border-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-emerald-400 text-lg font-bold">2</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">Browse Properties</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  View owner-financed homes that match your criteria. Direct from sellers.
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-500/20 border-2 border-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-emerald-400 text-lg font-bold">3</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">Connect & Close</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Work directly with owners for flexible terms and faster closings.
                </p>
              </div>
            </div>
          </div>

          {/* For Realtors */}
          <div>
            <div className="text-center mb-16">
              <h2 className="text-2xl font-bold text-blue-400 mb-3">For Real Estate Agents</h2>
              <p className="text-slate-300 text-base max-w-2xl mx-auto">Get qualified buyer leads for owner-financed properties</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-500/20 border-2 border-blue-400 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-blue-400 text-lg font-bold">1</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">Set Service Area</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Define your target cities and regions for receiving buyer leads.
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-500/20 border-2 border-blue-400 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-blue-400 text-lg font-bold">2</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">Get Qualified Leads</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Receive pre-qualified buyers looking for owner financing in your area.
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-500/20 border-2 border-blue-400 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-blue-400 text-lg font-bold">3</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">Earn Commissions</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Close deals that traditional financing couldn't handle.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="bg-slate-800/30 border-t border-slate-700/50 py-6">
        <div className="max-w-md mx-auto px-6">
          <div className="flex justify-center gap-6 text-sm">
            <a href="mailto:support@prosway.com" className="text-slate-400 hover:text-emerald-400 transition-colors">
              Contact
            </a>
            <a href="/terms" className="text-slate-400 hover:text-emerald-400 transition-colors">
              Terms
            </a>
            <a href="/privacy" className="text-slate-400 hover:text-emerald-400 transition-colors">
              Privacy
            </a>
          </div>
          <div className="text-center mt-4 text-xs text-slate-500">
            &copy; 2025 OwnerFi. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}