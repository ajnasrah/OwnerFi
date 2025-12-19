import { Metadata } from 'next'
import Link from 'next/link'
import Script from 'next/script'
import { LegalFooter } from '@/components/ui/LegalFooter'
import { getAdminDb } from '@/lib/firebase-admin'
import { notFound } from 'next/navigation'

// This handles ALL location-based pages dynamically
// Examples: /texas, /florida, /houston, /miami, etc.

type LocationType = 'state' | 'city'

interface LocationData {
  name: string
  displayName: string
  type: LocationType
  state?: string // For cities
  propertyCount: number
  nearbyLocations: string[]
  description: string
}

// Generate metadata dynamically for each location
export async function generateMetadata({ params }: { params: Promise<{ location: string }> }): Promise<Metadata> {
  const { location } = await params
  const locationData = await getLocationData(location)

  if (!locationData) {
    return {
      title: 'Location Not Found',
      description: 'This location page does not exist.',
    }
  }

  const isState = locationData.type === 'state'
  const locationTitle = locationData.displayName

  // Create SEO-optimized title and description based on location type
  const title = isState
    ? `Owner Financing ${locationTitle} | Rent to Own Homes | Seller Financed Properties`
    : `Owner Financing ${locationTitle}, ${locationData.state} | Rent to Own Homes | No Bank Needed`

  const description = isState
    ? `Find owner financed homes and rent to own properties in ${locationTitle}. Browse ${locationData.propertyCount}+ seller financed properties with no bank financing required. Bad credit OK, low down payments.`
    : `Browse owner financed homes in ${locationTitle}, ${locationData.state}. ${locationData.propertyCount}+ rent to own and seller financed properties available. No bank needed, flexible terms, bad credit options.`

  const keywords = isState
    ? `owner financing ${locationTitle.toLowerCase()}, rent to own ${locationTitle.toLowerCase()}, seller financing ${locationTitle.toLowerCase()}, owner financed homes ${locationTitle.toLowerCase()}, no bank financing ${locationTitle.toLowerCase()}, bad credit homes ${locationTitle.toLowerCase()}`
    : `owner financing ${locationTitle.toLowerCase()}, rent to own ${locationTitle.toLowerCase()}, owner financed homes ${locationTitle.toLowerCase()} ${locationData.state?.toLowerCase()}, seller financing ${locationTitle.toLowerCase()}, no credit check homes ${locationTitle.toLowerCase()}`

  return {
    title,
    description,
    keywords,
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: `https://ownerfi.ai/${location}`,
      siteName: 'OwnerFi',
      title: title.split('|')[0].trim(),
      description,
      images: [{
        url: `https://ownerfi.ai/og-${location}.png`,
        width: 1200,
        height: 630,
        alt: `Owner Financing ${locationTitle}`,
      }],
    },
    alternates: {
      canonical: `https://ownerfi.ai/${location}`,
    },
  }
}

// Get location data from Firebase Admin SDK (server-side)
async function getLocationData(locationSlug: string): Promise<LocationData | null> {
  try {
    const adminDb = await getAdminDb()
    if (!adminDb) {
      console.error('Firebase Admin SDK not initialized')
      return null
    }

    // First, check if it's a state
    const stateMapping: Record<string, string> = {
      'texas': 'TX', 'florida': 'FL', 'georgia': 'GA', 'california': 'CA',
      'arizona': 'AZ', 'north-carolina': 'NC', 'south-carolina': 'SC',
      'tennessee': 'TN', 'ohio': 'OH', 'michigan': 'MI', 'pennsylvania': 'PA',
      'illinois': 'IL', 'indiana': 'IN', 'missouri': 'MO', 'alabama': 'AL',
      'kentucky': 'KY', 'louisiana': 'LA', 'oklahoma': 'OK', 'arkansas': 'AR',
      'mississippi': 'MS', 'nevada': 'NV', 'colorado': 'CO', 'virginia': 'VA',
      'new-york': 'NY', 'new-jersey': 'NJ', 'maryland': 'MD', 'wisconsin': 'WI',
      'minnesota': 'MN', 'iowa': 'IA', 'kansas': 'KS', 'nebraska': 'NE',
    }

    const stateCode = stateMapping[locationSlug]

    if (stateCode) {
      // It's a state - get all properties in this state
      const snapshot = await adminDb
        .collection('properties')
        .where('state', '==', stateCode)
        .where('isActive', '==', true)
        .get()

      // Get unique cities in this state
      const cities = new Set<string>()
      snapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
        const data = doc.data()
        if (data.city) cities.add(data.city)
      })

      return {
        name: locationSlug,
        displayName: locationSlug.split('-').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' '),
        type: 'state',
        propertyCount: snapshot.size,
        nearbyLocations: Array.from(cities).slice(0, 10),
        description: `Browse owner financed properties across ${locationSlug}. Find seller financed homes with flexible terms.`
      }
    } else {
      // It's likely a city - search for properties with this city name
      const cityName = locationSlug.split('-').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')

      let snapshot = await adminDb
        .collection('properties')
        .where('city', '==', cityName)
        .where('isActive', '==', true)
        .get()

      if (snapshot.empty) {
        // Try with lowercase
        snapshot = await adminDb
          .collection('properties')
          .where('city', '==', cityName.toLowerCase())
          .where('isActive', '==', true)
          .get()

        if (snapshot.empty) return null
      }

      // Get state from first property
      const firstProperty = snapshot.docs[0]?.data()
      const state = firstProperty?.state

      // Get nearby cities
      const nearbyCities = new Set<string>()
      if (state) {
        const stateSnapshot = await adminDb
          .collection('properties')
          .where('state', '==', state)
          .where('isActive', '==', true)
          .get()

        stateSnapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
          const data = doc.data()
          if (data.city && data.city !== cityName) {
            nearbyCities.add(data.city)
          }
        })
      }

      return {
        name: locationSlug,
        displayName: cityName,
        type: 'city',
        state: state,
        propertyCount: snapshot.size,
        nearbyLocations: Array.from(nearbyCities).slice(0, 10),
        description: `Find owner financed homes in ${cityName}. Browse seller financed properties with no bank financing.`
      }
    }
  } catch (error) {
    console.error('Error fetching location data:', error)
    return null
  }
}

// Generate FAQ schema based on location
function generateFAQSchema(location: LocationData) {
  const faqs = location.type === 'state' ? [
    {
      question: `Is owner financing legal in ${location.displayName}?`,
      answer: `Yes, owner financing is legal in ${location.displayName}. Sellers can offer financing with proper documentation and compliance with state laws.`
    },
    {
      question: `How does owner financing work in ${location.displayName}?`,
      answer: `In ${location.displayName}, owner financing allows property sellers to act as the lender. Buyers make payments directly to the seller instead of getting a traditional mortgage.`
    },
    {
      question: `What are typical down payments for owner financing in ${location.displayName}?`,
      answer: `Down payments in ${location.displayName} typically range from 5% to 20% of the purchase price, though this varies by seller and property.`
    },
    {
      question: `Can I get owner financing with bad credit in ${location.displayName}?`,
      answer: `Yes, many sellers in ${location.displayName} offering owner financing are flexible with credit requirements, focusing more on down payment and income.`
    },
    {
      question: `How many owner financed properties are available in ${location.displayName}?`,
      answer: `Currently, there are ${location.propertyCount}+ owner financed properties available in ${location.displayName} through OwnerFi.`
    }
  ] : [
    {
      question: `Are there owner financed homes in ${location.displayName}?`,
      answer: `Yes, there are currently ${location.propertyCount}+ owner financed properties available in ${location.displayName}, ${location.state}.`
    },
    {
      question: `What types of properties are available with owner financing in ${location.displayName}?`,
      answer: `${location.displayName} offers various owner financed properties including single-family homes, condos, townhouses, and investment properties.`
    },
    {
      question: `What is the average down payment for owner financing in ${location.displayName}?`,
      answer: `Down payments in ${location.displayName} typically range from 5% to 20%, depending on the seller and property type.`
    },
    {
      question: `How fast can I close on an owner financed home in ${location.displayName}?`,
      answer: `Owner financed deals in ${location.displayName} can close in 7-14 days, much faster than traditional bank financing.`
    }
  ]

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  }
}

// Generate local business schema
function generateLocalBusinessSchema(location: LocationData) {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "name": `OwnerFi ${location.displayName}`,
    "description": `Owner financed properties marketplace in ${location.displayName}`,
    "url": `https://ownerfi.ai/${location.name}`,
    "areaServed": location.type === 'state' ? {
      "@type": "State",
      "name": location.displayName
    } : {
      "@type": "City",
      "name": location.displayName,
      "containedIn": {
        "@type": "State",
        "name": location.state
      }
    },
    "knowsAbout": ["Owner Financing", "Seller Financing", "Rent to Own", "Contract for Deed"],
  }
}

export default async function LocationPage({ params }: { params: Promise<{ location: string }> }) {
  const { location } = await params
  const locationData = await getLocationData(location)

  if (!locationData) {
    notFound()
  }

  const isState = locationData.type === 'state'

  return (
    <>
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateFAQSchema(locationData)) }}
      />
      <Script
        id="local-business-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateLocalBusinessSchema(locationData)) }}
      />

      <div className="min-h-screen bg-slate-900 text-white">
        {/* Header */}
        <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">O</span>
              </div>
              <span className="text-lg font-bold text-white">OwnerFi</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/" className="text-slate-300 hover:text-white text-sm">Home</Link>
              <Link href="/how-owner-finance-works" className="text-slate-300 hover:text-white text-sm">How It Works</Link>
              <Link href="/auth" className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Browse Properties
              </Link>
            </nav>
          </div>
        </header>

        <main>
          {/* Hero Section */}
          <section className="relative py-20 px-6 bg-gradient-to-b from-slate-800 to-slate-900">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12">
                <h1 className="text-5xl font-bold text-white mb-6">
                  Owner Financing in <span className="text-emerald-400">{locationData.displayName}</span>
                  {!isState && locationData.state && (
                    <span className="block text-3xl mt-4 text-slate-300">{locationData.state}</span>
                  )}
                  <span className="block text-2xl mt-4 text-blue-400">
                    {locationData.propertyCount}+ Properties Available
                  </span>
                </h1>
                <p className="text-xl text-slate-300 max-w-3xl mx-auto">
                  Find owner financed homes and rent to own properties in {locationData.displayName}.
                  Skip the bank with seller financing - bad credit OK, low down payments, flexible terms.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <Link
                  href="/auth"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all"
                >
                  Browse {locationData.displayName} Properties
                </Link>
                <Link
                  href="/rent-to-own-homes"
                  className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all"
                >
                  View All Locations
                </Link>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-emerald-400">{locationData.propertyCount}+</div>
                  <div className="text-slate-300 mt-2">Properties</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-blue-400">5%</div>
                  <div className="text-slate-300 mt-2">Min Down</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-purple-400">7 Days</div>
                  <div className="text-slate-300 mt-2">Fast Closing</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-yellow-400">Flexible</div>
                  <div className="text-slate-300 mt-2">Credit Terms</div>
                </div>
              </div>
            </div>
          </section>

          {/* Nearby Locations */}
          {locationData.nearbyLocations.length > 0 && (
            <section className="py-16 px-6 bg-slate-800/30">
              <div className="max-w-6xl mx-auto">
                <h2 className="text-3xl font-bold text-white text-center mb-12">
                  {isState ? `Cities in ${locationData.displayName} with Owner Financing` : `Nearby Cities with Owner Financing`}
                </h2>
                <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {locationData.nearbyLocations.map((nearby) => (
                    <Link
                      key={nearby}
                      href={`/${nearby.toLowerCase().replace(/\s+/g, '-')}`}
                      className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 hover:border-emerald-400/50 transition-all text-center"
                    >
                      <h3 className="text-white font-semibold">{nearby}</h3>
                      <p className="text-emerald-400 text-sm mt-1">View Properties →</p>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Benefits Section */}
          <section className="py-16 px-6">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Why Choose Owner Financing in {locationData.displayName}?
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-emerald-400 text-3xl mb-4">🏠</div>
                  <h3 className="text-xl font-semibold text-white mb-3">No Bank Required</h3>
                  <p className="text-slate-300">Skip traditional mortgage requirements and lengthy bank approval processes.</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-blue-400 text-3xl mb-4">💳</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Flexible Credit</h3>
                  <p className="text-slate-300">Many sellers work with all credit situations, focusing on down payment ability.</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-purple-400 text-3xl mb-4">💰</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Low Down Payment</h3>
                  <p className="text-slate-300">Start with as little as 5-10% down instead of 20% banks typically require.</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-yellow-400 text-3xl mb-4">⚡</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Fast Closing</h3>
                  <p className="text-slate-300">Close in 7-14 days instead of waiting 30-45 days for bank approval.</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-orange-400 text-3xl mb-4">📝</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Negotiable Terms</h3>
                  <p className="text-slate-300">Work directly with sellers to create payment terms that fit your budget.</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-cyan-400 text-3xl mb-4">🔑</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Immediate Ownership</h3>
                  <p className="text-slate-300">Get the deed and start building equity from day one.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Owner Financing vs Rent to Own */}
          <section className="py-16 px-6 bg-slate-800/30">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Owner Financing vs Rent-to-Own in {locationData.displayName}
              </h2>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/30 rounded-xl p-6 border border-emerald-500/30">
                  <h3 className="text-xl font-bold text-emerald-400 mb-4">✅ Owner Financing (Better Option)</h3>
                  <ul className="space-y-2 text-slate-300">
                    <li>• You get the deed immediately</li>
                    <li>• Legal homeowner from day one</li>
                    <li>• Build equity with each payment</li>
                    <li>• Tax deductions available</li>
                    <li>• Can sell or refinance anytime</li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-red-900/30 to-red-800/30 rounded-xl p-6 border border-red-500/30">
                  <h3 className="text-xl font-bold text-red-400 mb-4">❌ Traditional Rent-to-Own</h3>
                  <ul className="space-y-2 text-slate-300">
                    <li>• Still just a renter</li>
                    <li>• No deed until fully paid</li>
                    <li>• No equity building</li>
                    <li>• No tax benefits</li>
                    <li>• Risk losing option money</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="py-16 px-6">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                {locationData.displayName} Owner Financing FAQs
              </h2>
              <div className="space-y-6">
                {generateFAQSchema(locationData)["mainEntity"].map((faq: { name: string; acceptedAnswer: { text: string } }, i: number) => (
                  <div key={i} className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                    <h3 className="text-xl font-semibold text-white mb-3">{faq.name}</h3>
                    <p className="text-slate-300">{faq.acceptedAnswer.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-20 px-6 bg-gradient-to-b from-slate-900 to-slate-800">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-6">
                Ready to Find Your {locationData.displayName} Home?
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Browse {locationData.propertyCount}+ owner financed properties. No bank needed, flexible terms, fast closing.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/auth"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all"
                >
                  Browse {locationData.displayName} Properties
                </Link>
                <Link
                  href="/how-owner-finance-works"
                  className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all"
                >
                  Learn How It Works
                </Link>
              </div>
            </div>
          </section>
        </main>

        <LegalFooter includeInvestment={true} includeState={true} />
      </div>
    </>
  )
}

// Generate static params for known locations (for better SEO)
export async function generateStaticParams() {
  // Return empty array to make all pages dynamic
  // They'll be generated on-demand as properties are added
  return []
}