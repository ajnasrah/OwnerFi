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

      {/* Hero Section - Compact */}
      <div className="flex flex-col min-h-[calc(100vh-240px)] px-6">
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto text-center">
          <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
            
            <h1 className="text-3xl font-bold text-white leading-tight mb-4">
              Find homes with <span className="text-emerald-400">flexible financing</span>
            </h1>
            <p className="text-slate-300 text-base leading-relaxed mb-6">
              Connect directly with homeowners who offer financing
            </p>

            <div className="space-y-8 mb-8">
              <Link
                href="/signup"
                className="w-full block bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg hover:shadow-xl"
              >
                Find Your Dream Home
              </Link>

              <Link
                href="/realtor-signup"
                className="w-full block bg-transparent border-2 border-slate-500 hover:border-slate-400 hover:bg-slate-700/30 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02]"
              >
                I'm a Real Estate Agent
              </Link>
            </div>

            <div className="space-y-3 mb-6">
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

            <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-4">
              <div className="flex items-center justify-center gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-emerald-400">1,247</div>
                  <div className="text-xs text-slate-400">homes found</div>
                </div>
                <div className="w-px h-8 bg-slate-600"></div>
                <div className="flex items-center gap-1">
                  {[...Array(4)].map((_, i) => (
                    <svg key={i} className="w-3 h-3 text-emerald-400 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                    <defs>
                      <linearGradient id="partialStar" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="60%" stopColor="currentColor" />
                        <stop offset="60%" stopColor="rgb(71, 85, 105)" />
                      </linearGradient>
                    </defs>
                    <path fill="url(#partialStar)" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-sm text-slate-300 ml-1 font-medium">4.6</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Customer Success Stories */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-white mb-3">Real Families, Real Stories</h2>
            <p className="text-slate-400">From stuck renting to proud homeowners</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-emerald-400 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                "Stuck renting for 8 years after my credit got destroyed. Every bank said no. OwnerFi connected us with a seller who understood. Now we're homeowners!"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">MJ</span>
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">Maria & Jose</p>
                  <p className="text-slate-400 text-xs">Dallas, TX</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-emerald-400 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                "Self-employed contractors - lenders couldn't understand our income. We thought homeownership was impossible. OwnerFi closed in 3 weeks!"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">DK</span>
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">David & Karen</p>
                  <p className="text-slate-400 text-xs">Memphis, TN</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-emerald-400 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                "Medical bills tanked our credit, but OwnerFi found us a seller who cared more about our story than our score."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">LT</span>
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">Lisa & Tom</p>
                  <p className="text-slate-400 text-xs">Austin, TX</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Card-Based Design */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          
          <div className="grid lg:grid-cols-2 gap-16">
            
            {/* For Buyers Card */}
            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300">
              <div className="text-center mb-8">
                <div className="inline-block bg-emerald-500/20 px-4 py-2 rounded-full border border-emerald-400/30 mb-4">
                  <span className="text-emerald-400 font-semibold text-sm">FOR HOME BUYERS</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Find Your Dream Home</h2>
                <p className="text-slate-400 text-sm">Skip the banks, work directly with owners</p>
              </div>
              
              <div className="space-y-6 mb-8">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-emerald-400/20 rounded-lg flex items-center justify-center mt-1 flex-shrink-0">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Set Preferences</h3>
                    <p className="text-slate-400 text-sm">Budget and location. No credit checks.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-emerald-400/20 rounded-lg flex items-center justify-center mt-1 flex-shrink-0">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Browse Properties</h3>
                    <p className="text-slate-400 text-sm">Owner-financed homes, direct from sellers.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-emerald-400/20 rounded-lg flex items-center justify-center mt-1 flex-shrink-0">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Connect & Close</h3>
                    <p className="text-slate-400 text-sm">Flexible terms, faster closings.</p>
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <Link
                  href="/signup"
                  className="inline-block bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-300 hover:scale-[1.05] shadow-lg"
                >
                  Find My Dream Home
                </Link>
              </div>
            </div>

            {/* For Realtors Card */}
            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl hover:shadow-blue-500/10 transition-all duration-300">
              <div className="text-center mb-8">
                <div className="inline-block bg-blue-500/20 px-4 py-2 rounded-full border border-blue-400/30 mb-4">
                  <span className="text-blue-400 font-semibold text-sm">FOR REAL ESTATE AGENTS</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Get Qualified Leads</h2>
                <p className="text-slate-400 text-sm">Turn owner-financed deals into commissions</p>
              </div>
              
              <div className="space-y-6 mb-8">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-400/20 rounded-lg flex items-center justify-center mt-1 flex-shrink-0">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Define Service Area</h3>
                    <p className="text-slate-400 text-sm">Target cities and regions for leads.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-400/20 rounded-lg flex items-center justify-center mt-1 flex-shrink-0">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Receive Hot Leads</h3>
                    <p className="text-slate-400 text-sm">Pre-qualified buyers in your area.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-400/20 rounded-lg flex items-center justify-center mt-1 flex-shrink-0">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Earn Commissions</h3>
                    <p className="text-slate-400 text-sm">Close deals traditional lenders can't.</p>
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <Link
                  href="/realtor-signup"
                  className="inline-block bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-300 hover:scale-[1.05] shadow-lg"
                >
                  Start Getting Leads
                </Link>
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