import { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export const metadata: Metadata = {
  title: 'Owner Financing San Diego | Rent to Own Alternative CA | La Jolla, Mission Beach | OwnerFi',
  description: 'Find owner financed homes in San Diego - better than rent to own! Immediate ownership in La Jolla, Mission Beach, Gaslamp Quarter, Pacific Beach. No banks needed. Flexible credit options.',
  keywords: 'owner financing san diego, owner financed homes san diego, rent to own san diego, rent to own california, owner financing la jolla, seller financing san diego, no credit check homes san diego, bad credit homes san diego, san diego real estate owner financing',
  openGraph: {
    title: 'Owner Financed Homes in San Diego - Better Than Rent to Own | OwnerFi',
    description: 'Skip the banks! Find owner financed properties across San Diego with immediate ownership. Serving La Jolla, Mission Beach, Pacific Beach and more.',
    url: 'https://ownerfi.ai/san-diego-owner-financing',
    siteName: 'OwnerFi',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Owner Financing San Diego - Better Than Rent to Own',
    description: 'Find owner financed homes across San Diego. Immediate ownership, no banks needed.',
  },
  alternates: {
    canonical: 'https://ownerfi.ai/san-diego-owner-financing',
  }
}

async function getSanDiegoProperties() {
  try {
    const propertiesRef = collection(db, 'properties')
    const q = query(
      propertiesRef,
      where('isActive', '==', true),
      where('city', 'in', ['San Diego', 'La Jolla', 'Mission Beach', 'Pacific Beach', 'Gaslamp Quarter', 'Hillcrest'])
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
    console.error('Error fetching San Diego properties:', error)
    return { areaCounts: {}, totalCount: 0 }
  }
}

export default async function OwnerFinancingSanDiego() {
  const { areaCounts, totalCount } = await getSanDiegoProperties()

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is owner financing better than rent to own in San Diego?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! With owner financing in San Diego, you get immediate ownership and build equity from day one. Rent to own requires years of renting before you can purchase. Owner financing gives you the deed right away with seller-held financing."
        }
      },
      {
        "@type": "Question",
        "name": "Can I get owner financing with bad credit in San Diego?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Many San Diego sellers offering owner financing are flexible with credit requirements. While some properties require credit checks, approximately 30% have no credit requirements and 50% work with buyers who have credit challenges."
        }
      },
      {
        "@type": "Question",
        "name": "What areas in San Diego offer owner financed homes?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Owner financed homes are available throughout San Diego including La Jolla, Mission Beach, Pacific Beach, Gaslamp Quarter, Hillcrest, and Point Loma."
        }
      },
      {
        "@type": "Question",
        "name": "How much down payment is needed for San Diego owner financing?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Down payments in San Diego typically range from 15% to 25% of the purchase price due to higher coastal property values. However, the perfect weather and lifestyle make it worthwhile."
        }
      }
    ]
  }

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "OwnerFi San Diego - Owner Financed Homes",
    "description": "Find owner financed homes throughout San Diego. Better than rent to own with immediate ownership.",
    "url": "https://ownerfi.ai/san-diego-owner-financing",
    "areaServed": {
      "@type": "City",
      "name": "San Diego",
      "containsPlace": [
        { "@type": "Neighborhood", "name": "La Jolla" },
        { "@type": "Neighborhood", "name": "Mission Beach" },
        { "@type": "Neighborhood", "name": "Pacific Beach" },
        { "@type": "Neighborhood", "name": "Gaslamp Quarter" },
        { "@type": "Neighborhood", "name": "Hillcrest" }
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
              <li className="text-slate-900 font-medium">San Diego</li>
            </ol>
          </nav>

          {/* Hero Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Owner Financing San Diego - Better Than Rent to Own
            </h1>
            <p className="text-xl text-slate-700 mb-8">
              Find {totalCount > 0 ? `${totalCount}+ ` : ''}owner financed homes across America's Finest City.
              Skip the banks and get immediate ownership with seller financing in La Jolla, Mission Beach, Pacific Beach, and beyond.
              Experience San Diego's perfect climate and beach lifestyle with owner financing that makes coastal living accessible.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                <h3 className="font-bold text-green-900 mb-2">Immediate San Diego Ownership</h3>
                <p className="text-green-800">Get the deed right away, unlike rent to own</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl border border-blue-200">
                <h3 className="font-bold text-blue-900 mb-2">Perfect Climate</h3>
                <p className="text-blue-800">70°F year-round, beach lifestyle</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-yellow-50 p-6 rounded-xl border border-orange-200">
                <h3 className="font-bold text-orange-900 mb-2">Beach Living</h3>
                <p className="text-orange-800">Miles of pristine coastline</p>
              </div>
            </div>

            <Link href="/signup">
              <button className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-cyan-700 transition-all transform hover:scale-105 shadow-lg">
                Browse San Diego Properties →
              </button>
            </Link>
          </div>

          {/* San Diego Areas Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Owner Financed Homes by San Diego Area
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200">
                <h3 className="text-xl font-bold text-blue-900 mb-2">
                  La Jolla
                </h3>
                <p className="text-blue-700 mb-2">
                  {areaCounts['La Jolla'] || 'Luxury'} owner financed properties
                </p>
                <p className="text-sm text-blue-600 mb-3">
                  Upscale coastal, UC San Diego, luxury shopping
                </p>
                <p className="text-xs text-blue-500">
                  Prestigious address, ocean views, world-class dining
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border-2 border-yellow-200">
                <h3 className="text-xl font-bold text-yellow-900 mb-2">
                  Mission Beach
                </h3>
                <p className="text-yellow-700 mb-2">
                  {areaCounts['Mission Beach'] || 'Beachfront'} properties with seller financing
                </p>
                <p className="text-sm text-yellow-600 mb-3">
                  Boardwalk, beach volleyball, vacation rentals
                </p>
                <p className="text-xs text-yellow-500">
                  Beach lifestyle, boardwalk fun, active community
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-green-50 to-teal-50 rounded-xl border-2 border-green-200">
                <h3 className="text-xl font-bold text-green-900 mb-2">
                  Pacific Beach
                </h3>
                <p className="text-green-700 mb-2">
                  {areaCounts['Pacific Beach'] || 'Vibrant'} homes with owner financing
                </p>
                <p className="text-sm text-green-600 mb-3">
                  Crystal Pier, nightlife, young professionals
                </p>
                <p className="text-xs text-green-500">
                  Beach bars, surfing culture, active nightlife
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border-2 border-red-200">
                <h3 className="text-xl font-bold text-red-900 mb-2">
                  Gaslamp Quarter
                </h3>
                <p className="text-red-700 mb-2">
                  {areaCounts['Gaslamp Quarter'] || 'Historic'} owner financed properties
                </p>
                <p className="text-sm text-red-600 mb-3">
                  Downtown nightlife, historic district, urban living
                </p>
                <p className="text-xs text-red-500">
                  Victorian architecture, restaurants, entertainment
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border-2 border-purple-200">
                <h3 className="text-xl font-bold text-purple-900 mb-2">
                  Hillcrest
                </h3>
                <p className="text-purple-700 mb-2">
                  {areaCounts['Hillcrest'] || 'Diverse'} rent to own alternatives
                </p>
                <p className="text-sm text-purple-600 mb-3">
                  Medical district, diverse community, walkable
                </p>
                <p className="text-xs text-purple-500">
                  Healthcare hub, diverse dining, urban village
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border-2 border-orange-200">
                <h3 className="text-xl font-bold text-orange-900 mb-2">
                  Point Loma
                </h3>
                <p className="text-orange-700 mb-2">
                  {areaCounts['Point Loma'] || 'Coastal'} properties available
                </p>
                <p className="text-sm text-orange-600 mb-3">
                  Liberty Station, Sunset Cliffs, military friendly
                </p>
                <p className="text-xs text-orange-500">
                  Military community, sunset views, family-friendly
                </p>
              </div>
            </div>

            {/* Popular San Diego Areas */}
            <div className="border-t pt-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-4">
                More San Diego Areas with Owner Financing
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-700">
                {['Balboa Park', 'Coronado', 'Del Mar', 'Encinitas', 'Carlsbad', 'Chula Vista',
                  'Oceanside', 'Escondido', 'El Cajon', 'National City', 'Santee', 'Poway',
                  'Solana Beach', 'Imperial Beach', 'Lemon Grove', 'Spring Valley', 'Bonita', 'Vista'].map(area => (
                  <span key={area} className="text-sm hover:text-indigo-600">
                    {area}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Why Owner Financing in San Diego */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              Why Choose Owner Financing in San Diego?
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  San Diego Real Estate Advantages
                </h3>
                <ul className="space-y-3 text-slate-700">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Perfect year-round climate and beach lifestyle</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Major military presence and defense industry</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Growing biotech and life sciences sectors</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>World-class universities and research institutions</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Owner financing makes coastal living accessible</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Owner Financing vs Rent to Own in San Diego
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
                      Risk of losing option fee. Treated as tenant under California law.
                    </p>
                  </div>
                </div>
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
                { name: 'Los Angeles, CA', slug: 'los-angeles-owner-financing' },
                { name: 'Riverside, CA', slug: 'riverside-owner-financing' },
                { name: 'Anaheim, CA', slug: 'anaheim-owner-financing' },
                { name: 'Santa Ana, CA', slug: 'santa-ana-owner-financing' }
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
              San Diego Owner Financing FAQ
            </h2>

            <div className="space-y-6">
              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Is owner financing legal in San Diego?
                </h3>
                <p className="text-slate-700">
                  Yes, owner financing is completely legal in San Diego. The city follows California state laws governing
                  seller financing through grant deeds, deeds of trust, and promissory notes.
                  San Diego County Recorder handles property transfers and recording requirements.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  What credit score do I need for owner financing in San Diego?
                </h3>
                <p className="text-slate-700">
                  Credit requirements vary by seller. Approximately 30% of our San Diego properties have
                  no credit check requirements, 50% work with buyers who have credit challenges,
                  and 20% prefer good credit. Military personnel often receive special consideration
                  from sellers due to San Diego's strong military community.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  How much down payment is typical for San Diego owner financing?
                </h3>
                <p className="text-slate-700">
                  Down payments typically range from 15% to 25% of the purchase price in San Diego.
                  Coastal properties and premium areas like La Jolla may require higher down payments,
                  while inland areas often have more flexible terms. The average is around 20%.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Can I use owner financing for San Diego investment properties?
                </h3>
                <p className="text-slate-700">
                  Yes! Many San Diego sellers offer owner financing for investment properties.
                  The city's strong tourism industry and military presence create excellent rental demand.
                  Beach properties and areas near UCSD are particularly attractive to investors.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl shadow-xl p-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Start Your San Diego Homeownership Journey Today
            </h2>
            <p className="text-xl mb-8 text-blue-100">
              Better than rent to own - get immediate ownership with owner financing
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <button className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold hover:bg-blue-50 transition-all">
                  Search San Diego Properties
                </button>
              </Link>
              <Link href="/how-owner-finance-works">
                <button className="bg-blue-500 text-white px-8 py-4 rounded-xl font-semibold hover:bg-blue-400 transition-all">
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