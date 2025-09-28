import { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export const metadata: Metadata = {
  title: 'Owner Financing Austin | Rent to Own Alternative TX | Downtown, South Austin | OwnerFi',
  description: 'Find owner financed homes in Austin - better than rent to own! Immediate ownership in Downtown, South Austin, East Austin, Westlake. No banks needed. Flexible credit options.',
  keywords: 'owner financing austin, owner financed homes austin, rent to own austin, rent to own texas, owner financing downtown austin, seller financing austin, no credit check homes austin, bad credit homes austin, austin real estate owner financing',
  openGraph: {
    title: 'Owner Financed Homes in Austin - Better Than Rent to Own | OwnerFi',
    description: 'Skip the banks! Find owner financed properties across Austin with immediate ownership. Serving Downtown, South Austin, East Austin and more.',
    url: 'https://ownerfi.ai/austin-owner-financing',
    siteName: 'OwnerFi',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Owner Financing Austin - Better Than Rent to Own',
    description: 'Find owner financed homes across Austin. Immediate ownership, no banks needed.',
  },
  alternates: {
    canonical: 'https://ownerfi.ai/austin-owner-financing',
  }
}

async function getAustinProperties() {
  try {
    const propertiesRef = collection(db, 'properties')
    const q = query(
      propertiesRef,
      where('isActive', '==', true),
      where('city', 'in', ['Austin', 'Downtown Austin', 'South Austin', 'East Austin', 'Westlake', 'Cedar Park'])
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
    console.error('Error fetching Austin properties:', error)
    return { areaCounts: {}, totalCount: 0 }
  }
}

export default async function OwnerFinancingAustin() {
  const { areaCounts, totalCount } = await getAustinProperties()

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is owner financing better than rent to own in Austin?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! With owner financing in Austin, you get immediate ownership and build equity from day one. Rent to own requires years of renting before you can purchase. Owner financing gives you the deed right away with seller-held financing."
        }
      },
      {
        "@type": "Question",
        "name": "Can I get owner financing with bad credit in Austin?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Many Austin sellers offering owner financing are flexible with credit requirements. While some properties require credit checks, approximately 30% have no credit requirements and 50% work with buyers who have credit challenges."
        }
      },
      {
        "@type": "Question",
        "name": "What areas in Austin offer owner financed homes?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Owner financed homes are available throughout Austin including Downtown, South Austin, East Austin, Westlake, Cedar Park, and Round Rock."
        }
      },
      {
        "@type": "Question",
        "name": "How much down payment is needed for Austin owner financing?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Down payments in Austin typically range from 12% to 22% of the purchase price. The city's tech boom has increased values, but owner financing still offers accessible entry points."
        }
      }
    ]
  }

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "OwnerFi Austin - Owner Financed Homes",
    "description": "Find owner financed homes throughout Austin. Better than rent to own with immediate ownership.",
    "url": "https://ownerfi.ai/austin-owner-financing",
    "areaServed": {
      "@type": "City",
      "name": "Austin",
      "containsPlace": [
        { "@type": "Neighborhood", "name": "Downtown Austin" },
        { "@type": "Neighborhood", "name": "South Austin" },
        { "@type": "Neighborhood", "name": "East Austin" },
        { "@type": "Neighborhood", "name": "Westlake" },
        { "@type": "Neighborhood", "name": "Cedar Park" }
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
              <li className="text-slate-900 font-medium">Austin</li>
            </ol>
          </nav>

          {/* Hero Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Owner Financing Austin - Better Than Rent to Own
            </h1>
            <p className="text-xl text-slate-700 mb-8">
              Find {totalCount > 0 ? `${totalCount}+ ` : ''}owner financed homes across the Live Music Capital.
              Skip the banks and get immediate ownership with seller financing in Downtown, South Austin, East Austin, and beyond.
              Keep Austin weird with owner financing that makes homeownership accessible in Texas's tech and cultural hub.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                <h3 className="font-bold text-green-900 mb-2">Immediate Austin Ownership</h3>
                <p className="text-green-800">Get the deed right away, unlike rent to own</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-6 rounded-xl border border-purple-200">
                <h3 className="font-bold text-purple-900 mb-2">Tech Hub</h3>
                <p className="text-purple-800">Silicon Hills, major tech companies</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-orange-50 p-6 rounded-xl border border-red-200">
                <h3 className="font-bold text-red-900 mb-2">Keep Austin Weird</h3>
                <p className="text-red-800">Live music, food trucks, culture</p>
              </div>
            </div>

            <Link href="/signup">
              <button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 shadow-lg">
                Browse Austin Properties →
              </button>
            </Link>
          </div>

          {/* Austin Areas Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Owner Financed Homes by Austin Area
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
                <h3 className="text-xl font-bold text-blue-900 mb-2">
                  Downtown Austin
                </h3>
                <p className="text-blue-700 mb-2">
                  {areaCounts['Downtown Austin'] || 'Urban'} owner financed properties
                </p>
                <p className="text-sm text-blue-600 mb-3">
                  6th Street, Rainey Street, high-rise condos
                </p>
                <p className="text-xs text-blue-500">
                  Nightlife, live music venues, urban living
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-green-50 to-teal-50 rounded-xl border-2 border-green-200">
                <h3 className="text-xl font-bold text-green-900 mb-2">
                  South Austin
                </h3>
                <p className="text-green-700 mb-2">
                  {areaCounts['South Austin'] || 'Eclectic'} properties with seller financing
                </p>
                <p className="text-sm text-green-600 mb-3">
                  South Lamar, food trailers, Keep Austin Weird
                </p>
                <p className="text-xs text-green-500">
                  Quirky culture, local businesses, authentic Austin
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
                <h3 className="text-xl font-bold text-purple-900 mb-2">
                  East Austin
                </h3>
                <p className="text-purple-700 mb-2">
                  {areaCounts['East Austin'] || 'Hip'} homes with owner financing
                </p>
                <p className="text-sm text-purple-600 mb-3">
                  Music venues, art studios, trendy restaurants
                </p>
                <p className="text-xs text-purple-500">
                  Gentrifying area, creative scene, live music
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border-2 border-yellow-200">
                <h3 className="text-xl font-bold text-yellow-900 mb-2">
                  Westlake
                </h3>
                <p className="text-yellow-700 mb-2">
                  {areaCounts['Westlake'] || 'Upscale'} owner financed properties
                </p>
                <p className="text-sm text-yellow-600 mb-3">
                  Lake Austin, luxury homes, excellent schools
                </p>
                <p className="text-xs text-yellow-500">
                  Prestigious area, lakefront living, family-friendly
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border-2 border-red-200">
                <h3 className="text-xl font-bold text-red-900 mb-2">
                  Cedar Park
                </h3>
                <p className="text-red-700 mb-2">
                  {areaCounts['Cedar Park'] || 'Suburban'} rent to own alternatives
                </p>
                <p className="text-sm text-red-600 mb-3">
                  Family neighborhoods, new developments, schools
                </p>
                <p className="text-xs text-red-500">
                  Suburban feel, growing area, family-oriented
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border-2 border-cyan-200">
                <h3 className="text-xl font-bold text-cyan-900 mb-2">
                  University Area
                </h3>
                <p className="text-cyan-700 mb-2">
                  {areaCounts['University'] || 'Student'} properties available
                </p>
                <p className="text-sm text-cyan-600 mb-3">
                  UT campus, student housing, young demographics
                </p>
                <p className="text-xs text-cyan-500">
                  University lifestyle, Longhorn sports, academic
                </p>
              </div>
            </div>

            {/* Popular Austin Areas */}
            <div className="border-t pt-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-4">
                More Austin Areas with Owner Financing
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-700">
                {['Round Rock', 'Pflugerville', 'Leander', 'Georgetown', 'Buda', 'Kyle',
                  'Lakeway', 'Bee Cave', 'Dripping Springs', 'Manchaca', 'Oak Hill', 'Tarrytown',
                  'Zilker', 'Clarksville', 'Hyde Park', 'Mueller', 'North Austin', 'West Austin'].map(area => (
                  <span key={area} className="text-sm hover:text-indigo-600">
                    {area}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Why Owner Financing in Austin */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              Why Choose Owner Financing in Austin?
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Austin Real Estate Advantages
                </h3>
                <ul className="space-y-3 text-slate-700">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Major tech hub with Silicon Hills companies</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>No state income tax in Texas</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Live music capital with vibrant culture</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>University of Texas and educated workforce</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Owner financing makes tech boom accessible</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Owner Financing vs Rent to Own in Austin
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

          {/* Nearby Cities */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              Nearby Cities with Owner Financing
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: 'San Antonio, TX', slug: 'san-antonio-owner-financing' },
                { name: 'Houston, TX', slug: 'houston-owner-financing' },
                { name: 'Dallas, TX', slug: 'dallas-owner-financing' },
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
              Austin Owner Financing FAQ
            </h2>

            <div className="space-y-6">
              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Is owner financing legal in Austin?
                </h3>
                <p className="text-slate-700">
                  Yes, owner financing is completely legal in Austin. The city follows Texas state laws governing
                  seller financing through warranty deeds, deeds of trust, and promissory notes.
                  Travis County Clerk handles property transfers and recording requirements.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  What credit score do I need for owner financing in Austin?
                </h3>
                <p className="text-slate-700">
                  Credit requirements vary by seller. Approximately 30% of our Austin properties have
                  no credit check requirements, 50% work with buyers who have credit challenges,
                  and 20% prefer good credit. Tech workers and entrepreneurs often have unique income patterns
                  that sellers understand and accommodate.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  How much down payment is typical for Austin owner financing?
                </h3>
                <p className="text-slate-700">
                  Down payments typically range from 12% to 22% of the purchase price in Austin.
                  The tech boom has increased property values, but owner financing still offers accessible entry points.
                  Areas like East Austin may have more flexible terms. The average is around 17%.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Can I use owner financing for Austin investment properties?
                </h3>
                <p className="text-slate-700">
                  Yes! Many Austin sellers offer owner financing for investment properties.
                  The city's population growth and tech boom create strong rental demand.
                  Properties near UT, downtown, and tech corridors are particularly attractive to investors.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl shadow-xl p-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Start Your Austin Homeownership Journey Today
            </h2>
            <p className="text-xl mb-8 text-purple-100">
              Better than rent to own - get immediate ownership with owner financing
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <button className="bg-white text-purple-600 px-8 py-4 rounded-xl font-semibold hover:bg-purple-50 transition-all">
                  Search Austin Properties
                </button>
              </Link>
              <Link href="/how-owner-finance-works">
                <button className="bg-purple-500 text-white px-8 py-4 rounded-xl font-semibold hover:bg-purple-400 transition-all">
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