import { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export const metadata: Metadata = {
  title: 'Owner Financing Los Angeles | Rent to Own Alternative LA | Hollywood, Beverly Hills | OwnerFi',
  description: 'Find owner financed homes in Los Angeles - better than rent to own! Immediate ownership in Hollywood, Beverly Hills, Santa Monica, Downtown LA. No banks needed. Flexible credit options.',
  keywords: 'owner financing los angeles, owner financed homes la, rent to own los angeles, rent to own hollywood, owner financing beverly hills, seller financing la, no credit check homes los angeles, bad credit homes la, los angeles real estate owner financing',
  openGraph: {
    title: 'Owner Financed Homes in Los Angeles - Better Than Rent to Own | OwnerFi',
    description: 'Skip the banks! Find owner financed properties across Los Angeles with immediate ownership. Serving Hollywood, Beverly Hills, Santa Monica and more.',
    url: 'https://ownerfi.ai/los-angeles-owner-financing',
    siteName: 'OwnerFi',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Owner Financing Los Angeles - Better Than Rent to Own',
    description: 'Find owner financed homes across Los Angeles. Immediate ownership, no banks needed.',
  },
  alternates: {
    canonical: 'https://ownerfi.ai/los-angeles-owner-financing',
  }
}

async function getLAProperties() {
  try {
    const propertiesRef = collection(db, 'properties')
    const q = query(
      propertiesRef,
      where('isActive', '==', true),
      where('city', 'in', ['Los Angeles', 'LA', 'Hollywood', 'Beverly Hills', 'Santa Monica', 'West Hollywood'])
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
    console.error('Error fetching LA properties:', error)
    return { areaCounts: {}, totalCount: 0 }
  }
}

export default async function OwnerFinancingLA() {
  const { areaCounts, totalCount } = await getLAProperties()

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is owner financing better than rent to own in Los Angeles?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! With owner financing in Los Angeles, you get immediate ownership and build equity from day one. Rent to own requires years of renting before you can purchase. Owner financing gives you the deed right away with seller-held financing."
        }
      },
      {
        "@type": "Question",
        "name": "Can I get owner financing with bad credit in Los Angeles?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Many Los Angeles sellers offering owner financing are flexible with credit requirements. While some properties require credit checks, approximately 30% have no credit requirements and 50% work with buyers who have credit challenges."
        }
      },
      {
        "@type": "Question",
        "name": "What neighborhoods in LA offer owner financed homes?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Owner financed homes are available throughout Los Angeles including Hollywood, Beverly Hills, Santa Monica, Downtown LA, Venice, Pasadena, Glendale, and Burbank."
        }
      },
      {
        "@type": "Question",
        "name": "How much down payment is needed for LA owner financing?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Down payments in Los Angeles typically range from 15% to 25% due to high property values. However, many sellers are flexible with terms, especially for properties in emerging neighborhoods."
        }
      }
    ]
  }

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "OwnerFi Los Angeles - Owner Financed Homes",
    "description": "Find owner financed homes throughout Los Angeles. Better than rent to own with immediate ownership.",
    "url": "https://ownerfi.ai/los-angeles-owner-financing",
    "areaServed": {
      "@type": "City",
      "name": "Los Angeles",
      "containsPlace": [
        { "@type": "Neighborhood", "name": "Hollywood" },
        { "@type": "Neighborhood", "name": "Beverly Hills" },
        { "@type": "Neighborhood", "name": "Santa Monica" },
        { "@type": "Neighborhood", "name": "Downtown LA" },
        { "@type": "Neighborhood", "name": "Venice" }
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
              <li><Link href="/owner-financing-california" className="hover:text-indigo-600">California</Link></li>
              <li>/</li>
              <li className="text-slate-900 font-medium">Los Angeles</li>
            </ol>
          </nav>

          {/* Hero Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Owner Financing Los Angeles - Better Than Rent to Own
            </h1>
            <p className="text-xl text-slate-700 mb-8">
              Find {totalCount > 0 ? `${totalCount}+ ` : ''}owner financed homes across the City of Angels.
              Skip the banks and get immediate ownership with seller financing in Hollywood, Beverly Hills, Santa Monica, and beyond.
              Overcome LA's expensive housing market with flexible owner financing terms that make the California dream accessible.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                <h3 className="font-bold text-green-900 mb-2">Immediate LA Ownership</h3>
                <p className="text-green-800">Get the deed right away, unlike rent to own</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                <h3 className="font-bold text-blue-900 mb-2">No Banks Required</h3>
                <p className="text-blue-800">Deal directly with LA property owners</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-200">
                <h3 className="font-bold text-purple-900 mb-2">Flexible Credit</h3>
                <p className="text-purple-800">Many sellers work with all credit situations</p>
              </div>
            </div>

            <Link href="/signup">
              <button className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg">
                Browse LA Properties →
              </button>
            </Link>
          </div>

          {/* Call to Action Section */}
          <section className="py-12 px-6 bg-gradient-to-r from-emerald-900/30 to-blue-900/30 rounded-2xl mb-12">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                Ready to Find Your Los Angeles Home?
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Browse owner financed and rent-to-own properties across Los Angeles.
                No banks needed, flexible terms available.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup">
                  <button className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg hover:shadow-xl">
                    🏠 Browse Los Angeles Properties
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

          {/* LA Areas Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Owner Financed Homes by LA Area
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="p-6 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border-2 border-red-200">
                <h3 className="text-xl font-bold text-red-900 mb-2">
                  Hollywood
                </h3>
                <p className="text-red-700 mb-2">
                  {areaCounts['Hollywood'] || 'Premium'} owner financed properties
                </p>
                <p className="text-sm text-red-600 mb-3">
                  Hollywood Hills, West Hollywood, Hollywood Boulevard
                </p>
                <p className="text-xs text-red-500">
                  Entertainment capital, Walk of Fame, nightlife
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl border-2 border-yellow-200">
                <h3 className="text-xl font-bold text-yellow-900 mb-2">
                  Beverly Hills
                </h3>
                <p className="text-yellow-700 mb-2">
                  {areaCounts['Beverly Hills'] || 'Luxury'} properties with seller financing
                </p>
                <p className="text-sm text-yellow-600 mb-3">
                  Rodeo Drive, Golden Triangle, Trousdale Estates
                </p>
                <p className="text-xs text-yellow-500">
                  Luxury shopping, celebrity homes, prestigious address
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border-2 border-cyan-200">
                <h3 className="text-xl font-bold text-cyan-900 mb-2">
                  Santa Monica
                </h3>
                <p className="text-cyan-700 mb-2">
                  {areaCounts['Santa Monica'] || 'Beach'} homes with owner financing
                </p>
                <p className="text-sm text-cyan-600 mb-3">
                  Santa Monica Pier, Third Street Promenade, Venice Beach
                </p>
                <p className="text-xs text-cyan-500">
                  Beach lifestyle, tech companies, pier attractions
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border-2 border-purple-200">
                <h3 className="text-xl font-bold text-purple-900 mb-2">
                  Downtown LA
                </h3>
                <p className="text-purple-700 mb-2">
                  {areaCounts['Downtown LA'] || 'Urban'} owner financed properties
                </p>
                <p className="text-sm text-purple-600 mb-3">
                  Arts District, Financial District, Little Tokyo, Bunker Hill
                </p>
                <p className="text-xs text-purple-500">
                  High-rise living, cultural attractions, business district
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
                <h3 className="text-xl font-bold text-green-900 mb-2">
                  Westside
                </h3>
                <p className="text-green-700 mb-2">
                  {areaCounts['Westside'] || 'Upscale'} rent to own alternatives
                </p>
                <p className="text-sm text-green-600 mb-3">
                  Brentwood, Westwood, Pacific Palisades, Culver City
                </p>
                <p className="text-xs text-green-500">
                  UCLA area, affluent neighborhoods, coastal proximity
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl border-2 border-pink-200">
                <h3 className="text-xl font-bold text-pink-900 mb-2">
                  San Fernando Valley
                </h3>
                <p className="text-pink-700 mb-2">
                  {areaCounts['San Fernando Valley'] || 'Affordable'} properties available
                </p>
                <p className="text-sm text-pink-600 mb-3">
                  Studio City, Sherman Oaks, Van Nuys, Encino, Woodland Hills
                </p>
                <p className="text-xs text-pink-500">
                  Family-friendly, more affordable, entertainment industry
                </p>
              </div>
            </div>

            {/* Popular LA Neighborhoods */}
            <div className="border-t pt-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-4">
                Popular LA Neighborhoods with Owner Financing
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-700">
                {['Silver Lake', 'Los Feliz', 'Echo Park', 'Koreatown', 'Mid-City', 'Hancock Park',
                  'Venice', 'Mar Vista', 'Palms', 'Mid-Wilshire', 'Miracle Mile', 'Fairfax',
                  'Melrose', 'Larchmont', 'Windsor Square', 'Carthay Circle', 'Pico-Robertson', 'Beverlywood'].map(neighborhood => (
                  <span key={neighborhood} className="text-sm hover:text-indigo-600">
                    {neighborhood}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Why Owner Financing in LA */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              Why Choose Owner Financing in Los Angeles?
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  LA Real Estate Advantages
                </h3>
                <ul className="space-y-3 text-slate-700">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Entertainment industry capital of the world</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Year-round perfect weather and outdoor lifestyle</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Diverse cultural communities and cuisines</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Beaches, mountains, and desert within driving distance</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Owner financing overcomes high down payment barriers</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Owner Financing vs Rent to Own in LA
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-2">Owner Financing ✓</h4>
                    <p className="text-green-800 text-sm">
                      Immediate ownership with deed transfer. Build equity from day one.
                      California property tax benefits. Protected by state property laws.
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <h4 className="font-semibold text-red-900 mb-2">Rent to Own ✗</h4>
                    <p className="text-red-800 text-sm">
                      Years of renting before ownership. No equity during rental period.
                      Risk of losing option fee. Treated as tenant under CA rent laws.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* LA Market Insights */}
          <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl shadow-xl p-8 mb-12 border border-orange-200">
            <h2 className="text-3xl font-bold text-orange-900 mb-6">
              Los Angeles Housing Market & Owner Financing Opportunities
            </h2>

            <div className="grid md:grid-cols-3 gap-6 text-orange-800">
              <div>
                <h3 className="font-semibold text-orange-900 mb-3">Entertainment Industry</h3>
                <p className="text-sm">
                  Actors, directors, producers, and entertainment professionals often prefer owner financing.
                  Irregular income patterns make traditional financing challenging despite high earning potential.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-orange-900 mb-3">Tech & Startups</h3>
                <p className="text-sm">
                  Growing tech scene in Venice, Santa Monica, and West LA attracts entrepreneurs.
                  Startup founders and tech workers value flexible financing options.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-orange-900 mb-3">International Buyers</h3>
                <p className="text-sm">
                  LA attracts global buyers seeking luxury properties and investment opportunities.
                  Owner financing provides easier path for foreign nationals and investors.
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
                { name: 'San Diego, CA', slug: 'san-diego-owner-financing' },
                { name: 'Anaheim, CA', slug: 'anaheim-owner-financing' },
                { name: 'Long Beach, CA', slug: 'long-beach-owner-financing' },
                { name: 'Glendale, CA', slug: 'glendale-owner-financing' }
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
              Los Angeles Owner Financing FAQ
            </h2>

            <div className="space-y-6">
              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Is owner financing legal in Los Angeles?
                </h3>
                <p className="text-slate-700">
                  Yes, owner financing is completely legal in Los Angeles. The city follows California state laws governing
                  seller financing through grant deeds, deeds of trust, and promissory notes.
                  LA County Recorder handles property transfers and recording requirements.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  What credit score do I need for owner financing in LA?
                </h3>
                <p className="text-slate-700">
                  Credit requirements vary by seller. Approximately 30% of our LA properties have
                  no credit check requirements, 50% work with buyers who have credit challenges,
                  and 20% prefer good credit. Entertainment industry professionals often have unique income patterns
                  that sellers understand and accommodate.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  How much down payment is typical for LA owner financing?
                </h3>
                <p className="text-slate-700">
                  Down payments typically range from 15% to 25% of the purchase price in Los Angeles.
                  Premium areas like Beverly Hills or beachfront properties may require higher down payments,
                  while emerging neighborhoods often have more flexible terms. The average is around 20%.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Can I use owner financing for LA investment properties?
                </h3>
                <p className="text-slate-700">
                  Yes! Many LA sellers offer owner financing for investment properties.
                  This is especially common given the strong rental market and entertainment industry demand.
                  Multi-family properties and properties near studios often have investment-friendly terms.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl p-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Start Your Los Angeles Homeownership Journey Today
            </h2>
            <p className="text-xl mb-8 text-indigo-100">
              Better than rent to own - get immediate ownership with owner financing
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <button className="bg-white text-indigo-600 px-8 py-4 rounded-xl font-semibold hover:bg-indigo-50 transition-all">
                  Search LA Properties
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