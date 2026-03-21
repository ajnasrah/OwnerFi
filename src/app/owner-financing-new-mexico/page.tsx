import { Metadata } from 'next'
import Link from 'next/link'
import Script from 'next/script'
import { LegalFooter } from '@/components/ui/LegalFooter'

export const metadata: Metadata = {
  title: 'Owner Financing New Mexico | Seller Financed Homes in NEW MEXICO | No Banks Required',
  description: 'Find owner financed homes in New Mexico. Browse seller financing properties in Albuquerque, Las Cruces, Rio Rancho, Santa Fe. No bank financing needed. Bad credit OK. Low down payments.',
  keywords: 'owner financing new-mexico, owner financed homes new-mexico, seller financing new mexico, owner finance albuquerque, new mexico owner financing, no bank financing new-mexico, bad credit homes new-mexico, rent to own new-mexico',

  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://ownerfi.ai/owner-financing-new-mexico',
    siteName: 'Ownerfi',
    title: 'Owner Financing New Mexico - Seller Financed Homes',
    description: 'Browse owner financed properties across New Mexico. No bank needed, flexible terms available.',
    images: [{
      url: 'https://ownerfi.ai/og-new-mexico.png',
      width: 1200,
      height: 630,
      alt: 'Owner Financing New Mexico Properties',
    }],
  },

  alternates: {
    canonical: 'https://ownerfi.ai/owner-financing-new-mexico',
  },
}

function generateLocalBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "name": "Ownerfi New Mexico",
    "description": "Discover owner financed properties in New Mexico",
    "url": "https://ownerfi.ai/owner-financing-new-mexico",
    "areaServed": {
      "@type": "State",
      "name": "New Mexico",
      "containsPlace": [
        {"@type": "City", "name": "Albuquerque"},
        {"@type": "City", "name": "Las Cruces"},
        {"@type": "City", "name": "Rio Rancho"},
        {"@type": "City", "name": "Santa Fe"},
        {"@type": "City", "name": "Roswell"},
        {"@type": "City", "name": "Farmington"}
      ]
    }
  }
}

function generateFAQSchema() {
  const faqs = [
    {
      question: "Is owner financing legal in New Mexico?",
      answer: "Yes, owner financing is completely legal in New Mexico. The state allows sellers to finance their property sales with proper documentation and compliance with New Mexico real estate laws."
    },
    {
      question: "What are the benefits of owner financing in New Mexico?",
      answer: "Benefits include no bank approval needed, faster closing (7-14 days), flexible down payments, negotiable terms, and the opportunity to buy in New Mexico's growing market. Growing tech sector and Rich cultural heritage"
    },
    {
      question: "What is the typical down payment for owner financing in New Mexico?",
      answer: "Down payments for owner financed homes in New Mexico typically range from 5% to 20% of the purchase price. The exact amount is negotiable between buyer and seller based on the property and your financial situation."
    },
    {
      question: "Can I get owner financing with bad credit in New Mexico?",
      answer: "Yes, many New Mexico sellers offering owner financing are more flexible about credit scores than traditional banks. They often focus more on your down payment and ability to make monthly payments rather than credit history."
    },
    {
      question: "How is owner financing better than rent-to-own in New Mexico?",
      answer: "Owner financing is superior to rent-to-own because you get the deed immediately, build equity from day one, can make improvements, and have legal ownership rights. Rent-to-own often has higher costs and you don't own until the end."
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

export default function OwnerfinancingNewMexico() {
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

      <div className="min-h-screen bg-[#111625] text-white">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-[#111625]/90 backdrop-blur-xl border-b border-white/[0.06] px-4 sm:px-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between h-14 sm:h-16">
            <Link href="/" className="flex items-center gap-2">
              <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="lg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#00BC7D"/><stop offset="100%" stopColor="#3B82F6"/></linearGradient></defs><circle cx="50" cy="50" r="45" stroke="url(#lg)" strokeWidth="7" fill="none"/><ellipse cx="50" cy="50" rx="42" ry="22" stroke="url(#lg)" strokeWidth="5.5" fill="none" transform="rotate(-25 50 50)"/><ellipse cx="50" cy="50" rx="22" ry="42" stroke="url(#lg)" strokeWidth="5.5" fill="none" transform="rotate(-25 50 50)"/></svg>
              <span className="text-lg font-bold text-white">Ownerfi</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/" className="hidden sm:inline-flex text-sm text-slate-400 hover:text-white px-3 py-2 rounded-lg transition-colors">Home</Link>
              <Link href="/how-owner-finance-works" className="hidden sm:inline-flex text-sm text-slate-400 hover:text-white px-3 py-2 rounded-lg transition-colors">How It Works</Link>
              <Link href="/auth" className="bg-[#00BC7D] hover:bg-[#00d68f] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors">
                Browse Properties
              </Link>
            </nav>
          </div>
        </header>

        <main>
          {/* Hero Section */}
          <section className="relative py-20 px-6 bg-gradient-to-b from-orange-900/20 to-slate-900">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12">
                <h1 className="text-5xl font-bold text-white mb-6">
                  Owner Financing in <span className="text-orange-400">New Mexico</span>
                  <span className="block text-3xl mt-4 text-slate-300">Better Than Rent-to-Own</span>
                </h1>
                <p className="text-xl text-slate-300 max-w-3xl mx-auto">
                  Find owner financed homes across New Mexico - from Albuquerque to Las Cruces and beyond.
                  Skip the bank, get flexible terms, and own immediately with seller financing.
                  Growing tech sector and Rich cultural heritage.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <Link href="/auth" className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all">
                  Browse New Mexico Properties
                </Link>
                <Link href="/how-owner-finance-works" className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all">
                  Learn How It Works
                </Link>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-orange-400">130+</div>
                  <div className="text-slate-300 mt-2">New Mexico Properties</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-[#00BC7D]">5%</div>
                  <div className="text-slate-300 mt-2">Min Down Payment</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-purple-400">12+</div>
                  <div className="text-slate-300 mt-2">Cities Covered</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-yellow-400">7 Days</div>
                  <div className="text-slate-300 mt-2">Average Closing</div>
                </div>
              </div>
            </div>
          </section>

          {/* Cities Section */}
          <section className="py-16 px-6 bg-slate-800/30">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Owner Financed Homes by New Mexico City
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-[#111625]/50 border border-slate-700/50 rounded-xl p-6 hover:border-[#00BC7D]/50 transition-all">
                  <h3 className="text-xl font-bold text-[#00BC7D] mb-2">Albuquerque</h3>
                  <p className="text-slate-300 text-sm mb-3">New Mexico</p>
                  <p className="text-[#00BC7D] text-sm mt-3">Properties Available →</p>
                </div>
                <div className="bg-[#111625]/50 border border-slate-700/50 rounded-xl p-6 hover:border-blue-400/50 transition-all">
                  <h3 className="text-xl font-bold text-blue-400 mb-2">Las Cruces</h3>
                  <p className="text-slate-300 text-sm mb-3">New Mexico</p>
                  <p className="text-blue-400 text-sm mt-3">Properties Available →</p>
                </div>
                <div className="bg-[#111625]/50 border border-slate-700/50 rounded-xl p-6 hover:border-purple-400/50 transition-all">
                  <h3 className="text-xl font-bold text-purple-400 mb-2">Rio Rancho</h3>
                  <p className="text-slate-300 text-sm mb-3">New Mexico</p>
                  <p className="text-purple-400 text-sm mt-3">Properties Available →</p>
                </div>
                <div className="bg-[#111625]/50 border border-slate-700/50 rounded-xl p-6 hover:border-yellow-400/50 transition-all">
                  <h3 className="text-xl font-bold text-yellow-400 mb-2">Santa Fe</h3>
                  <p className="text-slate-300 text-sm mb-3">New Mexico</p>
                  <p className="text-yellow-400 text-sm mt-3">Properties Available →</p>
                </div>
                <div className="bg-[#111625]/50 border border-slate-700/50 rounded-xl p-6 hover:border-orange-400/50 transition-all">
                  <h3 className="text-xl font-bold text-orange-400 mb-2">Roswell</h3>
                  <p className="text-slate-300 text-sm mb-3">New Mexico</p>
                  <p className="text-orange-400 text-sm mt-3">Properties Available →</p>
                </div>
                <div className="bg-[#111625]/50 border border-slate-700/50 rounded-xl p-6 hover:border-cyan-400/50 transition-all">
                  <h3 className="text-xl font-bold text-cyan-400 mb-2">Farmington</h3>
                  <p className="text-slate-300 text-sm mb-3">New Mexico</p>
                  <p className="text-cyan-400 text-sm mt-3">Properties Available →</p>
                </div>
              </div>
            </div>
          </section>

          {/* Benefits Section */}
          <section className="py-16 px-6">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Why Choose Owner Financing Over Rent-to-Own in New Mexico?
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-orange-400 text-3xl mb-4">🏠</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Immediate Ownership</h3>
                  <p className="text-slate-300">Get the deed immediately with owner financing, unlike rent-to-own where you don't own until the very end.</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-[#00BC7D] text-3xl mb-4">📈</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Build Equity from Day One</h3>
                  <p className="text-slate-300">Every payment builds equity in your home, unlike rent-to-own where early payments often don't count toward ownership.</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-purple-400 text-3xl mb-4">🔧</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Make Improvements</h3>
                  <p className="text-slate-300">Since you own the property, you can make improvements and modifications without landlord approval.</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-yellow-400 text-3xl mb-4">⚡</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Fast Closing</h3>
                  <p className="text-slate-300">Close in 7-14 days instead of waiting months for traditional financing approval.</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-orange-400 text-3xl mb-4">🤝</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Flexible Terms</h3>
                  <p className="text-slate-300">Negotiate directly with sellers on down payment, interest rates, and payment schedules.</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-cyan-400 text-3xl mb-4">✅</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Credit Requirements Vary</h3>
                  <p className="text-slate-300">Many New Mexico sellers are flexible about credit scores and focus more on your ability to pay.</p>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="py-16 px-6 bg-slate-800/30">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                New Mexico Owner Financing FAQs
              </h2>
              <div className="space-y-6">
                <div className="bg-[#111625]/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">Is owner financing legal in New Mexico?</h3>
                  <p className="text-slate-300">Yes, owner financing is completely legal in New Mexico. The state allows sellers to finance their property sales with proper documentation and compliance with New Mexico real estate laws.</p>
                </div>
                <div className="bg-[#111625]/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">How is owner financing better than rent-to-own?</h3>
                  <p className="text-slate-300">Owner financing is superior because you get the deed immediately, build equity from day one, can make improvements, and have legal ownership rights. Rent-to-own often has higher costs and you don't own until the end.</p>
                </div>
                <div className="bg-[#111625]/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">What are typical down payments in New Mexico?</h3>
                  <p className="text-slate-300">Down payments typically range from 5% to 20% of the purchase price. The exact amount is negotiable between buyer and seller based on the property and your financial situation.</p>
                </div>
                <div className="bg-[#111625]/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">Do credit requirements vary by seller?</h3>
                  <p className="text-slate-300">Yes, credit requirements vary significantly by seller in New Mexico. Many sellers are more flexible than banks and focus on your down payment and ability to make monthly payments rather than just credit scores.</p>
                </div>
                <div className="bg-[#111625]/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">What New Mexico cities have the most owner financed homes?</h3>
                  <p className="text-slate-300">Albuquerque, Las Cruces, Rio Rancho have the most owner financed properties, but you can find seller financing options throughout New Mexico, including smaller cities and rural areas.</p>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-20 px-6 bg-gradient-to-b from-slate-900 to-slate-800">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-6">
                Ready to Find Your New Mexico Home with Owner Financing?
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Browse owner financed properties across New Mexico. Better than rent-to-own,
                no banks needed, and you own immediately.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth" className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all">
                  Browse New Mexico Properties Now
                </Link>
                <Link href="/rent-to-own-homes" className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all">
                  Compare All States
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