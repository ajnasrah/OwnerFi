import { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export const metadata: Metadata = {
  title: 'Owner Financing Arizona | Rent to Own Alternative | Phoenix, Tucson & More | OwnerFi',
  description: 'Find owner financed homes in Arizona - better than rent to own! Immediate ownership in Phoenix, Tucson, Mesa, Scottsdale. No banks needed. Flexible credit options available.',
  keywords: 'owner financing arizona, owner financed homes arizona, rent to own homes arizona, rent to own phoenix, owner financing scottsdale, seller financing arizona, no credit check homes arizona, bad credit homes arizona, arizona real estate owner financing',
  openGraph: {
    title: 'Owner Financed Homes in Arizona - Better Than Rent to Own | OwnerFi',
    description: 'Skip the banks! Find owner financed properties across Arizona with immediate ownership. Serving Phoenix, Tucson, Mesa, Scottsdale and more.',
    url: 'https://ownerfi.ai/owner-financing-arizona',
    siteName: 'OwnerFi',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Owner Financing Arizona - Better Than Rent to Own',
    description: 'Find owner financed homes across Arizona. Immediate ownership, no banks needed.',
  },
  alternates: {
    canonical: 'https://ownerfi.ai/owner-financing-arizona',
  }
}

async function getArizonaProperties() {
  try {
    const propertiesRef = collection(db, 'properties')
    const q = query(
      propertiesRef,
      where('isActive', '==', true),
      where('state', 'in', ['Arizona', 'AZ'])
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
    console.error('Error fetching Arizona properties:', error)
    return { cityCounts: {}, totalCount: 0 }
  }
}

export default async function OwnerFinancingArizona() {
  const { cityCounts, totalCount } = await getArizonaProperties()
  const cities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is owner financing better than rent to own in Arizona?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! With owner financing in Arizona, you get immediate ownership and build equity from day one. Rent to own requires years of renting before you can purchase. Owner financing gives you the deed right away with seller-held financing."
        }
      },
      {
        "@type": "Question",
        "name": "Can I get owner financing with bad credit in Arizona?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Many Arizona sellers offering owner financing are flexible with credit requirements. While some properties require credit checks, approximately 30% have no credit requirements and 50% work with buyers who have credit challenges."
        }
      },
      {
        "@type": "Question",
        "name": "What cities in Arizona offer owner financed homes?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Owner financed homes are available throughout Arizona including Phoenix, Tucson, Mesa, Scottsdale, Chandler, Glendale, Tempe, Peoria, Gilbert, and Surprise."
        }
      },
      {
        "@type": "Question",
        "name": "How does owner financing work in Arizona?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "In Arizona, the seller acts as the bank, providing financing directly to you. You'll sign a promissory note and receive the deed. Arizona law protects both buyers and sellers in owner financing transactions through proper recording and title transfer requirements."
        }
      }
    ]
  }

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "OwnerFi Arizona - Owner Financed Homes",
    "description": "Find owner financed homes throughout Arizona. Better than rent to own with immediate ownership.",
    "url": "https://ownerfi.ai/owner-financing-arizona",
    "areaServed": {
      "@type": "State",
      "name": "Arizona",
      "containsPlace": [
        { "@type": "City", "name": "Phoenix" },
        { "@type": "City", "name": "Tucson" },
        { "@type": "City", "name": "Mesa" },
        { "@type": "City", "name": "Scottsdale" },
        { "@type": "City", "name": "Chandler" }
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
              <li className="text-slate-900 font-medium">Arizona</li>
            </ol>
          </nav>

          {/* Hero Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Owner Financing Arizona - Better Than Rent to Own
            </h1>
            <p className="text-xl text-slate-700 mb-8">
              Find {totalCount > 0 ? `${totalCount}+ ` : ''}owner financed homes across the Grand Canyon State.
              Skip the banks and get immediate ownership with seller financing.
              From Phoenix's growing tech sector to Tucson's retirement communities, we have desert properties with flexible terms perfect for snowbirds and year-round residents alike.
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
                Browse Arizona Properties →
              </button>
            </Link>
          </div>

          {/* Call to Action Section */}
          <section className="py-12 px-6 bg-gradient-to-r from-emerald-900/30 to-blue-900/30 rounded-2xl mb-12">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                Ready to Find Your Arizona Home?
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Browse owner financed and rent-to-own properties across Arizona.
                No banks needed, flexible terms available.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup">
                  <button className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg hover:shadow-xl">
                    🏠 Browse Arizona Properties
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
              Owner Financed Homes by Arizona City
            </h2>

            {/* Major Cities Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <Link href="/phoenix" className="group">
                <div className="p-6 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border-2 border-red-200 hover:border-red-400 transition-all hover:shadow-lg">
                  <h3 className="text-xl font-bold text-red-900 mb-2 group-hover:text-red-700">
                    Phoenix
                  </h3>
                  <p className="text-red-700">
                    {cityCounts['Phoenix'] || 'Multiple'} owner financed properties in the Valley of the Sun
                  </p>
                  <p className="text-sm mt-2 text-red-600">
                    Growing tech hub with year-round sunshine
                  </p>
                </div>
              </Link>

              <Link href="/tucson" className="group">
                <div className="p-6 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl border-2 border-teal-200 hover:border-teal-400 transition-all hover:shadow-lg">
                  <h3 className="text-xl font-bold text-teal-900 mb-2 group-hover:text-teal-700">
                    Tucson
                  </h3>
                  <p className="text-teal-700">
                    {cityCounts['Tucson'] || 'Multiple'} properties in the Sonoran Desert
                  </p>
                  <p className="text-sm mt-2 text-teal-600">
                    Retirement paradise with affordable living
                  </p>
                </div>
              </Link>

              <Link href="/mesa" className="group">
                <div className="p-6 bg-gradient-to-br from-green-50 to-lime-50 rounded-xl border-2 border-green-200 hover:border-green-400 transition-all hover:shadow-lg">
                  <h3 className="text-xl font-bold text-green-900 mb-2 group-hover:text-green-700">
                    Mesa
                  </h3>
                  <p className="text-green-700">
                    {cityCounts['Mesa'] || 'Find'} homes with seller financing
                  </p>
                  <p className="text-sm mt-2 text-green-600">
                    Family-friendly communities and golf courses
                  </p>
                </div>
              </Link>

              <Link href="/scottsdale" className="group">
                <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 hover:border-blue-400 transition-all hover:shadow-lg">
                  <h3 className="text-xl font-bold text-blue-900 mb-2 group-hover:text-blue-700">
                    Scottsdale
                  </h3>
                  <p className="text-blue-700">
                    {cityCounts['Scottsdale'] || 'Browse'} luxury properties with owner financing
                  </p>
                  <p className="text-sm mt-2 text-blue-600">
                    Upscale desert living and resorts
                  </p>
                </div>
              </Link>

              <Link href="/chandler" className="group">
                <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200 hover:border-purple-400 transition-all hover:shadow-lg">
                  <h3 className="text-xl font-bold text-purple-900 mb-2 group-hover:text-purple-700">
                    Chandler
                  </h3>
                  <p className="text-purple-700">
                    {cityCounts['Chandler'] || 'Discover'} rent to own alternatives
                  </p>
                  <p className="text-sm mt-2 text-purple-600">
                    Tech corridor with top-rated schools
                  </p>
                </div>
              </Link>

              <Link href="/glendale" className="group">
                <div className="p-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border-2 border-red-200 hover:border-red-400 transition-all hover:shadow-lg">
                  <h3 className="text-xl font-bold text-red-900 mb-2 group-hover:text-red-700">
                    Glendale
                  </h3>
                  <p className="text-red-700">
                    {cityCounts['Glendale'] || 'View'} properties near sports venues
                  </p>
                  <p className="text-sm mt-2 text-red-600">
                    Home to Cardinals and Coyotes
                  </p>
                </div>
              </Link>
            </div>

            {/* Additional Cities */}
            <div className="border-t pt-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-4">
                More Arizona Cities with Owner Financing
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-700">
                {['Tempe', 'Peoria', 'Gilbert', 'Surprise', 'Yuma', 'Avondale',
                  'Flagstaff', 'Goodyear', 'Lake Havasu City', 'Buckeye', 'Casa Grande', 'Sierra Vista',
                  'Maricopa', 'Oro Valley', 'Prescott', 'Apache Junction', 'Marana', 'El Mirage'].map(city => (
                  <Link key={city} href={`/${city.toLowerCase().replace(' ', '-')}`} className="hover:text-indigo-600 hover:underline">
                    {city}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Why Owner Financing in Arizona */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              Why Choose Owner Financing in Arizona?
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Arizona Real Estate Advantages
                </h3>
                <ul className="space-y-3 text-slate-700">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Growing tech sector in Phoenix with Intel, Amazon, Google</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Popular retirement destination with active adult communities</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Year-round outdoor recreation and golf</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Snowbird seasonal market with flexible ownership</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>No state income tax attracting new residents</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Owner Financing vs Rent to Own in Arizona
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-2">Owner Financing ✓</h4>
                    <p className="text-green-800 text-sm">
                      Immediate ownership with deed transfer. Build equity from day one.
                      Tax benefits as a homeowner. Protected by Arizona property laws.
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <h4 className="font-semibold text-red-900 mb-2">Rent to Own ✗</h4>
                    <p className="text-red-800 text-sm">
                      Years of renting before ownership. No equity during rental period.
                      Risk of losing option fee. Treated as tenant under Arizona law.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Arizona Market Insights */}
          <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl shadow-xl p-8 mb-12 border border-orange-200">
            <h2 className="text-3xl font-bold text-orange-900 mb-6">
              Arizona Housing Market & Owner Financing Opportunities
            </h2>

            <div className="grid md:grid-cols-3 gap-6 text-orange-800">
              <div>
                <h3 className="font-semibold text-orange-900 mb-3">Phoenix Metro</h3>
                <p className="text-sm">
                  Fastest-growing major city with tech companies relocating from California.
                  Owner financing appeals to newcomers and existing residents looking to upgrade in this hot market.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-orange-900 mb-3">Retirement Communities</h3>
                <p className="text-sm">
                  Sun City, Green Valley, and other 55+ communities attract retirees nationwide.
                  Many prefer owner financing for tax advantages and flexible payment terms.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-orange-900 mb-3">Snowbird Market</h3>
                <p className="text-sm">
                  Seasonal residents from cold climates create unique opportunities.
                  Owner financing works well for vacation homes and eventual permanent relocation.
                </p>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Arizona Owner Financing FAQ
            </h2>

            <div className="space-y-6">
              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Is owner financing legal in Arizona?
                </h3>
                <p className="text-slate-700">
                  Yes, owner financing is completely legal in Arizona. The state has clear laws governing
                  seller financing through warranty deeds, deeds of trust, and promissory notes.
                  Arizona Revised Statutes Title 33 covers real property and financing arrangements.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  What credit score do I need for owner financing in Arizona?
                </h3>
                <p className="text-slate-700">
                  Credit requirements vary by seller. Approximately 30% of our Arizona properties have
                  no credit check requirements, 50% work with buyers who have credit challenges,
                  and 20% prefer good credit. Each seller sets their own terms based on down payment
                  and other factors.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  How much down payment is typical for Arizona owner financing?
                </h3>
                <p className="text-slate-700">
                  Down payments typically range from 5% to 20% of the purchase price. Arizona's
                  relatively affordable housing market (compared to California) often allows for
                  lower down payments. The average is around 10-15% for most properties.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Can I use owner financing for vacation homes in Arizona?
                </h3>
                <p className="text-slate-700">
                  Absolutely! Arizona is a popular vacation home destination, especially for snowbirds.
                  Many sellers prefer owner financing for second homes as it provides steady income
                  and tax advantages. Terms for vacation properties may differ from primary residences.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl p-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Start Your Arizona Homeownership Journey Today
            </h2>
            <p className="text-xl mb-8 text-indigo-100">
              Better than rent to own - get immediate ownership with owner financing
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <button className="bg-white text-indigo-600 px-8 py-4 rounded-xl font-semibold hover:bg-indigo-50 transition-all">
                  Search Arizona Properties
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