import { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export const metadata: Metadata = {
  title: 'Owner Financing Orlando | Rent to Own Alternative FL | Downtown, Winter Park | OwnerFi',
  description: 'Find owner financed homes in Orlando - better than rent to own! Immediate ownership in Downtown, Winter Park, College Park. No banks needed. Flexible credit options.',
  keywords: 'owner financing orlando, owner financed homes orlando, rent to own orlando, rent to own florida, seller financing orlando, no credit check homes orlando, bad credit homes orlando, orlando real estate owner financing',
  openGraph: {
    title: 'Owner Financed Homes in Orlando - Better Than Rent to Own | OwnerFi',
    description: 'Skip the banks! Find owner financed properties across Orlando with immediate ownership. Serving Downtown, Winter Park, College Park and more.',
    url: 'https://ownerfi.ai/orlando-owner-financing',
    siteName: 'OwnerFi',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Owner Financing Orlando - Better Than Rent to Own',
    description: 'Find owner financed homes across Orlando. Immediate ownership, no banks needed.',
  },
  alternates: {
    canonical: 'https://ownerfi.ai/orlando-owner-financing',
  }
}

async function getOrlandoProperties() {
  try {
    const propertiesRef = collection(db, 'properties')
    const q = query(
      propertiesRef,
      where('isActive', '==', true),
      where('city', 'in', ['Orlando', 'Downtown', 'Winter Park', 'College Park', 'Thornton Park', 'Lake Nona'])
    )
    const snapshot = await getDocs(q)

    const areaCounts: Record<string, number> = {}
    let totalCount = 0

    snapshot.docs.forEach(doc => {
      const data = doc.data()
      const cityName = data.city || ''
      if (cityName) {
        areaCounts[cityName] = (areaCounts[cityName] || 0) + 1
        totalCount++
      }
    })

    return { areaCounts, totalCount }
  } catch (error) {
    console.error('Error fetching Orlando properties:', error)
    return { areaCounts: {}, totalCount: 0 }
  }
}

export default async function OwnerFinancingOrlando() {
  const { areaCounts, totalCount } = await getOrlandoProperties()

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is owner financing better than rent to own in Orlando?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! With owner financing in Orlando, you get immediate ownership and build equity from day one. Rent to own requires years of renting before you can purchase. Owner financing gives you the deed right away with seller-held financing."
        }
      },
      {
        "@type": "Question",
        "name": "Can I get owner financing with bad credit in Orlando?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Many Orlando sellers offering owner financing are flexible with credit requirements. While some properties require credit checks, approximately 30% have no credit requirements and 50% work with buyers who have credit challenges."
        }
      },
      {
        "@type": "Question",
        "name": "What neighborhoods in Orlando offer owner financed homes?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Owner financed homes are available throughout Orlando including Downtown, Winter Park, College Park, Thornton Park, Lake Nona, and more."
        }
      },
      {
        "@type": "Question",
        "name": "How much down payment is needed for Orlando owner financing?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Down payments in Orlando typically range from 10% to 20% of the purchase price. Florida's market makes owner financing accessible with reasonable terms."
        }
      }
    ]
  }

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "OwnerFi Orlando - Owner Financed Homes",
    "description": "Find owner financed homes throughout Orlando. Better than rent to own with immediate ownership.",
    "url": "https://ownerfi.ai/orlando-owner-financing",
    "areaServed": {
      "@type": "City",
      "name": "Orlando",
      "containsPlace": [
        { "@type": "Neighborhood", "name": "Downtown" },
        { "@type": "Neighborhood", "name": "Winter Park" },
        { "@type": "Neighborhood", "name": "College Park" },
        { "@type": "Neighborhood", "name": "Thornton Park" },
        { "@type": "Neighborhood", "name": "Lake Nona" }
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
              <li className="text-slate-900 font-medium">Orlando</li>
            </ol>
          </nav>

          {/* Hero Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Owner Financing Orlando - Better Than Rent to Own
            </h1>
            <p className="text-xl text-slate-700 mb-8">
              Find {totalCount > 0 ? `${totalCount}+ ` : ''}owner financed homes across Theme Park Capital.
              Skip the banks and get immediate ownership with seller financing in Downtown, Winter Park, College Park, and beyond.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                <h3 className="font-bold text-green-900 mb-2">Immediate Orlando Ownership</h3>
                <p className="text-green-800">Get the deed right away, unlike rent to own</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-200">
                <h3 className="font-bold text-purple-900 mb-2">Theme Park Capital</h3>
                <p className="text-purple-800">Premium location, great lifestyle</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-200">
                <h3 className="font-bold text-purple-900 mb-2">Flexible Terms</h3>
                <p className="text-purple-800">Bad credit OK, low down payments</p>
              </div>
            </div>

            <Link href="/signup">
              <button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 shadow-lg">
                Browse Orlando Properties →
              </button>
            </Link>
          </div>

          {/* Call to Action Section */}
          <section className="py-12 px-6 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-2xl mb-12">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                Ready to Find Your Orlando Home?
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Browse owner financed and rent-to-own properties across Orlando.
                No banks needed, flexible terms available.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup">
                  <button className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg hover:shadow-xl">
                    🏠 Browse Orlando Properties
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

          {/* Orlando Neighborhoods Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Owner Financed Homes by Orlando Neighborhood
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="p-6 bg-gradient-to-br from-cyan-50 to-cyan-50 rounded-xl border-2 border-cyan-200">
                <h3 className="text-xl font-bold text-cyan-900 mb-2">
                  Downtown
                </h3>
                <p className="text-cyan-700 mb-2">
                  {areaCounts['Downtown'] || 'Premium'} owner financed properties
                </p>
                <p className="text-sm text-cyan-600 mb-3">
                  Great neighborhood with owner financing options
                </p>
              </div>
              <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-50 rounded-xl border-2 border-blue-200">
                <h3 className="text-xl font-bold text-blue-900 mb-2">
                  Winter Park
                </h3>
                <p className="text-blue-700 mb-2">
                  {areaCounts['Winter Park'] || 'Premium'} owner financed properties
                </p>
                <p className="text-sm text-blue-600 mb-3">
                  Great neighborhood with owner financing options
                </p>
              </div>
              <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-50 rounded-xl border-2 border-purple-200">
                <h3 className="text-xl font-bold text-purple-900 mb-2">
                  College Park
                </h3>
                <p className="text-purple-700 mb-2">
                  {areaCounts['College Park'] || 'Premium'} owner financed properties
                </p>
                <p className="text-sm text-purple-600 mb-3">
                  Great neighborhood with owner financing options
                </p>
              </div>
              <div className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-50 rounded-xl border-2 border-emerald-200">
                <h3 className="text-xl font-bold text-emerald-900 mb-2">
                  Thornton Park
                </h3>
                <p className="text-emerald-700 mb-2">
                  {areaCounts['Thornton Park'] || 'Premium'} owner financed properties
                </p>
                <p className="text-sm text-emerald-600 mb-3">
                  Great neighborhood with owner financing options
                </p>
              </div>
              <div className="p-6 bg-gradient-to-br from-teal-50 to-teal-50 rounded-xl border-2 border-teal-200">
                <h3 className="text-xl font-bold text-teal-900 mb-2">
                  Lake Nona
                </h3>
                <p className="text-teal-700 mb-2">
                  {areaCounts['Lake Nona'] || 'Premium'} owner financed properties
                </p>
                <p className="text-sm text-teal-600 mb-3">
                  Great neighborhood with owner financing options
                </p>
              </div>
            </div>
          </div>

          {/* Why Owner Financing in Orlando */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              Why Choose Owner Financing in Orlando?
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Orlando Real Estate Advantages
                </h3>
                <ul className="space-y-3 text-slate-700">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Great location and lifestyle in Orlando</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Skip traditional bank financing requirements</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Flexible terms with seller financing</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Build equity from day one</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Owner financing makes homeownership accessible</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Owner Financing vs Rent to Own in Orlando
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

          {/* FAQ Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Orlando Owner Financing FAQ
            </h2>

            <div className="space-y-6">
              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Is owner financing legal in Orlando?
                </h3>
                <p className="text-slate-700">
                  Yes, owner financing is completely legal in Orlando. The city follows Florida state laws governing
                  seller financing through warranty deeds, mortgages, and promissory notes.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  What credit score do I need for owner financing in Orlando?
                </h3>
                <p className="text-slate-700">
                  Credit requirements vary by seller. Approximately 30% of our Orlando properties have
                  no credit check requirements, 50% work with buyers who have credit challenges,
                  and 20% prefer good credit.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  How much down payment is typical for Orlando owner financing?
                </h3>
                <p className="text-slate-700">
                  Down payments typically range from 10% to 20% of the purchase price in Orlando.
                  The average is around 15%, making homeownership more accessible than traditional financing.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Can I use owner financing for Orlando investment properties?
                </h3>
                <p className="text-slate-700">
                  Yes! Many Orlando sellers offer owner financing for investment properties.
                  The city's market creates opportunities for real estate investors.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl shadow-xl p-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Start Your Orlando Homeownership Journey Today
            </h2>
            <p className="text-xl mb-8 text-purple-100">
              Better than rent to own - get immediate ownership with owner financing
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <button className="bg-white text-purple-600 px-8 py-4 rounded-xl font-semibold hover:bg-purple-50 transition-all">
                  Search Orlando Properties
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
