import { Metadata } from 'next'
import Link from 'next/link'
import Script from 'next/script'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import HomePageClient from './HomePageClient'
import { LegalFooter } from '@/components/ui/LegalFooter'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Owner Financed Homes in Texas, Florida & Georgia | No Bank Needed | OwnerFi',
  description: 'Find owner financed properties with no bank financing required. Browse seller financed homes in TX, FL, and GA. Low down payments, flexible terms, bad credit OK. Skip the bank, buy direct from owners.',
  keywords: 'owner financing, owner financed homes, seller financing, no bank financing, buy house without bank, owner finance texas, owner finance florida, owner finance georgia, creative financing, rent to own homes, bad credit home loans, self employed mortgage, contract for deed, subject to real estate',

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
                  Owner Financed Homes in <span className="text-emerald-400">Texas</span>, <span className="text-blue-400">Florida</span> & <span className="text-purple-400">Georgia</span>
                  <span className="block mt-2 text-3xl">No Bank Financing Needed</span>
                </h1>
                <p className="text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto">
                  Skip traditional mortgage requirements. Buy directly from property owners with flexible seller financing.
                  Low down payments, flexible terms, and bad credit options available.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="max-w-md mx-auto space-y-4 mb-12">
                <Link
                  href="/signup"
                  className="w-full block bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg hover:shadow-xl text-center"
                >
                  Browse Owner Financed Properties
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
                  📚 Learn How Owner Financing Works
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
                  <div className="text-slate-300">Direct Owner Deals</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 text-center">
                  <div className="text-3xl font-bold text-purple-400 mb-2">3 States</div>
                  <div className="text-slate-300">TX, FL, GA Coverage</div>
                </div>
              </div>
            </div>
          </section>

          {/* Benefits Section for SEO */}
          <section className="bg-slate-800/30 py-16 px-6">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Why Choose Owner Financing?
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
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Owner Financed Properties by State
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
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
            </div>
          </section>

          {/* FAQ Section for SEO */}
          <section className="bg-slate-800/30 py-16 px-6">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Frequently Asked Questions
              </h2>
              <div className="space-y-6">
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">What is owner financing?</h3>
                  <p className="text-slate-300">Owner financing, also known as seller financing, is when the property owner acts as the bank, allowing you to make payments directly to them instead of getting a traditional mortgage.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">Do I need good credit for owner financing?</h3>
                  <p className="text-slate-300">Many sellers are flexible with credit requirements. While some may check credit, others focus more on your down payment and ability to make monthly payments.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">How fast can I close with owner financing?</h3>
                  <p className="text-slate-300">Owner financed deals can close much faster than traditional mortgages - often in 7-14 days instead of 30-45 days, since there's no bank approval process.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Founder Section with Optimized Image */}
          <section className="py-16 px-6">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-8">Meet the Founder</h2>
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 max-w-2xl mx-auto">
                <Image
                  src="/abdullah.png"
                  alt="Abdullah Abunasrah - Founder and CEO of OwnerFi, owner financing expert"
                  width={120}
                  height={120}
                  className="rounded-full mx-auto mb-6 border-4 border-emerald-400/50"
                  loading="lazy"
                />
                <h3 className="text-2xl font-bold text-white mb-2">Abdullah Abunasrah</h3>
                <p className="text-emerald-400 font-medium mb-4">Founder & CEO</p>
                <p className="text-slate-300 leading-relaxed">
                  "We're making homeownership accessible by connecting buyers directly with sellers who offer financing.
                  No banks, no barriers - just people helping people achieve their dream of owning a home."
                </p>
              </div>
            </div>
          </section>
        </main>

        {/* SEO-Optimized Footer */}
        <footer className="bg-slate-900 border-t border-slate-800 py-12 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div>
                <h3 className="text-white font-semibold mb-4">Properties by State</h3>
                <ul className="space-y-2">
                  <li><Link href="/owner-financing-texas" className="text-slate-400 hover:text-emerald-400 transition-colors">Owner Financing Texas</Link></li>
                  <li><Link href="/owner-financing-florida" className="text-slate-400 hover:text-blue-400 transition-colors">Owner Financing Florida</Link></li>
                  <li><Link href="/owner-financing-georgia" className="text-slate-400 hover:text-purple-400 transition-colors">Owner Financing Georgia</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-4">Popular Cities</h3>
                <ul className="space-y-2">
                  <li><Link href="/owner-financing-houston" className="text-slate-400 hover:text-white transition-colors">Houston</Link></li>
                  <li><Link href="/owner-financing-dallas" className="text-slate-400 hover:text-white transition-colors">Dallas</Link></li>
                  <li><Link href="/owner-financing-miami" className="text-slate-400 hover:text-white transition-colors">Miami</Link></li>
                  <li><Link href="/owner-financing-atlanta" className="text-slate-400 hover:text-white transition-colors">Atlanta</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-4">Resources</h3>
                <ul className="space-y-2">
                  <li><Link href="/how-owner-finance-works" className="text-slate-400 hover:text-white transition-colors">How It Works</Link></li>
                  <li><Link href="/about" className="text-slate-400 hover:text-white transition-colors">About Us</Link></li>
                  <li><Link href="/contact" className="text-slate-400 hover:text-white transition-colors">Contact</Link></li>
                  <li><Link href="/signup" className="text-slate-400 hover:text-white transition-colors">Sign Up</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-4">For Agents</h3>
                <ul className="space-y-2">
                  <li><Link href="/realtor-signup" className="text-slate-400 hover:text-white transition-colors">Agent Sign Up</Link></li>
                  <li><Link href="/realtor" className="text-slate-400 hover:text-white transition-colors">Agent Portal</Link></li>
                  <li><Link href="/auth/signin" className="text-slate-400 hover:text-white transition-colors">Agent Login</Link></li>
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