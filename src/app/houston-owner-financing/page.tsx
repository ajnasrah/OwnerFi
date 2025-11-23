import { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export const metadata: Metadata = {
  title: 'Owner Financing Houston | Rent to Own Alternative TX | Montrose, River Oaks | OwnerFi',
  description: 'Find owner financed homes in Houston - better than rent to own! Immediate ownership in Montrose, River Oaks, Heights, Downtown. No banks needed. Flexible credit options.',
  keywords: 'owner financing houston, owner financed homes houston, rent to own houston, rent to own texas, owner financing montrose, seller financing houston, no credit check homes houston, bad credit homes houston, houston real estate owner financing',
  openGraph: {
    title: 'Owner Financed Homes in Houston - Better Than Rent to Own | OwnerFi',
    description: 'Skip the banks! Find owner financed properties across Houston with immediate ownership. Serving Montrose, River Oaks, Heights and more.',
    url: 'https://ownerfi.ai/houston-owner-financing',
    siteName: 'OwnerFi',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Owner Financing Houston - Better Than Rent to Own',
    description: 'Find owner financed homes across Houston. Immediate ownership, no banks needed.',
  },
  alternates: {
    canonical: 'https://ownerfi.ai/houston-owner-financing',
  }
}

async function getHoustonProperties() {
  try {
    const propertiesRef = collection(db, 'properties')
    const q = query(
      propertiesRef,
      where('isActive', '==', true),
      where('city', 'in', ['Houston', 'Montrose', 'River Oaks', 'Heights', 'Galleria', 'Sugar Land'])
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
    console.error('Error fetching Houston properties:', error)
    return { areaCounts: {}, totalCount: 0 }
  }
}

export default async function OwnerFinancingHouston() {
  const { areaCounts, totalCount } = await getHoustonProperties()

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is owner financing better than rent to own in Houston?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! With owner financing in Houston, you get immediate ownership and build equity from day one. Rent to own requires years of renting before you can purchase. Owner financing gives you the deed right away with seller-held financing."
        }
      },
      {
        "@type": "Question",
        "name": "Can I get owner financing with bad credit in Houston?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Many Houston sellers offering owner financing are flexible with credit requirements. While some properties require credit checks, approximately 30% have no credit requirements and 50% work with buyers who have credit challenges."
        }
      },
      {
        "@type": "Question",
        "name": "What neighborhoods in Houston offer owner financed homes?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Owner financed homes are available throughout Houston including Montrose, River Oaks, Heights, Galleria, Memorial, Kingwood, and Sugar Land."
        }
      },
      {
        "@type": "Question",
        "name": "How much down payment is needed for Houston owner financing?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Down payments in Houston typically range from 10% to 20% of the purchase price. Texas's affordable housing market makes owner financing accessible with reasonable down payment amounts."
        }
      }
    ]
  }

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "OwnerFi Houston - Owner Financed Homes",
    "description": "Find owner financed homes throughout Houston. Better than rent to own with immediate ownership.",
    "url": "https://ownerfi.ai/houston-owner-financing",
    "areaServed": {
      "@type": "City",
      "name": "Houston",
      "containsPlace": [
        { "@type": "Neighborhood", "name": "Montrose" },
        { "@type": "Neighborhood", "name": "River Oaks" },
        { "@type": "Neighborhood", "name": "Heights" },
        { "@type": "Neighborhood", "name": "Galleria" },
        { "@type": "Neighborhood", "name": "Memorial" }
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
              <li><Link href="/owner-financing-texas" className="hover:text-indigo-600">Texas</Link></li>
              <li>/</li>
              <li className="text-slate-900 font-medium">Houston</li>
            </ol>
          </nav>

          {/* Hero Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Owner Financing Houston - Better Than Rent to Own
            </h1>
            <p className="text-xl text-slate-700 mb-8">
              Find {totalCount > 0 ? `${totalCount}+ ` : ''}owner financed homes across Space City.
              Skip the banks and get immediate ownership with seller financing in Montrose, River Oaks, Heights, and beyond.
              Experience Houston's booming economy and diverse culture with owner financing that makes homeownership accessible in America's energy capital.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                <h3 className="font-bold text-green-900 mb-2">Immediate Houston Ownership</h3>
                <p className="text-green-800">Get the deed right away, unlike rent to own</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                <h3 className="font-bold text-blue-900 mb-2">No Banks Required</h3>
                <p className="text-blue-800">Deal directly with Houston property owners</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-200">
                <h3 className="font-bold text-purple-900 mb-2">Flexible Credit</h3>
                <p className="text-purple-800">Many sellers work with all credit situations</p>
              </div>
            </div>

            <Link href="/auth">
              <button className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg">
                Browse Houston Properties →
              </button>
            </Link>
          </div>

          {/* Call to Action Section */}
          <section className="py-12 px-6 bg-gradient-to-r from-emerald-900/30 to-blue-900/30 rounded-2xl mb-12">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                Ready to Find Your Houston Home?
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Browse owner financed and rent-to-own properties across Houston.
                No banks needed, flexible terms available.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth">
                  <button className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg hover:shadow-xl">
                    🏠 Browse Houston Properties
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

          {/* Houston Areas Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Owner Financed Homes by Houston Area
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border-2 border-purple-200">
                <h3 className="text-xl font-bold text-purple-900 mb-2">
                  Montrose
                </h3>
                <p className="text-purple-700 mb-2">
                  {areaCounts['Montrose'] || 'Trendy'} owner financed properties
                </p>
                <p className="text-sm text-purple-600 mb-3">
                  Museum District, art galleries, vintage shops
                </p>
                <p className="text-xs text-purple-500">
                  Hip neighborhood, diverse dining, cultural hub
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl border-2 border-yellow-200">
                <h3 className="text-xl font-bold text-yellow-900 mb-2">
                  River Oaks
                </h3>
                <p className="text-yellow-700 mb-2">
                  {areaCounts['River Oaks'] || 'Luxury'} properties with seller financing
                </p>
                <p className="text-sm text-yellow-600 mb-3">
                  Highland Village, River Oaks Country Club, mansions
                </p>
                <p className="text-xs text-yellow-500">
                  Most prestigious address, luxury shopping, country club
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
                <h3 className="text-xl font-bold text-green-900 mb-2">
                  Heights
                </h3>
                <p className="text-green-700 mb-2">
                  {areaCounts['Heights'] || 'Historic'} homes with owner financing
                </p>
                <p className="text-sm text-green-600 mb-3">
                  19th Street, White Oak Bayou, historic homes
                </p>
                <p className="text-xs text-green-500">
                  Historic charm, bike trails, young families
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200">
                <h3 className="text-xl font-bold text-blue-900 mb-2">
                  Galleria
                </h3>
                <p className="text-blue-700 mb-2">
                  {areaCounts['Galleria'] || 'Upscale'} owner financed properties
                </p>
                <p className="text-sm text-blue-600 mb-3">
                  Galleria Mall, high-rise condos, business district
                </p>
                <p className="text-xs text-blue-500">
                  Shopping hub, corporate offices, luxury living
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border-2 border-red-200">
                <h3 className="text-xl font-bold text-red-900 mb-2">
                  Memorial
                </h3>
                <p className="text-red-700 mb-2">
                  {areaCounts['Memorial'] || 'Family'} rent to own alternatives
                </p>
                <p className="text-sm text-red-600 mb-3">
                  Memorial Park, Energy Corridor, family homes
                </p>
                <p className="text-xs text-red-500">
                  Large park system, energy companies, suburban feel
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border-2 border-orange-200">
                <h3 className="text-xl font-bold text-orange-900 mb-2">
                  Sugar Land
                </h3>
                <p className="text-orange-700 mb-2">
                  {areaCounts['Sugar Land'] || 'Suburban'} properties available
                </p>
                <p className="text-sm text-orange-600 mb-3">
                  Master-planned communities, excellent schools
                </p>
                <p className="text-xs text-orange-500">
                  Family-oriented, top-rated schools, planned communities
                </p>
              </div>
            </div>

            {/* Popular Houston Areas */}
            <div className="border-t pt-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-4">
                More Houston Areas with Owner Financing
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-700">
                {['Midtown', 'Downtown', 'Medical Center', 'Katy', 'Pearland', 'The Woodlands',
                  'Clear Lake', 'Kingwood', 'Cypress', 'Spring', 'Tomball', 'Humble',
                  'Bellaire', 'West University', 'Southside', 'East End', 'Third Ward', 'Fifth Ward'].map(area => (
                  <span key={area} className="text-sm hover:text-indigo-600">
                    {area}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Why Owner Financing in Houston */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              Why Choose Owner Financing in Houston?
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Houston Real Estate Advantages
                </h3>
                <ul className="space-y-3 text-slate-700">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Global energy capital with high-paying jobs</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>No state income tax in Texas</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Diverse economy and international business</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Affordable housing compared to other major cities</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Owner financing makes homeownership even more accessible</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Owner Financing vs Rent to Own in Houston
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-2">Owner Financing ✓</h4>
                    <p className="text-green-800 text-sm">
                      Immediate ownership with deed transfer. Build equity from day one.
                      Texas property tax benefits. Protected by state property laws.
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <h4 className="font-semibold text-red-900 mb-2">Rent to Own ✗</h4>
                    <p className="text-red-800 text-sm">
                      Years of renting before ownership. No equity during rental period.
                      Risk of losing option fee. Treated as tenant under Texas law.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Houston Market Insights */}
          <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-2xl shadow-xl p-8 mb-12 border border-orange-200">
            <h2 className="text-3xl font-bold text-orange-900 mb-6">
              Houston Housing Market & Owner Financing Opportunities
            </h2>

            <div className="grid md:grid-cols-3 gap-6 text-orange-800">
              <div>
                <h3 className="font-semibold text-orange-900 mb-3">Energy Sector</h3>
                <p className="text-sm">
                  Houston's oil, gas, and renewable energy workers often have variable income.
                  Owner financing provides stability for energy professionals with fluctuating bonuses and project work.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-orange-900 mb-3">Medical Center</h3>
                <p className="text-sm">
                  Texas Medical Center is the world's largest medical complex.
                  Healthcare professionals value owner financing for its flexibility with irregular schedules and income patterns.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-orange-900 mb-3">International Community</h3>
                <p className="text-sm">
                  Houston's diverse international population often faces traditional financing challenges.
                  Owner financing provides accessible homeownership for expatriates and new immigrants.
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
                { name: 'Dallas, TX', slug: 'dallas-owner-financing' },
                { name: 'San Antonio, TX', slug: 'san-antonio-owner-financing' },
                { name: 'Austin, TX', slug: 'austin-owner-financing' },
                { name: 'Fort Worth, TX', slug: 'fort-worth-owner-financing' }
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
              Houston Owner Financing FAQ
            </h2>

            <div className="space-y-6">
              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Is owner financing legal in Houston?
                </h3>
                <p className="text-slate-700">
                  Yes, owner financing is completely legal in Houston. The city follows Texas state laws governing
                  seller financing through warranty deeds, deeds of trust, and promissory notes.
                  Harris County Clerk handles property transfers and recording requirements.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  What credit score do I need for owner financing in Houston?
                </h3>
                <p className="text-slate-700">
                  Credit requirements vary by seller. Approximately 30% of our Houston properties have
                  no credit check requirements, 50% work with buyers who have credit challenges,
                  and 20% prefer good credit. Many energy sector professionals have unique income patterns
                  that sellers understand and accommodate.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  How much down payment is typical for Houston owner financing?
                </h3>
                <p className="text-slate-700">
                  Down payments typically range from 10% to 20% of the purchase price in Houston.
                  Texas's affordable housing market means reasonable down payment amounts even for quality properties.
                  Energy professionals often prefer lower down payments to maintain cash flow for investments.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Can I use owner financing for Houston investment properties?
                </h3>
                <p className="text-slate-700">
                  Yes! Many Houston sellers offer owner financing for investment properties.
                  The city's growing population and diverse economy create strong rental demand.
                  Properties near the Medical Center and Energy Corridor are particularly attractive to investors.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl p-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Start Your Houston Homeownership Journey Today
            </h2>
            <p className="text-xl mb-8 text-indigo-100">
              Better than rent to own - get immediate ownership with owner financing
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth">
                <button className="bg-white text-indigo-600 px-8 py-4 rounded-xl font-semibold hover:bg-indigo-50 transition-all">
                  Search Houston Properties
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