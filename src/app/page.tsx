import { Metadata } from 'next'
import Link from 'next/link'
import Script from 'next/script'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import HomePageClient from './HomePageClient'
import { LegalFooter } from '@/components/ui/LegalFooter'
import Image from 'next/image'
import HeroVideo from '@/components/ui/HeroVideo'

// Force dynamic rendering to prevent static generation errors with headers()
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'No Bank Needed Homes | Owner Financing & Rent to Own Properties | OwnerFi',
  description: 'Find homes without bank financing! Browse owner financed properties, rent-to-own homes, seller financing, and creative deals across all 50 states. Bad credit OK, flexible terms.',
  keywords: 'no bank financing, owner financing, rent to own homes, seller financing, buy house without bank, owner financed homes, rent to own properties, creative financing, subject to real estate, lease purchase, contract for deed, bad credit homes, no credit check homes, alternative financing',

  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://ownerfi.ai',
    siteName: 'OwnerFi',
    title: 'Owner Financed Homes | No Bank Financing Needed',
    description: 'Find owner financed properties in Texas, Florida, and Georgia. Skip the bank with flexible seller financing options. Low down payments, bad credit OK.',
    images: [
      {
        url: 'https://ownerfi.ai/og-homepage.png',
        width: 1200,
        height: 630,
        alt: 'OwnerFi - Owner Financed Properties Platform',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Owner Financed Homes - No Bank Needed | OwnerFi',
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
    "name": "OwnerFi",
    "url": "https://ownerfi.ai",
    "logo": "https://ownerfi.ai/logo.png",
    "description": "Leading platform for owner financed properties in Texas, Florida, and Georgia",
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
    "name": "OwnerFi",
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
    "name": "Owner Finance Property Marketplace",
    "provider": {
      "@type": "Organization",
      "name": "OwnerFi"
    },
    "serviceType": "Real Estate Marketplace",
    "areaServed": ["Texas", "Florida", "Georgia"],
    "description": "Connect buyers with owner financed properties. No bank financing needed.",
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

      <div className="bg-slate-900 text-white">
        {/* SEO-Optimized Header */}
        <header>
          <nav className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 px-4 lg:px-6 py-4" aria-label="Main navigation">
            <div className="flex justify-between items-center max-w-6xl mx-auto">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">O</span>
                </div>
                <span className="text-lg font-bold text-white">OwnerFi</span>
              </div>

              <div className="flex items-center gap-4">
                <Link
                  href="/how-owner-finance-works"
                  className="hidden sm:block text-slate-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  How It Works
                </Link>
                {session ? (
                  <Link
                    href="/dashboard"
                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-300 hover:scale-105 shadow-lg shadow-emerald-500/25"
                  >
                    Go to Dashboard
                  </Link>
                ) : (
                  <Link
                    href="/auth/signin"
                    className="text-slate-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </div>
          </nav>
        </header>

        <main>
          {/* Hero Section - Modern App Showcase */}
          <section className="px-6 lg:px-12 py-16 min-h-screen flex items-center">
            <div className="max-w-7xl mx-auto w-full">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                {/* Left: Main Message */}
                <div>
                  {/* Trust Badge */}
                  <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-4 py-2 mb-6">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-emerald-400 text-sm font-semibold">Trusted by 1,000+ Homebuyers</span>
                  </div>

                  <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-white leading-[1.1] mb-6">
                    Swipe Your Way
                    <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400">
                      Into Your Dream Home
                    </span>
                  </h1>

                  <p className="text-xl md:text-2xl text-slate-300 leading-relaxed mb-8 max-w-xl">
                    The modern way to find owner-financed homes. <span className="text-white font-semibold">No bank approval needed.</span> Swipe through real properties you can afford today.
                  </p>

                  {/* Key Benefits */}
                  <div className="space-y-3 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-slate-200 text-lg">No bank approval or credit check required</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-slate-200 text-lg">Real properties with verified financing terms</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-slate-200 text-lg">Match with properties you can actually afford</span>
                    </div>
                  </div>

                  {/* CTA Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <Link
                      href="/signup"
                      className="group bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 hover:scale-[1.02] shadow-xl hover:shadow-2xl text-center flex items-center justify-center gap-2"
                      data-event="cta_click"
                      data-location="hero"
                    >
                      Start Swiping Free
                      <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Link>

                    <Link
                      href="#how-it-works"
                      className="bg-slate-800/50 hover:bg-slate-700/50 border-2 border-slate-600 hover:border-slate-500 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 hover:scale-[1.02] text-center"
                    >
                      See How It Works
                    </Link>
                  </div>

                  {/* Social Media Caption */}
                  <div className="mb-8 p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl">
                    <p className="text-slate-300 text-center text-sm">
                      Swipe real owner-finance homes at <span className="text-white font-semibold">OwnerFi</span> — follow{' '}
                      <a
                        href="https://www.tiktok.com/@ownerfi.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                      >
                        @OwnerFi.ai
                      </a>
                      {' '}for daily updates
                    </p>
                  </div>

                  {/* Trust Indicators */}
                  <div className="flex items-center gap-6 text-sm text-slate-400">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span>Bank-level security</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>100% Free to browse</span>
                    </div>
                  </div>
                </div>

                {/* Right: App Preview / Phone Mockup */}
                <div className="relative hidden lg:block">
                  {/* Floating Stats */}
                  <div className="absolute -top-8 -left-8 bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 shadow-2xl z-10 animate-float">
                    <div className="text-3xl font-black text-emerald-400">500+</div>
                    <div className="text-slate-300 text-sm">Properties</div>
                  </div>

                  <div className="absolute -bottom-8 -right-8 bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 shadow-2xl z-10 animate-float-delayed">
                    <div className="text-3xl font-black text-blue-400">50</div>
                    <div className="text-slate-300 text-sm">States</div>
                  </div>

                  {/* Phone Mockup */}
                  <div className="relative mx-auto w-[320px] h-[640px]">
                    {/* Phone Frame */}
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 rounded-[3rem] p-3 shadow-2xl border-4 border-slate-700">
                      {/* Notch */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-2xl" />

                      {/* Screen Content - App Demo Video */}
                      <div className="relative w-full h-full bg-slate-900 rounded-[2.5rem] overflow-hidden">
                        <HeroVideo />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* How It Works Section */}
          <section id="how-it-works" className="bg-slate-800/30 py-20 px-6">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
                  How It Works
                </h2>
                <p className="text-xl text-slate-300 max-w-2xl mx-auto">
                  Three simple steps to find your perfect home without bank approval
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8 mb-16">
                {/* Step 1 */}
                <div className="relative">
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 text-center h-full">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-white font-black text-xl shadow-xl">
                      1
                    </div>
                    <div className="text-5xl mb-6 mt-2">📝</div>
                    <h3 className="text-xl font-bold text-white mb-3">Set Your Budget</h3>
                    <p className="text-slate-300">
                      Tell us your max monthly payment and down payment. We'll only show you homes you can actually afford.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="relative">
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 text-center h-full">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-black text-xl shadow-xl">
                      2
                    </div>
                    <div className="text-5xl mb-6 mt-2">👆</div>
                    <h3 className="text-xl font-bold text-white mb-3">Swipe Through Homes</h3>
                    <p className="text-slate-300">
                      Swipe right on homes you love, left on ones you don't. Just like your favorite dating app, but for houses!
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="relative">
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 text-center h-full">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white font-black text-xl shadow-xl">
                      3
                    </div>
                    <div className="text-5xl mb-6 mt-2">🏡</div>
                    <h3 className="text-xl font-bold text-white mb-3">Connect & Buy</h3>
                    <p className="text-slate-300">
                      Found your dream home? We connect you directly with sellers for owner financing. No bank needed.
                    </p>
                  </div>
                </div>
              </div>

              {/* Interactive App Demo Video/GIF Placeholder */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-slate-700 rounded-3xl p-8 text-center">
                <div className="max-w-4xl mx-auto">
                  <h3 className="text-2xl font-bold text-white mb-4">See It In Action</h3>
                  <div className="relative aspect-video bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-6xl mb-4">🎬</div>
                        <p className="text-slate-300 text-lg">Interactive demo coming soon</p>
                        <p className="text-slate-400 text-sm mt-2">Watch how easy it is to swipe through properties</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Social Proof / Testimonials */}
          <section className="py-20 px-6 bg-slate-900">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
                  Real People, Real Homes
                </h2>
                <p className="text-xl text-slate-300 max-w-2xl mx-auto">
                  Join thousands of renters who found their dream home without bank approval
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8 mb-12">
                {/* Testimonial 1 */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-slate-200 mb-4 italic">
                    "I was stuck renting for years because of my credit. OwnerFi helped me find a home I could actually buy. Now I'm a homeowner!"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                      S
                    </div>
                    <div>
                      <div className="text-white font-semibold">Sarah M.</div>
                      <div className="text-slate-400 text-sm">Houston, TX</div>
                    </div>
                  </div>
                </div>

                {/* Testimonial 2 */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-slate-200 mb-4 italic">
                    "The app is so easy to use. Swiping through houses felt natural and fun. Found my home in just 2 weeks!"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                      M
                    </div>
                    <div>
                      <div className="text-white font-semibold">Marcus T.</div>
                      <div className="text-slate-400 text-sm">Atlanta, GA</div>
                    </div>
                  </div>
                </div>

                {/* Testimonial 3 */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-slate-200 mb-4 italic">
                    "Self-employed and couldn't get bank approval. Owner financing through OwnerFi was the perfect solution."
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                      J
                    </div>
                    <div>
                      <div className="text-white font-semibold">Jennifer K.</div>
                      <div className="text-slate-400 text-sm">Miami, FL</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trust Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 text-center">
                  <div className="text-4xl font-black text-emerald-400 mb-2">1,000+</div>
                  <div className="text-slate-300 text-sm">Happy Homeowners</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 text-center">
                  <div className="text-4xl font-black text-blue-400 mb-2">500+</div>
                  <div className="text-slate-300 text-sm">Active Properties</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 text-center">
                  <div className="text-4xl font-black text-purple-400 mb-2">50</div>
                  <div className="text-slate-300 text-sm">States Covered</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 text-center">
                  <div className="text-4xl font-black text-yellow-400 mb-2">4.8★</div>
                  <div className="text-slate-300 text-sm">Average Rating</div>
                </div>
              </div>
            </div>
          </section>

          {/* No-Bank Options Section */}
          <section className="bg-gradient-to-b from-slate-800/50 to-slate-900/50 py-16 px-6">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-4">
                All Types of No-Bank Home Buying Options
              </h2>
              <p className="text-slate-300 text-center mb-12 max-w-2xl mx-auto">
                We specialize in finding creative deals that don't require traditional bank financing.
                Each option has unique benefits - we'll help you find the right fit.
              </p>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/30 rounded-xl p-6 border border-emerald-500/30">
                  <h3 className="text-lg font-bold text-emerald-400 mb-4">🏠 Owner Financing</h3>
                  <ul className="space-y-2 text-slate-300 text-sm">
                    <li>• Immediate ownership</li>
                    <li>• Get deed at closing</li>
                    <li>• Build equity now</li>
                    <li>• Tax benefits</li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/30 rounded-xl p-6 border border-blue-500/30">
                  <h3 className="text-lg font-bold text-blue-400 mb-4">🔑 Rent to Own</h3>
                  <ul className="space-y-2 text-slate-300 text-sm">
                    <li>• Try before you buy</li>
                    <li>• Build down payment</li>
                    <li>• Lock in price</li>
                    <li>• Credit repair time</li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/30 rounded-xl p-6 border border-purple-500/30">
                  <h3 className="text-lg font-bold text-purple-400 mb-4">📄 Lease Purchase</h3>
                  <ul className="space-y-2 text-slate-300 text-sm">
                    <li>• Obligation to buy</li>
                    <li>• Agreed future date</li>
                    <li>• Credit toward price</li>
                    <li>• Flexible terms</li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-orange-900/30 to-orange-800/30 rounded-xl p-6 border border-orange-500/30">
                  <h3 className="text-lg font-bold text-orange-400 mb-4">🤝 Subject-To</h3>
                  <ul className="space-y-2 text-slate-300 text-sm">
                    <li>• Take over payments</li>
                    <li>• Quick closing</li>
                    <li>• Low down payment</li>
                    <li>• Keep existing rate</li>
                  </ul>
                </div>
              </div>

              <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-600/30 text-center">
                <p className="text-slate-300 mb-4">
                  <strong className="text-white">Our Specialty:</strong> Finding and structuring deals that work without banks.
                  Whether it's owner financing, rent-to-own, or other creative solutions - we have options for every situation.
                </p>
                <Link href="/how-owner-finance-works" className="text-emerald-400 hover:text-emerald-300 font-semibold">
                  Learn more about each option →
                </Link>
              </div>
            </div>
          </section>

          {/* Benefits Section for SEO */}
          <section className="py-16 px-6">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Benefits of Owner Financing Over Renting
              </h2>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-emerald-400 mb-3">No Bank Required</h3>
                  <p className="text-slate-300">Skip traditional mortgage requirements, credit checks, and lengthy approval processes.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-blue-400 mb-3">Flexible Terms</h3>
                  <p className="text-slate-300">Negotiate directly with sellers for down payments, interest rates, and payment schedules.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-purple-400 mb-3">Fast Closing</h3>
                  <p className="text-slate-300">Close deals in days, not months. No waiting for bank approvals or appraisals.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-yellow-400 mb-3">Bad Credit OK</h3>
                  <p className="text-slate-300">Many sellers work with buyers who have less-than-perfect credit or are self-employed.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Location-Based SEO Content */}
          <section className="py-16 px-6">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Owner Financed Properties by State
              </h2>

              {/* Featured States */}
              <div className="grid md:grid-cols-3 gap-6 mb-12">
                <Link href="/owner-financing-texas" className="group">
                  <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-8 text-center hover:border-emerald-400/50 transition-all duration-300 hover:scale-[1.02]">
                    <h3 className="text-2xl font-bold text-emerald-400 mb-2 group-hover:text-emerald-300">Texas</h3>
                    <p className="text-slate-300 mb-4">Houston, Dallas, Austin, San Antonio</p>
                    <p className="text-sm text-slate-400">200+ Properties Available</p>
                  </div>
                </Link>
                <Link href="/owner-financing-florida" className="group">
                  <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-8 text-center hover:border-blue-400/50 transition-all duration-300 hover:scale-[1.02]">
                    <h3 className="text-2xl font-bold text-blue-400 mb-2 group-hover:text-blue-300">Florida</h3>
                    <p className="text-slate-300 mb-4">Miami, Orlando, Tampa, Jacksonville</p>
                    <p className="text-sm text-slate-400">150+ Properties Available</p>
                  </div>
                </Link>
                <Link href="/owner-financing-georgia" className="group">
                  <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-8 text-center hover:border-purple-400/50 transition-all duration-300 hover:scale-[1.02]">
                    <h3 className="text-2xl font-bold text-purple-400 mb-2 group-hover:text-purple-300">Georgia</h3>
                    <p className="text-slate-300 mb-4">Atlanta, Augusta, Columbus, Savannah</p>
                    <p className="text-sm text-slate-400">100+ Properties Available</p>
                  </div>
                </Link>
              </div>

              {/* Simplified Coverage */}
              <div className="bg-slate-800/30 rounded-2xl p-8 border border-slate-700/50">
                <h3 className="text-2xl font-bold text-white text-center mb-6">Available Nationwide</h3>
                <div className="text-center mb-6">
                  <p className="text-slate-300 mb-4">Properties available in all 50 states</p>
                  <Link href="/signup" className="inline-block bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white py-3 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg">
                    View All Properties →
                  </Link>
                </div>
              </div>

              {/* Alternative Financing Options */}
              <div className="mt-12 bg-slate-800/30 rounded-2xl p-8 border border-slate-700/50">
                <h3 className="text-2xl font-bold text-white text-center mb-8">Alternative Financing Solutions</h3>
                <div className="grid md:grid-cols-3 gap-6">
                  <Link href="/rent-to-own-homes" className="group">
                    <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/30 rounded-xl p-6 border border-emerald-500/30 hover:border-emerald-400/50 transition-all duration-300 hover:scale-[1.02]">
                      <h4 className="text-xl font-bold text-emerald-400 mb-3 group-hover:text-emerald-300">Rent to Own Homes</h4>
                      <p className="text-slate-300 text-sm">Better than traditional rent-to-own with immediate ownership options.</p>
                    </div>
                  </Link>
                  <Link href="/bad-credit-home-buying" className="group">
                    <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/30 rounded-xl p-6 border border-blue-500/30 hover:border-blue-400/50 transition-all duration-300 hover:scale-[1.02]">
                      <h4 className="text-xl font-bold text-blue-400 mb-3 group-hover:text-blue-300">Bad Credit Solutions</h4>
                      <p className="text-slate-300 text-sm">Buy a home even with poor credit through flexible owner financing.</p>
                    </div>
                  </Link>
                  <Link href="/no-credit-check-homes" className="group">
                    <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/30 rounded-xl p-6 border border-purple-500/30 hover:border-purple-400/50 transition-all duration-300 hover:scale-[1.02]">
                      <h4 className="text-xl font-bold text-purple-400 mb-3 group-hover:text-purple-300">No Credit Check</h4>
                      <p className="text-slate-300 text-sm">Find homes that don't require credit checks or bank approval.</p>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </section>


        </main>

        {/* SEO-Optimized Footer */}
        <footer className="bg-slate-900 border-t border-slate-800 py-12 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-5 gap-8 mb-8">
              <div>
                <h3 className="text-white font-semibold mb-4">Top States</h3>
                <ul className="space-y-2">
                  <li><Link href="/owner-financing-texas" className="text-slate-400 hover:text-emerald-400 transition-colors">Texas</Link></li>
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
                  <li><Link href="/rent-to-own-homes" className="text-slate-400 hover:text-emerald-400 transition-colors">Rent to Own</Link></li>
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
                  <li><Link href="/realtor" className="text-slate-400 hover:text-white transition-colors">For Realtors</Link></li>
                  <li><Link href="/signup" className="text-slate-400 hover:text-white transition-colors">Sign Up</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-4">Account</h3>
                <ul className="space-y-2">
                  <li><Link href="/auth/signin" className="text-slate-400 hover:text-white transition-colors">Sign In</Link></li>
                  <li><Link href="/auth/signup" className="text-slate-400 hover:text-white transition-colors">Create Account</Link></li>
                  <li><Link href="/realtor-signup" className="text-slate-400 hover:text-white transition-colors">Agent Sign Up</Link></li>
                  <li><Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors">Dashboard</Link></li>
                </ul>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-8">
              <p className="text-center text-slate-400 text-sm">
                © 2024 OwnerFi. All rights reserved. |
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