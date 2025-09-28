import { Metadata } from 'next'
import Link from 'next/link'
import Script from 'next/script'
import { LegalFooter } from '@/components/ui/LegalFooter'

export const metadata: Metadata = {
  title: 'Owner Financing Florida | Seller Financed Homes FL | No Banks Required',
  description: 'Find owner financed homes in Florida. Browse seller financing properties in Miami, Orlando, Tampa, Jacksonville. No bank financing needed. Bad credit options. Low down payments.',
  keywords: 'owner financing florida, owner financed homes florida, seller financing florida, owner finance miami, owner finance orlando, owner finance tampa, florida owner financing, no bank financing florida, rent to own florida',

  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://ownerfi.ai/owner-financing-florida',
    siteName: 'OwnerFi',
    title: 'Owner Financing Florida - Seller Financed Homes',
    description: 'Browse owner financed properties across Florida. No bank needed, flexible terms available.',
    images: [{
      url: 'https://ownerfi.ai/og-florida.png',
      width: 1200,
      height: 630,
      alt: 'Owner Financing Florida Properties',
    }],
  },

  alternates: {
    canonical: 'https://ownerfi.ai/owner-financing-florida',
  },
}

function generateLocalBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "name": "OwnerFi Florida",
    "description": "Owner financed properties marketplace in Florida",
    "url": "https://ownerfi.ai/owner-financing-florida",
    "areaServed": {
      "@type": "State",
      "name": "Florida",
      "containsPlace": [
        {"@type": "City", "name": "Miami"},
        {"@type": "City", "name": "Orlando"},
        {"@type": "City", "name": "Tampa"},
        {"@type": "City", "name": "Jacksonville"},
        {"@type": "City", "name": "Fort Lauderdale"},
        {"@type": "City", "name": "West Palm Beach"},
        {"@type": "City", "name": "Tallahassee"},
        {"@type": "City", "name": "St. Petersburg"}
      ]
    }
  }
}

function generateFAQSchema() {
  const faqs = [
    {
      question: "Is owner financing legal in Florida?",
      answer: "Yes, owner financing is completely legal in Florida. The state allows sellers to finance their property sales with proper documentation and compliance with Florida real estate laws."
    },
    {
      question: "What are the benefits of owner financing in Florida?",
      answer: "Benefits include no bank approval needed, faster closing (7-14 days), flexible down payments, negotiable terms, no state income tax, and growing property values in Florida's hot real estate market."
    },
    {
      question: "What is the typical down payment for owner financing in Florida?",
      answer: "Down payments in Florida typically range from 5% to 20% of the purchase price. Beachfront and luxury properties may require higher down payments, while inland properties may have lower requirements."
    },
    {
      question: "Can I get owner financing for a vacation home in Florida?",
      answer: "Yes, many Florida sellers offer owner financing for vacation homes and investment properties, especially in tourist areas like Orlando, Miami Beach, and the Gulf Coast."
    },
    {
      question: "How does owner financing work with Florida homestead exemption?",
      answer: "With owner financing, you get the deed and can apply for Florida's homestead exemption if it's your primary residence, potentially saving thousands in property taxes."
    }
  ]

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  }
}

export default function OwnerFinancingFlorida() {
  return (
    <>
      <Script
        id="local-business-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateLocalBusinessSchema()) }}
      />
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateFAQSchema()) }}
      />

      <div className="min-h-screen bg-slate-900 text-white">
        {/* Header */}
        <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">O</span>
              </div>
              <span className="text-lg font-bold text-white">OwnerFi</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/" className="text-slate-300 hover:text-white text-sm">Home</Link>
              <Link href="/how-owner-finance-works" className="text-slate-300 hover:text-white text-sm">How It Works</Link>
              <Link href="/signup" className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Browse Properties
              </Link>
            </nav>
          </div>
        </header>

        <main>
          {/* Hero Section */}
          <section className="relative py-20 px-6 bg-gradient-to-b from-blue-900/20 to-slate-900">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12">
                <h1 className="text-5xl font-bold text-white mb-6">
                  Owner Financing in <span className="text-blue-400">Florida</span>
                  <span className="block text-3xl mt-4 text-slate-300">The Sunshine State's Best Kept Secret</span>
                </h1>
                <p className="text-xl text-slate-300 max-w-3xl mx-auto">
                  Find owner financed homes across Florida - from Miami's beaches to Orlando's attractions,
                  Tampa's growth corridor to Jacksonville's expanding market. No bank financing needed,
                  flexible terms, and fast closings.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <Link href="/signup" className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all">
                  Browse Florida Properties
                </Link>
                <Link href="/rent-to-own-homes" className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all">
                  View All States
                </Link>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-blue-400">400+</div>
                  <div className="text-slate-300 mt-2">Florida Properties</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-emerald-400">0%</div>
                  <div className="text-slate-300 mt-2">State Income Tax</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-purple-400">25+ Cities</div>
                  <div className="text-slate-300 mt-2">Coverage Area</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-yellow-400">Year-Round</div>
                  <div className="text-slate-300 mt-2">Perfect Weather</div>
                </div>
              </div>
            </div>
          </section>

          {/* Cities Section */}
          <section className="py-16 px-6 bg-slate-800/30">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Owner Financed Homes by Florida City
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                <Link href="/owner-financing-miami" className="group">
                  <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-blue-400/50 transition-all">
                    <h3 className="text-xl font-bold text-blue-400 mb-2 group-hover:text-blue-300">Miami</h3>
                    <p className="text-slate-300 text-sm mb-3">Miami-Dade County</p>
                    <ul className="text-slate-400 text-sm space-y-1">
                      <li>• Miami Beach</li>
                      <li>• Coral Gables</li>
                      <li>• Aventura</li>
                      <li>• Kendall</li>
                    </ul>
                    <p className="text-blue-400 text-sm mt-3">80+ Properties →</p>
                  </div>
                </Link>

                <Link href="/owner-financing-orlando" className="group">
                  <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-emerald-400/50 transition-all">
                    <h3 className="text-xl font-bold text-emerald-400 mb-2 group-hover:text-emerald-300">Orlando</h3>
                    <p className="text-slate-300 text-sm mb-3">Central Florida</p>
                    <ul className="text-slate-400 text-sm space-y-1">
                      <li>• Winter Park</li>
                      <li>• Kissimmee</li>
                      <li>• Lake Mary</li>
                      <li>• Sanford</li>
                    </ul>
                    <p className="text-emerald-400 text-sm mt-3">70+ Properties →</p>
                  </div>
                </Link>

                <Link href="/owner-financing-tampa" className="group">
                  <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-purple-400/50 transition-all">
                    <h3 className="text-xl font-bold text-purple-400 mb-2 group-hover:text-purple-300">Tampa Bay</h3>
                    <p className="text-slate-300 text-sm mb-3">West Coast</p>
                    <ul className="text-slate-400 text-sm space-y-1">
                      <li>• St. Petersburg</li>
                      <li>• Clearwater</li>
                      <li>• Brandon</li>
                      <li>• Sarasota</li>
                    </ul>
                    <p className="text-purple-400 text-sm mt-3">65+ Properties →</p>
                  </div>
                </Link>

                <Link href="/owner-financing-jacksonville" className="group">
                  <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-yellow-400/50 transition-all">
                    <h3 className="text-xl font-bold text-yellow-400 mb-2 group-hover:text-yellow-300">Jacksonville</h3>
                    <p className="text-slate-300 text-sm mb-3">North Florida</p>
                    <ul className="text-slate-400 text-sm space-y-1">
                      <li>• St. Augustine</li>
                      <li>• Orange Park</li>
                      <li>• Ponte Vedra</li>
                      <li>• Fleming Island</li>
                    </ul>
                    <p className="text-yellow-400 text-sm mt-3">55+ Properties →</p>
                  </div>
                </Link>

                <Link href="/owner-financing-fort-lauderdale" className="group">
                  <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-orange-400/50 transition-all">
                    <h3 className="text-xl font-bold text-orange-400 mb-2 group-hover:text-orange-300">Fort Lauderdale</h3>
                    <p className="text-slate-300 text-sm mb-3">Broward County</p>
                    <ul className="text-slate-400 text-sm space-y-1">
                      <li>• Hollywood</li>
                      <li>• Pompano Beach</li>
                      <li>• Davie</li>
                      <li>• Pembroke Pines</li>
                    </ul>
                    <p className="text-orange-400 text-sm mt-3">50+ Properties →</p>
                  </div>
                </Link>

                <Link href="/owner-financing-west-palm-beach" className="group">
                  <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-cyan-400/50 transition-all">
                    <h3 className="text-xl font-bold text-cyan-400 mb-2 group-hover:text-cyan-300">West Palm Beach</h3>
                    <p className="text-slate-300 text-sm mb-3">Palm Beach County</p>
                    <ul className="text-slate-400 text-sm space-y-1">
                      <li>• Boca Raton</li>
                      <li>• Delray Beach</li>
                      <li>• Jupiter</li>
                      <li>• Wellington</li>
                    </ul>
                    <p className="text-cyan-400 text-sm mt-3">45+ Properties →</p>
                  </div>
                </Link>
              </div>
            </div>
          </section>

          {/* Benefits Section */}
          <section className="py-16 px-6">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Why Choose Owner Financing in Florida?
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-blue-400 text-3xl mb-4">🌴</div>
                  <h3 className="text-xl font-semibold text-white mb-3">No State Income Tax</h3>
                  <p className="text-slate-300">Florida has no state income tax, leaving more money for your home payments and lifestyle.</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-emerald-400 text-3xl mb-4">📈</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Appreciating Market</h3>
                  <p className="text-slate-300">Florida real estate consistently appreciates, making owner financed properties excellent investments.</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-purple-400 text-3xl mb-4">🏖️</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Vacation Rental Potential</h3>
                  <p className="text-slate-300">Many properties can generate rental income through vacation rentals in tourist areas.</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-yellow-400 text-3xl mb-4">🏠</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Homestead Exemption</h3>
                  <p className="text-slate-300">Save thousands yearly with Florida's homestead exemption for primary residences.</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-orange-400 text-3xl mb-4">⚡</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Fast Closing</h3>
                  <p className="text-slate-300">Close in 7-14 days instead of waiting 30-45 days for traditional financing.</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-cyan-400 text-3xl mb-4">🤝</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Flexible Terms</h3>
                  <p className="text-slate-300">Negotiate directly with sellers on down payment, interest rates, and payment schedules.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Property Types */}
          <section className="py-16 px-6 bg-slate-800/30">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Types of Owner Financed Properties in Florida
              </h2>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-blue-400 mb-3">🏖️ Beachfront & Coastal</h3>
                  <ul className="text-slate-300 space-y-2">
                    <li>• Condos with ocean views</li>
                    <li>• Beach houses</li>
                    <li>• Waterfront properties</li>
                    <li>• Marina communities</li>
                  </ul>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-emerald-400 mb-3">🏡 Single Family Homes</h3>
                  <ul className="text-slate-300 space-y-2">
                    <li>• Suburban neighborhoods</li>
                    <li>• Gated communities</li>
                    <li>• Pool homes</li>
                    <li>• Golf course properties</li>
                  </ul>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-purple-400 mb-3">💼 Investment Properties</h3>
                  <ul className="text-slate-300 space-y-2">
                    <li>• Vacation rentals</li>
                    <li>• Multi-family units</li>
                    <li>• Mobile home parks</li>
                    <li>• Commercial properties</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="py-16 px-6">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Florida Owner Financing FAQs
              </h2>
              <div className="space-y-6">
                {[
                  {
                    q: "Is owner financing legal in Florida?",
                    a: "Yes, owner financing is completely legal in Florida. The state allows sellers to finance their property sales with proper documentation and compliance with Florida real estate laws."
                  },
                  {
                    q: "What are typical down payments in Florida?",
                    a: "Down payments in Florida typically range from 5% to 20% of the purchase price. Beachfront and luxury properties may require higher down payments, while inland properties may have lower requirements."
                  },
                  {
                    q: "Can I use owner financing for a vacation home?",
                    a: "Yes, many Florida sellers offer owner financing for vacation homes and investment properties, especially in tourist areas like Orlando, Miami Beach, and the Gulf Coast."
                  },
                  {
                    q: "How does Florida's homestead exemption work?",
                    a: "With owner financing, you get the deed and can apply for Florida's homestead exemption if it's your primary residence, potentially saving thousands in property taxes."
                  },
                  {
                    q: "What about hurricane insurance?",
                    a: "You'll need to obtain homeowners insurance including windstorm coverage. This is separate from your owner financing payments and is your responsibility as the property owner."
                  }
                ].map((faq, i) => (
                  <div key={i} className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                    <h3 className="text-xl font-semibold text-white mb-3">{faq.q}</h3>
                    <p className="text-slate-300">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-20 px-6 bg-gradient-to-b from-slate-900 to-slate-800">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-6">
                Ready to Find Your Florida Home with Owner Financing?
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Browse hundreds of owner financed properties across the Sunshine State.
                No banks, no delays, just direct deals with sellers.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup" className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all">
                  Browse Florida Properties Now
                </Link>
                <Link href="/owner-financing-georgia" className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all">
                  Explore Georgia Properties
                </Link>
              </div>
            </div>
          </section>
        </main>

        <LegalFooter includeInvestment={true} includeState={true} />
      </div>
    </>
  )
}