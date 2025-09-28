import { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export const metadata: Metadata = {
  title: 'Bad Credit Home Buying | Owner Financing for All Credit | Rent to Own Alternative | OwnerFi',
  description: 'Buy a home with bad credit through owner financing - better than rent to own! Many sellers offer flexible credit terms. No bank approval needed. Find homes that work with your credit situation.',
  keywords: 'bad credit home buying, bad credit homes, poor credit home loans, no credit check homes, owner financing bad credit, rent to own bad credit, buy house bad credit, homes for bad credit, seller financing bad credit, bad credit mortgage alternative',
  openGraph: {
    title: 'Bad Credit Home Buying - Owner Financing Solutions | OwnerFi',
    description: 'Don\'t let bad credit stop you from homeownership. Find owner financed homes with flexible credit requirements. Better than rent to own!',
    url: 'https://ownerfi.ai/bad-credit-home-buying',
    siteName: 'OwnerFi',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Buy a Home with Bad Credit - Owner Financing',
    description: 'Find homes with flexible credit requirements. Many sellers work with all credit situations.',
  },
  alternates: {
    canonical: 'https://ownerfi.ai/bad-credit-home-buying',
  }
}

async function getCreditFlexibleProperties() {
  try {
    const propertiesRef = collection(db, 'properties')
    const q = query(propertiesRef, where('isActive', '==', true))
    const snapshot = await getDocs(q)

    const statesCounts: Record<string, number> = {}
    let totalCount = 0

    snapshot.docs.forEach(doc => {
      const data = doc.data()
      const state = data.state || ''
      if (state) {
        statesCounts[state] = (statesCounts[state] || 0) + 1
        totalCount++
      }
    })

    return { statesCounts, totalCount }
  } catch (error) {
    console.error('Error fetching properties:', error)
    return { statesCounts: {}, totalCount: 0 }
  }
}

export default async function BadCreditHomeBuying() {
  const { statesCounts, totalCount } = await getCreditFlexibleProperties()

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Can I really buy a home with bad credit?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! Through owner financing, many sellers are willing to work with buyers who have bad credit, poor credit, or no credit history. While traditional banks might reject you, property owners can be more flexible, focusing on your down payment and ability to make monthly payments rather than just your credit score."
        }
      },
      {
        "@type": "Question",
        "name": "What percentage of owner financed homes accept bad credit?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Based on our listings, approximately 30% of properties require no credit check at all, 50% are flexible and work with credit challenges, and only 20% require good credit. This means 80% of our owner financed homes may work with bad credit situations."
        }
      },
      {
        "@type": "Question",
        "name": "Is owner financing better than rent to own for bad credit?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! Owner financing gives you immediate ownership even with bad credit, while rent to own keeps you as a tenant for years. With owner financing, you build equity immediately and have homeowner rights. Rent to own often has stricter credit requirements at the end of the rental period."
        }
      },
      {
        "@type": "Question",
        "name": "What credit scores do sellers typically accept?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Credit score requirements vary by seller. Some accept scores as low as 500, others don't check credit at all, and some prefer 600+. Each seller sets their own criteria based on down payment size, income stability, and other factors beyond just credit score."
        }
      },
      {
        "@type": "Question",
        "name": "How much down payment do I need with bad credit?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Down payments for bad credit buyers typically range from 10% to 25%. A larger down payment often helps offset credit concerns for sellers. Some sellers may accept as little as 5% with proof of steady income, while others might require 20% or more for very low credit scores."
        }
      }
    ]
  }

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Bad Credit Home Buying Guide: Owner Financing Solutions 2025",
    "description": "Complete guide to buying a home with bad credit through owner financing. Learn how to bypass banks and work directly with sellers.",
    "author": {
      "@type": "Organization",
      "name": "OwnerFi"
    },
    "publisher": {
      "@type": "Organization",
      "name": "OwnerFi",
      "url": "https://ownerfi.ai"
    },
    "datePublished": "2025-01-01",
    "dateModified": new Date().toISOString()
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-12">
          {/* Breadcrumb */}
          <nav className="mb-8">
            <ol className="flex space-x-2 text-sm text-slate-600">
              <li><Link href="/" className="hover:text-indigo-600">Home</Link></li>
              <li>/</li>
              <li className="text-slate-900 font-medium">Bad Credit Home Buying</li>
            </ol>
          </nav>

          {/* Hero Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Bad Credit? You Can Still Buy a Home!
            </h1>
            <p className="text-xl text-slate-700 mb-8">
              Don't let bad credit, poor credit, or no credit stop your homeownership dreams.
              With owner financing, {totalCount > 0 ? `${totalCount}+ ` : ''}sellers nationwide work with all credit situations.
              Better than rent to own - get immediate ownership without bank approval.
            </p>

            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border-2 border-green-300 mb-8">
              <h2 className="text-2xl font-bold text-green-900 mb-4">
                Important: Credit Requirements Vary by Seller
              </h2>
              <div className="grid md:grid-cols-3 gap-4 text-green-800">
                <div className="bg-white p-4 rounded-lg">
                  <div className="text-3xl font-bold text-green-600 mb-2">~30%</div>
                  <div className="font-semibold">No Credit Check</div>
                  <div className="text-sm">Focus on down payment & income</div>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <div className="text-3xl font-bold text-yellow-600 mb-2">~50%</div>
                  <div className="font-semibold">Flexible Credit</div>
                  <div className="text-sm">Work with credit challenges</div>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600 mb-2">~20%</div>
                  <div className="font-semibold">Credit Required</div>
                  <div className="text-sm">Prefer good credit scores</div>
                </div>
              </div>
              <p className="text-sm text-green-700 mt-4 italic">
                Each property listing shows specific credit requirements set by the seller
              </p>
            </div>

            <Link href="/signup">
              <button className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg">
                Find Credit-Flexible Properties →
              </button>
            </Link>
          </div>

          {/* Credit Score Ranges */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Owner Financing Options by Credit Score
            </h2>

            <div className="space-y-6">
              <div className="border-l-4 border-red-500 pl-6 py-4 bg-red-50 rounded-r-xl">
                <h3 className="text-xl font-bold text-red-900 mb-2">
                  Poor Credit (300-579) - Still Have Options!
                </h3>
                <p className="text-red-800 mb-3">
                  Many sellers focus on your down payment and income stability rather than credit score.
                  With 15-25% down, you can often secure owner financing even with poor credit.
                </p>
                <div className="text-sm text-red-700">
                  <strong>Tips:</strong> Larger down payment helps • Show proof of steady income •
                  Explain credit issues honestly • Consider a co-signer
                </div>
              </div>

              <div className="border-l-4 border-yellow-500 pl-6 py-4 bg-yellow-50 rounded-r-xl">
                <h3 className="text-xl font-bold text-yellow-900 mb-2">
                  Fair Credit (580-669) - Good Opportunities
                </h3>
                <p className="text-yellow-800 mb-3">
                  This range opens up more options. Many sellers are comfortable with fair credit,
                  especially with 10-20% down and stable employment history.
                </p>
                <div className="text-sm text-yellow-700">
                  <strong>Tips:</strong> Highlight improving credit trend • Show savings history •
                  Provide employment verification • Be ready to explain any issues
                </div>
              </div>

              <div className="border-l-4 border-green-500 pl-6 py-4 bg-green-50 rounded-r-xl">
                <h3 className="text-xl font-bold text-green-900 mb-2">
                  Good Credit (670-739) - Many Options
                </h3>
                <p className="text-green-800 mb-3">
                  With good credit, you'll qualify for most owner financed properties.
                  You may negotiate better terms, lower down payments (5-15%), and competitive rates.
                </p>
                <div className="text-sm text-green-700">
                  <strong>Benefits:</strong> More property choices • Better negotiating position •
                  Lower down payments • Potentially better interest rates
                </div>
              </div>

              <div className="border-l-4 border-blue-500 pl-6 py-4 bg-blue-50 rounded-r-xl">
                <h3 className="text-xl font-bold text-blue-900 mb-2">
                  No Credit History - First-Time Buyers Welcome
                </h3>
                <p className="text-blue-800 mb-3">
                  No credit can be better than bad credit for many sellers. If you have steady income
                  and a down payment, sellers often view you as lower risk than someone with past credit issues.
                </p>
                <div className="text-sm text-blue-700">
                  <strong>Tips:</strong> Show rental payment history • Provide bank statements •
                  Document income sources • Consider starting with a smaller property
                </div>
              </div>
            </div>
          </div>

          {/* Why Owner Financing Works for Bad Credit */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-xl p-8 mb-12 border border-indigo-200">
            <h2 className="text-3xl font-bold text-indigo-900 mb-6">
              Why Owner Financing Works for Bad Credit Buyers
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-indigo-800 mb-4">
                  Sellers Look Beyond Credit Scores
                </h3>
                <ul className="space-y-3 text-indigo-700">
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">✓</span>
                    <span>Focus on your ability to make monthly payments</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">✓</span>
                    <span>Value steady employment over credit history</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">✓</span>
                    <span>Consider the size of your down payment</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">✓</span>
                    <span>Appreciate buyers who communicate honestly</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">✓</span>
                    <span>May accept alternative credit (utility bills, rent)</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-purple-800 mb-4">
                  Benefits Over Traditional Financing
                </h3>
                <ul className="space-y-3 text-purple-700">
                  <li className="flex items-start">
                    <span className="text-purple-500 mr-2">✓</span>
                    <span>No bank underwriting or strict credit requirements</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-500 mr-2">✓</span>
                    <span>Faster closing without lengthy approval process</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-500 mr-2">✓</span>
                    <span>Flexible terms negotiated directly with seller</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-500 mr-2">✓</span>
                    <span>Build equity while rebuilding credit</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-500 mr-2">✓</span>
                    <span>Opportunity to refinance later with improved credit</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Bad Credit Home Buying Options Compared
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 p-4 text-left font-semibold">Option</th>
                    <th className="border border-slate-300 p-4 text-left font-semibold">Credit Required</th>
                    <th className="border border-slate-300 p-4 text-left font-semibold">Ownership</th>
                    <th className="border border-slate-300 p-4 text-left font-semibold">Equity Building</th>
                    <th className="border border-slate-300 p-4 text-left font-semibold">Typical Down Payment</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-green-50">
                    <td className="border border-slate-300 p-4 font-semibold text-green-900">Owner Financing</td>
                    <td className="border border-slate-300 p-4 text-green-800">Flexible/Varies</td>
                    <td className="border border-slate-300 p-4 text-green-800">Immediate</td>
                    <td className="border border-slate-300 p-4 text-green-800">From Day 1</td>
                    <td className="border border-slate-300 p-4 text-green-800">10-25%</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-4">Rent to Own</td>
                    <td className="border border-slate-300 p-4">Often Required Later</td>
                    <td className="border border-slate-300 p-4">After 2-3 Years</td>
                    <td className="border border-slate-300 p-4">Only After Purchase</td>
                    <td className="border border-slate-300 p-4">3-5% Option Fee</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-4">FHA Loan</td>
                    <td className="border border-slate-300 p-4">580+ Required</td>
                    <td className="border border-slate-300 p-4">At Closing</td>
                    <td className="border border-slate-300 p-4">From Day 1</td>
                    <td className="border border-slate-300 p-4">3.5%</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-4">Hard Money Loan</td>
                    <td className="border border-slate-300 p-4">Asset-Based</td>
                    <td className="border border-slate-300 p-4">At Closing</td>
                    <td className="border border-slate-300 p-4">From Day 1</td>
                    <td className="border border-slate-300 p-4">20-30%</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-4">Contract for Deed</td>
                    <td className="border border-slate-300 p-4">Very Flexible</td>
                    <td className="border border-slate-300 p-4">After Full Payment</td>
                    <td className="border border-slate-300 p-4">Limited</td>
                    <td className="border border-slate-300 p-4">5-20%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* States with Bad Credit Options */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Find Bad Credit Home Buying Options by State
            </h2>

            <div className="grid md:grid-cols-4 gap-4 mb-8">
              {Object.entries(statesCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 20)
                .map(([state, count]) => (
                  <Link
                    key={state}
                    href={`/owner-financing-${state.toLowerCase().replace(' ', '-')}`}
                    className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-300 hover:border-indigo-400 hover:shadow-lg transition-all"
                  >
                    <div className="font-semibold text-slate-900">{state}</div>
                    <div className="text-sm text-slate-600">{count} properties</div>
                    <div className="text-xs text-indigo-600 mt-1">View credit-flexible homes →</div>
                  </Link>
                ))}
            </div>

            <div className="border-t pt-6">
              <p className="text-slate-700">
                <strong>All 50 States Available:</strong> We have owner financed properties with flexible
                credit terms nationwide. Whether you're in California, New York, Illinois, or anywhere else,
                sellers are ready to work with your credit situation.
              </p>
            </div>
          </div>

          {/* Success Tips */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl shadow-xl p-8 mb-12 border border-green-200">
            <h2 className="text-3xl font-bold text-green-900 mb-6">
              Tips for Success: Buying with Bad Credit
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-green-800 mb-4">
                  Before You Apply
                </h3>
                <ol className="space-y-3 text-green-700">
                  <li className="flex items-start">
                    <span className="font-bold mr-2">1.</span>
                    <span><strong>Save for a larger down payment</strong> - This shows commitment and reduces seller risk</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-bold mr-2">2.</span>
                    <span><strong>Gather financial documents</strong> - Pay stubs, bank statements, tax returns</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-bold mr-2">3.</span>
                    <span><strong>Write a letter to sellers</strong> - Explain your situation and commitment</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-bold mr-2">4.</span>
                    <span><strong>Get pre-qualified if possible</strong> - Some lenders offer pre-qualification with soft pulls</span>
                  </li>
                </ol>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-green-800 mb-4">
                  When Negotiating
                </h3>
                <ol className="space-y-3 text-green-700">
                  <li className="flex items-start">
                    <span className="font-bold mr-2">1.</span>
                    <span><strong>Be honest about your credit</strong> - Transparency builds trust with sellers</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-bold mr-2">2.</span>
                    <span><strong>Highlight your strengths</strong> - Stable job, increasing income, savings</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-bold mr-2">3.</span>
                    <span><strong>Offer reasonable terms</strong> - Higher down payment or interest rate shows good faith</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-bold mr-2">4.</span>
                    <span><strong>Consider a shorter term</strong> - Plan to refinance in 3-5 years after credit improves</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Frequently Asked Questions - Bad Credit Home Buying
            </h2>

            <div className="space-y-6">
              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  What if I have a bankruptcy or foreclosure?
                </h3>
                <p className="text-slate-700">
                  Many sellers will consider buyers with past bankruptcies or foreclosures, especially if
                  they occurred more than 2 years ago. Be prepared to explain the circumstances and show
                  how your financial situation has improved. A larger down payment often helps.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Can I improve my chances with a co-signer?
                </h3>
                <p className="text-slate-700">
                  Yes! Having a co-signer with better credit can significantly improve your chances.
                  Some sellers are more comfortable with the additional security. The co-signer would
                  typically be on both the promissory note and the deed.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Will owner financing help rebuild my credit?
                </h3>
                <p className="text-slate-700">
                  Yes, if the seller reports payments to credit bureaus. Many sellers use loan servicing
                  companies that report to credit agencies. Making on-time payments can improve your
                  credit score, potentially allowing you to refinance with a traditional mortgage later.
                </p>
              </div>

              <div className="border-b pb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  What interest rates should I expect with bad credit?
                </h3>
                <p className="text-slate-700">
                  Interest rates vary by seller but typically range from 6% to 12% for buyers with
                  credit challenges. While higher than conventional mortgages, these rates are often
                  lower than hard money loans and allow you to become a homeowner immediately rather
                  than waiting years to improve credit.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  Should I try to fix my credit first or buy now?
                </h3>
                <p className="text-slate-700">
                  This depends on your situation. If you're currently renting, buying now through owner
                  financing lets you build equity immediately instead of paying rent. You can work on
                  credit repair while owning your home, then refinance in a few years. However, if you're
                  close to qualifying for traditional financing (credit score near 580), waiting might
                  get you better terms.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl p-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Your Credit Doesn't Define Your Future
            </h2>
            <p className="text-xl mb-8 text-indigo-100">
              Join thousands who've achieved homeownership despite credit challenges
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <button className="bg-white text-indigo-600 px-8 py-4 rounded-xl font-semibold hover:bg-indigo-50 transition-all">
                  Find Credit-Flexible Homes
                </button>
              </Link>
              <Link href="/how-owner-finance-works">
                <button className="bg-indigo-500 text-white px-8 py-4 rounded-xl font-semibold hover:bg-indigo-400 transition-all">
                  Learn How It Works
                </button>
              </Link>
            </div>
            <p className="text-sm text-indigo-200 mt-6">
              Remember: Each seller sets their own credit requirements. Browse listings to find properties that match your situation.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}