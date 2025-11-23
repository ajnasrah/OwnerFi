import { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export const metadata: Metadata = {
  title: 'Owner Financing Chicago | Rent to Own Alternative IL | Lincoln Park, Gold Coast | OwnerFi',
  description: 'Find owner financed homes in Chicago - better than rent to own! Immediate ownership in Lincoln Park, Gold Coast, Wicker Park, Downtown. No banks needed. Flexible credit options.',
  keywords: 'owner financing chicago, owner financed homes chicago, rent to own chicago, rent to own illinois, owner financing lincoln park, seller financing chicago, no credit check homes chicago, bad credit homes chicago, chicago real estate owner financing',
  openGraph: {
    title: 'Owner Financed Homes in Chicago - Better Than Rent to Own | OwnerFi',
    description: 'Skip the banks! Find owner financed properties across Chicago with immediate ownership. Serving Lincoln Park, Gold Coast, Wicker Park and more.',
    url: 'https://ownerfi.ai/chicago-owner-financing',
    siteName: 'OwnerFi',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Owner Financing Chicago - Better Than Rent to Own',
    description: 'Find owner financed homes across Chicago. Immediate ownership, no banks needed.',
  },
  alternates: {
    canonical: 'https://ownerfi.ai/chicago-owner-financing',
  }
}

async function getChicagoProperties() {
  try {
    const propertiesRef = collection(db, 'properties')
    const q = query(
      propertiesRef,
      where('isActive', '==', true),
      where('city', 'in', ['Chicago', 'Lincoln Park', 'Gold Coast', 'Wicker Park', 'River North'])
    )
    const snapshot = await getDocs(q)

    const areaCounts: Record<string, number> = {}
    let totalCount = 0

    snapshot.docs.forEach(doc => {
      const data = doc.data()
      const city = data.city || ''
      if (city) {
        areaCounts[city] = (areaCounts[city] || 0) + 1
        totalCount++
      }
    })

    return { areaCounts, totalCount }
  } catch (error) {
    console.error('Error fetching Chicago properties:', error)
    return { areaCounts: {}, totalCount: 0 }
  }
}

export default async function OwnerFinancingChicago() {
  const { areaCounts, totalCount } = await getChicagoProperties()

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is owner financing better than rent to own in Chicago?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! With owner financing in Chicago, you get immediate ownership and build equity from day one. Rent to own requires years of renting before you can purchase. Owner financing gives you the deed right away with seller-held financing."
        }
      },
      {
        "@type": "Question",
        "name": "Can I get owner financing with bad credit in Chicago?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Many Chicago sellers offering owner financing are flexible with credit requirements. While some properties require credit checks, approximately 30% have no credit requirements and 50% work with buyers who have credit challenges."
        }
      },
      {
        "@type": "Question",
        "name": "What neighborhoods in Chicago offer owner financed homes?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Owner financed homes are available throughout Chicago including Lincoln Park, Gold Coast, Wicker Park, River North, Lakeview, Logan Square, and Bucktown."
        }
      },
      {
        "@type": "Question",
        "name": "How much down payment is needed for Chicago owner financing?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Down payments in Chicago typically range from 10% to 20% of the purchase price. The city offers more affordable options compared to coastal markets, making owner financing accessible to more buyers."
        }
      }
    ]
  }

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "OwnerFi Chicago - Owner Financed Homes",
    "description": "Find owner financed homes throughout Chicago. Better than rent to own with immediate ownership.",
    "url": "https://ownerfi.ai/chicago-owner-financing",
    "areaServed": {
      "@type": "City",
      "name": "Chicago",
      "containsPlace": [
        { "@type": "Neighborhood", "name": "Lincoln Park" },
        { "@type": "Neighborhood", "name": "Gold Coast" },
        { "@type": "Neighborhood", "name": "Wicker Park" },
        { "@type": "Neighborhood", "name": "River North" },
        { "@type": "Neighborhood", "name": "Lakeview" }
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
              <li><Link href="/owner-financing-illinois" className="hover:text-indigo-600">Illinois</Link></li>
              <li>/</li>
              <li className="text-slate-900 font-medium">Chicago</li>
            </ol>
          </nav>

          {/* Hero Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Owner Financing Chicago - Better Than Rent to Own
            </h1>
            <p className="text-xl text-slate-700 mb-8">
              Find {totalCount > 0 ? `${totalCount}+ ` : ''}owner financed homes across the Windy City.
              Skip the banks and get immediate ownership with seller financing in Lincoln Park, Gold Coast, Wicker Park, and beyond.
              Discover Chicago's vibrant neighborhoods with owner financing that makes homeownership possible in America's third-largest city.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                <h3 className="font-bold text-green-900 mb-2">Immediate Chicago Ownership</h3>
                <p className="text-green-800">Get the deed right away, unlike rent to own</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                <h3 className="font-bold text-blue-900 mb-2">No Banks Required</h3>
                <p className="text-blue-800">Deal directly with Chicago property owners</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-200">
                <h3 className="font-bold text-purple-900 mb-2">Flexible Credit</h3>
                <p className="text-purple-800">Many sellers work with all credit situations</p>
              </div>
            </div>

            <Link href="/auth">
              <button className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg">
                Browse Chicago Properties →
              </button>
            </Link>
          </div>

          {/* Call to Action Section */}
          <section className="py-12 px-6 bg-gradient-to-r from-emerald-900/30 to-blue-900/30 rounded-2xl mb-12">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                Ready to Find Your Chicago Home?
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Browse owner financed and rent-to-own properties across Chicago.
                No banks needed, flexible terms available.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth">
                  <button className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg hover:shadow-xl">
                    🏠 Browse Chicago Properties
                  </button>
                </Link>
                <Link href="/auth">
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

          {/* Chicago Neighborhoods Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Owner Financed Homes by Chicago Neighborhood
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
                <h3 className="text-xl font-bold text-blue-900 mb-2">
                  Lincoln Park
                </h3>
                <p className="text-blue-700 mb-2">
                  {areaCounts['Lincoln Park'] || 'Premium'} owner financed properties
                </p>
                <p className="text-sm text-blue-600 mb-3">
                  DePaul University, Lincoln Park Zoo, lakefront living
                </p>
                <p className="text-xs text-blue-500">
                  Young professionals, parks, upscale dining
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl border-2 border-yellow-200">
                <h3 className="text-xl font-bold text-yellow-900 mb-2">
                  Gold Coast
                </h3>
                <p className="text-yellow-700 mb-2">
                  {areaCounts['Gold Coast'] || 'Luxury'} properties with seller financing
                </p>
                <p className="text-sm text-yellow-600 mb-3">
                  Michigan Avenue, Oak Street Beach, historic mansions
                </p>
                <p className="text-xs text-yellow-500">
                  High-end shopping, luxury condos, prestigious address
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
                <h3 className="text-xl font-bold text-green-900 mb-2">
                  Wicker Park
                </h3>
                <p className="text-green-700 mb-2">
                  {areaCounts['Wicker Park'] || 'Trendy'} homes with owner financing
                </p>
                <p className="text-sm text-green-600 mb-3">
                  Bucktown, hipster culture, music venues
                </p>
                <p className="text-xs text-green-500">
                  Arts scene, vintage shops, craft breweries
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border-2 border-purple-200">
                <h3 className="text-xl font-bold text-purple-900 mb-2">
                  River North
                </h3>
                <p className="text-purple-700 mb-2">
                  {areaCounts['River North'] || 'Downtown'} owner financed properties
                </p>
                <p className="text-sm text-purple-600 mb-3">
                  Gallery District, fine dining, high-rise living
                </p>
                <p className="text-xs text-purple-500">
                  Art galleries, upscale condos, nightlife
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border-2 border-red-200">
                <h3 className="text-xl font-bold text-red-900 mb-2">
                  Lakeview
                </h3>
                <p className="text-red-700 mb-2">
                  {areaCounts['Lakeview'] || 'Sports'} rent to own alternatives
                </p>
                <p className="text-sm text-red-600 mb-3">
                  Wrigleyville, Cubs stadium, lake access
                </p>
                <p className="text-xs text-red-500">
                  Baseball fans, sports bars, lake activities
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-cyan-50 to-teal-50 rounded-xl border-2 border-cyan-200">
                <h3 className="text-xl font-bold text-cyan-900 mb-2">
                  Logan Square
                </h3>
                <p className="text-cyan-700 mb-2">
                  {areaCounts['Logan Square'] || 'Emerging'} properties available
                </p>
                <p className="text-sm text-cyan-600 mb-3">
                  Revolution Brewing, farmers market, tree-lined streets
                </p>
                <p className="text-xs text-cyan-500">
                  Craft beer, local food scene, artistic community
                </p>
              </div>
            </div>

            {/* Popular Chicago Neighborhoods */}
            <div className="border-t pt-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-4">
                More Chicago Neighborhoods with Owner Financing
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-700">
                {['Bucktown', 'Old Town', 'Near North Side', 'Streeterville', 'West Loop', 'Pilsen',
                  'Ukrainian Village', 'Noble Square', 'Andersonville', 'Uptown', 'Edgewater', 'Rogers Park',
                  'Humboldt Park', 'Albany Park', 'North Center', 'Roscoe Village', 'Avondale', 'Irving Park'].map(neighborhood => (
                  <span key={neighborhood} className="text-sm hover:text-indigo-600">
                    {neighborhood}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Why Owner Financing in Chicago */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              Why Choose Owner Financing in Chicago?
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Chicago Real Estate Advantages
                </h3>
                <ul className="space-y-3 text-slate-700">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Major financial and business hub</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>World-class architecture and cultural attractions</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Affordable compared to coastal cities</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Strong public transportation system</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Owner financing makes homeownership accessible</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Owner Financing vs Rent to Own in Chicago
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-2">Owner Financing ✓</h4>
                    <p className="text-green-800 text-sm">
                      Immediate ownership with deed transfer. Build equity from day one.
                      Illinois property tax benefits. Protected by state property laws.
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <h4 className="font-semibold text-red-900 mb-2">Rent to Own ✗</h4>
                    <p className="text-red-800 text-sm">
                      Years of renting before ownership. No equity during rental period.
                      Risk of losing option fee. Treated as tenant under Illinois law.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chicago Market Insights */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-xl p-8 mb-12 border border-blue-200">
            <h2 className="text-3xl font-bold text-blue-900 mb-6">
              Chicago Housing Market & Owner Financing Opportunities
            </h2>

            <div className="grid md:grid-cols-3 gap-6 text-blue-800">
              <div>
                <h3 className="font-semibold text-blue-900 mb-3">Financial Professionals</h3>
                <p className="text-sm">
                  Chicago's Loop financial district attracts banking and trading professionals.
                  Many prefer owner financing to maintain liquidity for investments and trading capital.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-blue-900 mb-3">Young Professionals</h3>
                <p className="text-sm">
                  Large university presence and corporate headquarters create demand from young buyers.
                  Owner financing helps overcome student loan debt and limited credit history challenges.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-blue-900 mb-3">Neighborhood Revival</h3>
                <p className="text-sm">
                  Many Chicago neighborhoods are experiencing revitalization and gentrification.
                  Owner financing enables early investment in emerging areas with high potential.
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
                { name: 'Milwaukee, WI', slug: 'milwaukee-owner-financing' },
                { name: 'Indianapolis, IN', slug: 'indianapolis-owner-financing' },
                { name: 'Detroit, MI', slug: 'detroit-owner-financing' },
                { name: 'St. Louis, MO', slug: 'st-louis-owner-financing' }
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
              Chicago Owner Financing FAQ
            </h2>

            <div className="space-y-6">
              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Is owner financing legal in Chicago?
                </h3>
                <p className="text-slate-700">
                  Yes, owner financing is completely legal in Chicago. The city follows Illinois state laws governing
                  seller financing through warranty deeds, mortgages, and promissory notes.
                  Cook County Recorder of Deeds handles property transfers and recording requirements.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  What credit score do I need for owner financing in Chicago?
                </h3>
                <p className="text-slate-700">
                  Credit requirements vary by seller. Approximately 30% of our Chicago properties have
                  no credit check requirements, 50% work with buyers who have credit challenges,
                  and 20% prefer good credit. Many sellers focus more on income stability and down payment
                  than credit scores alone.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  How much down payment is typical for Chicago owner financing?
                </h3>
                <p className="text-slate-700">
                  Down payments typically range from 10% to 20% of the purchase price in Chicago.
                  The city's more affordable housing market compared to coastal areas means lower dollar amounts
                  for down payments, making owner financing accessible to more buyers. The average is around 15%.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Can I use owner financing for Chicago investment properties?
                </h3>
                <p className="text-slate-700">
                  Yes! Many Chicago sellers offer owner financing for investment properties.
                  The city's strong rental market and diverse neighborhoods create excellent investment opportunities.
                  Multi-unit buildings and properties in emerging neighborhoods are particularly attractive.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl p-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Start Your Chicago Homeownership Journey Today
            </h2>
            <p className="text-xl mb-8 text-indigo-100">
              Better than rent to own - get immediate ownership with owner financing
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth">
                <button className="bg-white text-indigo-600 px-8 py-4 rounded-xl font-semibold hover:bg-indigo-50 transition-all">
                  Search Chicago Properties
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