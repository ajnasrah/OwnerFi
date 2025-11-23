import { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export const metadata: Metadata = {
  title: 'Owner Financing Dallas | Rent to Own Alternative TX | Uptown, Deep Ellum | OwnerFi',
  description: 'Find owner financed homes in Dallas - better than rent to own! Immediate ownership in Uptown, Deep Ellum, Bishop Arts, Lakewood. No banks needed. Flexible credit options.',
  keywords: 'owner financing dallas, owner financed homes dallas, rent to own dallas, rent to own texas, owner financing uptown dallas, seller financing dallas, no credit check homes dallas, bad credit homes dallas, dallas real estate owner financing',
  openGraph: {
    title: 'Owner Financed Homes in Dallas - Better Than Rent to Own | OwnerFi',
    description: 'Skip the banks! Find owner financed properties across Dallas with immediate ownership. Serving Uptown, Deep Ellum, Bishop Arts and more.',
    url: 'https://ownerfi.ai/dallas-owner-financing',
    siteName: 'OwnerFi',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Owner Financing Dallas - Better Than Rent to Own',
    description: 'Find owner financed homes across Dallas. Immediate ownership, no banks needed.',
  },
  alternates: {
    canonical: 'https://ownerfi.ai/dallas-owner-financing',
  }
}

async function getDallasProperties() {
  try {
    const propertiesRef = collection(db, 'properties')
    const q = query(
      propertiesRef,
      where('isActive', '==', true),
      where('city', 'in', ['Dallas', 'Uptown', 'Deep Ellum', 'Bishop Arts', 'Lakewood', 'Highland Park'])
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
    console.error('Error fetching Dallas properties:', error)
    return { areaCounts: {}, totalCount: 0 }
  }
}

export default async function OwnerFinancingDallas() {
  const { areaCounts, totalCount } = await getDallasProperties()

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is owner financing better than rent to own in Dallas?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! With owner financing in Dallas, you get immediate ownership and build equity from day one. Rent to own requires years of renting before you can purchase. Owner financing gives you the deed right away with seller-held financing."
        }
      },
      {
        "@type": "Question",
        "name": "Can I get owner financing with bad credit in Dallas?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Many Dallas sellers offering owner financing are flexible with credit requirements. While some properties require credit checks, approximately 30% have no credit requirements and 50% work with buyers who have credit challenges."
        }
      },
      {
        "@type": "Question",
        "name": "What neighborhoods in Dallas offer owner financed homes?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Owner financed homes are available throughout Dallas including Uptown, Deep Ellum, Bishop Arts District, Lakewood, Highland Park, and Downtown Dallas."
        }
      },
      {
        "@type": "Question",
        "name": "How much down payment is needed for Dallas owner financing?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Down payments in Dallas typically range from 10% to 20% of the purchase price. Texas's competitive market and Dallas's growth make owner financing accessible with reasonable terms."
        }
      }
    ]
  }

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "OwnerFi Dallas - Owner Financed Homes",
    "description": "Find owner financed homes throughout Dallas. Better than rent to own with immediate ownership.",
    "url": "https://ownerfi.ai/dallas-owner-financing",
    "areaServed": {
      "@type": "City",
      "name": "Dallas",
      "containsPlace": [
        { "@type": "Neighborhood", "name": "Uptown" },
        { "@type": "Neighborhood", "name": "Deep Ellum" },
        { "@type": "Neighborhood", "name": "Bishop Arts" },
        { "@type": "Neighborhood", "name": "Lakewood" },
        { "@type": "Neighborhood", "name": "Highland Park" }
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
              <li className="text-slate-900 font-medium">Dallas</li>
            </ol>
          </nav>

          {/* Hero Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Owner Financing Dallas - Better Than Rent to Own
            </h1>
            <p className="text-xl text-slate-700 mb-8">
              Find {totalCount > 0 ? `${totalCount}+ ` : ''}owner financed homes across the Big D.
              Skip the banks and get immediate ownership with seller financing in Uptown, Deep Ellum, Bishop Arts, and beyond.
              Experience Dallas's booming economy and vibrant culture with owner financing that makes homeownership accessible in Texas's business capital.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                <h3 className="font-bold text-green-900 mb-2">Immediate Dallas Ownership</h3>
                <p className="text-green-800">Get the deed right away, unlike rent to own</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                <h3 className="font-bold text-blue-900 mb-2">Business Hub</h3>
                <p className="text-blue-800">Fortune 500 companies, tech growth</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-orange-50 p-6 rounded-xl border border-red-200">
                <h3 className="font-bold text-red-900 mb-2">No State Tax</h3>
                <p className="text-red-800">Texas has no state income tax</p>
              </div>
            </div>

            <Link href="/auth">
              <button className="bg-gradient-to-r from-blue-600 to-red-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-red-700 transition-all transform hover:scale-105 shadow-lg">
                Browse Dallas Properties →
              </button>
            </Link>
          </div>

          {/* Call to Action Section */}
          <section className="py-12 px-6 bg-gradient-to-r from-emerald-900/30 to-blue-900/30 rounded-2xl mb-12">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                Ready to Find Your Dallas Home?
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Browse owner financed and rent-to-own properties across Dallas.
                No banks needed, flexible terms available.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth">
                  <button className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg hover:shadow-xl">
                    🏠 Browse Dallas Properties
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

          {/* Dallas Neighborhoods Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Owner Financed Homes by Dallas Neighborhood
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
                <h3 className="text-xl font-bold text-blue-900 mb-2">
                  Uptown Dallas
                </h3>
                <p className="text-blue-700 mb-2">
                  {areaCounts['Uptown'] || 'Urban'} owner financed properties
                </p>
                <p className="text-sm text-blue-600 mb-3">
                  High-rise living, McKinney Avenue, trendy restaurants
                </p>
                <p className="text-xs text-blue-500">
                  Young professionals, walkable, luxury apartments
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border-2 border-purple-200">
                <h3 className="text-xl font-bold text-purple-900 mb-2">
                  Deep Ellum
                </h3>
                <p className="text-purple-700 mb-2">
                  {areaCounts['Deep Ellum'] || 'Artistic'} properties with seller financing
                </p>
                <p className="text-sm text-purple-600 mb-3">
                  Live music venues, street art, creative community
                </p>
                <p className="text-xs text-purple-500">
                  Arts district, music scene, bohemian culture
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border-2 border-red-200">
                <h3 className="text-xl font-bold text-red-900 mb-2">
                  Bishop Arts District
                </h3>
                <p className="text-red-700 mb-2">
                  {areaCounts['Bishop Arts'] || 'Trendy'} homes with owner financing
                </p>
                <p className="text-sm text-red-600 mb-3">
                  Boutique shops, local restaurants, historic charm
                </p>
                <p className="text-xs text-red-500">
                  Hip neighborhood, local businesses, walkable
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
                <h3 className="text-xl font-bold text-green-900 mb-2">
                  Lakewood
                </h3>
                <p className="text-green-700 mb-2">
                  {areaCounts['Lakewood'] || 'Historic'} owner financed properties
                </p>
                <p className="text-sm text-green-600 mb-3">
                  White Rock Lake, historic homes, family-friendly
                </p>
                <p className="text-xs text-green-500">
                  Lake activities, established neighborhood, parks
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border-2 border-yellow-200">
                <h3 className="text-xl font-bold text-yellow-900 mb-2">
                  Highland Park
                </h3>
                <p className="text-yellow-700 mb-2">
                  {areaCounts['Highland Park'] || 'Prestigious'} rent to own alternatives
                </p>
                <p className="text-sm text-yellow-600 mb-3">
                  Luxury homes, top schools, exclusive community
                </p>
                <p className="text-xs text-yellow-500">
                  Upscale living, excellent schools, tree-lined streets
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-cyan-50 to-teal-50 rounded-xl border-2 border-cyan-200">
                <h3 className="text-xl font-bold text-cyan-900 mb-2">
                  Downtown Dallas
                </h3>
                <p className="text-cyan-700 mb-2">
                  {areaCounts['Downtown'] || 'Urban'} properties available
                </p>
                <p className="text-sm text-cyan-600 mb-3">
                  Business district, sports venues, city living
                </p>
                <p className="text-xs text-cyan-500">
                  High-rise condos, sports teams, urban amenities
                </p>
              </div>
            </div>

            {/* Popular Dallas Areas */}
            <div className="border-t pt-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-4">
                More Dallas Areas with Owner Financing
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-700">
                {['Plano', 'Frisco', 'Allen', 'McKinney', 'Richardson', 'Garland',
                  'Irving', 'Mesquite', 'Carrollton', 'Grand Prairie', 'Addison', 'Farmers Branch',
                  'Cedar Hill', 'DeSoto', 'Duncanville', 'Lancaster', 'Rowlett', 'Wylie'].map(area => (
                  <span key={area} className="text-sm hover:text-indigo-600">
                    {area}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Why Owner Financing in Dallas */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              Why Choose Owner Financing in Dallas?
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Dallas Real Estate Advantages
                </h3>
                <ul className="space-y-3 text-slate-700">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Major business and technology hub</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>No state income tax in Texas</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Diverse economy and job opportunities</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Growing population and infrastructure</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Owner financing makes homeownership accessible</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Owner Financing vs Rent to Own in Dallas
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
                { name: 'Fort Worth, TX', slug: 'fort-worth-owner-financing' },
                { name: 'Houston, TX', slug: 'houston-owner-financing' },
                { name: 'Austin, TX', slug: 'austin-owner-financing' },
                { name: 'San Antonio, TX', slug: 'san-antonio-owner-financing' }
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
              Dallas Owner Financing FAQ
            </h2>

            <div className="space-y-6">
              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Is owner financing legal in Dallas?
                </h3>
                <p className="text-slate-700">
                  Yes, owner financing is completely legal in Dallas. The city follows Texas state laws governing
                  seller financing through warranty deeds, deeds of trust, and promissory notes.
                  Dallas County Clerk handles property transfers and recording requirements.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  What credit score do I need for owner financing in Dallas?
                </h3>
                <p className="text-slate-700">
                  Credit requirements vary by seller. Approximately 30% of our Dallas properties have
                  no credit check requirements, 50% work with buyers who have credit challenges,
                  and 20% prefer good credit. Tech workers and business professionals often have unique income patterns
                  that sellers understand and accommodate.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  How much down payment is typical for Dallas owner financing?
                </h3>
                <p className="text-slate-700">
                  Down payments typically range from 10% to 20% of the purchase price in Dallas.
                  The city's competitive market offers good value with reasonable down payment requirements.
                  Upscale areas like Highland Park may require higher amounts. The average is around 15%.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Can I use owner financing for Dallas investment properties?
                </h3>
                <p className="text-slate-700">
                  Yes! Many Dallas sellers offer owner financing for investment properties.
                  The city's growing population and business expansion create strong rental demand.
                  Properties near downtown, universities, and business districts are particularly attractive.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-blue-600 to-red-600 rounded-2xl shadow-xl p-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Start Your Dallas Homeownership Journey Today
            </h2>
            <p className="text-xl mb-8 text-blue-100">
              Better than rent to own - get immediate ownership with owner financing
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth">
                <button className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold hover:bg-blue-50 transition-all">
                  Search Dallas Properties
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