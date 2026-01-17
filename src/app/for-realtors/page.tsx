import { Metadata } from 'next'
import Link from 'next/link'
import Script from 'next/script'
import { LegalFooter } from '@/components/ui/LegalFooter'

export const metadata: Metadata = {
  title: 'For Realtors | Get Buyer Leads | OwnerFi Referral Network',
  description: 'Join OwnerFi\'s realtor referral network. Get pre-qualified buyer leads in your area. 1 free lead per month. Only pay 30% referral fee at closing.',
  keywords: 'buyer leads for realtors, real estate referrals, realtor lead generation, buyer referral program, real estate agent leads, pre-qualified buyer leads',
  openGraph: {
    title: 'For Realtors - Get Pre-Qualified Buyer Leads | OwnerFi',
    description: 'Join OwnerFi\'s referral network. 1 free lead per month. Only pay when you close.',
    url: 'https://ownerfi.ai/for-realtors',
    siteName: 'OwnerFi',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'For Realtors - Get Buyer Leads | OwnerFi',
    description: 'Pre-qualified buyer leads delivered to you. Free to join.',
  },
  alternates: {
    canonical: 'https://ownerfi.ai/for-realtors',
  }
}

// FAQ Schema
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I get paid as a realtor on OwnerFi?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "You earn your full commission at closing. OwnerFi's 30% referral fee is deducted from your commission only when the deal closes successfully. If the lead doesn't close, you owe nothing."
      }
    },
    {
      "@type": "Question",
      "name": "What if the lead doesn't close?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "You owe nothing. The 30% referral fee is only due at closing. If the buyer doesn't purchase a home, there's no fee to pay."
      }
    },
    {
      "@type": "Question",
      "name": "Can I refer leads to other agents?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes! OwnerFi has a double referral system. If you can't service a lead, you can refer them to another agent and earn a portion of the referral fee when they close."
      }
    },
    {
      "@type": "Question",
      "name": "What areas does OwnerFi cover?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "OwnerFi operates in all 50 states with buyer leads in major cities and suburbs. When you sign up, you set your service area within a 30-mile radius of your primary city."
      }
    },
    {
      "@type": "Question",
      "name": "How are buyer leads qualified?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "All leads are pre-screened buyers interested in owner-financed properties. They've provided their contact information, location preferences, and budget range through our platform."
      }
    },
    {
      "@type": "Question",
      "name": "What is the RF-701 Referral Agreement?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The RF-701 is a Tennessee Association of REALTORS standard referral agreement. It's a legally binding contract that outlines the 30% referral fee, 180-day term, and protects both parties. You sign it digitally when accepting a lead."
      }
    }
  ]
}

// Local Business Schema
const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "RealEstateAgent",
  "name": "OwnerFi Realtor Referral Network",
  "description": "Pre-qualified buyer leads for real estate agents. Join the OwnerFi referral network.",
  "url": "https://ownerfi.ai/for-realtors",
  "areaServed": {
    "@type": "Country",
    "name": "United States"
  },
  "knowsAbout": ["Buyer Leads", "Real Estate Referrals", "Owner Financing", "Seller Financing"]
}

export default function ForRealtorsPage() {
  return (
    <>
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <Script
        id="local-business-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />

      <div className="min-h-screen bg-slate-900 text-white">
        {/* Header */}
        <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 px-6 py-4 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">O</span>
              </div>
              <span className="text-lg font-bold text-white">OwnerFi</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/" className="hidden sm:block text-slate-300 hover:text-white text-sm">Home</Link>
              <Link href="/how-owner-finance-works" className="hidden sm:block text-slate-300 hover:text-white text-sm">How It Works</Link>
              <Link
                href="/auth?role=realtor"
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
              >
                Join Free
              </Link>
            </nav>
          </div>
        </header>

        <main>
          {/* Hero Section */}
          <section className="relative py-20 px-6 bg-gradient-to-b from-slate-800 to-slate-900 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent"></div>
            <div className="max-w-6xl mx-auto relative">
              <div className="text-center mb-12">
                <div className="inline-block px-4 py-2 bg-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium mb-6">
                  For Real Estate Agents
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                  Get Pre-Qualified Buyer Leads
                  <span className="block text-emerald-400">Delivered to You</span>
                </h1>
                <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
                  Join OwnerFi&apos;s referral network. Accept leads in your service area,
                  close deals, and only pay <span className="text-emerald-400 font-semibold">30% at closing</span>.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link
                    href="/auth?role=realtor"
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
                  >
                    Start Free - 1 Lead/Month
                  </Link>
                  <Link
                    href="#how-it-works"
                    className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all"
                  >
                    See How It Works
                  </Link>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-16">
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-emerald-400">Free</div>
                  <div className="text-slate-300 mt-2">To Join</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-blue-400">1 Lead</div>
                  <div className="text-slate-300 mt-2">Free/Month</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-purple-400">30%</div>
                  <div className="text-slate-300 mt-2">At Closing Only</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-yellow-400">50 States</div>
                  <div className="text-slate-300 mt-2">Coverage</div>
                </div>
              </div>
            </div>
          </section>

          {/* How It Works */}
          <section id="how-it-works" className="py-20 px-6 bg-slate-800/30">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
                How It Works
              </h2>
              <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
                Three simple steps to start receiving qualified buyer leads in your area
              </p>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="relative">
                  <div className="bg-slate-900/50 rounded-xl p-8 border border-slate-700/50 h-full">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                      <span className="text-emerald-400 font-bold text-xl">1</span>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-3">Sign Up Free</h3>
                    <p className="text-slate-300">
                      Create your account and set your service area. We&apos;ll show you leads within a 30-mile radius of your primary city.
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <div className="bg-slate-900/50 rounded-xl p-8 border border-slate-700/50 h-full">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-6">
                      <span className="text-blue-400 font-bold text-xl">2</span>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-3">Accept Leads</h3>
                    <p className="text-slate-300">
                      Browse pre-qualified buyers interested in owner-financed homes. Sign the RF-701 referral agreement to accept a lead.
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <div className="bg-slate-900/50 rounded-xl p-8 border border-slate-700/50 h-full">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mb-6">
                      <span className="text-purple-400 font-bold text-xl">3</span>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-3">Close & Earn</h3>
                    <p className="text-slate-300">
                      Work with your lead and close the deal. Pay the 30% referral fee only at closing. No close = no fee.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Dashboard Preview */}
          <section className="py-20 px-6">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
                Your Realtor Dashboard
              </h2>
              <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
                Everything you need to manage leads, agreements, and referrals in one place
              </p>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/20 rounded-xl p-6 border border-emerald-500/30">
                  <div className="text-emerald-400 text-3xl mb-4">👥</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Available Leads</h3>
                  <p className="text-slate-300 mb-4">
                    Browse buyer leads in your service area. See match percentages, location, and preferences before accepting.
                  </p>
                  <ul className="text-sm text-slate-400 space-y-2">
                    <li>• Filter by city and status</li>
                    <li>• View lead details and preferences</li>
                    <li>• Accept with one click</li>
                  </ul>
                </div>

                <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-xl p-6 border border-blue-500/30">
                  <div className="text-blue-400 text-3xl mb-4">📝</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Agreements</h3>
                  <p className="text-slate-300 mb-4">
                    Track all your RF-701 referral agreements. See pending signatures and active agreements at a glance.
                  </p>
                  <ul className="text-sm text-slate-400 space-y-2">
                    <li>• Digital signature process</li>
                    <li>• 180-day agreement tracking</li>
                    <li>• Contact info after signing</li>
                  </ul>
                </div>

                <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 rounded-xl p-6 border border-purple-500/30">
                  <div className="text-purple-400 text-3xl mb-4">🔄</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Double Referral</h3>
                  <p className="text-slate-300 mb-4">
                    Can&apos;t service a lead? Refer them to another agent and earn a portion of the fee when they close.
                  </p>
                  <ul className="text-sm text-slate-400 space-y-2">
                    <li>• Set your referral percentage</li>
                    <li>• Share via email, text, or link</li>
                    <li>• Track re-referred leads</li>
                  </ul>
                </div>

                <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 rounded-xl p-6 border border-yellow-500/30">
                  <div className="text-yellow-400 text-3xl mb-4">⚙️</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Service Area Settings</h3>
                  <p className="text-slate-300 mb-4">
                    Configure your coverage area. Select cities within a 30-mile radius of your primary location.
                  </p>
                  <ul className="text-sm text-slate-400 space-y-2">
                    <li>• Google Places autocomplete</li>
                    <li>• Multi-city selection</li>
                    <li>• Update anytime</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Free Tier Highlight */}
          <section className="py-20 px-6 bg-gradient-to-b from-slate-800/50 to-slate-900">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-block px-4 py-2 bg-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium mb-6">
                Free Plan
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Start with 1 Free Lead Every Month
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                No credit card required. No subscription needed. Get one qualified buyer lead per month absolutely free.
              </p>

              <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50 max-w-md mx-auto">
                <div className="text-5xl font-bold text-white mb-2">$0</div>
                <div className="text-slate-400 mb-6">per month</div>
                <ul className="text-left space-y-3 mb-8">
                  <li className="flex items-center gap-3 text-slate-300">
                    <span className="text-emerald-400">✓</span> 1 free lead per month
                  </li>
                  <li className="flex items-center gap-3 text-slate-300">
                    <span className="text-emerald-400">✓</span> 30-mile service area
                  </li>
                  <li className="flex items-center gap-3 text-slate-300">
                    <span className="text-emerald-400">✓</span> RF-701 digital signing
                  </li>
                  <li className="flex items-center gap-3 text-slate-300">
                    <span className="text-emerald-400">✓</span> Double referral access
                  </li>
                  <li className="flex items-center gap-3 text-slate-300">
                    <span className="text-emerald-400">✓</span> Pay only at closing
                  </li>
                </ul>
                <Link
                  href="/auth?role=realtor"
                  className="block w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-semibold transition-all"
                >
                  Get Started Free
                </Link>
              </div>
            </div>
          </section>

          {/* Sample Agreement Section */}
          <section className="py-20 px-6 bg-slate-800/30">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
                RF-701 Referral Agreement
              </h2>
              <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
                We use the Tennessee Association of REALTORS® standard referral agreement. Here&apos;s what you&apos;ll sign when accepting a lead.
              </p>

              <div className="grid md:grid-cols-2 gap-8 items-start">
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-4">Key Terms</h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <span className="text-emerald-400 text-xl">💰</span>
                      <div>
                        <div className="text-white font-medium">30% Referral Fee</div>
                        <div className="text-slate-400 text-sm">Percentage of your commission, paid at closing</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-blue-400 text-xl">📅</span>
                      <div>
                        <div className="text-white font-medium">180-Day Term</div>
                        <div className="text-slate-400 text-sm">Agreement valid for 6 months, extends through closing</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-purple-400 text-xl">🏠</span>
                      <div>
                        <div className="text-white font-medium">Buyer-Side Only</div>
                        <div className="text-slate-400 text-sm">Fee applies only to buyer representation</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-yellow-400 text-xl">✍️</span>
                      <div>
                        <div className="text-white font-medium">Digital Signature</div>
                        <div className="text-slate-400 text-sm">Sign online, buyer info released immediately</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 text-slate-900">
                  <div className="text-center mb-4">
                    <div className="text-2xl font-bold text-slate-800">eXp</div>
                    <div className="text-xs tracking-widest text-slate-600">R E A L T Y</div>
                  </div>
                  <div className="text-center font-bold text-lg mb-4">REFERRAL AGREEMENT</div>
                  <div className="text-xs text-slate-600 space-y-2">
                    <p><strong>1. REFERRING COMPANY:</strong> eXp Realty / OwnerFi</p>
                    <p><strong>2. RECEIVING COMPANY:</strong> [Your Brokerage]</p>
                    <p><strong>3. PROSPECT:</strong> [Buyer Name] - Buyer Referral</p>
                    <p><strong>4. REFERRAL FEE:</strong> 30% of commission at closing</p>
                    <p><strong>5. TERM:</strong> 180 days from signature date</p>
                  </div>
                  <div className="border-t border-slate-300 mt-4 pt-4 text-center">
                    <Link
                      href="/for-realtors/sample-agreement"
                      className="text-emerald-600 hover:text-emerald-700 font-medium text-sm"
                    >
                      View Full Sample Agreement →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="py-20 px-6">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
                Frequently Asked Questions
              </h2>
              <div className="space-y-6">
                {faqSchema.mainEntity.map((faq, i) => (
                  <div key={i} className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                    <h3 className="text-lg font-semibold text-white mb-3">{faq.name}</h3>
                    <p className="text-slate-300">{faq.acceptedAnswer.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-20 px-6 bg-gradient-to-b from-slate-900 to-slate-800">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Ready to Grow Your Business?
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Join OwnerFi&apos;s referral network today. Start receiving pre-qualified buyer leads in your area.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/auth?role=realtor"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
                >
                  Start Free - 1 Lead/Month
                </Link>
                <Link
                  href="/for-realtors/sample-agreement"
                  className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all"
                >
                  View Sample Agreement
                </Link>
              </div>
            </div>
          </section>

          {/* City Links for SEO */}
          <section className="py-12 px-6 bg-slate-800/30">
            <div className="max-w-6xl mx-auto">
              <h3 className="text-lg font-semibold text-white mb-6 text-center">
                Buyer Leads by Location
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-sm">
                <Link href="/buyer-leads/houston" className="text-slate-400 hover:text-emerald-400 transition-colors">Houston</Link>
                <Link href="/buyer-leads/dallas" className="text-slate-400 hover:text-emerald-400 transition-colors">Dallas</Link>
                <Link href="/buyer-leads/austin" className="text-slate-400 hover:text-emerald-400 transition-colors">Austin</Link>
                <Link href="/buyer-leads/san-antonio" className="text-slate-400 hover:text-emerald-400 transition-colors">San Antonio</Link>
                <Link href="/buyer-leads/miami" className="text-slate-400 hover:text-emerald-400 transition-colors">Miami</Link>
                <Link href="/buyer-leads/orlando" className="text-slate-400 hover:text-emerald-400 transition-colors">Orlando</Link>
                <Link href="/buyer-leads/tampa" className="text-slate-400 hover:text-emerald-400 transition-colors">Tampa</Link>
                <Link href="/buyer-leads/jacksonville" className="text-slate-400 hover:text-emerald-400 transition-colors">Jacksonville</Link>
                <Link href="/buyer-leads/atlanta" className="text-slate-400 hover:text-emerald-400 transition-colors">Atlanta</Link>
                <Link href="/buyer-leads/phoenix" className="text-slate-400 hover:text-emerald-400 transition-colors">Phoenix</Link>
                <Link href="/buyer-leads/las-vegas" className="text-slate-400 hover:text-emerald-400 transition-colors">Las Vegas</Link>
                <Link href="/buyer-leads/denver" className="text-slate-400 hover:text-emerald-400 transition-colors">Denver</Link>
                <Link href="/buyer-leads/texas" className="text-slate-400 hover:text-emerald-400 transition-colors">Texas</Link>
                <Link href="/buyer-leads/florida" className="text-slate-400 hover:text-emerald-400 transition-colors">Florida</Link>
                <Link href="/buyer-leads/georgia" className="text-slate-400 hover:text-emerald-400 transition-colors">Georgia</Link>
                <Link href="/buyer-leads/california" className="text-slate-400 hover:text-emerald-400 transition-colors">California</Link>
              </div>
            </div>
          </section>
        </main>

        <LegalFooter />
      </div>
    </>
  )
}
