import { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export const metadata: Metadata = {
  title: 'Owner Financing San Antonio | Rent to Own Alternative TX | Alamo Heights, Stone Oak | OwnerFi',
  description: 'Find owner financed homes in San Antonio - better than rent to own! Immediate ownership in Alamo Heights, Stone Oak, Southtown, Downtown. No banks needed. Flexible credit options.',
  keywords: 'owner financing san antonio, owner financed homes san antonio, rent to own san antonio, rent to own texas, owner financing alamo heights, seller financing san antonio, no credit check homes san antonio, bad credit homes san antonio, san antonio real estate owner financing',
  openGraph: {
    title: 'Owner Financed Homes in San Antonio - Better Than Rent to Own | OwnerFi',
    description: 'Skip the banks! Find owner financed properties across San Antonio with immediate ownership. Serving Alamo Heights, Stone Oak, Southtown and more.',
    url: 'https://ownerfi.ai/san-antonio-owner-financing',
    siteName: 'OwnerFi',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Owner Financing San Antonio - Better Than Rent to Own',
    description: 'Find owner financed homes across San Antonio. Immediate ownership, no banks needed.',
  },
  alternates: {
    canonical: 'https://ownerfi.ai/san-antonio-owner-financing',
  }
}

async function getSanAntonioProperties() {
  try {
    const propertiesRef = collection(db, 'properties')
    const q = query(
      propertiesRef,
      where('isActive', '==', true),
      where('city', 'in', ['San Antonio', 'Alamo Heights', 'Stone Oak', 'Southtown', 'The Pearl', 'Terrell Hills'])
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
    console.error('Error fetching San Antonio properties:', error)
    return { areaCounts: {}, totalCount: 0 }
  }
}

export default async function OwnerFinancingSanAntonio() {
  const { areaCounts, totalCount } = await getSanAntonioProperties()

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is owner financing better than rent to own in San Antonio?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! With owner financing in San Antonio, you get immediate ownership and build equity from day one. Rent to own requires years of renting before you can purchase. Owner financing gives you the deed right away with seller-held financing."
        }
      },
      {
        "@type": "Question",
        "name": "Can I get owner financing with bad credit in San Antonio?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Many San Antonio sellers offering owner financing are flexible with credit requirements. While some properties require credit checks, approximately 30% have no credit requirements and 50% work with buyers who have credit challenges."
        }
      },
      {
        "@type": "Question",
        "name": "What areas in San Antonio offer owner financed homes?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Owner financed homes are available throughout San Antonio including Alamo Heights, Stone Oak, Southtown, The Pearl, Medical Center, and Northwest Side."
        }
      },
      {
        "@type": "Question",
        "name": "How much down payment is needed for San Antonio owner financing?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Down payments in San Antonio typically range from 8% to 18% of the purchase price. Texas's affordable housing market and San Antonio's reasonable prices make owner financing very accessible."
        }
      }
    ]
  }

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "OwnerFi San Antonio - Owner Financed Homes",
    "description": "Find owner financed homes throughout San Antonio. Better than rent to own with immediate ownership.",
    "url": "https://ownerfi.ai/san-antonio-owner-financing",
    "areaServed": {
      "@type": "City",
      "name": "San Antonio",
      "containsPlace": [
        { "@type": "Neighborhood", "name": "Alamo Heights" },
        { "@type": "Neighborhood", "name": "Stone Oak" },
        { "@type": "Neighborhood", "name": "Southtown" },
        { "@type": "Neighborhood", "name": "The Pearl" },
        { "@type": "Neighborhood", "name": "Medical Center" }
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
              <li className="text-slate-900 font-medium">San Antonio</li>
            </ol>
          </nav>

          {/* Hero Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Owner Financing San Antonio - Better Than Rent to Own
            </h1>
            <p className="text-xl text-slate-700 mb-8">
              Find {totalCount > 0 ? `${totalCount}+ ` : ''}owner financed homes across the Alamo City.
              Skip the banks and get immediate ownership with seller financing in Alamo Heights, Stone Oak, Southtown, and beyond.
              Experience San Antonio's rich culture and growing economy with owner financing that makes homeownership accessible in Texas's historic gem.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                <h3 className="font-bold text-green-900 mb-2">Immediate San Antonio Ownership</h3>
                <p className="text-green-800">Get the deed right away, unlike rent to own</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                <h3 className="font-bold text-blue-900 mb-2">No Banks Required</h3>
                <p className="text-blue-800">Deal directly with San Antonio property owners</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-orange-50 p-6 rounded-xl border border-red-200">
                <h3 className="font-bold text-red-900 mb-2">Alamo City Living</h3>
                <p className="text-red-800">Rich history, vibrant culture, affordable</p>
              </div>
            </div>

            <Link href="/auth">
              <button className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-red-700 hover:to-orange-700 transition-all transform hover:scale-105 shadow-lg">
                Browse San Antonio Properties →
              </button>
            </Link>
          </div>

          {/* San Antonio Areas Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Owner Financed Homes by San Antonio Area
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
                <h3 className="text-xl font-bold text-green-900 mb-2">
                  Alamo Heights
                </h3>
                <p className="text-green-700 mb-2">
                  {areaCounts['Alamo Heights'] || 'Upscale'} owner financed properties
                </p>
                <p className="text-sm text-green-600 mb-3">
                  Historic district, tree-lined streets, excellent schools
                </p>
                <p className="text-xs text-green-500">
                  Prestigious address, family-friendly, walkable
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200">
                <h3 className="text-xl font-bold text-blue-900 mb-2">
                  Stone Oak
                </h3>
                <p className="text-blue-700 mb-2">
                  {areaCounts['Stone Oak'] || 'Master-planned'} properties with seller financing
                </p>
                <p className="text-sm text-blue-600 mb-3">
                  New developments, shopping centers, golf courses
                </p>
                <p className="text-xs text-blue-500">
                  Suburban lifestyle, new construction, amenities
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border-2 border-red-200">
                <h3 className="text-xl font-bold text-red-900 mb-2">
                  Southtown
                </h3>
                <p className="text-red-700 mb-2">
                  {areaCounts['Southtown'] || 'Artistic'} homes with owner financing
                </p>
                <p className="text-sm text-red-600 mb-3">
                  Art galleries, trendy restaurants, historic homes
                </p>
                <p className="text-xs text-red-500">
                  Arts district, nightlife, young professionals
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border-2 border-purple-200">
                <h3 className="text-xl font-bold text-purple-900 mb-2">
                  The Pearl
                </h3>
                <p className="text-purple-700 mb-2">
                  {areaCounts['The Pearl'] || 'Upscale'} owner financed properties
                </p>
                <p className="text-sm text-purple-600 mb-3">
                  Farmers market, luxury apartments, dining
                </p>
                <p className="text-xs text-purple-500">
                  Luxury living, weekend market, urban lifestyle
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border-2 border-yellow-200">
                <h3 className="text-xl font-bold text-yellow-900 mb-2">
                  Medical Center
                </h3>
                <p className="text-yellow-700 mb-2">
                  {areaCounts['Medical Center'] || 'Healthcare'} rent to own alternatives
                </p>
                <p className="text-sm text-yellow-600 mb-3">
                  Hospitals, medical offices, healthcare workers
                </p>
                <p className="text-xs text-yellow-500">
                  Healthcare hub, medical professionals, convenient
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl border-2 border-teal-200">
                <h3 className="text-xl font-bold text-teal-900 mb-2">
                  Northwest Side
                </h3>
                <p className="text-teal-700 mb-2">
                  {areaCounts['Northwest Side'] || 'Family'} properties available
                </p>
                <p className="text-sm text-teal-600 mb-3">
                  UTSA campus, family neighborhoods, growing area
                </p>
                <p className="text-xs text-teal-500">
                  University area, family-friendly, growing
                </p>
              </div>
            </div>

            {/* Popular San Antonio Areas */}
            <div className="border-t pt-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-4">
                More San Antonio Areas with Owner Financing
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-700">
                {['Downtown', 'King William', 'Monte Vista', 'Mahncke Park', 'Terrell Hills', 'Olmos Park',
                  'Castle Hills', 'Lincoln Heights', 'Dignowity Hill', 'River Walk', 'Broadway', 'Brackenridge Park',
                  'Northeast Side', 'Southeast Side', 'Southwest Side', 'Westside', 'East Side', 'North Side'].map(area => (
                  <span key={area} className="text-sm hover:text-indigo-600">
                    {area}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Why Owner Financing in San Antonio */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              Why Choose Owner Financing in San Antonio?
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  San Antonio Real Estate Advantages
                </h3>
                <ul className="space-y-3 text-slate-700">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Rich cultural heritage and historic charm</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>No state income tax in Texas</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Growing military and cybersecurity sectors</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Affordable cost of living and housing</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Owner financing makes homeownership even more accessible</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Owner Financing vs Rent to Own in San Antonio
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

          {/* San Antonio Market Insights */}
          <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl shadow-xl p-8 mb-12 border border-red-200">
            <h2 className="text-3xl font-bold text-red-900 mb-6">
              San Antonio Housing Market & Owner Financing Opportunities
            </h2>

            <div className="grid md:grid-cols-3 gap-6 text-red-800">
              <div>
                <h3 className="font-semibold text-red-900 mb-3">Military Personnel</h3>
                <p className="text-sm">
                  Large military presence with multiple bases creates steady demand.
                  Military families often prefer owner financing for its flexibility with deployments and relocations.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-red-900 mb-3">Healthcare Workers</h3>
                <p className="text-sm">
                  Major medical center creates jobs for healthcare professionals.
                  Nurses, doctors, and medical staff value owner financing for its accessibility and flexible terms.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-red-900 mb-3">Growing Economy</h3>
                <p className="text-sm">
                  Cybersecurity, tourism, and tech sectors are expanding rapidly.
                  Young professionals moving to San Antonio find owner financing an attractive entry point to homeownership.
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
                { name: 'Austin, TX', slug: 'austin-owner-financing' },
                { name: 'Houston, TX', slug: 'houston-owner-financing' },
                { name: 'Dallas, TX', slug: 'dallas-owner-financing' },
                { name: 'Corpus Christi, TX', slug: 'corpus-christi-owner-financing' }
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
              San Antonio Owner Financing FAQ
            </h2>

            <div className="space-y-6">
              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Is owner financing legal in San Antonio?
                </h3>
                <p className="text-slate-700">
                  Yes, owner financing is completely legal in San Antonio. The city follows Texas state laws governing
                  seller financing through warranty deeds, deeds of trust, and promissory notes.
                  Bexar County Clerk handles property transfers and recording requirements.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  What credit score do I need for owner financing in San Antonio?
                </h3>
                <p className="text-slate-700">
                  Credit requirements vary by seller. Approximately 30% of our San Antonio properties have
                  no credit check requirements, 50% work with buyers who have credit challenges,
                  and 20% prefer good credit. Military personnel and healthcare workers often receive
                  special consideration from sellers.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  How much down payment is typical for San Antonio owner financing?
                </h3>
                <p className="text-slate-700">
                  Down payments typically range from 8% to 18% of the purchase price in San Antonio.
                  The city's affordable housing market means very reasonable down payment amounts.
                  Military families often receive more flexible terms. The average is around 12%.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Can I use owner financing for San Antonio investment properties?
                </h3>
                <p className="text-slate-700">
                  Yes! Many San Antonio sellers offer owner financing for investment properties.
                  The city's growing population and military presence create steady rental demand.
                  Properties near UTSA, downtown, and the medical center are particularly attractive to investors.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl shadow-xl p-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Start Your San Antonio Homeownership Journey Today
            </h2>
            <p className="text-xl mb-8 text-red-100">
              Better than rent to own - get immediate ownership with owner financing
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth">
                <button className="bg-white text-red-600 px-8 py-4 rounded-xl font-semibold hover:bg-red-50 transition-all">
                  Search San Antonio Properties
                </button>
              </Link>
              <Link href="/how-owner-finance-works">
                <button className="bg-red-500 text-white px-8 py-4 rounded-xl font-semibold hover:bg-red-400 transition-all">
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