'use client';

import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#111625] text-white">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-[#111625]/90 backdrop-blur-xl border-b border-white/[0.06] px-4 sm:px-6">
        <div className="flex justify-between items-center max-w-6xl mx-auto h-14 sm:h-16">
          <Link href="/" className="flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="lg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#00BC7D"/><stop offset="100%" stopColor="#3B82F6"/></linearGradient></defs><circle cx="50" cy="50" r="45" stroke="url(#lg)" strokeWidth="7" fill="none"/><ellipse cx="50" cy="50" rx="42" ry="22" stroke="url(#lg)" strokeWidth="5.5" fill="none" transform="rotate(-25 50 50)"/><ellipse cx="50" cy="50" rx="22" ry="42" stroke="url(#lg)" strokeWidth="5.5" fill="none" transform="rotate(-25 50 50)"/></svg>
            <span className="text-lg font-bold text-white">Ownerfi</span>
          </Link>
          <Link
            href="/"
            className="hidden sm:inline-flex text-sm text-slate-400 hover:text-white px-3 py-2 rounded-lg transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-white mb-6">About Ownerfi</h1>
          <p className="text-xl text-slate-300 leading-relaxed max-w-3xl mx-auto">
            We&apos;re bridging the gap between families who deserve homeownership and property owners willing to offer creative financing solutions.
          </p>
        </div>

        {/* Mission Section */}
        <div className="mb-16">
          <div className="bg-gradient-to-br from-[#00BC7D]/10 to-[#00BC7D]/5 border border-[#00BC7D]/20 rounded-3xl p-8">
            <h2 className="text-3xl font-bold text-white mb-6">Our Mission</h2>
            <p className="text-slate-300 text-lg leading-relaxed mb-6">
              Traditional lending has failed millions of good families. Self-employed entrepreneurs, people with medical debt, 
              families who faced financial hardship during life&apos;s unexpected challenges - they all deserve a path to homeownership.
            </p>
            <p className="text-slate-300 text-lg leading-relaxed">
              We believe homeownership shouldn&apos;t be limited to those with perfect credit scores.
              Ownerfi connects these deserving families with property owners who are willing to offer direct financing, 
              creating win-win opportunities for everyone involved.
            </p>
          </div>
        </div>

        {/* What We Do */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">What We&apos;re Building</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-[#00BC7D] mb-4">For Families Seeking Homes</h3>
              <ul className="space-y-3 text-slate-300">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-[#00BC7D] rounded-full mt-2 flex-shrink-0"></div>
                  <span>Connect with property owners offering direct financing</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-[#00BC7D] rounded-full mt-2 flex-shrink-0"></div>
                  <span>No credit checks or bank applications required</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-[#00BC7D] rounded-full mt-2 flex-shrink-0"></div>
                  <span>Negotiate flexible terms that work for your situation</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-[#00BC7D] rounded-full mt-2 flex-shrink-0"></div>
                  <span>Faster closings without traditional lending delays</span>
                </li>
              </ul>
            </div>

            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-blue-400 mb-4">For Real Estate Professionals</h3>
              <ul className="space-y-3 text-slate-300">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Access to pre-screened buyers seeking owner financing</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Close deals that traditional financing couldn&apos;t handle</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Earn commissions on creative financing solutions</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Help families achieve homeownership while growing your business</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* The Problem We're Solving */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">The Problem We&apos;re Solving</h2>
          
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-red-400 mb-2">37%</div>
                <p className="text-slate-300 text-sm">of Americans have subprime credit scores</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-red-400 mb-2">25%</div>
                <p className="text-slate-300 text-sm">of mortgage applications are denied</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-red-400 mb-2">$2T</div>
                <p className="text-slate-300 text-sm">in wealth trapped in rental payments</p>
              </div>
            </div>
            
            <div className="mt-8 text-center">
              <p className="text-slate-300 text-lg leading-relaxed">
                Millions of hardworking families are stuck in the rental cycle, paying someone else&apos;s mortgage 
                while building no equity for themselves. Traditional banking serves only those with perfect credit histories, 
                leaving behind good people who&apos;ve faced life&apos;s challenges.
              </p>
            </div>
          </div>
        </div>

        {/* Our Approach */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Our Approach</h2>
          
          <div className="space-y-8">
            <div className="flex items-start gap-6">
              <div className="w-12 h-12 bg-[#00BC7D]/20 border-2 border-[#00BC7D] rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-[#00BC7D] text-xl">🏠</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-3">Human-Centered Lending</h3>
                <p className="text-slate-300 leading-relaxed">
                  We believe in evaluating people based on their current situation and future potential, 
                  not just their past financial history. Every family has a story, and every story deserves consideration.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-6">
              <div className="w-12 h-12 bg-blue-500/20 border-2 border-blue-400 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-400 text-xl">🤝</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-3">No Bank Required</h3>
                <p className="text-slate-300 leading-relaxed">
                  Owner financing eliminates the bureaucracy and inflexibility of traditional lending.
                  We show buyers properties where creative financing may be possible, and refer them to
                  licensed buying agents in their area to represent them through the process.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-6">
              <div className="w-12 h-12 bg-purple-500/20 border-2 border-purple-400 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-purple-400 text-xl">⚡</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-3">Technology-Powered Discovery</h3>
                <p className="text-slate-300 leading-relaxed">
                  Our platform uses data and technology to show buyers owner-finance properties based on their budget
                  and preferences. When they find one they like, we refer them to a licensed buying agent in their area to write an offer.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Impact */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Our Impact</h2>
          
          <div className="bg-gradient-to-r from-[#00BC7D]/10 to-blue-500/10 border border-slate-600/30 rounded-2xl p-8">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-[#00BC7D] mb-2">1,200+</div>
                <p className="text-slate-300 text-sm">Families helped into homeownership</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-blue-400 mb-2">$180M</div>
                <p className="text-slate-300 text-sm">in owner-financed property deals</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-400 mb-2">95%</div>
                <p className="text-slate-300 text-sm">customer satisfaction rate</p>
              </div>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Ready to Be Part of the Solution?</h2>
          <p className="text-slate-300 text-lg mb-8 max-w-2xl mx-auto">
            Whether you&apos;re a family seeking homeownership or a real estate professional looking to help more clients,
            Ownerfi provides the tools and connections you need.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/auth"
              className="bg-gradient-to-r from-[#00BC7D]/50 to-[#00BC7D] hover:from-[#00BC7D] hover:to-[#00BC7D]/50 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg"
            >
              Find Your Dream Home
            </Link>
            
            <Link
              href="/auth"
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg"
            >
              Start Getting Leads
            </Link>
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="bg-slate-800/30 border-t border-slate-700/50 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="flex justify-center gap-8 text-sm mb-4">
            <Link href="/" className="text-slate-400 hover:text-[#00BC7D] transition-colors">
              Home
            </Link>
            <Link href="/terms" className="text-slate-400 hover:text-[#00BC7D] transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="text-slate-400 hover:text-[#00BC7D] transition-colors">
              Privacy
            </Link>
            <a href="mailto:support@ownerfi.com" className="text-slate-400 hover:text-[#00BC7D] transition-colors">
              Contact
            </a>
          </div>
          <p className="text-xs text-slate-500">
            &copy; 2025 Ownerfi. Empowering homeownership through innovative financing solutions.
          </p>
        </div>
      </footer>
    </div>
  );
}