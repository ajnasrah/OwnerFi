import { Metadata } from 'next'
import Link from 'next/link'
import Script from 'next/script'
import { LegalFooter } from '@/components/ui/LegalFooter'

export const metadata: Metadata = {
  title: 'No Credit Check Homes | Owner Financed Properties | Flexible Credit Options',
  description: 'Find owner financed homes with flexible credit requirements. While some sellers require credit checks, many work with all credit situations. Browse properties with bad credit options.',
  keywords: 'no credit check homes, bad credit homes, owner financing bad credit, no credit check houses, homes without credit check, owner finance no credit, seller financing bad credit, flexible credit homes, credit flexible properties',

  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://ownerfi.ai/no-credit-check-homes',
    siteName: 'OwnerFi',
    title: 'No Credit Check Homes - Flexible Owner Financing Options',
    description: 'Find owner financed properties with flexible credit requirements. Many sellers work with all credit situations.',
    images: [{
      url: 'https://ownerfi.ai/og-no-credit.png',
      width: 1200,
      height: 630,
      alt: 'No Credit Check Homes',
    }],
  },

  alternates: {
    canonical: 'https://ownerfi.ai/no-credit-check-homes',
  },
}

function generateFAQSchema() {
  const faqs = [
    {
      question: "Do all owner financed homes require no credit check?",
      answer: "No, credit requirements vary by seller. While many sellers are flexible and may not require traditional credit checks, some do check credit. Each seller sets their own requirements based on down payment, income verification, and other factors."
    },
    {
      question: "What do sellers look at instead of credit scores?",
      answer: "Sellers often focus on: down payment amount (typically 5-20%), proof of income or ability to pay, employment history, rental payment history, and personal references. Each seller has different criteria."
    },
    {
      question: "Can I get owner financing with bad credit?",
      answer: "Yes, many sellers work with buyers who have less-than-perfect credit. They may require a larger down payment or proof of income stability. The key is finding sellers whose requirements match your situation."
    },
    {
      question: "Do some owner financed properties require credit checks?",
      answer: "Yes, some sellers do require credit checks as part of their screening process. However, they're often more flexible than banks and consider the whole financial picture, not just credit scores."
    },
    {
      question: "What's the typical down payment for bad credit buyers?",
      answer: "Down payments typically range from 10-20% for buyers with credit challenges, compared to 5-10% for those with good credit. The exact amount depends on the seller and property."
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

export default function NoCreditCheckHomes() {
  return (
    <>
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateFAQSchema()) }}
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
              <Link href="/how-owner-finance-works" className="text-slate-300 hover:text-white text-sm">How It Works</Link>
              <Link href="/auth" className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Browse Properties
              </Link>
            </nav>
          </div>
        </header>

        <main>
          {/* Hero Section */}
          <section className="py-20 px-6 bg-gradient-to-b from-slate-800 to-slate-900">
            <div className="max-w-6xl mx-auto text-center">
              <h1 className="text-5xl font-bold text-white mb-6">
                Owner Financed Homes with <span className="text-emerald-400">Flexible Credit Requirements</span>
              </h1>
              <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
                Find properties with varying credit requirements. While some sellers require credit checks,
                many work with all credit situations. Browse thousands of owner financed homes and find sellers
                whose requirements match your situation.
              </p>

              {/* Important Disclaimer */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 max-w-3xl mx-auto mb-4">
                <p className="text-yellow-200 text-sm">
                  <strong>Important:</strong> Credit requirements vary by property and seller. Some properties require credit checks
                  while others are more flexible. Each seller sets their own criteria. Always verify requirements before applying.
                </p>
              </div>

              {/* Owner Financing Qualifier */}
              <div className="bg-amber-900/30 border border-amber-500/30 rounded-xl p-4 max-w-3xl mx-auto mb-8">
                <p className="text-amber-200 text-sm text-center">
                  <strong>Owner Financing Availability:</strong> Subject to seller approval and verification. Not all properties listed will qualify for or offer owner financing.
                  Financing type must be independently confirmed with the seller or their agent.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth" className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-xl font-semibold text-lg">
                  Browse All Properties
                </Link>
                <Link href="/how-owner-finance-works" className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-xl font-semibold text-lg">
                  Learn How It Works
                </Link>
              </div>
            </div>
          </section>

          {/* Credit Requirements Spectrum */}
          <section className="py-16 px-6 bg-slate-800/30">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-4">
                Understanding Credit Requirements in Owner Financing
              </h2>
              <p className="text-slate-400 text-sm text-center mb-12">
                * Percentages are estimates based on general market trends. Actual availability varies by location and time.
              </p>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="bg-gradient-to-br from-green-900/30 to-green-800/30 rounded-xl p-6 border border-green-500/30">
                  <h3 className="text-xl font-bold text-green-400 mb-4">No Credit Check</h3>
                  <p className="text-slate-300 mb-4">Some sellers focus only on:</p>
                  <ul className="space-y-2 text-slate-300 text-sm">
                    <li>• Down payment amount</li>
                    <li>• Proof of income</li>
                    <li>• Employment verification</li>
                    <li>• No credit report pulled</li>
                  </ul>
                  <p className="text-green-400 text-sm mt-4">~30% of properties*</p>
                </div>

                <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-800/30 rounded-xl p-6 border border-yellow-500/30">
                  <h3 className="text-xl font-bold text-yellow-400 mb-4">Flexible Credit</h3>
                  <p className="text-slate-300 mb-4">Sellers who check but are flexible:</p>
                  <ul className="space-y-2 text-slate-300 text-sm">
                    <li>• Soft credit check</li>
                    <li>• Consider whole picture</li>
                    <li>• Accept past issues</li>
                    <li>• Focus on recent history</li>
                  </ul>
                  <p className="text-yellow-400 text-sm mt-4">~50% of properties*</p>
                </div>

                <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/30 rounded-xl p-6 border border-blue-500/30">
                  <h3 className="text-xl font-bold text-blue-400 mb-4">Credit Required</h3>
                  <p className="text-slate-300 mb-4">Sellers with stricter requirements:</p>
                  <ul className="space-y-2 text-slate-300 text-sm">
                    <li>• Full credit check</li>
                    <li>• Minimum score requirements</li>
                    <li>• Income verification</li>
                    <li>• Lower down payments</li>
                  </ul>
                  <p className="text-blue-400 text-sm mt-4">~20% of properties*</p>
                </div>
              </div>
            </div>
          </section>

          {/* What Sellers Look For */}
          <section className="py-16 px-6">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                What Owner Finance Sellers Actually Look For
              </h2>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700/50">
                  <h3 className="text-2xl font-bold text-emerald-400 mb-6">More Important Than Credit</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-white font-semibold mb-2">💰 Down Payment</h4>
                      <p className="text-slate-300 text-sm">Larger down payment shows commitment and reduces seller risk</p>
                    </div>
                    <div>
                      <h4 className="text-white font-semibold mb-2">💼 Income Stability</h4>
                      <p className="text-slate-300 text-sm">Steady employment or income source matters more than credit score</p>
                    </div>
                    <div>
                      <h4 className="text-white font-semibold mb-2">🏠 Rental History</h4>
                      <p className="text-slate-300 text-sm">Good rental payment history shows reliability</p>
                    </div>
                    <div>
                      <h4 className="text-white font-semibold mb-2">📊 Debt-to-Income Ratio</h4>
                      <p className="text-slate-300 text-sm">Ability to afford monthly payments is key</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700/50">
                  <h3 className="text-2xl font-bold text-blue-400 mb-6">Credit Situations We See</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-white font-semibold mb-2">✅ Commonly Accepted</h4>
                      <ul className="text-slate-300 text-sm space-y-1">
                        <li>• Past bankruptcy (after 2+ years)</li>
                        <li>• Medical debt issues</li>
                        <li>• Divorce-related credit problems</li>
                        <li>• Self-employment income</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-white font-semibold mb-2">⚠️ Case-by-Case</h4>
                      <ul className="text-slate-300 text-sm space-y-1">
                        <li>• Recent late payments</li>
                        <li>• High debt levels</li>
                        <li>• Multiple recent inquiries</li>
                        <li>• Scores below 500</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Success Stories */}
          <section className="py-16 px-6 bg-slate-800/30">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-4">
                Example Buyer Situations
              </h2>
              <p className="text-slate-400 text-sm text-center mb-12">
                * These are illustrative examples of typical buyer situations. Individual results vary and are not guaranteed.
              </p>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <div className="text-2xl mb-3">🏗️</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Self-Employed Contractor</h3>
                  <p className="text-slate-300 text-sm mb-3">
                    "Banks wouldn't approve me because of variable income. Found a seller who accepted
                    my tax returns and 15% down. No credit check needed."
                  </p>
                  <p className="text-emerald-400 text-sm">✓ Approved with tax returns</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <div className="text-2xl mb-3">🏥</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Medical Bankruptcy</h3>
                  <p className="text-slate-300 text-sm mb-3">
                    "Had a bankruptcy from medical bills 3 years ago. Seller did check credit but
                    focused on my current income and 20% down payment."
                  </p>
                  <p className="text-emerald-400 text-sm">✓ Approved despite bankruptcy</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <div className="text-2xl mb-3">💼</div>
                  <h3 className="text-xl font-semibold text-white mb-3">New Job, Good Income</h3>
                  <p className="text-slate-300 text-sm mb-3">
                    "Just started a new job with great salary but short employment history.
                    Seller required credit check but approved with employment contract."
                  </p>
                  <p className="text-emerald-400 text-sm">✓ Approved with verification</p>
                </div>
              </div>
            </div>
          </section>

          {/* How to Improve Your Chances */}
          <section className="py-16 px-6">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                How to Improve Your Approval Chances
              </h2>
              <div className="bg-gradient-to-br from-emerald-900/20 to-emerald-800/20 rounded-xl p-8 border border-emerald-500/30">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-xl font-bold text-emerald-400 mb-4">Before You Apply:</h3>
                    <ul className="space-y-2 text-slate-300">
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-1">✓</span>
                        <span>Save a larger down payment (10-20%)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-1">✓</span>
                        <span>Gather income documentation</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-1">✓</span>
                        <span>Get rental payment history records</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-1">✓</span>
                        <span>Write an explanation letter for credit issues</span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-emerald-400 mb-4">Be Honest About:</h3>
                    <ul className="space-y-2 text-slate-300">
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-1">✓</span>
                        <span>Your credit situation upfront</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-1">✓</span>
                        <span>Your income sources</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-1">✓</span>
                        <span>Any past financial challenges</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-1">✓</span>
                        <span>Your current financial stability</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="py-16 px-6 bg-slate-800/30">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Frequently Asked Questions
              </h2>
              <div className="space-y-6">
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">Do all owner financed homes require no credit check?</h3>
                  <p className="text-slate-300">No, credit requirements vary by seller. While many sellers are flexible and may not require traditional credit checks, some do check credit. Each seller sets their own requirements.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">What credit score do I need for owner financing?</h3>
                  <p className="text-slate-300">There's no universal credit score requirement. Some sellers don't check credit at all, while others may look for scores above 500-600. Many focus more on down payment and income than credit scores.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">Can I get owner financing after bankruptcy?</h3>
                  <p className="text-slate-300">Yes, many sellers will work with buyers who have past bankruptcies, especially if it's been 2+ years and you can show current financial stability with steady income and a good down payment.</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-xl font-semibold text-white mb-3">How can I find properties that don't require credit checks?</h3>
                  <p className="text-slate-300">When browsing properties, look for listings that mention "flexible credit," "all credit considered," or "credit flexible." Contact sellers or agents to discuss specific requirements before applying.</p>
                </div>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="py-20 px-6 bg-gradient-to-b from-slate-900 to-slate-800">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-4xl font-bold text-white mb-6">
                Find Owner Financed Homes That Match Your Situation
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Browse properties with varying credit requirements. From no-credit-check to flexible terms, find sellers who work with your situation.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth" className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-xl font-semibold text-lg">
                  Browse All Properties
                </Link>
                <Link href="/bad-credit-home-buying" className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-xl font-semibold text-lg">
                  Bad Credit Options
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