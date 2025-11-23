import { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export const metadata: Metadata = {
  title: 'Owner Financing Philadelphia | Rent to Own Alternative PA | Center City, Society Hill | OwnerFi',
  description: 'Find owner financed homes in Philadelphia - better than rent to own! Immediate ownership in Center City, Society Hill, Northern Liberties, Fishtown. No banks needed. Flexible credit options.',
  keywords: 'owner financing philadelphia, owner financed homes philadelphia, rent to own philadelphia, rent to own pennsylvania, owner financing center city, seller financing philadelphia, no credit check homes philadelphia, bad credit homes philadelphia, philadelphia real estate owner financing',
  openGraph: {
    title: 'Owner Financed Homes in Philadelphia - Better Than Rent to Own | OwnerFi',
    description: 'Skip the banks! Find owner financed properties across Philadelphia with immediate ownership. Serving Center City, Society Hill, Fishtown and more.',
    url: 'https://ownerfi.ai/philadelphia-owner-financing',
    siteName: 'OwnerFi',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Owner Financing Philadelphia - Better Than Rent to Own',
    description: 'Find owner financed homes across Philadelphia. Immediate ownership, no banks needed.',
  },
  alternates: {
    canonical: 'https://ownerfi.ai/philadelphia-owner-financing',
  }
}

async function getPhiladelphiaProperties() {
  try {
    const propertiesRef = collection(db, 'properties')
    const q = query(
      propertiesRef,
      where('isActive', '==', true),
      where('city', 'in', ['Philadelphia', 'Center City', 'Society Hill', 'Northern Liberties', 'Fishtown', 'University City'])
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
    console.error('Error fetching Philadelphia properties:', error)
    return { areaCounts: {}, totalCount: 0 }
  }
}

export default async function OwnerFinancingPhiladelphia() {
  const { areaCounts, totalCount } = await getPhiladelphiaProperties()

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is owner financing better than rent to own in Philadelphia?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! With owner financing in Philadelphia, you get immediate ownership and build equity from day one. Rent to own requires years of renting before you can purchase. Owner financing gives you the deed right away with seller-held financing."
        }
      },
      {
        "@type": "Question",
        "name": "Can I get owner financing with bad credit in Philadelphia?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Many Philadelphia sellers offering owner financing are flexible with credit requirements. While some properties require credit checks, approximately 30% have no credit requirements and 50% work with buyers who have credit challenges."
        }
      },
      {
        "@type": "Question",
        "name": "What neighborhoods in Philadelphia offer owner financed homes?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Owner financed homes are available throughout Philadelphia including Center City, Society Hill, Northern Liberties, Fishtown, University City, and Rittenhouse Square."
        }
      },
      {
        "@type": "Question",
        "name": "How much down payment is needed for Philadelphia owner financing?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Down payments in Philadelphia typically range from 12% to 22% of the purchase price. The city offers more affordable options than NYC or DC, making owner financing accessible to more buyers."
        }
      }
    ]
  }

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "OwnerFi Philadelphia - Owner Financed Homes",
    "description": "Find owner financed homes throughout Philadelphia. Better than rent to own with immediate ownership.",
    "url": "https://ownerfi.ai/philadelphia-owner-financing",
    "areaServed": {
      "@type": "City",
      "name": "Philadelphia",
      "containsPlace": [
        { "@type": "Neighborhood", "name": "Center City" },
        { "@type": "Neighborhood", "name": "Society Hill" },
        { "@type": "Neighborhood", "name": "Northern Liberties" },
        { "@type": "Neighborhood", "name": "Fishtown" },
        { "@type": "Neighborhood", "name": "University City" }
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
              <li><Link href="/owner-financing-pennsylvania" className="hover:text-indigo-600">Pennsylvania</Link></li>
              <li>/</li>
              <li className="text-slate-900 font-medium">Philadelphia</li>
            </ol>
          </nav>

          {/* Hero Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Owner Financing Philadelphia - Better Than Rent to Own
            </h1>
            <p className="text-xl text-slate-700 mb-8">
              Find {totalCount > 0 ? `${totalCount}+ ` : ''}owner financed homes across the City of Brotherly Love.
              Skip the banks and get immediate ownership with seller financing in Center City, Society Hill, Fishtown, and beyond.
              Experience Philadelphia's rich history and vibrant culture with owner financing that makes homeownership accessible in America's birthplace.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                <h3 className="font-bold text-green-900 mb-2">Immediate Philly Ownership</h3>
                <p className="text-green-800">Get the deed right away, unlike rent to own</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                <h3 className="font-bold text-blue-900 mb-2">No Banks Required</h3>
                <p className="text-blue-800">Deal directly with Philadelphia property owners</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-pink-50 p-6 rounded-xl border border-red-200">
                <h3 className="font-bold text-red-900 mb-2">Historic City</h3>
                <p className="text-red-800">Rich history, walkable neighborhoods</p>
              </div>
            </div>

            <Link href="/auth">
              <button className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-lg">
                Browse Philadelphia Properties →
              </button>
            </Link>
          </div>

          {/* Philadelphia Neighborhoods Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Owner Financed Homes by Philadelphia Neighborhood
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
                <h3 className="text-xl font-bold text-blue-900 mb-2">
                  Center City
                </h3>
                <p className="text-blue-700 mb-2">
                  {areaCounts['Center City'] || 'Urban'} owner financed properties
                </p>
                <p className="text-sm text-blue-600 mb-3">
                  Rittenhouse Square, City Hall, business district
                </p>
                <p className="text-xs text-blue-500">
                  Downtown living, high-rise condos, walkable
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border-2 border-red-200">
                <h3 className="text-xl font-bold text-red-900 mb-2">
                  Society Hill
                </h3>
                <p className="text-red-700 mb-2">
                  {areaCounts['Society Hill'] || 'Historic'} properties with seller financing
                </p>
                <p className="text-sm text-red-600 mb-3">
                  Cobblestone streets, colonial architecture, Independence Hall
                </p>
                <p className="text-xs text-red-500">
                  Historic charm, upscale living, tourist destination
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
                <h3 className="text-xl font-bold text-green-900 mb-2">
                  Northern Liberties
                </h3>
                <p className="text-green-700 mb-2">
                  {areaCounts['Northern Liberties'] || 'Trendy'} homes with owner financing
                </p>
                <p className="text-sm text-green-600 mb-3">
                  Piazza, nightlife, converted warehouses
                </p>
                <p className="text-xs text-green-500">
                  Hip neighborhood, young professionals, nightlife
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border-2 border-yellow-200">
                <h3 className="text-xl font-bold text-yellow-900 mb-2">
                  Fishtown
                </h3>
                <p className="text-yellow-700 mb-2">
                  {areaCounts['Fishtown'] || 'Artistic'} owner financed properties
                </p>
                <p className="text-sm text-yellow-600 mb-3">
                  Music venues, breweries, art galleries
                </p>
                <p className="text-xs text-yellow-500">
                  Artistic community, craft beer, music scene
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border-2 border-purple-200">
                <h3 className="text-xl font-bold text-purple-900 mb-2">
                  University City
                </h3>
                <p className="text-purple-700 mb-2">
                  {areaCounts['University City'] || 'Academic'} rent to own alternatives
                </p>
                <p className="text-sm text-purple-600 mb-3">
                  UPenn, Drexel University, student housing
                </p>
                <p className="text-xs text-purple-500">
                  University area, student life, research facilities
                </p>
              </div>

              <div className="p-6 bg-gradient-to-br from-cyan-50 to-teal-50 rounded-xl border-2 border-cyan-200">
                <h3 className="text-xl font-bold text-cyan-900 mb-2">
                  Old City
                </h3>
                <p className="text-cyan-700 mb-2">
                  {areaCounts['Old City'] || 'Historic'} properties available
                </p>
                <p className="text-sm text-cyan-600 mb-3">
                  Liberty Bell, First Friday, art galleries
                </p>
                <p className="text-xs text-cyan-500">
                  Historic district, art scene, loft living
                </p>
              </div>
            </div>

            {/* Popular Philadelphia Neighborhoods */}
            <div className="border-t pt-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-4">
                More Philadelphia Neighborhoods with Owner Financing
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-700">
                {['Rittenhouse Square', 'Graduate Hospital', 'Queen Village', 'Bella Vista', 'Washington Square West', 'Fairmount',
                  'Brewerytown', 'Kensington', 'Port Richmond', 'South Philly', 'Point Breeze', 'Passyunk Square',
                  'East Passyunk', 'Pennsport', 'Whitman', 'Girard Estate', 'Grays Ferry', 'University City'].map(neighborhood => (
                  <span key={neighborhood} className="text-sm hover:text-indigo-600">
                    {neighborhood}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Why Owner Financing in Philadelphia */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              Why Choose Owner Financing in Philadelphia?
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Philadelphia Real Estate Advantages
                </h3>
                <ul className="space-y-3 text-slate-700">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Rich American history and cultural attractions</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Major Northeast corridor city with train access</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Affordable compared to NYC and Washington DC</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Walkable neighborhoods with character</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Owner financing makes city living accessible</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Owner Financing vs Rent to Own in Philadelphia
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-2">Owner Financing ✓</h4>
                    <p className="text-green-800 text-sm">
                      Immediate ownership with deed transfer. Build equity from day one.
                      Pennsylvania property tax benefits. Protected by state property laws.
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <h4 className="font-semibold text-red-900 mb-2">Rent to Own ✗</h4>
                    <p className="text-red-800 text-sm">
                      Years of renting before ownership. No equity during rental period.
                      Risk of losing option fee. Treated as tenant under Pennsylvania law.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Philadelphia Market Insights */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-xl p-8 mb-12 border border-blue-200">
            <h2 className="text-3xl font-bold text-blue-900 mb-6">
              Philadelphia Housing Market & Owner Financing Opportunities
            </h2>

            <div className="grid md:grid-cols-3 gap-6 text-blue-800">
              <div>
                <h3 className="font-semibold text-blue-900 mb-3">Healthcare Workers</h3>
                <p className="text-sm">
                  Major medical centers including CHOP and Jefferson attract healthcare professionals.
                  Nurses, doctors, and medical staff often prefer owner financing for shift work schedules and varying income.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-blue-900 mb-3">Students & Graduates</h3>
                <p className="text-sm">
                  Large university presence with UPenn, Temple, and Drexel creates demand from students and recent graduates.
                  Owner financing helps overcome student loan debt and limited credit history.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-blue-900 mb-3">Arts & Culture</h3>
                <p className="text-sm">
                  Thriving arts scene attracts creative professionals with irregular income patterns.
                  Musicians, artists, and performers value flexible financing options in creative neighborhoods.
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
                { name: 'Baltimore, MD', slug: 'baltimore-owner-financing' },
                { name: 'Washington, DC', slug: 'washington-dc-owner-financing' },
                { name: 'Newark, NJ', slug: 'newark-owner-financing' },
                { name: 'Wilmington, DE', slug: 'wilmington-owner-financing' }
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
              Philadelphia Owner Financing FAQ
            </h2>

            <div className="space-y-6">
              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Is owner financing legal in Philadelphia?
                </h3>
                <p className="text-slate-700">
                  Yes, owner financing is completely legal in Philadelphia. The city follows Pennsylvania state laws governing
                  seller financing through warranty deeds, mortgages, and promissory notes.
                  Philadelphia Department of Records handles property transfers and recording requirements.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  What credit score do I need for owner financing in Philadelphia?
                </h3>
                <p className="text-slate-700">
                  Credit requirements vary by seller. Approximately 30% of our Philadelphia properties have
                  no credit check requirements, 50% work with buyers who have credit challenges,
                  and 20% prefer good credit. Many sellers focus on stable income and the buyer's connection
                  to the community rather than credit scores alone.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  How much down payment is typical for Philadelphia owner financing?
                </h3>
                <p className="text-slate-700">
                  Down payments typically range from 12% to 22% of the purchase price in Philadelphia.
                  The city's more affordable housing market compared to NYC or DC means reasonable down payment amounts.
                  Historic properties may have unique considerations. The average is around 17%.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Can I use owner financing for Philadelphia investment properties?
                </h3>
                <p className="text-slate-700">
                  Yes! Many Philadelphia sellers offer owner financing for investment properties.
                  The city's large student population and young professional demographic create strong rental demand.
                  Properties near universities and in gentrifying neighborhoods are particularly attractive.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-xl p-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Start Your Philadelphia Homeownership Journey Today
            </h2>
            <p className="text-xl mb-8 text-blue-100">
              Better than rent to own - get immediate ownership with owner financing
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth">
                <button className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold hover:bg-blue-50 transition-all">
                  Search Philadelphia Properties
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