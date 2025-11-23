import { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export const metadata: Metadata = {
  title: 'Owner Financing Georgia | Rent to Own Alternative | Atlanta, Savannah & More | OwnerFi',
  description: 'Find owner financed homes in Georgia - better than rent to own! Immediate ownership in Atlanta, Savannah, Augusta, Columbus. No banks needed. Flexible credit options available.',
  keywords: 'owner financing georgia, owner financed homes georgia, rent to own homes georgia, rent to own atlanta, owner financing atlanta, seller financing georgia, no credit check homes georgia, bad credit homes georgia, georgia real estate owner financing',
  openGraph: {
    title: 'Owner Financed Homes in Georgia - Better Than Rent to Own | OwnerFi',
    description: 'Skip the banks! Find owner financed properties across Georgia with immediate ownership. Serving Atlanta, Savannah, Augusta, Columbus and more.',
    url: 'https://ownerfi.ai/owner-financing-georgia',
    siteName: 'OwnerFi',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Owner Financing Georgia - Better Than Rent to Own',
    description: 'Find owner financed homes across Georgia. Immediate ownership, no banks needed.',
  },
  alternates: {
    canonical: 'https://ownerfi.ai/owner-financing-georgia',
  }
}

async function getGeorgiaProperties() {
  try {
    const propertiesRef = collection(db, 'properties')
    const q = query(
      propertiesRef,
      where('isActive', '==', true),
      where('state', 'in', ['Georgia', 'GA'])
    )
    const snapshot = await getDocs(q)

    const cityCounts: Record<string, number> = {}
    let totalCount = 0

    snapshot.docs.forEach(doc => {
      const data = doc.data()
      const city = data.city || ''
      if (city) {
        cityCounts[city] = (cityCounts[city] || 0) + 1
        totalCount++
      }
    })

    return { cityCounts, totalCount }
  } catch (error) {
    console.error('Error fetching Georgia properties:', error)
    return { cityCounts: {}, totalCount: 0 }
  }
}

export default async function OwnerFinancingGeorgia() {
  const { cityCounts, totalCount } = await getGeorgiaProperties()
  const cities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is owner financing better than rent to own in Georgia?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! With owner financing in Georgia, you get immediate ownership and build equity from day one. Rent to own requires years of renting before you can purchase. Owner financing gives you the deed right away with seller-held financing."
        }
      },
      {
        "@type": "Question",
        "name": "Can I get owner financing with bad credit in Georgia?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Many Georgia sellers offering owner financing are flexible with credit requirements. While some properties require credit checks, approximately 30% have no credit requirements and 50% work with buyers who have credit challenges."
        }
      },
      {
        "@type": "Question",
        "name": "What cities in Georgia offer owner financed homes?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Owner financed homes are available throughout Georgia including Atlanta, Savannah, Augusta, Columbus, Macon, Athens, Sandy Springs, Roswell, Albany, Johns Creek, Warner Robins, and Alpharetta."
        }
      },
      {
        "@type": "Question",
        "name": "How does owner financing work in Georgia?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "In Georgia, the seller acts as the bank, providing financing directly to you. You'll sign a promissory note and receive the deed. Georgia law protects both buyers and sellers in owner financing transactions through proper recording and title transfer requirements."
        }
      }
    ]
  }

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "OwnerFi Georgia - Owner Financed Homes",
    "description": "Find owner financed homes throughout Georgia. Better than rent to own with immediate ownership.",
    "url": "https://ownerfi.ai/owner-financing-georgia",
    "areaServed": {
      "@type": "State",
      "name": "Georgia",
      "containsPlace": [
        { "@type": "City", "name": "Atlanta" },
        { "@type": "City", "name": "Savannah" },
        { "@type": "City", "name": "Augusta" },
        { "@type": "City", "name": "Columbus" },
        { "@type": "City", "name": "Macon" }
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
              <li className="text-slate-900 font-medium">Georgia</li>
            </ol>
          </nav>

          {/* Hero Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Owner Financing Georgia - Better Than Rent to Own
            </h1>
            <p className="text-xl text-slate-700 mb-8">
              Find {totalCount > 0 ? `${totalCount}+ ` : ''}owner financed homes across the Peach State.
              Skip the banks and get immediate ownership with seller financing.
              From Atlanta's metro area to Savannah's historic district, we have properties with flexible terms.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                <h3 className="font-bold text-green-900 mb-2">Immediate Ownership</h3>
                <p className="text-green-800">Get the deed right away, unlike rent to own</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                <h3 className="font-bold text-blue-900 mb-2">No Banks Required</h3>
                <p className="text-blue-800">Deal directly with property owners</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-200">
                <h3 className="font-bold text-purple-900 mb-2">Flexible Credit</h3>
                <p className="text-purple-800">Many sellers work with all credit situations</p>
              </div>
            </div>

            <Link href="/auth">
              <button className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg">
                Browse Georgia Properties →
              </button>
            </Link>
          </div>

          {/* Call to Action Section */}
          <section className="py-12 px-6 bg-gradient-to-r from-emerald-900/30 to-blue-900/30 rounded-2xl mb-12">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                Ready to Find Your Georgia Home?
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Browse owner financed and rent-to-own properties across Georgia.
                No banks needed, flexible terms available.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth">
                  <button className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg hover:shadow-xl">
                    🏠 Browse Georgia Properties
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

          {/* Cities Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Owner Financed Homes by Georgia City
            </h2>

            {/* Major Cities Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <Link href="/atlanta" className="group">
                <div className="p-6 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border-2 border-red-200 hover:border-red-400 transition-all hover:shadow-lg">
                  <h3 className="text-xl font-bold text-red-900 mb-2 group-hover:text-red-700">
                    Atlanta
                  </h3>
                  <p className="text-red-700">
                    {cityCounts['Atlanta'] || 'Multiple'} owner financed properties in Georgia's capital
                  </p>
                  <p className="text-sm mt-2 text-red-600">
                    Rent to own alternative in Buckhead, Midtown, Downtown
                  </p>
                </div>
              </Link>

              <Link href="/savannah" className="group">
                <div className="p-6 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl border-2 border-teal-200 hover:border-teal-400 transition-all hover:shadow-lg">
                  <h3 className="text-xl font-bold text-teal-900 mb-2 group-hover:text-teal-700">
                    Savannah
                  </h3>
                  <p className="text-teal-700">
                    {cityCounts['Savannah'] || 'Multiple'} properties in this historic coastal city
                  </p>
                  <p className="text-sm mt-2 text-teal-600">
                    Owner financing near River Street & Forsyth Park
                  </p>
                </div>
              </Link>

              <Link href="/augusta" className="group">
                <div className="p-6 bg-gradient-to-br from-green-50 to-lime-50 rounded-xl border-2 border-green-200 hover:border-green-400 transition-all hover:shadow-lg">
                  <h3 className="text-xl font-bold text-green-900 mb-2 group-hover:text-green-700">
                    Augusta
                  </h3>
                  <p className="text-green-700">
                    {cityCounts['Augusta'] || 'Find'} homes with seller financing
                  </p>
                  <p className="text-sm mt-2 text-green-600">
                    Home of the Masters Tournament
                  </p>
                </div>
              </Link>

              <Link href="/columbus" className="group">
                <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 hover:border-blue-400 transition-all hover:shadow-lg">
                  <h3 className="text-xl font-bold text-blue-900 mb-2 group-hover:text-blue-700">
                    Columbus
                  </h3>
                  <p className="text-blue-700">
                    {cityCounts['Columbus'] || 'Browse'} owner financed properties
                  </p>
                  <p className="text-sm mt-2 text-blue-600">
                    Near Fort Benning military base
                  </p>
                </div>
              </Link>

              <Link href="/macon" className="group">
                <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200 hover:border-purple-400 transition-all hover:shadow-lg">
                  <h3 className="text-xl font-bold text-purple-900 mb-2 group-hover:text-purple-700">
                    Macon
                  </h3>
                  <p className="text-purple-700">
                    {cityCounts['Macon'] || 'Discover'} rent to own alternatives
                  </p>
                  <p className="text-sm mt-2 text-purple-600">
                    Central Georgia's affordable housing market
                  </p>
                </div>
              </Link>

              <Link href="/athens" className="group">
                <div className="p-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border-2 border-red-200 hover:border-red-400 transition-all hover:shadow-lg">
                  <h3 className="text-xl font-bold text-red-900 mb-2 group-hover:text-red-700">
                    Athens
                  </h3>
                  <p className="text-red-700">
                    {cityCounts['Athens'] || 'View'} properties near UGA
                  </p>
                  <p className="text-sm mt-2 text-red-600">
                    College town with investment opportunities
                  </p>
                </div>
              </Link>
            </div>

            {/* Additional Cities */}
            <div className="border-t pt-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-4">
                More Georgia Cities with Owner Financing
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-700">
                {['Sandy Springs', 'Roswell', 'Albany', 'Johns Creek', 'Warner Robins', 'Alpharetta',
                  'Marietta', 'Valdosta', 'Smyrna', 'Dunwoody', 'Peachtree City', 'Gainesville',
                  'Rome', 'Dalton', 'Kennesaw', 'Lawrenceville', 'Decatur', 'Tucker'].map(city => (
                  <Link key={city} href={`/${city.toLowerCase().replace(' ', '-')}`} className="hover:text-indigo-600 hover:underline">
                    {city}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Why Owner Financing in Georgia */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              Why Choose Owner Financing in Georgia?
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Georgia Real Estate Advantages
                </h3>
                <ul className="space-y-3 text-slate-700">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Growing tech hub in Atlanta with job opportunities</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Affordable cost of living compared to other Southeast metros</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Strong military presence with multiple bases</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Film industry boom creating housing demand</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Historic properties perfect for owner financing</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Owner Financing vs Rent to Own in Georgia
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-2">Owner Financing ✓</h4>
                    <p className="text-green-800 text-sm">
                      Immediate ownership with deed transfer. Build equity from day one.
                      Tax benefits as a homeowner. Protected by Georgia property laws.
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <h4 className="font-semibold text-red-900 mb-2">Rent to Own ✗</h4>
                    <p className="text-red-800 text-sm">
                      Years of renting before ownership. No equity during rental period.
                      Risk of losing option fee. Treated as tenant under Georgia law.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Georgia Market Insights */}
          <div className="bg-gradient-to-br from-peach-50 to-orange-50 rounded-2xl shadow-xl p-8 mb-12 border border-orange-200">
            <h2 className="text-3xl font-bold text-orange-900 mb-6">
              Georgia Housing Market & Owner Financing Opportunities
            </h2>

            <div className="grid md:grid-cols-3 gap-6 text-orange-800">
              <div>
                <h3 className="font-semibold text-orange-900 mb-3">Atlanta Metro</h3>
                <p className="text-sm">
                  Booming tech sector with companies like NCR, Mailchimp, and Microsoft expanding.
                  Owner financing helps buyers enter this competitive market without traditional lending.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-orange-900 mb-3">Coastal Georgia</h3>
                <p className="text-sm">
                  Savannah and Brunswick offer historic charm and tourism economy.
                  Many older properties perfect for owner financing arrangements.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-orange-900 mb-3">North Georgia Mountains</h3>
                <p className="text-sm">
                  Blue Ridge and Dahlonega attract retirees and vacation home buyers.
                  Sellers often prefer owner financing for tax advantages.
                </p>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Georgia Owner Financing FAQ
            </h2>

            <div className="space-y-6">
              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Is owner financing legal in Georgia?
                </h3>
                <p className="text-slate-700">
                  Yes, owner financing is completely legal in Georgia. The state has clear laws governing
                  seller financing through warranty deeds, security deeds, and promissory notes.
                  Georgia Code Title 44 covers property transfers and financing arrangements.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  What credit score do I need for owner financing in Georgia?
                </h3>
                <p className="text-slate-700">
                  Credit requirements vary by seller. Approximately 30% of our Georgia properties have
                  no credit check requirements, 50% work with buyers who have credit challenges,
                  and 20% prefer good credit. Each seller sets their own terms based on down payment
                  and other factors.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  How much down payment is typical for Georgia owner financing?
                </h3>
                <p className="text-slate-700">
                  Down payments typically range from 5% to 20% of the purchase price. Some sellers
                  in rural Georgia areas may accept lower down payments, while premium properties
                  in Atlanta metro may require more. The average is around 10-15%.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Can I use owner financing for investment properties in Georgia?
                </h3>
                <p className="text-slate-700">
                  Yes! Many Georgia sellers offer owner financing for investment properties.
                  This is especially common in college towns like Athens and military areas
                  like Columbus where rental demand is strong. Terms may vary from primary residences.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl p-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Start Your Georgia Homeownership Journey Today
            </h2>
            <p className="text-xl mb-8 text-indigo-100">
              Better than rent to own - get immediate ownership with owner financing
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth">
                <button className="bg-white text-indigo-600 px-8 py-4 rounded-xl font-semibold hover:bg-indigo-50 transition-all">
                  Search Georgia Properties
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