import { Metadata } from 'next'
import Link from 'next/link'
import Script from 'next/script'
import Image from 'next/image'
import { LegalFooter } from '@/components/ui/LegalFooter'

export const metadata: Metadata = {
  title: 'Owner Financing Texas | Seller Financed Homes in TX | No Banks Needed',
  description: 'Find owner financed homes in Texas. Browse seller financing properties in Houston, Dallas, Austin, San Antonio. No bank financing required. Bad credit OK. Low down payments.',
  keywords: 'owner financing texas, owner financed homes texas, seller financing texas, owner finance houston, owner finance dallas, owner finance austin, texas owner financing, no bank financing texas, bad credit homes texas, contract for deed texas, owner will carry texas',

  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://ownerfi.ai/owner-financing-texas',
    siteName: 'OwnerFi',
    title: 'Owner Financing Texas - Find Seller Financed Homes',
    description: 'Browse owner financed properties across Texas. No bank needed, flexible terms, bad credit options available.',
    images: [{
      url: 'https://ownerfi.ai/og-texas.png',
      width: 1200,
      height: 630,
      alt: 'Owner Financing Texas Properties',
    }],
  },

  alternates: {
    canonical: 'https://ownerfi.ai/owner-financing-texas',
  },
}

// Schema Markup
function generateLocalBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "OwnerFi - Texas Properties",
    "description": "Lead generation platform for owner financed properties in Texas",
    "applicationCategory": "Real Estate",
    "url": "https://ownerfi.ai/owner-financing-texas",
    "areaServed": {
      "@type": "State",
      "name": "Texas",
      "containsPlace": [
        {"@type": "City", "name": "Houston"},
        {"@type": "City", "name": "Dallas"},
        {"@type": "City", "name": "Austin"},
        {"@type": "City", "name": "San Antonio"},
        {"@type": "City", "name": "Fort Worth"},
        {"@type": "City", "name": "El Paso"}
      ]
    },
    "knowsAbout": ["Owner Financing", "Seller Financing", "Contract for Deed", "Subject To"],
  }
}

function generateFAQSchema() {
  const faqs = [
    {
      question: "How does owner financing work in Texas?",
      answer: "In Texas, owner financing allows property sellers to act as the lender. The buyer makes payments directly to the seller instead of getting a traditional mortgage. Texas has specific laws protecting both buyers and sellers in owner finance transactions."
    },
    {
      question: "Is owner financing legal in Texas?",
      answer: "Yes, owner financing is completely legal in Texas. The state has specific regulations under the Texas Property Code that govern seller financing, including required disclosures and protections for buyers."
    },
    {
      question: "What are the benefits of owner financing in Texas?",
      answer: "Benefits include: no bank approval needed, faster closing (often 7-14 days), flexible down payments, negotiable terms, and options for buyers with less-than-perfect credit or self-employment income."
    },
    {
      question: "What is the typical down payment for owner financing in Texas?",
      answer: "Down payments for owner financed homes in Texas typically range from 5% to 20% of the purchase price, though some sellers may accept less. The amount is negotiable between buyer and seller."
    },
    {
      question: "Can I get owner financing with bad credit in Texas?",
      answer: "Yes, many Texas sellers offering owner financing are more flexible about credit scores than banks. They often focus more on your down payment and ability to make monthly payments rather than credit history."
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

function generateBreadcrumbSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://ownerfi.ai"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Owner Financing Texas",
        "item": "https://ownerfi.ai/owner-financing-texas"
      }
    ]
  }
}

export default function OwnerFinancingTexas() {
  return (
    <>
      {/* Schema Markup */}
      <Script
        id="local-business-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateLocalBusinessSchema()) }}
      />
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateFAQSchema()) }}
      />
      <Script
        id="breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBreadcrumbSchema()) }}
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
                  Owner Financing in <span className="text-emerald-400">Texas</span>
                  <span className="block text-3xl mt-4 text-slate-300">Find Seller Financed Homes with No Bank Needed</span>
                </h1>
                <p className="text-xl text-slate-300 max-w-3xl mx-auto">
                  Browse hundreds of owner financed properties across Texas. From Houston to Dallas, Austin to San Antonio -
                  find homes with flexible seller financing, low down payments, and no traditional mortgage requirements.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <Link href="/auth" className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all">
                  Browse Texas Properties
                </Link>
                <Link href="/how-owner-finance-works" className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all">
                  Learn How It Works
                </Link>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-emerald-400">200+</div>
                  <div className="text-slate-300 mt-2">Texas Properties</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-blue-400">5%</div>
                  <div className="text-slate-300 mt-2">Min Down Payment</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-purple-400">15+ Cities</div>
                  <div className="text-slate-300 mt-2">Coverage Area</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 text-center border border-slate-700/50">
                  <div className="text-3xl font-bold text-yellow-400">7 Days</div>
                  <div className="text-slate-300 mt-2">Average Closing</div>
                </div>
              </div>

              {/* Owner Financing Qualifier */}
              <div className="bg-amber-900/30 border border-amber-500/30 rounded-xl p-4 mt-8">
                <p className="text-amber-200 text-sm text-center">
                  <strong>Important:</strong> Subject to seller approval and verification. Not all properties listed will qualify for or offer owner financing.
                  Financing type must be independently confirmed with the seller or their agent.
                </p>
              </div>
            </div>
          </section>

          {/* Call to Action Section */}
          <section className="py-12 px-6 bg-gradient-to-r from-emerald-900/30 to-blue-900/30">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                Ready to Find Your Texas Home?
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Browse hundreds of owner financed and rent-to-own properties across Texas.
                No banks needed, flexible terms available.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth">
                  <button className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg hover:shadow-xl">
                    🏠 Browse Texas Properties
                  </button>
                </Link>
                <Link href="/auth">
                  <button className="bg-white/10 backdrop-blur-sm border-2 border-white/30 hover:bg-white/20 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-[1.02]">
                    Create Free Account
                  </button>
                </Link>
              </div>
              <p className="text-sm text-slate-400 mt-6">
                Explore owner financing options without traditional bank requirements
              </p>
            </div>
          </section>

          {/* Cities Section */}
          <section className="py-16 px-6 bg-slate-800/30">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Owner Financed Homes by Texas City
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                <Link href="/owner-financing-houston" className="group">
                  <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-emerald-400/50 transition-all">
                    <h3 className="text-xl font-bold text-emerald-400 mb-2 group-hover:text-emerald-300">Houston</h3>
                    <p className="text-slate-300 text-sm mb-3">Harris County & Surrounding Areas</p>
                    <ul className="text-slate-400 text-sm space-y-1">
                      <li>• The Woodlands</li>
                      <li>• Sugar Land</li>
                      <li>• Katy</li>
                      <li>• Pearland</li>
                    </ul>
                    <p className="text-emerald-400 text-sm mt-3">50+ Properties Available →</p>
                  </div>
                </Link>

                <Link href="/owner-financing-dallas" className="group">
                  <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-blue-400/50 transition-all">
                    <h3 className="text-xl font-bold text-blue-400 mb-2 group-hover:text-blue-300">Dallas-Fort Worth</h3>
                    <p className="text-slate-300 text-sm mb-3">DFW Metroplex</p>
                    <ul className="text-slate-400 text-sm space-y-1">
                      <li>• Fort Worth</li>
                      <li>• Arlington</li>
                      <li>• Plano</li>
                      <li>• Irving</li>
                    </ul>
                    <p className="text-blue-400 text-sm mt-3">45+ Properties Available →</p>
                  </div>
                </Link>

                <Link href="/owner-financing-austin" className="group">
                  <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-purple-400/50 transition-all">
                    <h3 className="text-xl font-bold text-purple-400 mb-2 group-hover:text-purple-300">Austin</h3>
                    <p className="text-slate-300 text-sm mb-3">Travis County & Metro</p>
                    <ul className="text-slate-400 text-sm space-y-1">
                      <li>• Round Rock</li>
                      <li>• Cedar Park</li>
                      <li>• Georgetown</li>
                      <li>• Pflugerville</li>
                    </ul>
                    <p className="text-purple-400 text-sm mt-3">35+ Properties Available →</p>
                  </div>
                </Link>

                <Link href="/owner-financing-san-antonio" className="group">
                  <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-yellow-400/50 transition-all">
                    <h3 className="text-xl font-bold text-yellow-400 mb-2 group-hover:text-yellow-300">San Antonio</h3>
                    <p className="text-slate-300 text-sm mb-3">Bexar County</p>
                    <ul className="text-slate-400 text-sm space-y-1">
                      <li>• New Braunfels</li>
                      <li>• Boerne</li>
                      <li>• Schertz</li>
                      <li>• Seguin</li>
                    </ul>
                    <p className="text-yellow-400 text-sm mt-3">30+ Properties Available →</p>
                  </div>
                </Link>

                <Link href="/owner-financing-el-paso" className="group">
                  <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-orange-400/50 transition-all">
                    <h3 className="text-xl font-bold text-orange-400 mb-2 group-hover:text-orange-300">El Paso</h3>
                    <p className="text-slate-300 text-sm mb-3">West Texas</p>
                    <ul className="text-slate-400 text-sm space-y-1">
                      <li>• Las Cruces area</li>
                      <li>• Socorro</li>
                      <li>• Horizon City</li>
                      <li>• Fort Bliss area</li>
                    </ul>
                    <p className="text-orange-400 text-sm mt-3">20+ Properties Available →</p>
                  </div>
                </Link>

                <Link href="/owner-financing-corpus-christi" className="group">
                  <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-cyan-400/50 transition-all">
                    <h3 className="text-xl font-bold text-cyan-400 mb-2 group-hover:text-cyan-300">Corpus Christi</h3>
                    <p className="text-slate-300 text-sm mb-3">Coastal Texas</p>
                    <ul className="text-slate-400 text-sm space-y-1">
                      <li>• Portland</li>
                      <li>• Rockport</li>
                      <li>• Aransas Pass</li>
                      <li>• Ingleside</li>
                    </ul>
                    <p className="text-cyan-400 text-sm mt-3">15+ Properties Available →</p>
                  </div>
                </Link>
              </div>
            </div>
          </section>

          {/* Benefits Section */}
          <section className="py-16 px-6">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-4">
                Why Choose Owner Financing in Texas?
              </h2>
              <p className="text-slate-400 text-xs text-center mb-12">
                * Property values can go up or down. This is educational information only, not investment advice. Consult a licensed professional before making real estate decisions.
              </p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-emerald-400 text-3xl mb-4">🏛️</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Texas Law Protection</h3>
                  <p className="text-slate-300">Texas has specific laws protecting buyers in owner finance deals, including required disclosures and contractual safeguards.</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-blue-400 text-3xl mb-4">💰</div>
                  <h3 className="text-xl font-semibold text-white mb-3">No State Income Tax</h3>
                  <p className="text-slate-300">Texas has no state income tax, meaning more money in your pocket for home payments and improvements.</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-purple-400 text-3xl mb-4">📈</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Texas Real Estate Market</h3>
                  <p className="text-slate-300">Texas has a diverse real estate market with various price points and neighborhoods to explore.*</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-yellow-400 text-3xl mb-4">⚡</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Fast Closing Process</h3>
                  <p className="text-slate-300">Close in as little as 7 days with owner financing, compared to 30-45 days with traditional mortgages.</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-orange-400 text-3xl mb-4">🤝</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Flexible Terms</h3>
                  <p className="text-slate-300">Negotiate directly with sellers on down payment, interest rates, and payment schedules that work for you.</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                  <div className="text-cyan-400 text-3xl mb-4">✅</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Bad Credit Options</h3>
                  <p className="text-slate-300">Many Texas sellers accept buyers with less-than-perfect credit or self-employment income.</p>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="py-16 px-6 bg-slate-800/30">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Texas Owner Financing FAQs
              </h2>
              <div className="space-y-6">
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">How does owner financing work in Texas?</h3>
                  <p className="text-slate-300">In Texas, owner financing allows property sellers to act as the lender. The buyer makes payments directly to the seller instead of getting a traditional mortgage. Texas has specific laws protecting both buyers and sellers in owner finance transactions.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">Is owner financing legal in Texas?</h3>
                  <p className="text-slate-300">Yes, owner financing is completely legal in Texas. The state has specific regulations under the Texas Property Code that govern seller financing, including required disclosures and protections for buyers.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">What are typical down payments in Texas?</h3>
                  <p className="text-slate-300">Down payments for owner financed homes in Texas typically range from 5% to 20% of the purchase price, though some sellers may accept less. The amount is negotiable between buyer and seller.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">Can I get owner financing with bad credit?</h3>
                  <p className="text-slate-300">Yes, many Texas sellers offering owner financing are more flexible about credit scores than banks. They often focus more on your down payment and ability to make monthly payments rather than credit history.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">What Texas cities have the most owner financed homes?</h3>
                  <p className="text-slate-300">Houston, Dallas-Fort Worth, San Antonio, and Austin have the most owner financed properties. However, you can find seller financing options throughout Texas, including smaller cities and rural areas.</p>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-20 px-6 bg-gradient-to-b from-slate-900 to-slate-800">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-6">
                Ready to Find Your Texas Home with Owner Financing?
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Browse hundreds of owner financed properties across Texas. No bank needed, flexible terms, and fast closing.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth" className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all">
                  Browse Texas Properties Now
                </Link>
                <Link href="/auth" className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all">
                  I'm a Texas Real Estate Agent
                </Link>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="bg-slate-900 border-t border-slate-800 py-12 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div>
                <h3 className="text-white font-semibold mb-4">Texas Cities</h3>
                <ul className="space-y-2">
                  <li><Link href="/owner-financing-houston" className="text-slate-400 hover:text-white">Houston</Link></li>
                  <li><Link href="/owner-financing-dallas" className="text-slate-400 hover:text-white">Dallas</Link></li>
                  <li><Link href="/owner-financing-austin" className="text-slate-400 hover:text-white">Austin</Link></li>
                  <li><Link href="/owner-financing-san-antonio" className="text-slate-400 hover:text-white">San Antonio</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-4">Other States</h3>
                <ul className="space-y-2">
                  <li><Link href="/owner-financing-florida" className="text-slate-400 hover:text-white">Florida</Link></li>
                  <li><Link href="/owner-financing-georgia" className="text-slate-400 hover:text-white">Georgia</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-4">Resources</h3>
                <ul className="space-y-2">
                  <li><Link href="/how-owner-finance-works" className="text-slate-400 hover:text-white">How It Works</Link></li>
                  <li><Link href="/about" className="text-slate-400 hover:text-white">About</Link></li>
                  <li><Link href="/contact" className="text-slate-400 hover:text-white">Contact</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-4">Get Started</h3>
                <ul className="space-y-2">
                  <li><Link href="/auth" className="text-slate-400 hover:text-white">Sign Up</Link></li>
                  <li><Link href="/auth" className="text-slate-400 hover:text-white">Sign In</Link></li>
                  <li><Link href="/auth" className="text-slate-400 hover:text-white">Agent Portal</Link></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-slate-800 pt-8 text-center">
              <p className="text-slate-400 text-sm">
                © {new Date().getFullYear()} OwnerFi. All rights reserved. |
                <Link href="/terms" className="hover:text-white ml-2">Terms</Link> |
                <Link href="/privacy" className="hover:text-white ml-2">Privacy</Link> |
                <Link href="/creative-finance-disclaimer" className="hover:text-white ml-2">Creative Finance Disclaimer</Link>
              </p>
            </div>
          </div>
        </footer>

        <LegalFooter includeInvestment={true} includeState={true} />
      </div>
    </>
  )
}