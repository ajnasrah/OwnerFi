'use client';

import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <nav className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 px-4 py-4">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">O</span>
            </div>
            <span className="text-lg font-bold text-white">OwnerFi</span>
          </Link>
          <Link
            href="/"
            className="text-slate-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-white mb-6">About OwnerFi</h1>
          <p className="text-xl text-slate-300 leading-relaxed max-w-3xl mx-auto">
            We&apos;re bridging the gap between families who deserve homeownership and property owners willing to offer creative financing solutions.
          </p>
        </div>

        {/* Mission Section */}
        <div className="mb-16">
          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-400/20 rounded-3xl p-8">
            <h2 className="text-3xl font-bold text-white mb-6">Our Mission</h2>
            <p className="text-slate-300 text-lg leading-relaxed mb-6">
              Traditional lending has failed millions of good families. Self-employed entrepreneurs, people with medical debt, 
              families who faced financial hardship during life&apos;s unexpected challenges - they all deserve a path to homeownership.
            </p>
            <p className="text-slate-300 text-lg leading-relaxed">
              We believe homeownership shouldn&apos;t be limited to those with perfect credit scores.
              OwnerFi connects these deserving families with property owners who are willing to offer direct financing, 
              creating win-win opportunities for everyone involved.
            </p>
          </div>
        </div>

        {/* What We Do */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">What We&apos;re Building</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-emerald-400 mb-4">For Families Seeking Homes</h3>
              <ul className="space-y-3 text-slate-300">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Connect with property owners offering direct financing</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span>No credit checks or bank applications required</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Negotiate flexible terms that work for your situation</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Faster closings without traditional lending delays</span>
                </li>
              </ul>
            </div>

            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-blue-400 mb-4">For Real Estate Professionals</h3>
              <ul className="space-y-3 text-slate-300">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Access to pre-qualified buyers seeking owner financing</span>
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
              <div className="w-12 h-12 bg-emerald-500/20 border-2 border-emerald-400 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-400 text-xl">🏠</span>
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
                <h3 className="text-xl font-semibold text-white mb-3">Direct Connections</h3>
                <p className="text-slate-300 leading-relaxed">
                  By connecting buyers directly with property owners, we eliminate the bureaucracy and 
                  inflexibility of traditional lending. This creates opportunities for creative financing 
                  solutions that work for both parties.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-6">
              <div className="w-12 h-12 bg-purple-500/20 border-2 border-purple-400 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-purple-400 text-xl">⚡</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-3">Technology-Powered Matching</h3>
                <p className="text-slate-300 leading-relaxed">
                  Our platform uses advanced algorithms to match buyers with properties based on their specific 
                  needs and circumstances, not just their credit score. We find the right opportunities for the right people.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Impact */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Our Impact</h2>
          
          <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-slate-600/30 rounded-2xl p-8">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-emerald-400 mb-2">1,200+</div>
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
            OwnerFi provides the tools and connections you need.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/auth"
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg"
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
            <Link href="/" className="text-slate-400 hover:text-emerald-400 transition-colors">
              Home
            </Link>
            <Link href="/terms" className="text-slate-400 hover:text-emerald-400 transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="text-slate-400 hover:text-emerald-400 transition-colors">
              Privacy
            </Link>
            <a href="mailto:support@ownerfi.com" className="text-slate-400 hover:text-emerald-400 transition-colors">
              Contact
            </a>
          </div>
          <p className="text-xs text-slate-500">
            &copy; 2025 OwnerFi. Empowering homeownership through innovative financing solutions.
          </p>
        </div>
      </footer>
    </div>
  );
}