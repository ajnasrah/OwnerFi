import { Metadata } from 'next'
import Link from 'next/link'
import Script from 'next/script'
import { LegalFooter } from '@/components/ui/LegalFooter'

export const metadata: Metadata = {
  title: 'Rent to Own Homes | Owner Financed Properties | No Bank Needed',
  description: 'Find rent to own homes and owner financed properties in Texas, Florida & Georgia. Skip the bank with seller financing. Bad credit OK, low down payments, flexible terms.',
  keywords: 'rent to own homes, rent to own houses, lease to own homes, rent to own near me, owner financing, seller financing, no bank financing, bad credit homes, rent to own properties, lease purchase homes, contract for deed, owner will carry',

  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://ownerfi.ai/rent-to-own-homes',
    siteName: 'OwnerFi',
    title: 'Rent to Own Homes - Owner Financed Properties Available',
    description: 'Browse thousands of rent to own and owner financed homes. No bank needed, bad credit OK, flexible terms.',
    images: [{
      url: 'https://ownerfi.ai/og-rent-to-own.png',
      width: 1200,
      height: 630,
      alt: 'Rent to Own Homes - OwnerFi',
    }],
  },

  alternates: {
    canonical: 'https://ownerfi.ai/rent-to-own-homes',
  },
}

function generateFAQSchema() {
  const faqs = [
    {
      question: "What is rent to own?",
      answer: "Rent to own, also called lease-to-own or lease-purchase, is when you rent a home with the option to buy it later. With OwnerFi, we focus on owner financing which gives you immediate ownership benefits unlike traditional rent-to-own."
    },
    {
      question: "Is owner financing better than rent to own?",
      answer: "Yes, owner financing is typically better because you get the deed immediately and start building equity from day one. Rent-to-own means you're still a renter until you exercise the purchase option."
    },
    {
      question: "Can I get rent to own with bad credit?",
      answer: "Yes, many sellers offering owner financing and rent-to-own options work with buyers who have bad credit, focusing instead on down payment and monthly payment ability."
    },
    {
      question: "How much down payment for rent to own?",
      answer: "Down payments typically range from 3% to 10% for owner financed properties, much less than the 20% banks require. Some rent-to-own programs start with just first and last month's rent."
    },
    {
      question: "What states offer rent to own homes?",
      answer: "OwnerFi currently has owner financed and rent-to-own properties in Texas, Florida, and Georgia, with more states coming soon."
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

function generateServiceSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Rent to Own Home Marketplace",
    "provider": {
      "@type": "Organization",
      "name": "OwnerFi"
    },
    "serviceType": "Real Estate Marketplace",
    "areaServed": "United States",
    "description": "Find rent to own and owner financed homes without bank financing",
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "USD",
      "lowPrice": "500",
      "highPrice": "5000",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": "500-5000",
        "priceCurrency": "USD",
        "unitText": "MONTH"
      }
    }
  }
}

export default function RentToOwnHomes() {
  const states = [
    { name: 'Texas', count: '200+', slug: 'texas' },
    { name: 'Florida', count: '150+', slug: 'florida' },
    { name: 'Georgia', count: '100+', slug: 'georgia' }
  ]

  return (
    <>
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateFAQSchema()) }}
      />
      <Script
        id="service-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateServiceSchema()) }}
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
              <Link href="/how-owner-finance-works" className="text-slate-300 hover:text-white text-sm">How It Works</Link>
              <Link href="/auth" className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Get Started
              </Link>
            </nav>
          </div>
        </header>

        <main>
          {/* Hero Section */}
          <section className="py-20 px-6 bg-gradient-to-b from-slate-800 to-slate-900">
            <div className="max-w-6xl mx-auto text-center">
              <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
                Rent to Own Homes <span className="text-emerald-400">No Bank Needed</span>
              </h1>
              <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
                Skip traditional financing with owner financed and rent-to-own properties.
                Bad credit OK, low down payments, flexible terms. Browse properties in Texas, Florida, and Georgia.
              </p>

              {/* Search Bar */}
              <div className="max-w-2xl mx-auto mb-8">
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2 border border-slate-700">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="Enter city or state..."
                      className="flex-1 bg-slate-800 text-white px-6 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                    <Link href="/auth" className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-xl font-semibold transition-all">
                      Search Properties
                    </Link>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700/50">
                  <div className="text-3xl font-bold text-emerald-400">500+</div>
                  <div className="text-slate-300 text-sm">Properties</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700/50">
                  <div className="text-3xl font-bold text-blue-400">3</div>
                  <div className="text-slate-300 text-sm">States</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700/50">
                  <div className="text-3xl font-bold text-purple-400">50+</div>
                  <div className="text-slate-300 text-sm">Cities</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700/50">
                  <div className="text-3xl font-bold text-yellow-400">5%</div>
                  <div className="text-slate-300 text-sm">Min Down*</div>
                </div>
              </div>
              <p className="text-xs text-slate-500 text-center mt-4">* Down payment requirements vary by seller</p>

              {/* Owner Financing Qualifier */}
              <div className="bg-amber-900/30 border border-amber-500/30 rounded-xl p-4 mt-8 max-w-3xl mx-auto">
                <p className="text-amber-200 text-sm text-center">
                  <strong>Important:</strong> Subject to seller approval and verification. Not all properties listed will qualify for or offer owner financing.
                  Financing type must be independently confirmed with the seller or their agent.
                </p>
              </div>
            </div>
          </section>

          {/* Owner Financing vs Rent to Own */}
          <section className="py-16 px-6 bg-slate-800/30">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Why Owner Financing Beats Traditional Rent-to-Own
              </h2>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/30 rounded-xl p-8 border border-emerald-500/30">
                  <h3 className="text-2xl font-bold text-emerald-400 mb-4">✅ Owner Financing (Better)</h3>
                  <ul className="space-y-3 text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">✓</span>
                      <span>You get the deed immediately - you're the owner</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">✓</span>
                      <span>Build equity from day one</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">✓</span>
                      <span>Tax benefits as a homeowner</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">✓</span>
                      <span>Can modify or improve property</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">✓</span>
                      <span>Protected by real estate laws</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-red-900/30 to-red-800/30 rounded-xl p-8 border border-red-500/30">
                  <h3 className="text-2xl font-bold text-red-400 mb-4">❌ Traditional Rent-to-Own</h3>
                  <ul className="space-y-3 text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-1">✗</span>
                      <span>You're still just a renter</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-1">✗</span>
                      <span>No equity until you buy</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-1">✗</span>
                      <span>No tax benefits</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-1">✗</span>
                      <span>Can't modify property</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-1">✗</span>
                      <span>Can lose option money</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="text-center mt-8">
                <Link href="/how-owner-finance-works" className="text-emerald-400 hover:text-emerald-300 font-semibold text-lg">
                  Learn More About Owner Financing →
                </Link>
              </div>
            </div>
          </section>

          {/* States Grid */}
          <section className="py-16 px-6">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-4">
                Rent to Own Homes Available in Texas, Florida &amp; Georgia
              </h2>
              <p className="text-slate-300 text-center mb-12 max-w-3xl mx-auto">
                Browse owner financed and rent-to-own properties currently in Texas, Florida, and Georgia, with more states coming soon.
                Click any state to see available properties.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {states.map((state) => (
                  <Link
                    key={state.slug}
                    href={`/owner-financing-${state.slug}`}
                    className="group bg-slate-800/50 backdrop-blur rounded-lg p-4 border border-slate-700/50 hover:border-emerald-400/50 transition-all hover:scale-[1.02]"
                  >
                    <h3 className="font-semibold text-white group-hover:text-emerald-400 transition-colors">
                      {state.name}
                    </h3>
                    <p className="text-emerald-400 text-sm mt-1">{state.count} properties</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* Benefits */}
          <section className="py-16 px-6 bg-slate-800/30">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Benefits of Rent to Own & Owner Financing
              </h2>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="text-5xl mb-4">🏠</div>
                  <h3 className="text-xl font-semibold text-white mb-3">No Bank Required</h3>
                  <p className="text-slate-300">Skip traditional mortgage requirements and lengthy approval processes</p>
                </div>
                <div className="text-center">
                  <div className="text-5xl mb-4">💳</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Bad Credit OK</h3>
                  <p className="text-slate-300">Many sellers work with all credit situations, focusing on down payment</p>
                </div>
                <div className="text-center">
                  <div className="text-5xl mb-4">💰</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Low Down Payment</h3>
                  <p className="text-slate-300">Start with as little as 3-5% down instead of 20% banks require</p>
                </div>
                <div className="text-center">
                  <div className="text-5xl mb-4">⚡</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Fast Move-In</h3>
                  <p className="text-slate-300">Close in 7-14 days instead of waiting 30-45 days for bank approval</p>
                </div>
                <div className="text-center">
                  <div className="text-5xl mb-4">📝</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Flexible Terms</h3>
                  <p className="text-slate-300">Negotiate payment terms directly with the seller</p>
                </div>
                <div className="text-center">
                  <div className="text-5xl mb-4">🔑</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Build Equity</h3>
                  <p className="text-slate-300">Start building home equity immediately with owner financing</p>
                </div>
              </div>
            </div>
          </section>

          {/* Popular Cities */}
          <section className="py-16 px-6">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Popular Cities for Rent to Own Homes
              </h2>
              <div className="grid md:grid-cols-4 gap-4">
                {[
                  'Houston, TX', 'Dallas, TX', 'Miami, FL', 'Atlanta, GA',
                  'Phoenix, AZ', 'Las Vegas, NV', 'Orlando, FL', 'San Antonio, TX',
                  'Austin, TX', 'Jacksonville, FL', 'Charlotte, NC', 'Nashville, TN',
                  'Memphis, TN', 'Louisville, KY', 'Oklahoma City, OK', 'Indianapolis, IN'
                ].map((city) => (
                  <Link
                    key={city}
                    href={`/owner-financing-${city.toLowerCase().replace(/, /, '-').replace(' ', '-')}`}
                    className="bg-slate-800/50 backdrop-blur rounded-lg px-4 py-3 border border-slate-700/50 hover:border-emerald-400/50 transition-all text-slate-300 hover:text-white text-center"
                  >
                    {city}
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="py-16 px-6 bg-slate-800/30">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Frequently Asked Questions
              </h2>
              <div className="space-y-6">
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">What is rent to own?</h3>
                  <p className="text-slate-300">Rent to own, also called lease-to-own or lease-purchase, is when you rent a home with the option to buy it later. With OwnerFi, we focus on owner financing which gives you immediate ownership benefits unlike traditional rent-to-own.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">Is owner financing better than rent to own?</h3>
                  <p className="text-slate-300">Yes, owner financing is typically better because you get the deed immediately and start building equity from day one. Rent-to-own means you're still a renter until you exercise the purchase option.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">Can I get rent to own with bad credit?</h3>
                  <p className="text-slate-300">Yes, many sellers offering owner financing and rent-to-own options work with buyers who have bad credit, focusing instead on down payment and monthly payment ability.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">What states offer rent to own homes?</h3>
                  <p className="text-slate-300">OwnerFi currently has owner financed and rent-to-own properties in Texas, Florida, and Georgia, with more states coming soon.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">How much down payment do I need?</h3>
                  <p className="text-slate-300">Down payments typically range from 3% to 10% for owner financed properties, much less than the 20% banks require. Some programs start with just first and last month's rent.</p>
                </div>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="py-20 px-6 bg-gradient-to-b from-slate-900 to-slate-800">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-4xl font-bold text-white mb-6">
                Find Your Rent to Own Home Today
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Browse thousands of owner financed and rent-to-own properties. No bank needed, bad credit OK.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth" className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all">
                  Browse All Properties
                </Link>
                <Link href="/how-owner-finance-works" className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all">
                  Learn How It Works
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