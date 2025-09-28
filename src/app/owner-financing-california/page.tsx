import { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export const metadata: Metadata = {
  title: 'Owner Financing California | Rent to Own Alternative | Los Angeles, San Francisco & More | OwnerFi',
  description: 'Find owner financed homes in California - better than rent to own! Immediate ownership in Los Angeles, San Francisco, San Diego, Sacramento. No banks needed. Flexible credit options available.',
  keywords: 'owner financing california, owner financed homes california, rent to own homes california, rent to own los angeles, owner financing san francisco, seller financing california, no credit check homes california, bad credit homes california, california real estate owner financing',
  openGraph: {
    title: 'Owner Financed Homes in California - Better Than Rent to Own | OwnerFi',
    description: 'Skip the banks! Find owner financed properties across California with immediate ownership. Serving Los Angeles, San Francisco, San Diego, Sacramento and more.',
    url: 'https://ownerfi.ai/owner-financing-california',
    siteName: 'OwnerFi',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Owner Financing California - Better Than Rent to Own',
    description: 'Find owner financed homes across California. Immediate ownership, no banks needed.',
  },
  alternates: {
    canonical: 'https://ownerfi.ai/owner-financing-california',
  }
}

async function getCaliforniaProperties() {
  try {
    const propertiesRef = collection(db, 'properties')
    const q = query(
      propertiesRef,
      where('isActive', '==', true),
      where('state', 'in', ['California', 'CA'])
    )
    const snapshot = await getDocs(q)

    const cityCounts: Record<string, number> = {}
    let totalCount = 0

    snapshot.docs.forEach(doc => {
      const data = doc.data()
      const city = data.city || ''
      if (city) {
        cityCounts[city] = (cityCounts[city] || 0) + 1
        totalCount++
      }
    })

    return { cityCounts, totalCount }
  } catch (error) {
    console.error('Error fetching California properties:', error)
    return { cityCounts: {}, totalCount: 0 }
  }
}

export default async function OwnerFinancingCalifornia() {
  const { cityCounts, totalCount } = await getCaliforniaProperties()
  const cities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is owner financing better than rent to own in California?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! With owner financing in California, you get immediate ownership and build equity from day one. Rent to own requires years of renting before you can purchase. Owner financing gives you the deed right away with seller-held financing."
        }
      },
      {
        "@type": "Question",
        "name": "Can I get owner financing with bad credit in California?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Many California sellers offering owner financing are flexible with credit requirements. While some properties require credit checks, approximately 30% have no credit requirements and 50% work with buyers who have credit challenges."
        }
      },
      {
        "@type": "Question",
        "name": "What cities in California offer owner financed homes?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Owner financed homes are available throughout California including Los Angeles, San Francisco, San Diego, Sacramento, Fresno, Oakland, Bakersfield, Anaheim, Santa Ana, Riverside, Stockton, and Irvine."
        }
      },
      {
        "@type": "Question",
        "name": "How does owner financing work in California?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "In California, the seller acts as the bank, providing financing directly to you. You'll sign a promissory note and receive the deed. California law protects both buyers and sellers in owner financing transactions through proper recording and title transfer requirements."
        }
      }
    ]
  }

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "OwnerFi California - Owner Financed Homes",
    "description": "Find owner financed homes throughout California. Better than rent to own with immediate ownership.",
    "url": "https://ownerfi.ai/owner-financing-california",
    "areaServed": {
      "@type": "State",
      "name": "California",
      "containsPlace": [
        { "@type": "City", "name": "Los Angeles" },
        { "@type": "City", "name": "San Francisco" },
        { "@type": "City", "name": "San Diego" },
        { "@type": "City", "name": "Sacramento" },
        { "@type": "City", "name": "Fresno" }
      ]
    }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-12">
          {/* Breadcrumb */}
          <nav className="mb-8">
            <ol className="flex space-x-2 text-sm text-slate-600">
              <li><Link href="/" className="hover:text-indigo-600">Home</Link></li>
              <li>/</li>
              <li className="text-slate-900 font-medium">California</li>
            </ol>
          </nav>

          {/* Hero Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Owner Financing California - Better Than Rent to Own
            </h1>
            <p className="text-xl text-slate-700 mb-8">
              Find {totalCount > 0 ? `${totalCount}+ ` : ''}owner financed homes across the Golden State.
              Skip the banks and get immediate ownership with seller financing.
              From Silicon Valley's tech hubs to beach communities, we have properties with flexible terms that make homeownership accessible despite California's high cost of living.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                <h3 className="font-bold text-green-900 mb-2">Immediate Ownership</h3>
                <p className="text-green-800">Get the deed right away, unlike rent to own</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                <h3 className="font-bold text-blue-900 mb-2">No Banks Required</h3>
                <p className="text-blue-800">Deal directly with property owners</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-200">
                <h3 className="font-bold text-purple-900 mb-2">Flexible Credit</h3>
                <p className="text-purple-800">Many sellers work with all credit situations</p>
              </div>
            </div>

            <Link href="/signup">
              <button className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg">
                Browse California Properties →
              </button>
            </Link>
          </div>

          {/* Call to Action Section */}
          <section className="py-12 px-6 bg-gradient-to-r from-emerald-900/30 to-blue-900/30 rounded-2xl mb-12">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                Ready to Find Your California Home?
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Browse owner financed and rent-to-own properties across California.
                No banks needed, flexible terms available.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup">
                  <button className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg hover:shadow-xl">
                    🏠 Browse California Properties
                  </button>
                </Link>
                <Link href="/signup">
                  <button className="bg-white/10 backdrop-blur-sm border-2 border-white/30 hover:bg-white/20 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02]">
                    Get Pre-Qualified Today
                  </button>
                </Link>
              </div>
              <p className="text-sm text-slate-400 mt-6">
                Join 500+ buyers who found their dream home without traditional financing
              </p>
            </div>
          </section>

          {/* Cities Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Owner Financed Homes by California City
            </h2>

            {/* Major Cities Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <Link href="/los-angeles" className="group">
                <div className="p-6 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border-2 border-red-200 hover:border-red-400 transition-all hover:shadow-lg">
                  <h3 className="text-xl font-bold text-red-900 mb-2 group-hover:text-red-700">
                    Los Angeles
                  </h3>
                  <p className="text-red-700">
                    {cityCounts['Los Angeles'] || 'Multiple'} owner financed properties in the City of Angels
                  </p>
                  <p className="text-sm mt-2 text-red-600">
                    Hollywood, Beverly Hills, Downtown LA alternatives
                  </p>
                </div>
              </Link>

              <Link href="/san-francisco" className="group">
                <div className="p-6 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl border-2 border-teal-200 hover:border-teal-400 transition-all hover:shadow-lg">
                  <h3 className="text-xl font-bold text-teal-900 mb-2 group-hover:text-teal-700">
                    San Francisco
                  </h3>
                  <p className="text-teal-700">
                    {cityCounts['San Francisco'] || 'Multiple'} properties in the tech capital
                  </p>
                  <p className="text-sm mt-2 text-teal-600">
                    Skip high down payments with owner financing
                  </p>
                </div>
              </Link>

              <Link href="/san-diego" className="group">
                <div className="p-6 bg-gradient-to-br from-green-50 to-lime-50 rounded-xl border-2 border-green-200 hover:border-green-400 transition-all hover:shadow-lg">
                  <h3 className="text-xl font-bold text-green-900 mb-2 group-hover:text-green-700">
                    San Diego
                  </h3>
                  <p className="text-green-700">
                    {cityCounts['San Diego'] || 'Find'} homes with seller financing
                  </p>
                  <p className="text-sm mt-2 text-green-600">
                    Perfect climate, beach communities
                  </p>
                </div>
              </Link>

              <Link href="/sacramento" className="group">
                <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 hover:border-blue-400 transition-all hover:shadow-lg">
                  <h3 className="text-xl font-bold text-blue-900 mb-2 group-hover:text-blue-700">
                    Sacramento
                  </h3>
                  <p className="text-blue-700">
                    {cityCounts['Sacramento'] || 'Browse'} owner financed properties
                  </p>
                  <p className="text-sm mt-2 text-blue-600">
                    California's capital with affordable options
                  </p>
                </div>
              </Link>

              <Link href="/fresno" className="group">
                <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200 hover:border-purple-400 transition-all hover:shadow-lg">
                  <h3 className="text-xl font-bold text-purple-900 mb-2 group-hover:text-purple-700">
                    Fresno
                  </h3>
                  <p className="text-purple-700">
                    {cityCounts['Fresno'] || 'Discover'} rent to own alternatives
                  </p>
                  <p className="text-sm mt-2 text-purple-600">
                    Central Valley's agricultural hub
                  </p>
                </div>
              </Link>

              <Link href="/oakland" className="group">
                <div className="p-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border-2 border-red-200 hover:border-red-400 transition-all hover:shadow-lg">
                  <h3 className="text-xl font-bold text-red-900 mb-2 group-hover:text-red-700">
                    Oakland
                  </h3>
                  <p className="text-red-700">
                    {cityCounts['Oakland'] || 'View'} properties across the Bay
                  </p>
                  <p className="text-sm mt-2 text-red-600">
                    Bay Area alternative to SF prices
                  </p>
                </div>
              </Link>
            </div>

            {/* Additional Cities */}
            <div className="border-t pt-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-4">
                More California Cities with Owner Financing
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-700">
                {['Bakersfield', 'Anaheim', 'Santa Ana', 'Riverside', 'Stockton', 'Irvine',
                  'Fremont', 'San Bernardino', 'Modesto', 'Oxnard', 'Fontana', 'Moreno Valley',
                  'Huntington Beach', 'Glendale', 'Santa Clarita', 'Garden Grove', 'Oceanside', 'Rancho Cucamonga'].map(city => (
                  <Link key={city} href={`/${city.toLowerCase().replace(' ', '-')}`} className="hover:text-indigo-600 hover:underline">
                    {city}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Why Owner Financing in California */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              Why Choose Owner Financing in California?
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  California Real Estate Advantages
                </h3>
                <ul className="space-y-3 text-slate-700">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Silicon Valley tech sector with high-paying jobs</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Diverse geography from beaches to mountains to deserts</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Year-round perfect climate in many areas</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Strong entertainment industry in Los Angeles</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Owner financing helps overcome high cost barriers</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Owner Financing vs Rent to Own in California
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-2">Owner Financing ✓</h4>
                    <p className="text-green-800 text-sm">
                      Immediate ownership with deed transfer. Build equity from day one.
                      Tax benefits as a homeowner. Protected by California property laws.
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <h4 className="font-semibold text-red-900 mb-2">Rent to Own ✗</h4>
                    <p className="text-red-800 text-sm">
                      Years of renting before ownership. No equity during rental period.
                      Risk of losing option fee. Treated as tenant under California law.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* California Market Insights */}
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl shadow-xl p-8 mb-12 border border-orange-200">
            <h2 className="text-3xl font-bold text-orange-900 mb-6">
              California Housing Market & Owner Financing Opportunities
            </h2>

            <div className="grid md:grid-cols-3 gap-6 text-orange-800">
              <div>
                <h3 className="font-semibold text-orange-900 mb-3">Tech Workers</h3>
                <p className="text-sm">
                  High-income tech professionals often prefer owner financing to avoid massive down payments.
                  Companies like Google, Apple, and Meta create housing demand but traditional financing can be challenging.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-orange-900 mb-3">Coastal Communities</h3>
                <p className="text-sm">
                  Malibu, Santa Barbara, and Monterey attract buyers seeking beach lifestyle.
                  Owner financing makes these premium markets accessible to more buyers.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-orange-900 mb-3">Inland Areas</h3>
                <p className="text-sm">
                  Central Valley and Inland Empire offer affordability with owner financing.
                  Growing populations from LA and Bay Area create investment opportunities.
                </p>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              California Owner Financing FAQ
            </h2>

            <div className="space-y-6">
              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Is owner financing legal in California?
                </h3>
                <p className="text-slate-700">
                  Yes, owner financing is completely legal in California. The state has comprehensive laws governing
                  seller financing through grant deeds, deeds of trust, and promissory notes.
                  California Civil Code and Financial Code provide strong protections for both parties.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  What credit score do I need for owner financing in California?
                </h3>
                <p className="text-slate-700">
                  Credit requirements vary by seller. Approximately 30% of our California properties have
                  no credit check requirements, 50% work with buyers who have credit challenges,
                  and 20% prefer good credit. Each seller sets their own terms based on down payment
                  and other factors.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  How much down payment is typical for California owner financing?
                </h3>
                <p className="text-slate-700">
                  Down payments typically range from 10% to 25% of the purchase price. Due to California's
                  high property values, some sellers may accept lower percentages but higher dollar amounts.
                  The average is around 15-20%, much lower than traditional financing in expensive markets.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Can I use owner financing for investment properties in California?
                </h3>
                <p className="text-slate-700">
                  Yes! Many California sellers offer owner financing for investment properties.
                  This is especially common in college towns and areas with strong rental demand.
                  Terms may vary from primary residences, with higher down payments typically required.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl p-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Start Your California Homeownership Journey Today
            </h2>
            <p className="text-xl mb-8 text-indigo-100">
              Better than rent to own - get immediate ownership with owner financing
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <button className="bg-white text-indigo-600 px-8 py-4 rounded-xl font-semibold hover:bg-indigo-50 transition-all">
                  Search California Properties
                </button>
              </Link>
              <Link href="/how-owner-finance-works">
                <button className="bg-indigo-500 text-white px-8 py-4 rounded-xl font-semibold hover:bg-indigo-400 transition-all">
                  Learn How It Works
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}