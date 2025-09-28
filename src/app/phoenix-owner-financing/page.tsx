import { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export const metadata: Metadata = {
  title: 'Owner Financing Phoenix | Rent to Own Alternative AZ | Scottsdale, Tempe | OwnerFi',
  description: 'Find owner financed homes in Phoenix - better than rent to own! Immediate ownership in Scottsdale, Tempe, Paradise Valley, Downtown. No banks needed. Flexible credit options.',
  keywords: 'owner financing phoenix, owner financed homes phoenix, rent to own phoenix, rent to own arizona, owner financing scottsdale, seller financing phoenix, no credit check homes phoenix, bad credit homes phoenix, phoenix real estate owner financing',
  openGraph: {
    title: 'Owner Financed Homes in Phoenix - Better Than Rent to Own | OwnerFi',
    description: 'Skip the banks! Find owner financed properties across Phoenix with immediate ownership. Serving Scottsdale, Tempe, Paradise Valley and more.',
    url: 'https://ownerfi.ai/phoenix-owner-financing',
    siteName: 'OwnerFi',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Owner Financing Phoenix - Better Than Rent to Own',
    description: 'Find owner financed homes across Phoenix. Immediate ownership, no banks needed.',
  },
  alternates: {
    canonical: 'https://ownerfi.ai/phoenix-owner-financing',
  }
}

async function getPhoenixProperties() {
  try {
    const propertiesRef = collection(db, 'properties')
    const q = query(
      propertiesRef,
      where('isActive', '==', true),
      where('city', 'in', ['Phoenix', 'Scottsdale', 'Tempe', 'Paradise Valley', 'Ahwatukee', 'Camelback'])
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
    console.error('Error fetching Phoenix properties:', error)
    return { areaCounts: {}, totalCount: 0 }
  }
}

export default async function OwnerFinancingPhoenix() {
  const { areaCounts, totalCount } = await getPhoenixProperties()

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is owner financing better than rent to own in Phoenix?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! With owner financing in Phoenix, you get immediate ownership and build equity from day one. Rent to own requires years of renting before you can purchase. Owner financing gives you the deed right away with seller-held financing."
        }
      },
      {
        "@type": "Question",
        "name": "Can I get owner financing with bad credit in Phoenix?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Many Phoenix sellers offering owner financing are flexible with credit requirements. While some properties require credit checks, approximately 30% have no credit requirements and 50% work with buyers who have credit challenges."
        }
      },
      {
        "@type": "Question",
        "name": "What areas in Phoenix offer owner financed homes?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Owner financed homes are available throughout Phoenix including Scottsdale, Tempe, Paradise Valley, Ahwatukee, Camelback Mountain, and Central Phoenix."
        }
      },
      {
        "@type": "Question",
        "name": "How much down payment is needed for Phoenix owner financing?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Down payments in Phoenix typically range from 10% to 20% of the purchase price. Arizona's growing market offers reasonable pricing with owner financing making desert living accessible."
        }
      }
    ]
  }

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "OwnerFi Phoenix - Owner Financed Homes",
    "description": "Find owner financed homes throughout Phoenix. Better than rent to own with immediate ownership.",
    "url": "https://ownerfi.ai/phoenix-owner-financing",
    "areaServed": {
      "@type": "City",
      "name": "Phoenix",
      "containsPlace": [
        { "@type": "Neighborhood", "name": "Scottsdale" },
        { "@type": "Neighborhood", "name": "Tempe" },
        { "@type": "Neighborhood", "name": "Paradise Valley" },
        { "@type": "Neighborhood", "name": "Ahwatukee" },
        { "@type": "Neighborhood", "name": "Camelback" }
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
              <li><Link href="/owner-financing-arizona" className="hover:text-indigo-600">Arizona</Link></li>
              <li>/</li>
              <li className="text-slate-900 font-medium">Phoenix</li>
            </ol>
          </nav>

          {/* Hero Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Owner Financing Phoenix - Better Than Rent to Own
            </h1>
            <p className="text-xl text-slate-700 mb-8">
              Find {totalCount > 0 ? `${totalCount}+ ` : ''}owner financed homes across the Valley of the Sun.
              Skip the banks and get immediate ownership with seller financing in Scottsdale, Tempe, Paradise Valley, and beyond.
              Experience Arizona's year-round sunshine and booming economy with owner financing that makes desert living accessible.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                <h3 className="font-bold text-green-900 mb-2">Immediate Phoenix Ownership</h3>
                <p className="text-green-800">Get the deed right away, unlike rent to own</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                <h3 className="font-bold text-blue-900 mb-2">No Banks Required</h3>
                <p className="text-blue-800">Deal directly with Phoenix property owners</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-red-50 p-6 rounded-xl border border-orange-200">
                <h3 className="font-bold text-orange-900 mb-2">Desert Lifestyle</h3>
                <p className="text-orange-800">320+ days of sunshine annually</p>
              </div>
            </div>

            <Link href="/signup">
              <button className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-orange-700 hover:to-red-700 transition-all transform hover:scale-105 shadow-lg">
                Browse Phoenix Properties →
              </button>
            </Link>
          </div>

          {/* Call to Action Section */}
          <section className="py-12 px-6 bg-gradient-to-r from-emerald-900/30 to-blue-900/30 rounded-2xl mb-12">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                Ready to Find Your Phoenix Home?
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Browse owner financed and rent-to-own properties across Phoenix.
                No banks needed, flexible terms available.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup">
                  <button className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg hover:shadow-xl">
                    🏠 Browse Phoenix Properties
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

          {/* Phoenix Areas Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Owner Financed Homes by Phoenix Area
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="p-6 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border-2 border-orange-200">
                <h3 className="text-xl font-bold text-orange-900 mb-2">
                  Scottsdale
                </h3>
                <p className="text-orange-700 mb-2">
                  {areaCounts['Scottsdale'] || 'Luxury'} owner financed properties
                </p>
                <p className="text-sm text-orange-600 mb-3">
                  Old Town, Fashion Square, luxury resorts
                </p>
                <p className="text-xs text-orange-500">
                  Upscale shopping, golf courses, spa resorts
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border-2 border-red-200">
                <h3 className="text-xl font-bold text-red-900 mb-2">
                  Tempe
                </h3>
                <p className="text-red-700 mb-2">
                  {areaCounts['Tempe'] || 'College'} properties with seller financing
                </p>
                <p className="text-sm text-red-600 mb-3">
                  ASU campus, Mill Avenue, Tempe Town Lake
                </p>
                <p className="text-xs text-red-500">
                  University town, young professionals, tech companies
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border-2 border-purple-200">
                <h3 className="text-xl font-bold text-purple-900 mb-2">
                  Paradise Valley
                </h3>
                <p className="text-purple-700 mb-2">
                  {areaCounts['Paradise Valley'] || 'Elite'} homes with owner financing
                </p>
                <p className="text-sm text-purple-600 mb-3">
                  Camelback Mountain, luxury estates, private communities
                </p>
                <p className="text-xs text-purple-500">
                  Celebrity homes, mountain views, gated communities
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
                <h3 className="text-xl font-bold text-green-900 mb-2">
                  Ahwatukee
                </h3>
                <p className="text-green-700 mb-2">
                  {areaCounts['Ahwatukee'] || 'Family'} owner financed properties
                </p>
                <p className="text-sm text-green-600 mb-3">
                  South Mountain, family neighborhoods, master-planned
                </p>
                <p className="text-xs text-green-500">
                  Family-friendly, hiking trails, suburban feel
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border-2 border-yellow-200">
                <h3 className="text-xl font-bold text-yellow-900 mb-2">
                  Central Phoenix
                </h3>
                <p className="text-yellow-700 mb-2">
                  {areaCounts['Central Phoenix'] || 'Urban'} rent to own alternatives
                </p>
                <p className="text-sm text-yellow-600 mb-3">
                  Downtown, Midtown, historic districts
                </p>
                <p className="text-xs text-yellow-500">
                  Urban living, sports venues, cultural attractions
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200">
                <h3 className="text-xl font-bold text-blue-900 mb-2">
                  Camelback Corridor
                </h3>
                <p className="text-blue-700 mb-2">
                  {areaCounts['Camelback'] || 'Business'} properties available
                </p>
                <p className="text-sm text-blue-600 mb-3">
                  Biltmore, business district, luxury hotels
                </p>
                <p className="text-xs text-blue-500">
                  Business hub, luxury shopping, fine dining
                </p>
              </div>
            </div>

            {/* Popular Phoenix Areas */}
            <div className="border-t pt-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-4">
                More Phoenix Areas with Owner Financing
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-700">
                {['Glendale', 'Mesa', 'Chandler', 'Gilbert', 'Peoria', 'Surprise',
                  'Avondale', 'Goodyear', 'Fountain Hills', 'Cave Creek', 'Carefree', 'Queen Creek',
                  'Anthem', 'New River', 'Desert Ridge', 'Deer Valley', 'North Phoenix', 'South Phoenix'].map(area => (
                  <span key={area} className="text-sm hover:text-indigo-600">
                    {area}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Why Owner Financing in Phoenix */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              Why Choose Owner Financing in Phoenix?
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Phoenix Real Estate Advantages
                </h3>
                <ul className="space-y-3 text-slate-700">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Year-round outdoor lifestyle and recreation</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Growing tech and healthcare industries</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>No state income tax and business-friendly</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Stunning desert landscapes and mountain views</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Owner financing makes desert living affordable</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Owner Financing vs Rent to Own in Phoenix
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-2">Owner Financing ✓</h4>
                    <p className="text-green-800 text-sm">
                      Immediate ownership with deed transfer. Build equity from day one.
                      Arizona property tax benefits. Protected by state property laws.
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <h4 className="font-semibold text-red-900 mb-2">Rent to Own ✗</h4>
                    <p className="text-red-800 text-sm">
                      Years of renting before ownership. No equity during rental period.
                      Risk of losing option fee. Treated as tenant under Arizona law.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Phoenix Market Insights */}
          <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl shadow-xl p-8 mb-12 border border-orange-200">
            <h2 className="text-3xl font-bold text-orange-900 mb-6">
              Phoenix Housing Market & Owner Financing Opportunities
            </h2>

            <div className="grid md:grid-cols-3 gap-6 text-orange-800">
              <div>
                <h3 className="font-semibold text-orange-900 mb-3">Retirees & Snowbirds</h3>
                <p className="text-sm">
                  Phoenix attracts retirees seeking warm weather year-round.
                  Owner financing helps those downsizing or relocating from other states with unique financial situations.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-orange-900 mb-3">Tech & Healthcare</h3>
                <p className="text-sm">
                  Growing biotechnology and semiconductor industries create high-paying jobs.
                  Tech workers and healthcare professionals value flexible financing options for relocations.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-orange-900 mb-3">Population Growth</h3>
                <p className="text-sm">
                  Phoenix is one of America's fastest-growing cities attracting newcomers.
                  Owner financing provides accessible homeownership for people relocating to Arizona.
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
                { name: 'Mesa, AZ', slug: 'mesa-owner-financing' },
                { name: 'Tucson, AZ', slug: 'tucson-owner-financing' },
                { name: 'Chandler, AZ', slug: 'chandler-owner-financing' },
                { name: 'Glendale, AZ', slug: 'glendale-owner-financing' }
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
              Phoenix Owner Financing FAQ
            </h2>

            <div className="space-y-6">
              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Is owner financing legal in Phoenix?
                </h3>
                <p className="text-slate-700">
                  Yes, owner financing is completely legal in Phoenix. The city follows Arizona state laws governing
                  seller financing through warranty deeds, deeds of trust, and promissory notes.
                  Maricopa County Recorder handles property transfers and recording requirements.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  What credit score do I need for owner financing in Phoenix?
                </h3>
                <p className="text-slate-700">
                  Credit requirements vary by seller. Approximately 30% of our Phoenix properties have
                  no credit check requirements, 50% work with buyers who have credit challenges,
                  and 20% prefer good credit. Many retirees and relocating professionals have unique situations
                  that sellers accommodate.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  How much down payment is typical for Phoenix owner financing?
                </h3>
                <p className="text-slate-700">
                  Down payments typically range from 10% to 20% of the purchase price in Phoenix.
                  Arizona's competitive market offers good value with reasonable down payment requirements.
                  Luxury areas like Paradise Valley may require higher amounts. The average is around 15%.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Can I use owner financing for Phoenix investment properties?
                </h3>
                <p className="text-slate-700">
                  Yes! Many Phoenix sellers offer owner financing for investment properties.
                  The city's population growth and tourism create strong rental demand.
                  Properties near ASU, downtown, and resort areas are particularly attractive to investors.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl shadow-xl p-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Start Your Phoenix Homeownership Journey Today
            </h2>
            <p className="text-xl mb-8 text-orange-100">
              Better than rent to own - get immediate ownership with owner financing
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <button className="bg-white text-orange-600 px-8 py-4 rounded-xl font-semibold hover:bg-orange-50 transition-all">
                  Search Phoenix Properties
                </button>
              </Link>
              <Link href="/how-owner-finance-works">
                <button className="bg-orange-500 text-white px-8 py-4 rounded-xl font-semibold hover:bg-orange-400 transition-all">
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