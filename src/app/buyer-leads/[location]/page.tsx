import { Metadata } from 'next'
import Link from 'next/link'
import Script from 'next/script'
import { notFound } from 'next/navigation'
import { LegalFooter } from '@/components/ui/LegalFooter'
import { lookupLocationBySlug, getNearbyCities, STATE_DATA, generateCitySlug, CityData, StateData } from '@/lib/realtor-cities-data'

// Dynamic metadata for SEO
export async function generateMetadata({ params }: { params: Promise<{ location: string }> }): Promise<Metadata> {
  const { location } = await params
  const locationData = lookupLocationBySlug(location)

  if (!locationData) {
    return {
      title: 'Buyer Leads for Realtors | OwnerFi',
      description: 'Get pre-qualified buyer leads in your area.',
    }
  }

  const isState = locationData.type === 'state'
  const stateData = locationData.data as StateData
  const cityData = locationData.data as CityData

  const locationName = isState ? stateData.name : cityData.name
  const fullLocation = isState ? stateData.name : `${cityData.name}, ${cityData.stateCode}`

  const title = isState
    ? `Buyer Leads for Realtors in ${locationName} | Real Estate Referrals | OwnerFi`
    : `Buyer Leads ${cityData.name} ${cityData.stateCode} | Real Estate Agent Leads | OwnerFi`

  const description = isState
    ? `Get pre-qualified buyer leads in ${locationName}. Join OwnerFi's realtor referral network. 1 free lead per month, only pay 30% at closing.`
    : `Real estate buyer leads in ${fullLocation}. Pre-qualified buyers looking for homes. Free to join, 30% referral fee at closing only.`

  const keywords = isState
    ? `buyer leads ${locationName.toLowerCase()}, real estate leads ${locationName.toLowerCase()}, realtor referrals ${locationName.toLowerCase()}, agent leads ${stateData.code}, buyer referral program ${locationName.toLowerCase()}`
    : `buyer leads ${cityData.name.toLowerCase()}, real estate leads ${cityData.name.toLowerCase()} ${cityData.stateCode}, realtor leads ${cityData.name.toLowerCase()}, buyer referrals ${cityData.name.toLowerCase()}, agent leads ${cityData.name.toLowerCase()}`

  return {
    title,
    description,
    keywords,
    openGraph: {
      title: title.split('|')[0].trim(),
      description,
      url: `https://ownerfi.ai/buyer-leads/${location}`,
      siteName: 'OwnerFi',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: title.split('|')[0].trim(),
      description,
    },
    alternates: {
      canonical: `https://ownerfi.ai/buyer-leads/${location}`,
    }
  }
}

// Generate FAQ schema
function generateFAQSchema(locationName: string, isState: boolean) {
  const faqs = [
    {
      question: `How do I get buyer leads in ${locationName}?`,
      answer: `Join OwnerFi's realtor referral network for free. Set ${locationName} as your service area and start receiving pre-qualified buyer leads. You get 1 free lead per month and only pay a 30% referral fee when deals close.`
    },
    {
      question: `What types of buyer leads are available in ${locationName}?`,
      answer: `OwnerFi provides pre-qualified buyers interested in owner-financed properties in ${locationName}. These buyers have already provided their contact information, location preferences, and budget range through our platform.`
    },
    {
      question: `How much do buyer leads cost in ${locationName}?`,
      answer: `Joining OwnerFi is free. You get 1 free buyer lead per month in ${locationName}. The only cost is a 30% referral fee paid at closing - if the lead doesn't close, you owe nothing.`
    },
    {
      question: `Are the buyer leads in ${locationName} exclusive?`,
      answer: `Yes, once you accept a lead and sign the RF-701 referral agreement, that buyer is assigned exclusively to you for 180 days. The agreement automatically extends through any closing date.`
    },
    {
      question: isState
        ? `Which cities in ${locationName} have buyer leads available?`
        : `Are there buyer leads available near ${locationName}?`,
      answer: isState
        ? `OwnerFi has buyer leads throughout ${locationName} including all major cities and surrounding suburbs. When you join, you can set your service area within a 30-mile radius of your primary city.`
        : `Yes, OwnerFi has buyer leads throughout the area. Your service area covers a 30-mile radius from ${locationName}, so you'll see leads from nearby cities and suburbs as well.`
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
function generateLocalBusinessSchema(locationName: string, slug: string) {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "name": `OwnerFi Buyer Leads - ${locationName}`,
    "description": `Pre-qualified buyer leads for real estate agents in ${locationName}`,
    "url": `https://ownerfi.ai/buyer-leads/${slug}`,
    "areaServed": {
      "@type": "Place",
      "name": locationName
    },
    "knowsAbout": ["Buyer Leads", "Real Estate Referrals", "Agent Lead Generation", "Owner Financing"]
  }
}

// Generate breadcrumb schema
function generateBreadcrumbSchema(locationName: string, slug: string, isState: boolean, stateSlug?: string, stateName?: string) {
  const items = [
    { name: "Home", url: "https://ownerfi.ai" },
    { name: "For Realtors", url: "https://ownerfi.ai/for-realtors" },
  ]

  if (!isState && stateSlug && stateName) {
    items.push({ name: `${stateName} Leads`, url: `https://ownerfi.ai/buyer-leads/${stateSlug}` })
  }

  items.push({ name: `${locationName} Leads`, url: `https://ownerfi.ai/buyer-leads/${slug}` })

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url
    }))
  }
}

export default async function BuyerLeadsLocationPage({ params }: { params: Promise<{ location: string }> }) {
  const { location } = await params
  const locationData = lookupLocationBySlug(location)

  if (!locationData) {
    notFound()
  }

  const isState = locationData.type === 'state'
  const stateData = locationData.data as StateData
  const cityData = locationData.data as CityData

  const locationName = isState ? stateData.name : cityData.name
  const fullLocation = isState ? stateData.name : `${cityData.name}, ${cityData.stateCode}`
  const stateCode = isState ? stateData.code : cityData.stateCode
  const stateName = isState ? stateData.name : cityData.state
  const stateSlug = isState ? stateData.slug : STATE_DATA[cityData.stateCode]?.slug

  // Get nearby cities
  const nearbyCities = isState
    ? stateData.cities.slice(0, 12).map(city => ({
        name: city,
        state: stateData.name,
        stateCode: stateData.code,
        slug: generateCitySlug(city)
      }))
    : getNearbyCities(cityData.stateCode, cityData.name, 12)

  const faqSchema = generateFAQSchema(locationName, isState)
  const localBusinessSchema = generateLocalBusinessSchema(locationName, location)
  const breadcrumbSchema = generateBreadcrumbSchema(locationName, location, isState, stateSlug, stateName)

  return (
    <>
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <Script
        id="local-business-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
      <Script
        id="breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="min-h-screen bg-slate-900 text-white">
        {/* Header */}
        <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 px-6 py-4 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">O</span>
              </div>
              <span className="text-lg font-bold text-white">OwnerFi</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/for-realtors" className="hidden sm:block text-slate-300 hover:text-white text-sm">For Realtors</Link>
              <Link
                href="/auth?role=realtor"
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
              >
                Join Free
              </Link>
            </nav>
          </div>
        </header>

        <main>
          {/* Breadcrumbs */}
          <nav className="px-6 py-4 bg-slate-800/30">
            <div className="max-w-6xl mx-auto">
              <ol className="flex items-center gap-2 text-sm text-slate-400">
                <li><Link href="/" className="hover:text-white">Home</Link></li>
                <li>/</li>
                <li><Link href="/for-realtors" className="hover:text-white">For Realtors</Link></li>
                {!isState && (
                  <>
                    <li>/</li>
                    <li><Link href={`/buyer-leads/${stateSlug}`} className="hover:text-white">{stateName}</Link></li>
                  </>
                )}
                <li>/</li>
                <li className="text-white">{locationName}</li>
              </ol>
            </div>
          </nav>

          {/* Hero Section */}
          <section className="py-16 px-6 bg-gradient-to-b from-slate-800 to-slate-900">
            <div className="max-w-6xl mx-auto text-center">
              <div className="inline-block px-4 py-2 bg-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium mb-6">
                Buyer Leads for Realtors
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Buyer Leads in <span className="text-emerald-400">{fullLocation}</span>
              </h1>
              <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
                Get pre-qualified buyer leads in {locationName}. Join OwnerFi&apos;s referral network -
                1 free lead per month, only pay 30% when deals close.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/auth?role=realtor"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
                >
                  Get {locationName} Leads Free
                </Link>
                <Link
                  href="/for-realtors"
                  className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all"
                >
                  Learn More
                </Link>
              </div>
            </div>
          </section>

          {/* Stats */}
          <section className="py-12 px-6 bg-slate-800/30">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                <div className="bg-slate-900/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-emerald-400">Free</div>
                  <div className="text-slate-300 mt-2">To Join</div>
                </div>
                <div className="bg-slate-900/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-blue-400">1 Lead</div>
                  <div className="text-slate-300 mt-2">Free/Month</div>
                </div>
                <div className="bg-slate-900/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-purple-400">30%</div>
                  <div className="text-slate-300 mt-2">At Closing</div>
                </div>
                <div className="bg-slate-900/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-yellow-400">180 Days</div>
                  <div className="text-slate-300 mt-2">Exclusive</div>
                </div>
              </div>
            </div>
          </section>

          {/* How It Works */}
          <section className="py-16 px-6">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                How to Get Buyer Leads in {locationName}
              </h2>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                    <span className="text-emerald-400 font-bold text-xl">1</span>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">Sign Up Free</h3>
                  <p className="text-slate-300">
                    Create your account and set {locationName} as your service area. Takes less than 2 minutes.
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
                    <span className="text-blue-400 font-bold text-xl">2</span>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">Accept Leads</h3>
                  <p className="text-slate-300">
                    Browse available buyer leads in {locationName}. Sign the RF-701 agreement to accept.
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mb-4">
                    <span className="text-purple-400 font-bold text-xl">3</span>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">Close & Earn</h3>
                  <p className="text-slate-300">
                    Work with your lead and close the deal. Pay 30% referral fee only at closing.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Benefits */}
          <section className="py-16 px-6 bg-slate-800/30">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Why {locationName} Realtors Choose OwnerFi
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <div className="text-emerald-400 text-2xl mb-3">💰</div>
                  <h3 className="text-lg font-semibold text-white mb-2">No Upfront Cost</h3>
                  <p className="text-slate-400 text-sm">Free to join, 1 free lead per month. Only pay when deals close.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <div className="text-blue-400 text-2xl mb-3">✅</div>
                  <h3 className="text-lg font-semibold text-white mb-2">Pre-Qualified Buyers</h3>
                  <p className="text-slate-400 text-sm">All leads have provided contact info, location, and budget preferences.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <div className="text-purple-400 text-2xl mb-3">🔒</div>
                  <h3 className="text-lg font-semibold text-white mb-2">Exclusive Leads</h3>
                  <p className="text-slate-400 text-sm">180-day exclusive agreement. The lead is yours until closing.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <div className="text-yellow-400 text-2xl mb-3">📝</div>
                  <h3 className="text-lg font-semibold text-white mb-2">Legal Protection</h3>
                  <p className="text-slate-400 text-sm">Standard RF-701 referral agreement protects both parties.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <div className="text-orange-400 text-2xl mb-3">🔄</div>
                  <h3 className="text-lg font-semibold text-white mb-2">Double Referral</h3>
                  <p className="text-slate-400 text-sm">Can&apos;t service a lead? Refer to another agent and earn a cut.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <div className="text-cyan-400 text-2xl mb-3">📍</div>
                  <h3 className="text-lg font-semibold text-white mb-2">Local Focus</h3>
                  <p className="text-slate-400 text-sm">Set your 30-mile service area to get leads where you work.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Nearby Cities/State Cities */}
          {nearbyCities.length > 0 && (
            <section className="py-16 px-6">
              <div className="max-w-6xl mx-auto">
                <h2 className="text-3xl font-bold text-white text-center mb-12">
                  {isState ? `Buyer Leads in ${locationName} Cities` : `More Buyer Leads Near ${locationName}`}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {nearbyCities.map((city) => (
                    <Link
                      key={city.slug}
                      href={`/buyer-leads/${city.slug}`}
                      className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 hover:border-emerald-400/50 transition-all text-center"
                    >
                      <h3 className="text-white font-semibold">{city.name}</h3>
                      <p className="text-emerald-400 text-sm mt-1">Get Leads →</p>
                    </Link>
                  ))}
                </div>
                {!isState && (
                  <div className="text-center mt-8">
                    <Link
                      href={`/buyer-leads/${stateSlug}`}
                      className="text-emerald-400 hover:text-emerald-300 font-medium"
                    >
                      View All {stateName} Cities →
                    </Link>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* FAQ Section */}
          <section className="py-16 px-6 bg-slate-800/30">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                {locationName} Buyer Leads FAQ
              </h2>
              <div className="space-y-6">
                {faqSchema.mainEntity.map((faq: { name: string; acceptedAnswer: { text: string } }, i: number) => (
                  <div key={i} className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                    <h3 className="text-lg font-semibold text-white mb-3">{faq.name}</h3>
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
                Ready to Get Buyer Leads in {locationName}?
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Join OwnerFi&apos;s realtor referral network today. 1 free lead per month, only pay when deals close.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/auth?role=realtor"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
                >
                  Start Free Today
                </Link>
                <Link
                  href="/for-realtors/sample-agreement"
                  className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all"
                >
                  View Sample Agreement
                </Link>
              </div>
            </div>
          </section>

          {/* State Links for SEO */}
          <section className="py-12 px-6 bg-slate-800/50">
            <div className="max-w-6xl mx-auto">
              <h3 className="text-lg font-semibold text-white mb-6 text-center">
                Buyer Leads by State
              </h3>
              <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-2 text-sm">
                {Object.values(STATE_DATA).slice(0, 24).map((state) => (
                  <Link
                    key={state.slug}
                    href={`/buyer-leads/${state.slug}`}
                    className="text-slate-400 hover:text-emerald-400 transition-colors text-center"
                  >
                    {state.code}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </main>

        <LegalFooter />
      </div>
    </>
  )
}

// Generate static params for all locations (optional - for better performance)
export async function generateStaticParams() {
  // Return empty to make pages dynamic (generated on-demand)
  // This is better for 1000+ pages to avoid long build times
  return []
}
