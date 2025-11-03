import { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export const metadata: Metadata = {
  title: 'Owner Financing Miami | Rent to Own Alternative FL | South Beach, Brickell | OwnerFi',
  description: 'Find owner financed homes in Miami - better than rent to own! Immediate ownership in South Beach, Brickell, Wynwood, Coral Gables. No banks needed. Flexible credit options.',
  keywords: 'owner financing miami, owner financed homes miami, rent to own miami, rent to own florida, owner financing south beach, seller financing miami, no credit check homes miami, bad credit homes miami, miami real estate owner financing',
  openGraph: {
    title: 'Owner Financed Homes in Miami - Better Than Rent to Own | OwnerFi',
    description: 'Skip the banks! Find owner financed properties across Miami with immediate ownership. Serving South Beach, Brickell, Wynwood and more.',
    url: 'https://ownerfi.ai/miami-owner-financing',
    siteName: 'OwnerFi',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Owner Financing Miami - Better Than Rent to Own',
    description: 'Find owner financed homes across Miami. Immediate ownership, no banks needed.',
  },
  alternates: {
    canonical: 'https://ownerfi.ai/miami-owner-financing',
  }
}

async function getMiamiProperties() {
  try {
    const propertiesRef = collection(db, 'properties')
    const q = query(
      propertiesRef,
      where('isActive', '==', true),
      where('city', 'in', ['Miami', 'South Beach', 'Brickell', 'Wynwood', 'Coral Gables', 'Coconut Grove'])
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
    console.error('Error fetching Miami properties:', error)
    return { areaCounts: {}, totalCount: 0 }
  }
}

export default async function OwnerFinancingMiami() {
  const { areaCounts, totalCount } = await getMiamiProperties()

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is owner financing better than rent to own in Miami?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! With owner financing in Miami, you get immediate ownership and build equity from day one. Rent to own requires years of renting before you can purchase. Owner financing gives you the deed right away with seller-held financing."
        }
      },
      {
        "@type": "Question",
        "name": "Can I get owner financing with bad credit in Miami?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Many Miami sellers offering owner financing are flexible with credit requirements. While some properties require credit checks, approximately 30% have no credit requirements and 50% work with buyers who have credit challenges."
        }
      },
      {
        "@type": "Question",
        "name": "What neighborhoods in Miami offer owner financed homes?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Owner financed homes are available throughout Miami including South Beach, Brickell, Wynwood, Coral Gables, Coconut Grove, and Downtown Miami."
        }
      },
      {
        "@type": "Question",
        "name": "How much down payment is needed for Miami owner financing?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Down payments in Miami typically range from 10% to 20% of the purchase price. Florida's diverse market and Miami's international appeal make owner financing accessible with reasonable terms."
        }
      }
    ]
  }

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "OwnerFi Miami - Owner Financed Homes",
    "description": "Find owner financed homes throughout Miami. Better than rent to own with immediate ownership.",
    "url": "https://ownerfi.ai/miami-owner-financing",
    "areaServed": {
      "@type": "City",
      "name": "Miami",
      "containsPlace": [
        { "@type": "Neighborhood", "name": "South Beach" },
        { "@type": "Neighborhood", "name": "Brickell" },
        { "@type": "Neighborhood", "name": "Wynwood" },
        { "@type": "Neighborhood", "name": "Coral Gables" },
        { "@type": "Neighborhood", "name": "Coconut Grove" }
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
              <li><Link href="/owner-financing-florida" className="hover:text-indigo-600">Florida</Link></li>
              <li>/</li>
              <li className="text-slate-900 font-medium">Miami</li>
            </ol>
          </nav>

          {/* Hero Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Owner Financing Miami - Better Than Rent to Own
            </h1>
            <p className="text-xl text-slate-700 mb-8">
              Find {totalCount > 0 ? `${totalCount}+ ` : ''}owner financed homes across the Magic City.
              Skip the banks and get immediate ownership with seller financing in South Beach, Brickell, Wynwood, and beyond.
              Experience Miami's vibrant culture, tropical lifestyle, and international business hub with owner financing that makes homeownership accessible in Florida's premier city.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                <h3 className="font-bold text-green-900 mb-2">Immediate Miami Ownership</h3>
                <p className="text-green-800">Get the deed right away, unlike rent to own</p>
              </div>
              <div className="bg-gradient-to-br from-cyan-50 to-blue-50 p-6 rounded-xl border border-cyan-200">
                <h3 className="font-bold text-cyan-900 mb-2">Tropical Paradise</h3>
                <p className="text-cyan-800">Beach lifestyle, year-round sunshine</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-pink-50 p-6 rounded-xl border border-orange-200">
                <h3 className="font-bold text-orange-900 mb-2">No State Tax</h3>
                <p className="text-orange-800">Florida has no state income tax</p>
              </div>
            </div>

            <Link href="/signup">
              <button className="bg-gradient-to-r from-cyan-600 to-pink-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-cyan-700 hover:to-pink-700 transition-all transform hover:scale-105 shadow-lg">
                Browse Miami Properties →
              </button>
            </Link>
          </div>

          {/* Call to Action Section */}
          <section className="py-12 px-6 bg-gradient-to-r from-cyan-900/30 to-pink-900/30 rounded-2xl mb-12">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                Ready to Find Your Miami Home?
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Browse owner financed and rent-to-own properties across Miami.
                No banks needed, flexible terms available.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup">
                  <button className="bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg hover:shadow-xl">
                    🏠 Browse Miami Properties
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

          {/* Miami Neighborhoods Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Owner Financed Homes by Miami Neighborhood
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="p-6 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border-2 border-cyan-200">
                <h3 className="text-xl font-bold text-cyan-900 mb-2">
                  South Beach
                </h3>
                <p className="text-cyan-700 mb-2">
                  {areaCounts['South Beach'] || 'Iconic'} owner financed properties
                </p>
                <p className="text-sm text-cyan-600 mb-3">
                  Art Deco architecture, beach clubs, Ocean Drive
                </p>
                <p className="text-xs text-cyan-500">
                  Beach lifestyle, nightlife, international vibe
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
                <h3 className="text-xl font-bold text-blue-900 mb-2">
                  Brickell
                </h3>
                <p className="text-blue-700 mb-2">
                  {areaCounts['Brickell'] || 'Urban'} properties with seller financing
                </p>
                <p className="text-sm text-blue-600 mb-3">
                  Financial district, luxury high-rises, waterfront dining
                </p>
                <p className="text-xs text-blue-500">
                  Business hub, young professionals, modern living
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
                <h3 className="text-xl font-bold text-purple-900 mb-2">
                  Wynwood
                </h3>
                <p className="text-purple-700 mb-2">
                  {areaCounts['Wynwood'] || 'Artistic'} homes with owner financing
                </p>
                <p className="text-sm text-purple-600 mb-3">
                  Street art walls, galleries, creative community
                </p>
                <p className="text-xs text-purple-500">
                  Arts district, trendy restaurants, hipster culture
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border-2 border-emerald-200">
                <h3 className="text-xl font-bold text-emerald-900 mb-2">
                  Coral Gables
                </h3>
                <p className="text-emerald-700 mb-2">
                  {areaCounts['Coral Gables'] || 'Prestigious'} owner financed properties
                </p>
                <p className="text-sm text-emerald-600 mb-3">
                  Mediterranean architecture, tree-lined streets, upscale shopping
                </p>
                <p className="text-xs text-emerald-500">
                  Historic charm, excellent schools, family-friendly
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl border-2 border-teal-200">
                <h3 className="text-xl font-bold text-teal-900 mb-2">
                  Coconut Grove
                </h3>
                <p className="text-teal-700 mb-2">
                  {areaCounts['Coconut Grove'] || 'Bohemian'} rent to own alternatives
                </p>
                <p className="text-sm text-teal-600 mb-3">
                  Sailing clubs, outdoor cafes, lush canopy
                </p>
                <p className="text-xs text-teal-500">
                  Village atmosphere, waterfront, laid-back vibe
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border-2 border-orange-200">
                <h3 className="text-xl font-bold text-orange-900 mb-2">
                  Downtown Miami
                </h3>
                <p className="text-orange-700 mb-2">
                  {areaCounts['Downtown'] || 'Urban'} properties available
                </p>
                <p className="text-sm text-orange-600 mb-3">
                  Business district, Bayside Marketplace, sports venues
                </p>
                <p className="text-xs text-orange-500">
                  High-rise condos, city living, urban amenities
                </p>
              </div>
            </div>

            {/* Popular Miami Areas */}
            <div className="border-t pt-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-4">
                More Miami Areas with Owner Financing
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-700">
                {['Miami Beach', 'Aventura', 'Key Biscayne', 'Kendall', 'Doral', 'Hialeah',
                  'Homestead', 'Pinecrest', 'Palmetto Bay', 'Surfside', 'Sunny Isles', 'North Miami',
                  'Miami Lakes', 'Cutler Bay', 'Miami Shores', 'El Portal', 'Bay Harbor Islands', 'Bal Harbour'].map(area => (
                  <span key={area} className="text-sm hover:text-indigo-600">
                    {area}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Why Owner Financing in Miami */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              Why Choose Owner Financing in Miami?
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Miami Real Estate Advantages
                </h3>
                <ul className="space-y-3 text-slate-700">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>International business and finance hub</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>No state income tax in Florida</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Year-round tropical weather and beaches</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Strong real estate appreciation potential</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Owner financing makes homeownership accessible</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Owner Financing vs Rent to Own in Miami
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-2">Owner Financing ✓</h4>
                    <p className="text-green-800 text-sm">
                      Immediate ownership with deed transfer. Build equity from day one.
                      Florida property tax benefits. Protected by state property laws.
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <h4 className="font-semibold text-red-900 mb-2">Rent to Own ✗</h4>
                    <p className="text-red-800 text-sm">
                      Years of renting before ownership. No equity during rental period.
                      Risk of losing option fee. Treated as tenant under Florida law.
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
                { name: 'Fort Lauderdale, FL', slug: 'fort-lauderdale-owner-financing' },
                { name: 'Tampa, FL', slug: 'tampa-owner-financing' },
                { name: 'Orlando, FL', slug: 'orlando-owner-financing' },
                { name: 'Jacksonville, FL', slug: 'jacksonville-owner-financing' }
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
              Miami Owner Financing FAQ
            </h2>

            <div className="space-y-6">
              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Is owner financing legal in Miami?
                </h3>
                <p className="text-slate-700">
                  Yes, owner financing is completely legal in Miami. The city follows Florida state laws governing
                  seller financing through warranty deeds, mortgages, and promissory notes.
                  Miami-Dade County Clerk handles property transfers and recording requirements.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  What credit score do I need for owner financing in Miami?
                </h3>
                <p className="text-slate-700">
                  Credit requirements vary by seller. Approximately 30% of our Miami properties have
                  no credit check requirements, 50% work with buyers who have credit challenges,
                  and 20% prefer good credit. International buyers and entrepreneurs often have unique income patterns
                  that sellers understand and accommodate.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  How much down payment is typical for Miami owner financing?
                </h3>
                <p className="text-slate-700">
                  Down payments typically range from 10% to 20% of the purchase price in Miami.
                  The city's international market offers diverse options with reasonable down payment requirements.
                  Luxury areas like Coral Gables and South Beach may require higher amounts. The average is around 15%.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Can I use owner financing for Miami investment properties?
                </h3>
                <p className="text-slate-700">
                  Yes! Many Miami sellers offer owner financing for investment properties.
                  The city's strong tourism and growing population create excellent rental demand.
                  Properties near beaches, downtown, and business districts are particularly attractive.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-cyan-600 to-pink-600 rounded-2xl shadow-xl p-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Start Your Miami Homeownership Journey Today
            </h2>
            <p className="text-xl mb-8 text-cyan-100">
              Better than rent to own - get immediate ownership with owner financing
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <button className="bg-white text-cyan-600 px-8 py-4 rounded-xl font-semibold hover:bg-cyan-50 transition-all">
                  Search Miami Properties
                </button>
              </Link>
              <Link href="/how-owner-finance-works">
                <button className="bg-cyan-500 text-white px-8 py-4 rounded-xl font-semibold hover:bg-cyan-400 transition-all">
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
