import { Metadata } from 'next'
import Link from 'next/link'
import Script from 'next/script'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import HomePageClient from './HomePageClient'
import { LegalFooter } from '@/components/ui/LegalFooter'
import HeroVideo from '@/components/ui/HeroVideo'
import { SmartCTAButton } from '@/components/ui/SmartCTAButton'

// Force dynamic rendering to prevent static generation errors with headers()
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'No Bank Needed Homes | Owner Financing & Rent to Own Properties | Ownerfi',
  description: 'Find homes without bank financing! Browse owner financed properties, rent-to-own homes, seller financing, and creative deals in Texas, Florida & Georgia. Bad credit OK, flexible terms.',
  keywords: 'no bank financing, owner financing, rent to own homes, seller financing, buy house without bank, owner financed homes, rent to own properties, creative financing, subject to real estate, lease purchase, contract for deed, bad credit homes, no credit check homes, alternative financing',

  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://ownerfi.ai',
    siteName: 'Ownerfi',
    title: 'Owner Financed Homes | No Bank Financing Needed',
    description: 'Find owner financed properties in Texas, Florida, and Georgia. Skip the bank with flexible seller financing options. Low down payments, bad credit OK.',
    images: [
      {
        url: 'https://ownerfi.ai/og-homepage.png',
        width: 1200,
        height: 630,
        alt: 'Ownerfi - Owner Financed Properties Platform',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Owner Financed Homes - No Bank Needed | Ownerfi',
    description: 'Find seller financed homes with flexible terms. Skip traditional bank financing.',
    images: ['https://ownerfi.ai/og-homepage.png'],
    creator: '@ownerfi',
  },

  alternates: {
    canonical: 'https://ownerfi.ai',
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

// Schema Markup for SEO
function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://ownerfi.ai/#organization",
    "name": "Ownerfi",
    "url": "https://ownerfi.ai",
    "logo": "https://ownerfi.ai/logo.png",
    "description": "Owner-financed property search and lead-generation platform serving Texas, Florida, and Georgia.",
    "foundingDate": "2024",
    "founder": {
      "@type": "Person",
      "name": "Abdullah Abunasrah",
      "image": "https://ownerfi.ai/abdullah.png"
    },
    "areaServed": [
      {
        "@type": "State",
        "name": "Texas"
      },
      {
        "@type": "State",
        "name": "Florida"
      },
      {
        "@type": "State",
        "name": "Georgia"
      }
    ],
    "knowsAbout": [
      "Owner Financing",
      "Seller Financing",
      "Contract for Deed",
      "Subject To Real Estate",
      "Creative Financing"
    ],
    "sameAs": [
      "https://www.facebook.com/ownerfi",
      "https://www.linkedin.com/company/ownerfi",
      "https://twitter.com/ownerfi"
    ]
  }
}

function generateWebsiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "url": "https://ownerfi.ai",
    "name": "Ownerfi",
    "description": "Find owner financed homes without bank financing",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://ownerfi.ai/search?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  }
}

function generateServiceSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Owner Finance Property Discovery Platform",
    "provider": {
      "@type": "Organization",
      "name": "Ownerfi"
    },
    "serviceType": "Real Estate Discovery Platform",
    "areaServed": ["Texas", "Florida", "Georgia"],
    "description": "Discover owner financed properties across the US. Browse homes, get referred to licensed agents. No bank financing needed.",
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "USD",
      "lowPrice": "50000",
      "highPrice": "1000000"
    }
  }
}

export default async function HomePage() {
  let session = null
  try {
    session = await getServerSession(authOptions as any)
  } catch (error) {
    console.error('Session error:', error)
  }

  // Determine dashboard URL based on user role
  const getDashboardUrl = () => {
    if (!session?.user) return '/dashboard'
    const userRole = (session.user as any).role
    if (userRole === 'admin') return '/admin'
    if (userRole === 'realtor') return '/realtor-dashboard'
    return '/dashboard'
  }

  return (
    <>
      {/* Schema Markup */}
      <Script
        id="organization-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateOrganizationSchema())
        }}
      />
      <Script
        id="website-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateWebsiteSchema())
        }}
      />
      <Script
        id="service-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateServiceSchema())
        }}
      />

      <div className="bg-[#111625] text-white">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-[#111625]/90 backdrop-blur-xl border-b border-white/[0.06]">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6" aria-label="Main navigation">
            <div className="flex items-center justify-between h-14 sm:h-16">
              <Link href="/" className="flex items-center gap-3">
                <svg width="36" height="36" viewBox="0 0 100 100" fill="none"><defs><linearGradient id="lg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#00BC7D"/><stop offset="100%" stopColor="#3B82F6"/></linearGradient></defs><circle cx="50" cy="50" r="45" stroke="url(#lg)" strokeWidth="7" fill="none"/><ellipse cx="50" cy="50" rx="42" ry="22" stroke="url(#lg)" strokeWidth="5.5" fill="none" transform="rotate(-25 50 50)"/><ellipse cx="50" cy="50" rx="22" ry="42" stroke="url(#lg)" strokeWidth="5.5" fill="none" transform="rotate(-25 50 50)"/></svg>
                <span className="text-2xl font-bold text-white">Ownerfi</span>
              </Link>
              <div className="flex items-center gap-1 sm:gap-2">
                <Link href="/how-owner-finance-works" className="hidden sm:inline-flex text-sm text-slate-400 hover:text-white px-3 py-2 rounded-lg transition-colors">
                  How It Works
                </Link>
                <Link href="/for-realtors" className="hidden sm:inline-flex text-sm text-slate-400 hover:text-white px-3 py-2 rounded-lg transition-colors">
                  For Realtors
                </Link>
                {session ? (
                  <Link href={getDashboardUrl()} className="bg-[#00BC7D] hover:bg-[#00d68f] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors">
                    Dashboard
                  </Link>
                ) : (
                  <Link href="/auth" className="bg-[#00BC7D] hover:bg-[#00d68f] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors">
                    Get Started
                  </Link>
                )}
              </div>
            </div>
          </nav>
        </header>

        <main>
          {/* Section 1: Hero - Full Screen with CTA Only */}
          <section className="min-h-screen flex items-center justify-center px-4 py-16">
            <div className="max-w-7xl mx-auto w-full">
              <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
                {/* Left: Main Message */}
                <div className="text-center lg:text-left">
                  {/* Trust Badge — generic, non-numeric until we have verified, audited counts. */}
                  <div className="inline-flex items-center gap-2 bg-[#00BC7D]/10 border border-[#00BC7D]/30 rounded-full px-3 py-1.5 mb-4">
                    <div className="w-2 h-2 bg-[#00BC7D] rounded-full animate-pulse" />
                    <span className="text-[#00BC7D] text-xs font-semibold" data-translate="hero.trustBadge">Owner-Financed Properties Across the US</span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black text-white leading-tight mb-4">
                    <span data-translate="hero.title1">Swipe Your Way</span>
                    <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#00BC7D] via-blue-400 to-purple-400" data-translate="hero.title2">
                      Into Your Dream Home
                    </span>
                  </h1>

                  <p className="text-base sm:text-lg lg:text-xl text-slate-300 leading-relaxed mb-6 max-w-xl mx-auto lg:mx-0">
                    <span data-translate="hero.subtitle">The modern way to find owner-financed homes.</span> <span className="text-white font-semibold" data-translate="hero.subtitleBold">No bank approval needed.</span> <span data-translate="hero.subtitleEnd">Swipe through real properties you can afford today.</span>
                  </p>

                  {/* CTA Buttons - Large and Prominent */}
                  <div className="flex flex-col gap-3 mb-6 max-w-md mx-auto lg:mx-0">
                    <SmartCTAButton
                      className="group bg-gradient-to-r from-[#00BC7D] to-[#00BC7D]/50 hover:from-[#00BC7D]/50 hover:to-[#00d68f] text-white px-6 py-3.5 rounded-xl font-bold text-base transition-all duration-300 hover:scale-[1.02] shadow-xl hover:shadow-2xl text-center flex items-center justify-center gap-2"
                    >
                      <span data-translate="hero.ctaPrimary">Start Swiping Free</span>
                      <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </SmartCTAButton>

                    <Link
                      href="#how-it-works"
                      className="bg-slate-800/50 hover:bg-slate-700/50 border-2 border-slate-600 hover:border-slate-500 text-white px-6 py-3.5 rounded-xl font-semibold text-base transition-all duration-300 hover:scale-[1.02] text-center"
                    >
                      <span data-translate="hero.ctaSecondary">See How It Works</span>
                    </Link>
                  </div>

                  {/* Scroll Indicator */}
                  <div className="text-center lg:text-left mt-8">
                    <p className="text-slate-400 text-sm mb-2" data-translate="hero.scrollText">Scroll to learn more</p>
                    <svg className="w-6 h-6 text-slate-400 animate-bounce mx-auto lg:mx-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </div>

                {/* Right: App Preview / Phone Mockup */}
                <div className="relative">
                  {/* Floating labels — non-numeric until we have audit-ready counts. */}
                  <div className="absolute -top-8 -left-8 bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 shadow-2xl z-10 animate-float">
                    <div className="text-xl font-black text-[#00BC7D]">Owner-Financed</div>
                    <div className="text-slate-300 text-xs">No bank required</div>
                  </div>

                  <div className="absolute -bottom-8 -right-8 bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 shadow-2xl z-10 animate-float-delayed">
                    <div className="text-xl font-black text-blue-400">TX · FL · GA</div>
                    <div className="text-slate-300 text-xs">Growing coverage</div>
                  </div>

                  {/* Phone Mockup */}
                  <div className="relative mx-auto w-[320px] h-[640px]">
                    {/* Phone Frame */}
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 rounded-[3rem] p-3 shadow-2xl border-4 border-slate-700">
                      {/* Notch */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#111625] rounded-b-2xl" />

                      {/* Screen Content - App Demo Video */}
                      <div className="relative w-full h-full bg-[#111625] rounded-[2.5rem] overflow-hidden">
                        <HeroVideo />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Owner Financing Disclaimer */}
          <div className="bg-amber-900/30 border-y border-amber-500/30 py-4 px-6">
            <div className="max-w-4xl mx-auto text-center">
              <p className="text-amber-200 text-sm">
                <strong>Important:</strong> Subject to seller approval and verification. Not all properties listed will qualify for or offer owner financing.
                Financing type must be independently confirmed with the seller or their agent.
              </p>
            </div>
          </div>

          {/* Section Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>

          {/* Section 2: Why Choose Us / Benefits */}
          <section className="min-h-screen flex items-center justify-center py-16 px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-3" data-translate="whyChoose.title">
                  Why Choose Ownerfi?
                </h2>
                <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto" data-translate="whyChoose.subtitle">
                  The modern alternative to traditional home buying
                </p>
              </div>

              <div className="grid sm:grid-cols-3 gap-6 mb-12">
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 text-center">
                  <div className="w-12 h-12 bg-[#00BC7D]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-[#00BC7D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-white mb-2" data-translate="whyChoose.benefit1Title">Skip the Banks</h3>
                  <p className="text-sm text-slate-300" data-translate="whyChoose.benefit1Text">Work directly with sellers for flexible financing</p>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 text-center">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-white mb-2" data-translate="whyChoose.benefit2Title">Find Homes Fast</h3>
                  <p className="text-sm text-slate-300" data-translate="whyChoose.benefit2Text">Swipe through properties that match your budget</p>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 text-center">
                  <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-white mb-2" data-translate="whyChoose.benefit3Title">Real Properties</h3>
                  <p className="text-sm text-slate-300" data-translate="whyChoose.benefit3Text">Live owner-financed listings refreshed daily</p>
                </div>
              </div>

              {/* Social Media Caption */}
              <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl text-center">
                <p className="text-slate-300 text-sm">
                  <span data-translate="whyChoose.socialFollow">Follow</span>{' '}
                  <a
                    href="https://www.tiktok.com/@ownerfi.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00BC7D] hover:text-[#00d68f] font-semibold transition-colors"
                  >
                    @Ownerfi.ai
                  </a>
                  {' '}<span data-translate="whyChoose.socialText">for daily property updates</span>
                </p>
              </div>
            </div>
          </section>

          {/* Section Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>

          {/* Section 3: How It Works */}
          <section id="how-it-works" className="min-h-screen flex items-center justify-center py-16 px-4">
            <div className="max-w-4xl mx-auto w-full">
              <div className="text-center mb-12">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-3" data-translate="howItWorks.title">
                  How It Works
                </h2>
                <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto" data-translate="howItWorks.subtitle">
                  Three simple steps to find your perfect home
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {/* Step 1 */}
                <div className="relative">
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 text-center h-full">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 bg-[#00BC7D]/50 rounded-full flex items-center justify-center text-white font-black text-lg shadow-xl">
                      1
                    </div>
                    <div className="text-4xl mb-4 mt-2">📝</div>
                    <h3 className="text-base font-bold text-white mb-2" data-translate="howItWorks.step1Title">Tell Us Where</h3>
                    <p className="text-sm text-slate-300" data-translate="howItWorks.step1Text">
                      Share your preferred city and state. We'll match you with owner-financed properties nearby.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="relative">
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 text-center h-full">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-black text-lg shadow-xl">
                      2
                    </div>
                    <div className="text-4xl mb-4 mt-2">👆</div>
                    <h3 className="text-base font-bold text-white mb-2" data-translate="howItWorks.step2Title">Swipe Through Homes</h3>
                    <p className="text-sm text-slate-300" data-translate="howItWorks.step2Text">
                      Swipe right on homes you love, left on ones you don't. Just like your favorite dating app!
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="relative">
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 text-center h-full">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-black text-lg shadow-xl">
                      3
                    </div>
                    <div className="text-4xl mb-4 mt-2">🏡</div>
                    <h3 className="text-base font-bold text-white mb-2" data-translate="howItWorks.step3Title">Get Referred & Buy</h3>
                    <p className="text-sm text-slate-300" data-translate="howItWorks.step3Text">
                      Found your dream home? We refer you to a licensed agent in your area to represent you. No bank needed.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>

          {/* Section 4: Trust Stats (testimonials removed — no FTC-compliant
              signed-release endorsements on file; restore only with real
              customers who have granted written permission per 16 CFR §255). */}
          <section className="min-h-screen flex items-center justify-center py-16 px-4">
            <div className="max-w-4xl mx-auto w-full">
              {/* Trust Stats — neutral copy until we have audit-ready counts to claim. */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 text-center">
                  <div className="text-2xl font-black text-[#00BC7D] mb-2">Free</div>
                  <div className="text-slate-300 text-sm" data-translate="testimonials.stat1">To Join &amp; Browse</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 text-center">
                  <div className="text-2xl font-black text-blue-400 mb-2">Daily</div>
                  <div className="text-slate-300 text-sm" data-translate="testimonials.stat2">New Listings Added</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 text-center">
                  <div className="text-2xl font-black text-purple-400 mb-2">TX, FL, GA</div>
                  <div className="text-slate-300 text-sm" data-translate="testimonials.stat3">Growing Coverage</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 text-center">
                  <div className="text-4xl font-black text-yellow-400 mb-2">4.8★</div>
                  <div className="text-slate-300 text-sm" data-translate="testimonials.stat4">Average Rating</div>
                </div>
              </div>
            </div>
          </section>

          {/* No-Bank Options Section */}
          <section className="bg-gradient-to-b from-slate-800/50 to-slate-900/50 py-16 px-6">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-4" data-translate="noBankOptions.title">
                All Types of No-Bank Home Buying Options
              </h2>
              <p className="text-slate-300 text-center mb-12 max-w-2xl mx-auto" data-translate="noBankOptions.subtitle">
                We specialize in finding creative deals that don't require traditional bank financing.
                Each option has unique benefits - we'll help you find the right fit.
              </p>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <div className="bg-gradient-to-br from-[#004D33]/30 to-[#007A52]/30 rounded-xl p-6 border border-[#00BC7D]/30">
                  <h3 className="text-lg font-bold text-[#00BC7D] mb-4" data-translate="noBankOptions.option1Title">🏠 Owner Financing</h3>
                  <ul className="space-y-2 text-slate-300 text-sm">
                    <li data-translate="noBankOptions.option1Point1">• Immediate ownership</li>
                    <li data-translate="noBankOptions.option1Point2">• Get deed at closing</li>
                    <li data-translate="noBankOptions.option1Point3">• Build equity now</li>
                    <li data-translate="noBankOptions.option1Point4">• Tax benefits</li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/30 rounded-xl p-6 border border-blue-500/30">
                  <h3 className="text-lg font-bold text-blue-400 mb-4" data-translate="noBankOptions.option2Title">🔑 Rent to Own</h3>
                  <ul className="space-y-2 text-slate-300 text-sm">
                    <li data-translate="noBankOptions.option2Point1">• Try before you buy</li>
                    <li data-translate="noBankOptions.option2Point2">• Build down payment</li>
                    <li data-translate="noBankOptions.option2Point3">• Lock in price</li>
                    <li data-translate="noBankOptions.option2Point4">• Credit repair time</li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/30 rounded-xl p-6 border border-purple-500/30">
                  <h3 className="text-lg font-bold text-purple-400 mb-4" data-translate="noBankOptions.option3Title">📄 Lease Purchase</h3>
                  <ul className="space-y-2 text-slate-300 text-sm">
                    <li data-translate="noBankOptions.option3Point1">• Obligation to buy</li>
                    <li data-translate="noBankOptions.option3Point2">• Agreed future date</li>
                    <li data-translate="noBankOptions.option3Point3">• Credit toward price</li>
                    <li data-translate="noBankOptions.option3Point4">• Flexible terms</li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-orange-900/30 to-orange-800/30 rounded-xl p-6 border border-orange-500/30">
                  <h3 className="text-lg font-bold text-orange-400 mb-4" data-translate="noBankOptions.option4Title">🤝 Subject-To</h3>
                  <ul className="space-y-2 text-slate-300 text-sm">
                    <li data-translate="noBankOptions.option4Point1">• Take over payments</li>
                    <li data-translate="noBankOptions.option4Point2">• Quick closing</li>
                    <li data-translate="noBankOptions.option4Point3">• Low down payment</li>
                    <li data-translate="noBankOptions.option4Point4">• Keep existing rate</li>
                  </ul>
                </div>
              </div>

              <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-600/30 text-center">
                <p className="text-slate-300 mb-4">
                  <strong className="text-white" data-translate="noBankOptions.specialtyText">Our Specialty:</strong> <span data-translate="noBankOptions.specialtyDescription">Finding and structuring deals that work without banks.
                  Whether it's owner financing, rent-to-own, or other creative solutions - we have options for every situation.</span>
                </p>
                <Link href="/how-owner-finance-works" className="text-[#00BC7D] hover:text-[#00d68f] font-semibold" data-translate="noBankOptions.learnMore">
                  Learn more about each option →
                </Link>
              </div>
            </div>
          </section>

          {/* Benefits Section for SEO */}
          <section className="py-16 px-6">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12" data-translate="benefits.title">
                Benefits of Owner Financing Over Renting
              </h2>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-[#111625]/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-[#00BC7D] mb-3" data-translate="benefits.benefit1Title">No Bank Required</h3>
                  <p className="text-slate-300" data-translate="benefits.benefit1Text">Skip traditional mortgage requirements, credit checks, and lengthy approval processes.</p>
                </div>
                <div className="bg-[#111625]/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-blue-400 mb-3" data-translate="benefits.benefit2Title">Flexible Terms</h3>
                  <p className="text-slate-300" data-translate="benefits.benefit2Text">Negotiate directly with sellers for down payments, interest rates, and payment schedules.</p>
                </div>
                <div className="bg-[#111625]/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-purple-400 mb-3" data-translate="benefits.benefit3Title">Fast Closing</h3>
                  <p className="text-slate-300" data-translate="benefits.benefit3Text">Close deals in days, not months. No waiting for bank approvals or appraisals.</p>
                </div>
                <div className="bg-[#111625]/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-yellow-400 mb-3" data-translate="benefits.benefit4Title">Bad Credit OK</h3>
                  <p className="text-slate-300" data-translate="benefits.benefit4Text">Many sellers work with buyers who have less-than-perfect credit or are self-employed.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Location-Based SEO Content */}
          <section className="py-16 px-6">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12" data-translate="locations.title">
                Owner Financed Properties by State
              </h2>

              {/* Featured States */}
              <div className="grid md:grid-cols-3 gap-6 mb-12">
                <Link href="/owner-financing-texas" className="group">
                  <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-8 text-center hover:border-[#00BC7D]/50 transition-all duration-300 hover:scale-[1.02]">
                    <h3 className="text-2xl font-bold text-[#00BC7D] mb-2 group-hover:text-[#00d68f]">Texas</h3>
                    <p className="text-slate-300 mb-4" data-translate="locations.texasSubtitle">Houston, Dallas, Austin, San Antonio</p>
                    <p className="text-sm text-slate-400" data-translate="locations.texasProperties">Active listings statewide</p>
                  </div>
                </Link>
                <Link href="/owner-financing-florida" className="group">
                  <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-8 text-center hover:border-blue-400/50 transition-all duration-300 hover:scale-[1.02]">
                    <h3 className="text-2xl font-bold text-blue-400 mb-2 group-hover:text-blue-300">Florida</h3>
                    <p className="text-slate-300 mb-4" data-translate="locations.floridaSubtitle">Miami, Orlando, Tampa, Jacksonville</p>
                    <p className="text-sm text-slate-400" data-translate="locations.floridaProperties">Active listings statewide</p>
                  </div>
                </Link>
                <Link href="/owner-financing-georgia" className="group">
                  <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-8 text-center hover:border-purple-400/50 transition-all duration-300 hover:scale-[1.02]">
                    <h3 className="text-2xl font-bold text-purple-400 mb-2 group-hover:text-purple-300">Georgia</h3>
                    <p className="text-slate-300 mb-4" data-translate="locations.georgiaSubtitle">Atlanta, Augusta, Columbus, Savannah</p>
                    <p className="text-sm text-slate-400" data-translate="locations.georgiaProperties">Active listings statewide</p>
                  </div>
                </Link>
              </div>

              {/* Simplified Coverage */}
              <div className="bg-slate-800/30 rounded-2xl p-8 border border-slate-700/50">
                <h3 className="text-2xl font-bold text-white text-center mb-6" data-translate="locations.nationwideTitle">Growing Coverage</h3>
                <div className="text-center mb-6">
                  <p className="text-slate-300 mb-4" data-translate="locations.nationwideSubtitle">Currently serving Texas, Florida, and Georgia with more states coming soon</p>
                  <SmartCTAButton className="inline-block bg-gradient-to-r from-[#00BC7D] to-[#00BC7D]/50 hover:from-[#00BC7D]/50 hover:to-[#00d68f] text-white py-3 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg">
                    <span data-translate="locations.viewAllCta">View All Properties →</span>
                  </SmartCTAButton>
                </div>
              </div>

              {/* Alternative Financing Options */}
              <div className="mt-12 bg-slate-800/30 rounded-2xl p-8 border border-slate-700/50">
                <h3 className="text-2xl font-bold text-white text-center mb-8" data-translate="locations.alternativeTitle">Alternative Financing Solutions</h3>
                <div className="grid md:grid-cols-3 gap-6">
                  <Link href="/rent-to-own-homes" className="group">
                    <div className="bg-gradient-to-br from-[#004D33]/30 to-[#007A52]/30 rounded-xl p-6 border border-[#00BC7D]/30 hover:border-[#00BC7D]/50 transition-all duration-300 hover:scale-[1.02]">
                      <h4 className="text-xl font-bold text-[#00BC7D] mb-3 group-hover:text-[#00d68f]" data-translate="locations.rentToOwnTitle">Rent to Own Homes</h4>
                      <p className="text-slate-300 text-sm" data-translate="locations.rentToOwnText">Better than traditional rent-to-own with immediate ownership options.</p>
                    </div>
                  </Link>
                  <Link href="/bad-credit-home-buying" className="group">
                    <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/30 rounded-xl p-6 border border-blue-500/30 hover:border-blue-400/50 transition-all duration-300 hover:scale-[1.02]">
                      <h4 className="text-xl font-bold text-blue-400 mb-3 group-hover:text-blue-300" data-translate="locations.badCreditTitle">Bad Credit Solutions</h4>
                      <p className="text-slate-300 text-sm" data-translate="locations.badCreditText">Buy a home even with poor credit through flexible owner financing.</p>
                    </div>
                  </Link>
                  <Link href="/no-credit-check-homes" className="group">
                    <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/30 rounded-xl p-6 border border-purple-500/30 hover:border-purple-400/50 transition-all duration-300 hover:scale-[1.02]">
                      <h4 className="text-xl font-bold text-purple-400 mb-3 group-hover:text-purple-300" data-translate="locations.noCreditTitle">No Credit Check</h4>
                      <p className="text-slate-300 text-sm" data-translate="locations.noCreditText">Find homes that don't require credit checks or bank approval.</p>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </section>


        </main>

        {/* SEO-Optimized Footer */}
        <footer className="bg-[#111625] border-t border-slate-800 py-12 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-5 gap-8 mb-8">
              <div>
                <h3 className="text-white font-semibold mb-4">Top States</h3>
                <ul className="space-y-2">
                  <li><Link href="/owner-financing-texas" className="text-slate-400 hover:text-[#00BC7D] transition-colors">Texas</Link></li>
                  <li><Link href="/owner-financing-florida" className="text-slate-400 hover:text-blue-400 transition-colors">Florida</Link></li>
                  <li><Link href="/owner-financing-california" className="text-slate-400 hover:text-purple-400 transition-colors">California</Link></li>
                  <li><Link href="/owner-financing-georgia" className="text-slate-400 hover:text-yellow-400 transition-colors">Georgia</Link></li>
                  <li><Link href="/owner-financing-new-york" className="text-slate-400 hover:text-pink-400 transition-colors">New York</Link></li>
                  <li><Link href="/owner-financing-north-carolina" className="text-slate-400 hover:text-orange-400 transition-colors">North Carolina</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-4">Major Cities</h3>
                <ul className="space-y-2">
                  <li><Link href="/houston-owner-financing" className="text-slate-400 hover:text-white transition-colors">Houston</Link></li>
                  <li><Link href="/los-angeles-owner-financing" className="text-slate-400 hover:text-white transition-colors">Los Angeles</Link></li>
                  <li><Link href="/chicago-owner-financing" className="text-slate-400 hover:text-white transition-colors">Chicago</Link></li>
                  <li><Link href="/phoenix-owner-financing" className="text-slate-400 hover:text-white transition-colors">Phoenix</Link></li>
                  <li><Link href="/philadelphia-owner-financing" className="text-slate-400 hover:text-white transition-colors">Philadelphia</Link></li>
                  <li><Link href="/dallas-owner-financing" className="text-slate-400 hover:text-white transition-colors">Dallas</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-4">Financing Options</h3>
                <ul className="space-y-2">
                  <li><Link href="/rent-to-own-homes" className="text-slate-400 hover:text-[#00BC7D] transition-colors">Rent to Own</Link></li>
                  <li><Link href="/bad-credit-home-buying" className="text-slate-400 hover:text-blue-400 transition-colors">Bad Credit Solutions</Link></li>
                  <li><Link href="/no-credit-check-homes" className="text-slate-400 hover:text-purple-400 transition-colors">No Credit Check</Link></li>
                  <li><Link href="/how-owner-finance-works" className="text-slate-400 hover:text-white transition-colors">How It Works</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-4">Company</h3>
                <ul className="space-y-2">
                  <li><Link href="/about" className="text-slate-400 hover:text-white transition-colors">About Us</Link></li>
                  <li><Link href="/contact" className="text-slate-400 hover:text-white transition-colors">Contact</Link></li>
                  <li><Link href="/for-realtors" className="text-slate-400 hover:text-white transition-colors">For Realtors</Link></li>
                  <li><SmartCTAButton className="text-slate-400 hover:text-white transition-colors text-left">Get Started</SmartCTAButton></li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-4">Account</h3>
                <ul className="space-y-2">
                  <li><Link href={getDashboardUrl()} className="text-slate-400 hover:text-white transition-colors">Dashboard</Link></li>
                </ul>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-8">
              <p className="text-center text-slate-400 text-sm">
                © {new Date().getFullYear()} Ownerfi. All rights reserved. |
                <Link href="/terms" className="hover:text-white ml-2">Terms</Link> |
                <Link href="/privacy" className="hover:text-white ml-2">Privacy</Link> |
                <Link href="/tcpa-compliance" className="hover:text-white ml-2">TCPA Compliance</Link>
              </p>
            </div>
          </div>
        </footer>

        <LegalFooter includeInvestment={true} includeState={true} />

        {/* Client Components */}
        <HomePageClient />
      </div>
    </>
  )
}