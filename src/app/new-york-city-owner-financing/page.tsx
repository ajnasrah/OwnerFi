import { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export const metadata: Metadata = {
  title: 'Owner Financing New York City | Rent to Own Alternative NYC | Manhattan, Brooklyn, Queens | OwnerFi',
  description: 'Find owner financed homes in New York City - better than rent to own! Immediate ownership in Manhattan, Brooklyn, Queens, Bronx, Staten Island. No banks needed. Flexible credit options.',
  keywords: 'owner financing nyc, owner financed homes new york city, rent to own nyc, rent to own manhattan, owner financing brooklyn, seller financing nyc, no credit check homes nyc, bad credit homes manhattan, nyc real estate owner financing',
  openGraph: {
    title: 'Owner Financed Homes in New York City - Better Than Rent to Own | OwnerFi',
    description: 'Skip the banks! Find owner financed properties across NYC with immediate ownership. Serving Manhattan, Brooklyn, Queens, Bronx and Staten Island.',
    url: 'https://ownerfi.ai/new-york-city-owner-financing',
    siteName: 'OwnerFi',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Owner Financing NYC - Better Than Rent to Own',
    description: 'Find owner financed homes across New York City. Immediate ownership, no banks needed.',
  },
  alternates: {
    canonical: 'https://ownerfi.ai/new-york-city-owner-financing',
  }
}

async function getNYCProperties() {
  try {
    const propertiesRef = collection(db, 'properties')
    const q = query(
      propertiesRef,
      where('isActive', '==', true),
      where('city', 'in', ['New York City', 'New York', 'Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'])
    )
    const snapshot = await getDocs(q)

    const boroughCounts: Record<string, number> = {}
    let totalCount = 0

    snapshot.docs.forEach(doc => {
      const data = doc.data()
      const city = data.city || ''
      if (city) {
        boroughCounts[city] = (boroughCounts[city] || 0) + 1
        totalCount++
      }
    })

    return { boroughCounts, totalCount }
  } catch (error) {
    console.error('Error fetching NYC properties:', error)
    return { boroughCounts: {}, totalCount: 0 }
  }
}

export default async function OwnerFinancingNYC() {
  const { boroughCounts, totalCount } = await getNYCProperties()

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is owner financing better than rent to own in NYC?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! With owner financing in NYC, you get immediate ownership and build equity from day one. Rent to own requires years of renting before you can purchase. Owner financing gives you the deed right away with seller-held financing."
        }
      },
      {
        "@type": "Question",
        "name": "Can I get owner financing with bad credit in New York City?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Many NYC sellers offering owner financing are flexible with credit requirements. While some properties require credit checks, approximately 30% have no credit requirements and 50% work with buyers who have credit challenges."
        }
      },
      {
        "@type": "Question",
        "name": "What neighborhoods in NYC offer owner financed homes?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Owner financed homes are available throughout NYC including Manhattan, Brooklyn (Williamsburg, Park Slope, Crown Heights), Queens (Astoria, Flushing, Long Island City), Bronx (Riverdale, Fordham), and Staten Island."
        }
      },
      {
        "@type": "Question",
        "name": "How much down payment is needed for NYC owner financing?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Down payments in NYC typically range from 15% to 30% due to high property values. However, the dollar amount may be substantial even at lower percentages. Many sellers are flexible with terms for qualified buyers."
        }
      }
    ]
  }

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "OwnerFi New York City - Owner Financed Homes",
    "description": "Find owner financed homes throughout New York City. Better than rent to own with immediate ownership.",
    "url": "https://ownerfi.ai/new-york-city-owner-financing",
    "areaServed": {
      "@type": "City",
      "name": "New York City",
      "containsPlace": [
        { "@type": "Neighborhood", "name": "Manhattan" },
        { "@type": "Neighborhood", "name": "Brooklyn" },
        { "@type": "Neighborhood", "name": "Queens" },
        { "@type": "Neighborhood", "name": "Bronx" },
        { "@type": "Neighborhood", "name": "Staten Island" }
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
              <li><Link href="/owner-financing-new-york" className="hover:text-indigo-600">New York</Link></li>
              <li>/</li>
              <li className="text-slate-900 font-medium">New York City</li>
            </ol>
          </nav>

          {/* Hero Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Owner Financing New York City - Better Than Rent to Own
            </h1>
            <p className="text-xl text-slate-700 mb-8">
              Find {totalCount > 0 ? `${totalCount}+ ` : ''}owner financed homes across the Big Apple.
              Skip the banks and get immediate ownership with seller financing in Manhattan, Brooklyn, Queens, Bronx, and Staten Island.
              Overcome NYC's challenging down payment requirements with flexible owner financing terms.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                <h3 className="font-bold text-green-900 mb-2">Immediate NYC Ownership</h3>
                <p className="text-green-800">Get the deed right away, unlike rent to own</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                <h3 className="font-bold text-blue-900 mb-2">No Banks Required</h3>
                <p className="text-blue-800">Deal directly with NYC property owners</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-200">
                <h3 className="font-bold text-purple-900 mb-2">Flexible Credit</h3>
                <p className="text-purple-800">Many sellers work with all credit situations</p>
              </div>
            </div>

            <Link href="/auth">
              <button className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg">
                Browse NYC Properties →
              </button>
            </Link>
          </div>

          {/* NYC Boroughs Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Owner Financed Homes by NYC Borough
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="p-6 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border-2 border-red-200">
                <h3 className="text-xl font-bold text-red-900 mb-2">
                  Manhattan
                </h3>
                <p className="text-red-700 mb-2">
                  {boroughCounts['Manhattan'] || 'Premium'} owner financed properties
                </p>
                <p className="text-sm text-red-600 mb-3">
                  Upper East Side, Greenwich Village, SoHo, Tribeca, Midtown
                </p>
                <p className="text-xs text-red-500">
                  Financial district, world-class dining, Broadway theaters
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl border-2 border-teal-200">
                <h3 className="text-xl font-bold text-teal-900 mb-2">
                  Brooklyn
                </h3>
                <p className="text-teal-700 mb-2">
                  {boroughCounts['Brooklyn'] || 'Multiple'} properties with seller financing
                </p>
                <p className="text-sm text-teal-600 mb-3">
                  Williamsburg, Park Slope, Crown Heights, DUMBO, Bay Ridge
                </p>
                <p className="text-xs text-teal-500">
                  Hipster culture, artisanal food scene, Brooklyn Bridge
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-green-50 to-lime-50 rounded-xl border-2 border-green-200">
                <h3 className="text-xl font-bold text-green-900 mb-2">
                  Queens
                </h3>
                <p className="text-green-700 mb-2">
                  {boroughCounts['Queens'] || 'Find'} homes with owner financing
                </p>
                <p className="text-sm text-green-600 mb-3">
                  Astoria, Flushing, Long Island City, Forest Hills, Jackson Heights
                </p>
                <p className="text-xs text-green-500">
                  Most diverse borough, amazing international cuisine
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
                <h3 className="text-xl font-bold text-blue-900 mb-2">
                  Bronx
                </h3>
                <p className="text-blue-700 mb-2">
                  {boroughCounts['Bronx'] || 'Browse'} owner financed properties
                </p>
                <p className="text-sm text-blue-600 mb-3">
                  Riverdale, Fordham, Concourse, Mott Haven, City Island
                </p>
                <p className="text-xs text-blue-500">
                  Yankee Stadium, Bronx Zoo, growing arts scene
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
                <h3 className="text-xl font-bold text-purple-900 mb-2">
                  Staten Island
                </h3>
                <p className="text-purple-700 mb-2">
                  {boroughCounts['Staten Island'] || 'Discover'} rent to own alternatives
                </p>
                <p className="text-sm text-purple-600 mb-3">
                  St. George, New Brighton, Tottenville, Great Kills
                </p>
                <p className="text-xs text-purple-500">
                  Suburban feel, Staten Island Ferry, parks and beaches
                </p>
              </div>
            </div>

            {/* Popular NYC Neighborhoods */}
            <div className="border-t pt-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-4">
                Popular NYC Neighborhoods with Owner Financing
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-700">
                {['Chelsea', 'East Village', 'Harlem', 'Hell\'s Kitchen', 'Lower East Side', 'NoHo',
                  'Red Hook', 'Sunset Park', 'Greenpoint', 'Bushwick', 'Long Island City', 'Astoria',
                  'Woodside', 'Elmhurst', 'Mott Haven', 'Riverdale', 'St. George', 'New Brighton'].map(neighborhood => (
                  <span key={neighborhood} className="text-sm hover:text-indigo-600">
                    {neighborhood}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Why Owner Financing in NYC */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              Why Choose Owner Financing in New York City?
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  NYC Real Estate Advantages
                </h3>
                <ul className="space-y-3 text-slate-700">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>World's financial capital with Wall Street</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Unmatched cultural attractions and entertainment</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Best public transportation system in the US</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Diverse neighborhoods and communities</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Owner financing overcomes massive down payment barriers</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Owner Financing vs Rent to Own in NYC
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-2">Owner Financing ✓</h4>
                    <p className="text-green-800 text-sm">
                      Immediate ownership with deed transfer. Build equity from day one.
                      NYC property tax benefits. Protected by New York property laws.
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <h4 className="font-semibold text-red-900 mb-2">Rent to Own ✗</h4>
                    <p className="text-red-800 text-sm">
                      Years of renting before ownership. No equity during rental period.
                      Risk of losing option fee. Treated as tenant under NYC rent laws.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* NYC Market Insights */}
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl shadow-xl p-8 mb-12 border border-orange-200">
            <h2 className="text-3xl font-bold text-orange-900 mb-6">
              NYC Housing Market & Owner Financing Opportunities
            </h2>

            <div className="grid md:grid-cols-3 gap-6 text-orange-800">
              <div>
                <h3 className="font-semibold text-orange-900 mb-3">Financial Workers</h3>
                <p className="text-sm">
                  Wall Street professionals often prefer owner financing to avoid tying up massive amounts in down payments.
                  High salaries but cash flow preferences make owner financing attractive.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-orange-900 mb-3">Tech & Media</h3>
                <p className="text-sm">
                  Growing tech scene in Manhattan and Brooklyn attracts workers who value flexibility.
                  Media professionals in entertainment and advertising prefer alternative financing.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-orange-900 mb-3">International Buyers</h3>
                <p className="text-sm">
                  NYC attracts global buyers who may face challenges with traditional US financing.
                  Owner financing provides path to ownership for foreign nationals and investors.
                </p>
              </div>
            </div>
          </div>

          {/* Nearby Cities */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              Nearby Cities with Owner Financing
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: 'Jersey City, NJ', slug: 'jersey-city-owner-financing' },
                { name: 'Yonkers, NY', slug: 'yonkers-owner-financing' },
                { name: 'Newark, NJ', slug: 'newark-owner-financing' },
                { name: 'White Plains, NY', slug: 'white-plains-owner-financing' }
              ].map(city => (
                <Link key={city.slug} href={`/${city.slug}`} className="text-indigo-600 hover:text-indigo-800 hover:underline text-sm">
                  {city.name}
                </Link>
              ))}
            </div>
          </div>

          {/* FAQ Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              NYC Owner Financing FAQ
            </h2>

            <div className="space-y-6">
              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Is owner financing legal in New York City?
                </h3>
                <p className="text-slate-700">
                  Yes, owner financing is completely legal in NYC. The city follows New York State laws governing
                  seller financing through warranty deeds, mortgages, and promissory notes.
                  NYC Department of Finance handles property transfers and recording requirements.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  What credit score do I need for owner financing in NYC?
                </h3>
                <p className="text-slate-700">
                  Credit requirements vary by seller. Approximately 30% of our NYC properties have
                  no credit check requirements, 50% work with buyers who have credit challenges,
                  and 20% prefer good credit. Each seller sets their own terms based on down payment
                  and income verification.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  How much down payment is typical for NYC owner financing?
                </h3>
                <p className="text-slate-700">
                  Down payments typically range from 15% to 30% of the purchase price in NYC.
                  Due to high property values, this often means substantial dollar amounts even at lower percentages.
                  Manhattan properties may require higher down payments than outer borough properties.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Can I use owner financing for NYC investment properties?
                </h3>
                <p className="text-slate-700">
                  Yes! Many NYC sellers offer owner financing for investment properties.
                  This is especially common given the strong rental market and constant demand.
                  Terms may vary from primary residences, with higher down payments typically required.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl p-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Start Your NYC Homeownership Journey Today
            </h2>
            <p className="text-xl mb-8 text-indigo-100">
              Better than rent to own - get immediate ownership with owner financing
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth">
                <button className="bg-white text-indigo-600 px-8 py-4 rounded-xl font-semibold hover:bg-indigo-50 transition-all">
                  Search NYC Properties
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