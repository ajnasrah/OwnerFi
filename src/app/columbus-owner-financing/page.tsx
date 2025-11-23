import { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export const metadata: Metadata = {
  title: 'Owner Financing Columbus | Rent to Own Alternative OH | Downtown, Short North | OwnerFi',
  description: 'Find owner financed homes in Columbus - better than rent to own! Immediate ownership in Downtown, Short North, German Village. No banks needed. Flexible credit options.',
  keywords: 'owner financing columbus, owner financed homes columbus, rent to own columbus, rent to own ohio, seller financing columbus, no credit check homes columbus, bad credit homes columbus, columbus real estate owner financing',
  openGraph: {
    title: 'Owner Financed Homes in Columbus - Better Than Rent to Own | OwnerFi',
    description: 'Skip the banks! Find owner financed properties across Columbus with immediate ownership. Serving Downtown, Short North, German Village and more.',
    url: 'https://ownerfi.ai/columbus-owner-financing',
    siteName: 'OwnerFi',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Owner Financing Columbus - Better Than Rent to Own',
    description: 'Find owner financed homes across Columbus. Immediate ownership, no banks needed.',
  },
  alternates: {
    canonical: 'https://ownerfi.ai/columbus-owner-financing',
  }
}

async function getColumbusProperties() {
  try {
    const propertiesRef = collection(db, 'properties')
    const q = query(
      propertiesRef,
      where('isActive', '==', true),
      where('city', 'in', ['Columbus', 'Downtown', 'Short North', 'German Village', 'Clintonville', 'Grandview'])
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
    console.error('Error fetching Columbus properties:', error)
    return { areaCounts: {}, totalCount: 0 }
  }
}

export default async function OwnerFinancingColumbus() {
  const { areaCounts, totalCount } = await getColumbusProperties()

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is owner financing better than rent to own in Columbus?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! With owner financing in Columbus, you get immediate ownership and build equity from day one. Rent to own requires years of renting before you can purchase. Owner financing gives you the deed right away with seller-held financing."
        }
      },
      {
        "@type": "Question",
        "name": "Can I get owner financing with bad credit in Columbus?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Many Columbus sellers offering owner financing are flexible with credit requirements. While some properties require credit checks, approximately 30% have no credit requirements and 50% work with buyers who have credit challenges."
        }
      },
      {
        "@type": "Question",
        "name": "What neighborhoods in Columbus offer owner financed homes?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Owner financed homes are available throughout Columbus including Downtown, Short North, German Village, Clintonville, Grandview, and more."
        }
      },
      {
        "@type": "Question",
        "name": "How much down payment is needed for Columbus owner financing?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Down payments in Columbus typically range from 10% to 20% of the purchase price. Ohio's market makes owner financing accessible with reasonable terms."
        }
      }
    ]
  }

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "OwnerFi Columbus - Owner Financed Homes",
    "description": "Find owner financed homes throughout Columbus. Better than rent to own with immediate ownership.",
    "url": "https://ownerfi.ai/columbus-owner-financing",
    "areaServed": {
      "@type": "City",
      "name": "Columbus",
      "containsPlace": [
        { "@type": "Neighborhood", "name": "Downtown" },
        { "@type": "Neighborhood", "name": "Short North" },
        { "@type": "Neighborhood", "name": "German Village" },
        { "@type": "Neighborhood", "name": "Clintonville" },
        { "@type": "Neighborhood", "name": "Grandview" }
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
              <li><Link href="/owner-financing-ohio" className="hover:text-indigo-600">Ohio</Link></li>
              <li>/</li>
              <li className="text-slate-900 font-medium">Columbus</li>
            </ol>
          </nav>

          {/* Hero Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Owner Financing Columbus - Better Than Rent to Own
            </h1>
            <p className="text-xl text-slate-700 mb-8">
              Find {totalCount > 0 ? `${totalCount}+ ` : ''}owner financed homes across Ohio Capital.
              Skip the banks and get immediate ownership with seller financing in Downtown, Short North, German Village, and beyond.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                <h3 className="font-bold text-green-900 mb-2">Immediate Columbus Ownership</h3>
                <p className="text-green-800">Get the deed right away, unlike rent to own</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-pink-50 p-6 rounded-xl border border-red-200">
                <h3 className="font-bold text-red-900 mb-2">Ohio Capital</h3>
                <p className="text-red-800">Premium location, great lifestyle</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-200">
                <h3 className="font-bold text-purple-900 mb-2">Flexible Terms</h3>
                <p className="text-purple-800">Bad credit OK, low down payments</p>
              </div>
            </div>

            <Link href="/auth">
              <button className="bg-gradient-to-r from-red-600 to-pink-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-red-700 hover:to-pink-700 transition-all transform hover:scale-105 shadow-lg">
                Browse Columbus Properties →
              </button>
            </Link>
          </div>

          {/* Call to Action Section */}
          <section className="py-12 px-6 bg-gradient-to-r from-red-900/30 to-pink-900/30 rounded-2xl mb-12">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                Ready to Find Your Columbus Home?
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Browse owner financed and rent-to-own properties across Columbus.
                No banks needed, flexible terms available.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth">
                  <button className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg hover:shadow-xl">
                    🏠 Browse Columbus Properties
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

          {/* Columbus Neighborhoods Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Owner Financed Homes by Columbus Neighborhood
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
                  Short North
                </h3>
                <p className="text-blue-700 mb-2">
                  {areaCounts['Short North'] || 'Premium'} owner financed properties
                </p>
                <p className="text-sm text-blue-600 mb-3">
                  Great neighborhood with owner financing options
                </p>
              </div>
              <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-50 rounded-xl border-2 border-purple-200">
                <h3 className="text-xl font-bold text-purple-900 mb-2">
                  German Village
                </h3>
                <p className="text-purple-700 mb-2">
                  {areaCounts['German Village'] || 'Premium'} owner financed properties
                </p>
                <p className="text-sm text-purple-600 mb-3">
                  Great neighborhood with owner financing options
                </p>
              </div>
              <div className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-50 rounded-xl border-2 border-emerald-200">
                <h3 className="text-xl font-bold text-emerald-900 mb-2">
                  Clintonville
                </h3>
                <p className="text-emerald-700 mb-2">
                  {areaCounts['Clintonville'] || 'Premium'} owner financed properties
                </p>
                <p className="text-sm text-emerald-600 mb-3">
                  Great neighborhood with owner financing options
                </p>
              </div>
              <div className="p-6 bg-gradient-to-br from-teal-50 to-teal-50 rounded-xl border-2 border-teal-200">
                <h3 className="text-xl font-bold text-teal-900 mb-2">
                  Grandview
                </h3>
                <p className="text-teal-700 mb-2">
                  {areaCounts['Grandview'] || 'Premium'} owner financed properties
                </p>
                <p className="text-sm text-teal-600 mb-3">
                  Great neighborhood with owner financing options
                </p>
              </div>
            </div>
          </div>

          {/* Why Owner Financing in Columbus */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              Why Choose Owner Financing in Columbus?
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Columbus Real Estate Advantages
                </h3>
                <ul className="space-y-3 text-slate-700">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Great location and lifestyle in Columbus</span>
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
                  Owner Financing vs Rent to Own in Columbus
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-2">Owner Financing ✓</h4>
                    <p className="text-green-800 text-sm">
                      Immediate ownership with deed transfer. Build equity from day one.
                      Ohio property tax benefits. Protected by state property laws.
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <h4 className="font-semibold text-red-900 mb-2">Rent to Own ✗</h4>
                    <p className="text-red-800 text-sm">
                      Years of renting before ownership. No equity during rental period.
                      Risk of losing option fee. Treated as tenant under Ohio law.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Columbus Owner Financing FAQ
            </h2>

            <div className="space-y-6">
              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Is owner financing legal in Columbus?
                </h3>
                <p className="text-slate-700">
                  Yes, owner financing is completely legal in Columbus. The city follows Ohio state laws governing
                  seller financing through warranty deeds, mortgages, and promissory notes.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  What credit score do I need for owner financing in Columbus?
                </h3>
                <p className="text-slate-700">
                  Credit requirements vary by seller. Approximately 30% of our Columbus properties have
                  no credit check requirements, 50% work with buyers who have credit challenges,
                  and 20% prefer good credit.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  How much down payment is typical for Columbus owner financing?
                </h3>
                <p className="text-slate-700">
                  Down payments typically range from 10% to 20% of the purchase price in Columbus.
                  The average is around 15%, making homeownership more accessible than traditional financing.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Can I use owner financing for Columbus investment properties?
                </h3>
                <p className="text-slate-700">
                  Yes! Many Columbus sellers offer owner financing for investment properties.
                  The city's market creates opportunities for real estate investors.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-red-600 to-pink-600 rounded-2xl shadow-xl p-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Start Your Columbus Homeownership Journey Today
            </h2>
            <p className="text-xl mb-8 text-red-100">
              Better than rent to own - get immediate ownership with owner financing
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth">
                <button className="bg-white text-red-600 px-8 py-4 rounded-xl font-semibold hover:bg-red-50 transition-all">
                  Search Columbus Properties
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
