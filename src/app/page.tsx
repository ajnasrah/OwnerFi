import { Metadata } from 'next'
import Link from 'next/link'
import Script from 'next/script'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import HomePageClient from './HomePageClient'
import { LegalFooter } from '@/components/ui/LegalFooter'
import Image from 'next/image'

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
  const session = await getServerSession(authOptions)

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
          {/* Hero Section with SEO Content */}
          <section className="px-6 lg:px-12 py-12 min-h-[600px]">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
                  Buy a Home <span className="text-emerald-400">Without a Bank</span>
                  <div className="mt-4 text-2xl space-y-2">
                    <div>Owner Financing</div>
                    <div>Rent to Own</div>
                    <div>Creative Deals</div>
                  </div>
                </h1>
                <p className="text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto">
                  We specialize in finding homes you can buy without traditional bank financing.
                  Browse owner financed properties, rent-to-own homes, and creative deals nationwide.
                  Bad credit OK, flexible terms available.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="max-w-md mx-auto space-y-4 mb-12">
                <Link
                  href="/signup"
                  className="w-full block bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg hover:shadow-xl text-center"
                >
                  Browse No-Bank Properties
                </Link>

                <Link
                  href="/realtor-signup"
                  className="w-full block bg-transparent border-2 border-slate-500 hover:border-slate-400 hover:bg-slate-700/30 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] text-center"
                >
                  I'm a Real Estate Agent
                </Link>

                <Link
                  href="/how-owner-finance-works"
                  className="w-full block bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-3 px-6 rounded-xl font-medium text-base transition-all duration-300 hover:scale-[1.02] shadow-md text-center"
                >
                  📚 Learn About No-Bank Options
                </Link>
              </div>

              {/* Trust Signals */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 text-center">
                  <div className="text-3xl font-bold text-emerald-400 mb-2">500+</div>
                  <div className="text-slate-300">Available Properties</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 text-center">
                  <div className="text-3xl font-bold text-blue-400 mb-2">No Banks</div>
                  <div className="text-slate-300">Multiple Options</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 text-center">
                  <div className="text-3xl font-bold text-purple-400 mb-2">50 States</div>
                  <div className="text-slate-300">Nationwide Coverage</div>
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