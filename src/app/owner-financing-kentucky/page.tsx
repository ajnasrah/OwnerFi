import { Metadata } from 'next'
import Link from 'next/link'
import Script from 'next/script'
import { LegalFooter } from '@/components/ui/LegalFooter'

export const metadata: Metadata = {
  title: 'Owner Financing Kentucky | Seller Financed Homes in KENTUCKY | No Banks Required',
  description: 'Find owner financed homes in Kentucky. Browse seller financing properties in Louisville, Lexington, Bowling Green, Owensboro. No bank financing needed. Bad credit OK. Low down payments.',
  keywords: 'owner financing kentucky, owner financed homes kentucky, seller financing kentucky, owner finance louisville, kentucky owner financing, no bank financing kentucky, bad credit homes kentucky, rent to own kentucky',

  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://ownerfi.ai/owner-financing-kentucky',
    siteName: 'OwnerFi',
    title: 'Owner Financing Kentucky - Seller Financed Homes',
    description: 'Browse owner financed properties across Kentucky. No bank needed, flexible terms available.',
    images: [{
      url: 'https://ownerfi.ai/og-kentucky.png',
      width: 1200,
      height: 630,
      alt: 'Owner Financing Kentucky Properties',
    }],
  },

  alternates: {
    canonical: 'https://ownerfi.ai/owner-financing-kentucky',
  },
}

function generateLocalBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "name": "OwnerFi Kentucky",
    "description": "Owner financed properties marketplace in Kentucky",
    "url": "https://ownerfi.ai/owner-financing-kentucky",
    "areaServed": {
      "@type": "State",
      "name": "Kentucky",
      "containsPlace": [
        {"@type": "City", "name": "Louisville"},
        {"@type": "City", "name": "Lexington"},
        {"@type": "City", "name": "Bowling Green"},
        {"@type": "City", "name": "Owensboro"},
        {"@type": "City", "name": "Covington"},
        {"@type": "City", "name": "Hopkinsville"}
      ]
    }
  }
}

function generateFAQSchema() {
  const faqs = [
    {
      question: "Is owner financing legal in Kentucky?",
      answer: "Yes, owner financing is completely legal in Kentucky. The state allows sellers to finance their property sales with proper documentation and compliance with Kentucky real estate laws."
    },
    {
      question: "What are the benefits of owner financing in Kentucky?",
      answer: "Benefits include no bank approval needed, faster closing (7-14 days), flexible down payments, negotiable terms, and the opportunity to buy in Kentucky's growing market. Bourbon industry heritage and Growing healthcare sector"
    },
    {
      question: "What is the typical down payment for owner financing in Kentucky?",
      answer: "Down payments for owner financed homes in Kentucky typically range from 5% to 20% of the purchase price. The exact amount is negotiable between buyer and seller based on the property and your financial situation."
    },
    {
      question: "Can I get owner financing with bad credit in Kentucky?",
      answer: "Yes, many Kentucky sellers offering owner financing are more flexible about credit scores than traditional banks. They often focus more on your down payment and ability to make monthly payments rather than credit history."
    },
    {
      question: "How is owner financing better than rent-to-own in Kentucky?",
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

export default function OwnerFinancingKentucky() {
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
          <section className="relative py-20 px-6 bg-gradient-to-b from-emerald-900/20 to-slate-900">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12">
                <h1 className="text-5xl font-bold text-white mb-6">
                  Owner Financing in <span className="text-emerald-400">Kentucky</span>
                  <span className="block text-3xl mt-4 text-slate-300">Better Than Rent-to-Own</span>
                </h1>
                <p className="text-xl text-slate-300 max-w-3xl mx-auto">
                  Find owner financed homes across Kentucky - from Louisville to Lexington and beyond.
                  Skip the bank, get flexible terms, and own immediately with seller financing.
                  Bourbon industry heritage and Growing healthcare sector.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <Link href="/signup" className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all">
                  Browse Kentucky Properties
                </Link>
                <Link href="/how-owner-finance-works" className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all">
                  Learn How It Works
                </Link>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-emerald-400">180+</div>
                  <div className="text-slate-300 mt-2">Kentucky Properties</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-emerald-400">5%</div>
                  <div className="text-slate-300 mt-2">Min Down Payment</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-purple-400">15+</div>
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
                Owner Financed Homes by Kentucky City
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-emerald-400/50 transition-all">
                  <h3 className="text-xl font-bold text-emerald-400 mb-2">Louisville</h3>
                  <p className="text-slate-300 text-sm mb-3">Kentucky</p>
                  <p className="text-emerald-400 text-sm mt-3">Properties Available →</p>
                </div>
                <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-blue-400/50 transition-all">
                  <h3 className="text-xl font-bold text-blue-400 mb-2">Lexington</h3>
                  <p className="text-slate-300 text-sm mb-3">Kentucky</p>
                  <p className="text-blue-400 text-sm mt-3">Properties Available →</p>
                </div>
                <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-purple-400/50 transition-all">
                  <h3 className="text-xl font-bold text-purple-400 mb-2">Bowling Green</h3>
                  <p className="text-slate-300 text-sm mb-3">Kentucky</p>
                  <p className="text-purple-400 text-sm mt-3">Properties Available →</p>
                </div>
                <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-yellow-400/50 transition-all">
                  <h3 className="text-xl font-bold text-yellow-400 mb-2">Owensboro</h3>
                  <p className="text-slate-300 text-sm mb-3">Kentucky</p>
                  <p className="text-yellow-400 text-sm mt-3">Properties Available →</p>
                </div>
                <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-orange-400/50 transition-all">
                  <h3 className="text-xl font-bold text-orange-400 mb-2">Covington</h3>
                  <p className="text-slate-300 text-sm mb-3">Kentucky</p>
                  <p className="text-orange-400 text-sm mt-3">Properties Available →</p>
                </div>
                <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-cyan-400/50 transition-all">
                  <h3 className="text-xl font-bold text-cyan-400 mb-2">Hopkinsville</h3>
                  <p className="text-slate-300 text-sm mb-3">Kentucky</p>
                  <p className="text-cyan-400 text-sm mt-3">Properties Available →</p>
                </div>
              </div>
            </div>
          </section>

          {/* Benefits Section */}
          <section className="py-16 px-6">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Why Choose Owner Financing Over Rent-to-Own in Kentucky?
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-emerald-400 text-3xl mb-4">🏠</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Immediate Ownership</h3>
                  <p className="text-slate-300">Get the deed immediately with owner financing, unlike rent-to-own where you don't own until the very end.</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-emerald-400 text-3xl mb-4">📈</div>
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
                  <p className="text-slate-300">Many Kentucky sellers are flexible about credit scores and focus more on your ability to pay.</p>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="py-16 px-6 bg-slate-800/30">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Kentucky Owner Financing FAQs
              </h2>
              <div className="space-y-6">
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">Is owner financing legal in Kentucky?</h3>
                  <p className="text-slate-300">Yes, owner financing is completely legal in Kentucky. The state allows sellers to finance their property sales with proper documentation and compliance with Kentucky real estate laws.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">How is owner financing better than rent-to-own?</h3>
                  <p className="text-slate-300">Owner financing is superior because you get the deed immediately, build equity from day one, can make improvements, and have legal ownership rights. Rent-to-own often has higher costs and you don't own until the end.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">What are typical down payments in Kentucky?</h3>
                  <p className="text-slate-300">Down payments typically range from 5% to 20% of the purchase price. The exact amount is negotiable between buyer and seller based on the property and your financial situation.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">Do credit requirements vary by seller?</h3>
                  <p className="text-slate-300">Yes, credit requirements vary significantly by seller in Kentucky. Many sellers are more flexible than banks and focus on your down payment and ability to make monthly payments rather than just credit scores.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">What Kentucky cities have the most owner financed homes?</h3>
                  <p className="text-slate-300">Louisville, Lexington, Bowling Green have the most owner financed properties, but you can find seller financing options throughout Kentucky, including smaller cities and rural areas.</p>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-20 px-6 bg-gradient-to-b from-slate-900 to-slate-800">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-6">
                Ready to Find Your Kentucky Home with Owner Financing?
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Browse owner financed properties across Kentucky. Better than rent-to-own,
                no banks needed, and you own immediately.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup" className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all">
                  Browse Kentucky Properties Now
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