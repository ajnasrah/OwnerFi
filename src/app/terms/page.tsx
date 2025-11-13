'use client';

import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import Link from 'next/link';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-primary-bg">
      <Header />

      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="bg-white rounded-xl shadow-light p-8 md:p-12">
          <h1 className="text-4xl font-bold text-primary-text mb-8">Terms of Service</h1>
          <p className="text-slate-600 mb-8">Effective Date: November 13, 2025</p>
          <p className="text-slate-600 mb-4">Governing Law: State of Tennessee</p>
          <p className="text-slate-600 mb-4">Arbitration Venue: Shelby County, Tennessee</p>
          <p className="text-slate-600 mb-8">Contact: support@ownerfi.ai</p>

          {/* Plain English Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
            <h2 className="text-2xl font-semibold text-blue-800 mb-4">📋 What You Need to Know (Plain English)</h2>
            <ul className="space-y-2 text-blue-700">
              <li>• <strong>We search for active MLS owner finance properties</strong> in specific areas and store them in our database</li>
              <li>• <strong>We give you a way to view owner finance deals</strong> stored in our database</li>
              <li>• <strong>ALL information is ONLY what listing agents told us</strong> - we don't verify, inspect, or confirm anything</li>
              <li>• <strong>Payment estimates are ILLUSTRATIVE ONLY</strong> - excludes taxes, insurance, HOA, reserves, and fees</li>
              <li>• <strong>Down payment amounts shown are NOT binding</strong> - final terms set only in signed agreement</li>
              <li>• <strong>Property information comes from realtors and MLS data</strong> - we provide approximate details based on what we're told</li>
              <li>• <strong>Sellers can change or withdraw their offers at any time</strong> - nothing is finalized until closing</li>
              <li>• <strong>We do NOT guarantee approvals</strong> - sellers may require credit reports, income verification, and background checks</li>
              <li>• <strong>We may be wrong about property details</strong> - information can be inaccurate, outdated, or incomplete</li>
              <li>• <strong>DO NOT ASSUME anything we provide is verified or correct</strong> - verify everything yourself</li>
              <li>• <strong>NEVER wire funds based on OwnerFi information</strong> - verify all wiring instructions with escrow/title company by phone</li>
              <li>• <strong>Hire a mortgage broker or RMLO</strong> - we strongly recommend professional representation</li>
              <li>• <strong>You accept full responsibility for verification</strong> - by signing up, you agree to verify everything yourself</li>
              <li>• <strong>Your contact info will be sold to licensed realtors</strong> who may call/text/email you</li>
              <li>• <strong>We're not your agent, broker, or advisor</strong> - we're just a property database and lead generation platform</li>
            </ul>
          </div>

          <div className="space-y-8 text-lg leading-relaxed text-slate-700">

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">1. Acceptance of Terms</h2>
              <p>By accessing or using OwnerFi ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service. You must be at least 18 years old and legally capable of entering into contracts to use this service.</p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                <p className="font-bold text-yellow-800">⚠️ CRITICAL ACKNOWLEDGMENT</p>
                <p className="text-yellow-700 mt-2">
                  <strong>By creating an account or using OwnerFi, you explicitly acknowledge and accept that:</strong>
                </p>
                <ul className="list-disc ml-6 mt-2 space-y-1 text-yellow-700 text-sm">
                  <li>Property information may be inaccurate, incomplete, or outdated</li>
                  <li>You are solely responsible for verifying all property details</li>
                  <li>OwnerFi may provide incorrect information and disclaims liability for such errors</li>
                  <li>You assume all risk associated with relying on property information displayed on OwnerFi</li>
                  <li><strong>Nothing we provide is verified, correct, or guaranteed - DO NOT ASSUME OTHERWISE</strong></li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">2. Description of Service</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-blue-800">🏠 HOW OWNERFI WORKS</p>
                <p className="text-blue-700 mt-2">OwnerFi is a property database and lead generation platform that:</p>
                <ul className="list-disc ml-6 mt-2 space-y-1 text-blue-700">
                  <li><strong>Searches for active MLS listings</strong> with owner financing in specific geographic areas</li>
                  <li><strong>Stores owner finance property data</strong> in our database collected from various sources</li>
                  <li><strong>Provides users a way to view and browse</strong> owner finance deals stored in our database</li>
                  <li><strong>Displays property information</strong> including approximate prices, terms, and details</li>
                  <li><strong>Receives information from licensed realtors</strong> and MLS data sources</li>
                  <li><strong>Provides approximate calculations</strong> for payments, interest rates, and terms based on available data</li>
                  <li><strong>Collects buyer information and preferences</strong> from users interested in properties</li>
                  <li><strong>Sells buyer lead information</strong> to licensed real estate agents and brokers</li>
                  <li><strong>Matches buyers with agents</strong> who can help with property transactions</li>
                </ul>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-red-800">⚠️ IMPORTANT LIMITATION</p>
                <p className="text-red-700 mt-2">
                  <strong>All property information in our database is approximate and based ONLY on what listing agents told us.</strong> We receive information from listing agents, realtors, MLS systems, and other data providers and store it in our database exactly as provided for you to view. We do not verify, inspect, or confirm any information. This information may be:
                </p>
                <ul className="list-disc ml-6 mt-2 space-y-1 text-red-700 text-sm">
                  <li>Incomplete or missing key details</li>
                  <li>Inaccurate due to data entry errors or outdated information</li>
                  <li>Changed since it was added to our database</li>
                  <li>Stale or no longer current (properties may have sold or been delisted)</li>
                  <li>Misinterpreted or incorrectly displayed</li>
                  <li>No longer accurate or available</li>
                </ul>
                <p className="text-red-700 mt-2 font-semibold">OwnerFi makes no guarantees about the accuracy, currency, or availability of any property information in our database.</p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                <p className="text-green-700"><strong>Important:</strong> <strong className="text-green-800">Buyers do not pay for use of OwnerFi.</strong> Our service is free for buyers. Payments are made by licensed real estate professionals for access to leads. Your use of the service is also governed by our <Link href="/privacy" className="underline hover:text-green-800">Privacy Policy</Link>, which describes how we collect, use, and share your information.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">3. NOT A LICENSED BROKER OR AGENT</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-red-800 text-xl">⚠️ CRITICAL LEGAL DISCLAIMER</p>
                <p className="text-red-700 mt-2"><strong>OWNERFI IS NOT A LICENSED REAL ESTATE BROKER, AGENT, OR LENDER IN ANY STATE.</strong> We do not:</p>
                <ul className="list-disc ml-6 mt-2 space-y-1 text-red-700">
                  <li>Represent buyers or sellers in real estate transactions</li>
                  <li>Negotiate sales prices or financing terms</li>
                  <li>Provide real estate brokerage services</li>
                  <li>Act as a fiduciary or advocate for any party</li>
                  <li>Provide lending, mortgage, or financial services</li>
                  <li>Provide legal, tax, or investment advice</li>
                  <li>Guarantee property information accuracy</li>
                  <li>Verify property information from third parties</li>
                  <li>Conduct property inspections or due diligence</li>
                  <li>Facilitate or conduct real estate transactions</li>
                </ul>
                <p className="text-red-700 mt-2"><strong>WE ARE SOLELY A PROPERTY DATABASE AGGREGATOR AND LEAD GENERATION PLATFORM.</strong></p>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-purple-800">🏛️ STATE LICENSING DISCLOSURES</p>
                <div className="text-purple-700 mt-2 space-y-1 text-sm">
                  <p><strong>California:</strong> Not licensed by California Bureau of Real Estate. License #: N/A</p>
                  <p><strong>Texas:</strong> Not licensed by Texas Real Estate Commission (TREC). TSB #: N/A</p>
                  <p><strong>Florida:</strong> Not licensed by Florida Department of Business & Professional Regulation</p>
                  <p><strong>New York:</strong> Not licensed by New York Department of State</p>
                  <p><strong>All States:</strong> We are not licensed to provide real estate brokerage services in any jurisdiction</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">4. SELLER'S RIGHT TO CHANGE OR WITHDRAW OFFERS</h2>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-4">
                <h3 className="font-bold text-orange-800 text-xl mb-4">🔄 NO BINDING COMMITMENTS - SELLERS RESERVE ALL RIGHTS</h3>

                <div className="space-y-4 text-orange-700">
                  <div className="bg-orange-100 border border-orange-300 rounded-lg p-4">
                    <p className="font-bold text-orange-800 mb-2">⚠️ NOTHING IS FINALIZED UNTIL CLOSING</p>
                    <p className="text-orange-700 text-sm mb-2">
                      <strong>Property listings on OwnerFi are informational only and DO NOT constitute binding offers or commitments.</strong>
                    </p>
                    <ul className="list-disc ml-6 space-y-1 text-orange-700 text-sm">
                      <li><strong>Sellers reserve the absolute right</strong> to change, modify, or withdraw their seller finance offers at any time, for any reason, without notice or explanation</li>
                      <li><strong>Terms shown are subject to change</strong> - interest rates, down payments, monthly payments, loan terms, and all other conditions may be modified or revoked</li>
                      <li><strong>Availability is not guaranteed</strong> - properties may be sold, delisted, or removed from seller financing programs at seller's sole discretion</li>
                      <li><strong>No obligation exists</strong> until a legally binding purchase agreement is fully executed and all contingencies are satisfied</li>
                      <li><strong>Verbal or written communications</strong> from OwnerFi, realtors, or sellers do not create binding commitments until formal closing</li>
                    </ul>
                  </div>

                  <div className="bg-red-100 border border-red-300 rounded-lg p-4">
                    <p className="font-bold text-red-800 mb-2">🚨 OWNERFI'S RIGHT TO MODIFY OR REMOVE LISTINGS</p>
                    <p className="text-red-700 text-sm mb-2">
                      <strong>OwnerFi reserves the right to:</strong>
                    </p>
                    <ul className="list-disc ml-6 space-y-1 text-red-700 text-sm">
                      <li>Modify, update, or remove property listings from our database at any time without notice</li>
                      <li>Correct errors in pricing, terms, or property details at any time</li>
                      <li>Withdraw properties from our platform for any reason</li>
                      <li>Update financing terms, interest rates, or payment calculations</li>
                      <li>Remove properties that are no longer available or offering seller financing</li>
                    </ul>
                    <p className="text-red-700 text-sm mt-2 font-bold">
                      You acknowledge that property information may change at any time and that you have no claim against OwnerFi for such changes.
                    </p>
                  </div>

                  <div className="bg-purple-100 border border-purple-300 rounded-lg p-4">
                    <p className="font-bold text-purple-800 mb-2">💳 NO GUARANTEE OF APPROVAL - SELLERS REQUIRE CREDIT CHECKS</p>
                    <p className="text-purple-700 text-sm mb-2">
                      <strong>OwnerFi does NOT guarantee approval for any financing or property purchase.</strong>
                    </p>
                    <ul className="list-disc ml-6 space-y-1 text-purple-700 text-sm">
                      <li><strong>Sellers may require credit reports</strong> - Most sellers will pull your credit report and check your credit score before approving financing</li>
                      <li><strong>Income verification required</strong> - Sellers typically require proof of income, employment verification, tax returns, and bank statements</li>
                      <li><strong>Background checks may be conducted</strong> - Sellers may check criminal history, rental history, and previous bankruptcies or foreclosures</li>
                      <li><strong>Down payment verification</strong> - Sellers may require proof of funds for down payment and closing costs</li>
                      <li><strong>Sellers have complete discretion</strong> - Sellers can deny your application for any lawful reason including credit score, debt-to-income ratio, employment history, or personal preference</li>
                      <li><strong>No guarantee of financing terms</strong> - Even if approved, final terms may differ from what was advertised</li>
                      <li><strong>OwnerFi has no control over approvals</strong> - We do not make financing decisions or influence seller approval processes</li>
                    </ul>
                    <p className="text-purple-700 text-sm mt-2 font-bold">
                      Viewing a property on OwnerFi does NOT mean you will be approved for financing. All approval decisions are made solely by property sellers.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">5. PAYMENT ESTIMATES & FINANCIAL CALCULATIONS</h2>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-4">
                <h3 className="font-bold text-amber-800 text-xl mb-4">💰 PAYMENT ESTIMATES ARE FOR ILLUSTRATION ONLY</h3>

                <div className="space-y-4 text-amber-700">
                  <div className="bg-amber-100 border border-amber-300 rounded-lg p-4">
                    <p className="font-bold text-amber-800 mb-2">⚠️ NON-BINDING ESTIMATES</p>
                    <p className="text-amber-700 text-sm mb-2">
                      <strong>Any payment amounts displayed by OwnerFi are NON-BINDING ESTIMATES generated from assumptions that can be wrong or incomplete.</strong> Payment estimates (including "estimated monthly payment," APR-like figures, amortization schedules, and affordability outputs) are provided for informational and illustrative purposes only.
                    </p>
                  </div>

                  <div className="bg-red-100 border border-red-300 rounded-lg p-4">
                    <p className="font-bold text-red-800 mb-2">🚨 WHAT'S NOT INCLUDED IN PAYMENT ESTIMATES</p>
                    <p className="text-red-700 text-sm mb-2"><strong>Unless explicitly stated, payment estimates EXCLUDE:</strong></p>
                    <ul className="list-disc ml-6 space-y-1 text-red-700 text-sm">
                      <li><strong>Property taxes</strong> - Can vary significantly by location and change annually</li>
                      <li><strong>Homeowner's insurance</strong> - Required by most sellers and can vary widely</li>
                      <li><strong>HOA dues</strong> - Homeowner association fees (monthly, quarterly, or annual)</li>
                      <li><strong>Mortgage insurance</strong> - If required by the seller</li>
                      <li><strong>Flood insurance</strong> - If property is in a flood zone</li>
                      <li><strong>Escrow reserves</strong> - Upfront funds for taxes and insurance</li>
                      <li><strong>Lender/servicer fees</strong> - Origination, processing, or servicing fees</li>
                      <li><strong>Property maintenance</strong> - Repairs, utilities, and upkeep</li>
                    </ul>
                    <p className="text-red-700 text-sm mt-2 font-bold">
                      YOUR ACTUAL MONTHLY PAYMENT WILL LIKELY BE SIGNIFICANTLY HIGHER than the estimate shown once these items are included.
                    </p>
                  </div>

                  <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4">
                    <p className="font-bold text-yellow-800 mb-2">⚠️ IMPORTANT CALCULATION LIMITATIONS</p>
                    <ul className="list-disc ml-6 space-y-1 text-yellow-700 text-sm">
                      <li><strong>Rounding & Timing:</strong> Estimates may differ due to rounding, calendar day counts, compounding conventions, and timing of first payment</li>
                      <li><strong>Rate/Term Changes:</strong> Sellers may change interest rate, amortization period, or balloon terms at any time before a fully executed agreement</li>
                      <li><strong>Escrow Variability:</strong> If escrows are required, taxes and insurance can change annually and increase the total monthly payment</li>
                      <li><strong>Balloon Payments:</strong> If a balloon payment applies, you will owe the remaining balance in full at a specified date and may need to refinance or pay in cash</li>
                      <li><strong>Assumption Errors:</strong> Estimates are based on information provided by third parties that may be incorrect</li>
                    </ul>
                  </div>

                  <div className="bg-purple-100 border border-purple-300 rounded-lg p-4">
                    <p className="font-bold text-purple-800 mb-2">📋 NO COMMITMENT OR OFFER</p>
                    <p className="text-purple-700 text-sm">
                      <strong>Final terms are solely determined by the seller and/or their designated loan professional</strong> after review of your full financial information, credit report, employment verification, and other documentation. Payment estimates displayed on OwnerFi are <strong>NOT</strong>:
                    </p>
                    <ul className="list-disc ml-6 mt-2 space-y-1 text-purple-700 text-sm">
                      <li>An offer to finance or lend</li>
                      <li>A commitment to provide financing</li>
                      <li>A guarantee of approval or terms</li>
                      <li>A quote from any lender or seller</li>
                      <li>A binding agreement of any kind</li>
                    </ul>
                    <p className="text-purple-700 text-sm mt-2 font-bold">
                      You agree not to rely on any estimate as a quote, commitment, or approval.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">6. DOWN PAYMENTS, DEPOSITS & WIRE FRAUD PROTECTION</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
                <h3 className="font-bold text-red-800 text-xl mb-4">🏦 CRITICAL FINANCIAL PROTECTIONS</h3>

                <div className="space-y-4 text-red-700">
                  <div className="bg-red-100 border border-red-300 rounded-lg p-4">
                    <p className="font-bold text-red-800 mb-2">💵 DOWN PAYMENTS ARE NOT BINDING</p>
                    <p className="text-red-700 text-sm mb-2">
                      <strong>Any "down payment," "earnest money," or "option fee" amounts discussed on OwnerFi are PLACEHOLDERS until the parties sign a written agreement.</strong>
                    </p>
                    <ul className="list-disc ml-6 space-y-1 text-red-700 text-sm">
                      <li><strong>Type of Payment:</strong> Whether a payment is earnest money, option fee, down payment, or deposit is defined ONLY in the final, signed contract</li>
                      <li><strong>Refundability:</strong> Whether funds are refundable (in whole or in part) is defined ONLY in the final, signed contract between buyer and seller</li>
                      <li><strong>Amount May Change:</strong> The actual down payment amount required by the seller may be different from what is shown on OwnerFi</li>
                      <li><strong>Timing:</strong> When funds are due and how they are applied is determined by the signed agreement, not by OwnerFi listings</li>
                    </ul>
                    <p className="text-red-700 text-sm mt-2 font-bold">
                      Do NOT make any financial commitments or payments based solely on information from OwnerFi.
                    </p>
                  </div>

                  <div className="bg-orange-100 border border-orange-300 rounded-lg p-4">
                    <p className="font-bold text-orange-800 mb-2">🏛️ ESCROW REQUIREMENT</p>
                    <p className="text-orange-700 text-sm">
                      <strong>All funds should be deposited with a licensed escrow company, title company, or attorney.</strong> OwnerFi does NOT:
                    </p>
                    <ul className="list-disc ml-6 mt-2 space-y-1 text-orange-700 text-sm">
                      <li>Receive, handle, or hold any buyer or seller funds</li>
                      <li>Provide escrow or title services</li>
                      <li>Instruct or direct wire transfers or payments</li>
                      <li>Act as an intermediary for financial transactions</li>
                    </ul>
                    <p className="text-orange-700 text-sm mt-2 font-bold">
                      You must independently select and verify a licensed, reputable escrow or title company.
                    </p>
                  </div>

                  <div className="bg-red-200 border-2 border-red-400 rounded-lg p-4">
                    <p className="font-bold text-red-900 mb-2 text-lg">🚨 WIRE FRAUD WARNING - READ CAREFULLY</p>
                    <p className="text-red-900 text-sm mb-2">
                      <strong>Wire fraud is extremely common in real estate transactions. NEVER wire funds based on email instructions alone.</strong>
                    </p>
                    <ul className="list-disc ml-6 space-y-1 text-red-900 text-sm font-semibold">
                      <li>⛔ OWNERFI NEVER PROVIDES WIRE INSTRUCTIONS</li>
                      <li>⛔ OWNERFI NEVER REQUESTS PAYMENTS OR DEPOSITS</li>
                      <li>⛔ OWNERFI NEVER SENDS WIRING INFORMATION BY EMAIL</li>
                    </ul>
                    <p className="text-red-900 text-sm mt-3 font-bold">
                      ✅ ALWAYS verify wiring instructions BY PHONE with the escrow/title company using a phone number YOU independently look up (not from an email).
                    </p>
                    <p className="text-red-900 text-sm mt-2">
                      <strong>If you receive an email claiming to be from OwnerFi with wire instructions, it is FRAUD.</strong> Scammers hack email accounts and send fake wiring instructions. Once you wire money to a fraudulent account, it is almost impossible to recover.
                    </p>
                  </div>

                  <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4">
                    <p className="font-bold text-yellow-800 mb-2">⚠️ NO RELIANCE ON LISTINGS</p>
                    <p className="text-yellow-700 text-sm">
                      Listing statements about down payments, earnest money, option fees, or deposit amounts are <strong>NOT binding</strong> until confirmed in a signed purchase agreement reviewed by your attorney. OwnerFi is not a party to any agreement between buyers and sellers and has no control over deposit terms or refundability.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">7. MANDATORY PROFESSIONAL REPRESENTATION RECOMMENDATION</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-4">
                <h3 className="font-bold text-blue-800 text-xl mb-4">👔 HIRE LICENSED PROFESSIONALS - PROTECT YOURSELF</h3>

                <div className="space-y-4 text-blue-700">
                  <div className="bg-blue-100 border border-blue-300 rounded-lg p-4">
                    <p className="font-bold text-blue-800 mb-2">💼 STRONGLY RECOMMENDED: MORTGAGE BROKER OR RMLO</p>
                    <p className="text-blue-700 text-sm mb-2">
                      <strong>OwnerFi STRONGLY RECOMMENDS hiring a licensed mortgage broker or Residential Mortgage Loan Originator (RMLO) to protect your interests.</strong>
                    </p>
                    <p className="text-blue-700 text-sm mb-2">A mortgage broker or RMLO can:</p>
                    <ul className="list-disc ml-6 space-y-1 text-blue-700 text-sm">
                      <li><strong>Review and verify financing terms</strong> - ensure you understand interest rates, payment schedules, and loan structures</li>
                      <li><strong>Explain risks and obligations</strong> - clarify balloon payments, prepayment penalties, and default consequences</li>
                      <li><strong>Compare financing options</strong> - help you evaluate if seller financing is your best option</li>
                      <li><strong>Protect you from predatory terms</strong> - identify unfair or exploitative loan conditions</li>
                      <li><strong>Ensure compliance with regulations</strong> - verify the transaction meets federal and state lending laws</li>
                      <li><strong>Negotiate on your behalf</strong> - work to improve terms and protect your financial interests</li>
                    </ul>
                  </div>

                  <div className="bg-purple-100 border border-purple-300 rounded-lg p-4">
                    <p className="font-bold text-purple-800 mb-2">📋 OTHER REQUIRED PROFESSIONAL CONSULTATIONS</p>
                    <p className="text-purple-700 mb-2"><strong>Before entering any real estate transaction, you MUST consult with:</strong></p>
                    <ul className="list-disc ml-6 space-y-1 text-purple-700 text-sm">
                      <li><strong>Licensed Real Estate Attorney</strong> - To review all contracts, explain legal implications, and protect your legal rights</li>
                      <li><strong>Licensed Real Estate Agent/Buyer's Agent</strong> - To represent your interests and guide the transaction process</li>
                      <li><strong>Title Company or Title Attorney</strong> - To conduct title searches, verify ownership, and ensure clear title</li>
                      <li><strong>Licensed Home Inspector</strong> - To assess property condition and identify defects or needed repairs</li>
                      <li><strong>Certified Public Accountant (CPA) or Tax Professional</strong> - To understand tax implications and financial consequences</li>
                      <li><strong>Financial Advisor</strong> - To evaluate investment risks and assess affordability</li>
                    </ul>
                  </div>

                  <div className="bg-red-100 border border-red-300 rounded-lg p-4">
                    <p className="font-bold text-red-800 mb-2">🚨 FAILURE TO HIRE PROFESSIONALS = YOUR RISK</p>
                    <p className="text-red-700 text-sm">
                      <strong>If you choose not to hire licensed professionals, you proceed entirely at your own risk.</strong> OwnerFi is not responsible for any losses, damages, or problems arising from your failure to obtain professional representation. By using OwnerFi, you acknowledge that you have been advised to hire licensed professionals and accept all consequences if you choose not to do so.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">8. DO NOT ASSUME ANYTHING IS VERIFIED OR CORRECT</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
                <h3 className="font-bold text-red-800 text-xl mb-4">🚫 CRITICAL WARNING - NO VERIFICATION PROVIDED</h3>

                <div className="space-y-4 text-red-700">
                  <div className="bg-red-100 border border-red-300 rounded-lg p-4">
                    <p className="font-bold text-red-800 text-lg mb-2">⚠️ DO NOT ASSUME ANYTHING</p>
                    <p className="text-red-700 text-sm mb-2">
                      <strong>NOTHING on OwnerFi is verified, confirmed, guaranteed, or warranted to be correct.</strong>
                    </p>
                    <p className="text-red-700 text-sm mb-2"><strong>DO NOT ASSUME:</strong></p>
                    <ul className="list-disc ml-6 space-y-1 text-red-700 text-sm">
                      <li>✗ That property prices are accurate</li>
                      <li>✗ That property details (beds, baths, square footage) are correct</li>
                      <li>✗ That financing terms are current or available</li>
                      <li>✗ That you will be approved for financing</li>
                      <li>✗ That sellers won't require credit checks or income verification</li>
                      <li>✗ That payment calculations are accurate</li>
                      <li>✗ That properties are still for sale</li>
                      <li>✗ That seller financing is still being offered</li>
                      <li>✗ That the seller owns the property free and clear</li>
                      <li>✗ That there are no liens, judgments, or title issues</li>
                      <li>✗ That the property is in the condition described</li>
                      <li>✗ That listing agents provided us accurate information</li>
                      <li>✗ That any information from realtors or MLS is correct</li>
                      <li>✗ That OwnerFi has verified any information</li>
                      <li>✗ That information is current or up-to-date</li>
                    </ul>
                  </div>

                  <div className="bg-red-200 border-2 border-red-400 rounded-lg p-4">
                    <p className="font-bold text-red-900 text-center text-lg mb-2">
                      ⛔ ASSUME EVERYTHING IS WRONG UNTIL YOU VERIFY IT YOURSELF
                    </p>
                    <p className="text-red-800 text-sm text-center">
                      <strong>Treat all information on OwnerFi as unverified, potentially incorrect, and requiring independent confirmation.</strong> If you rely on any information without independent verification, you do so entirely at your own risk.
                    </p>
                  </div>

                  <div className="bg-orange-100 border border-orange-300 rounded-lg p-4">
                    <p className="font-bold text-orange-800 mb-2">🔍 WHAT YOU MUST VERIFY INDEPENDENTLY</p>
                    <p className="text-orange-700 text-sm mb-2"><strong>Before making ANY decisions, YOU must verify:</strong></p>
                    <ul className="list-disc ml-6 space-y-1 text-orange-700 text-sm">
                      <li>Property existence, location, and legal description</li>
                      <li>Current ownership and authority to sell</li>
                      <li>Title status, liens, encumbrances, and judgments</li>
                      <li>Property condition through professional inspection</li>
                      <li>Actual square footage, bedroom/bathroom count, and lot size</li>
                      <li>Current market value and comparable sales</li>
                      <li>Availability of seller financing and current terms</li>
                      <li>Interest rates, payment amounts, and loan structure</li>
                      <li>Property taxes, insurance costs, and HOA fees</li>
                      <li>Zoning, permitted uses, and building code compliance</li>
                      <li>Environmental issues, flood zones, and hazards</li>
                      <li>All representations made by sellers, agents, or OwnerFi</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">9. PROPERTY INFORMATION SOURCES & ACCURACY</h2>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-4">
                <h3 className="font-bold text-orange-800 text-xl mb-4">📊 WHERE OUR PROPERTY DATA COMES FROM</h3>

                <div className="space-y-4 text-orange-700">
                  <div>
                    <p className="font-semibold mb-2">Property information stored in our database is sourced from:</p>
                    <ul className="list-disc ml-6 space-y-1 text-sm">
                      <li><strong>Licensed real estate agents and brokers</strong> who provide us with property details</li>
                      <li><strong>Multiple Listing Service (MLS) data</strong> for active listings in specific areas</li>
                      <li><strong>Third-party data providers</strong> and aggregators</li>
                      <li><strong>Public records</strong> and county assessor data</li>
                      <li><strong>Property owners and sellers</strong> who list properties with us</li>
                    </ul>
                    <p className="text-sm mt-2"><strong>We aggregate this data and store it in our database to provide you a way to view available owner finance opportunities.</strong></p>
                  </div>

                  <div className="bg-blue-100 border border-blue-300 rounded-lg p-4">
                    <p className="font-bold text-blue-800 mb-2">📞 INFORMATION IS ONLY WHAT LISTING AGENTS TOLD US</p>
                    <p className="text-blue-700 text-sm">
                      <strong>ALL property information in our database is ONLY based on what the listing agent told us.</strong> We rely entirely on information provided by listing agents, brokers, and third-party sources. We do not inspect properties, verify facts, or confirm accuracy. If the listing agent provided incorrect, incomplete, or misleading information, our database will contain that same incorrect information. <strong>You cannot hold OwnerFi responsible for what listing agents tell us.</strong>
                    </p>
                  </div>

                  <div className="bg-red-100 border border-red-300 rounded-lg p-4">
                    <p className="font-bold text-red-800 mb-2">🚨 ACCURACY DISCLAIMER - READ CAREFULLY</p>
                    <p className="text-red-700 text-sm mb-2">
                      <strong>OwnerFi provides APPROXIMATE information based ONLY on what listing agents, realtors, and data sources tell us.</strong> We store this information in our database exactly as provided and make it available for viewing. We do not independently verify, inspect, or confirm this information. The information displayed in our database may be:
                    </p>
                    <ul className="list-disc ml-6 space-y-1 text-red-700 text-sm">
                      <li><strong>Wrong</strong> - Prices, square footage, bedrooms, bathrooms, lot size may be incorrect</li>
                      <li><strong>Outdated</strong> - Properties may have sold, been delisted, or had terms changed since being added to our database</li>
                      <li><strong>Incomplete</strong> - Critical information may be missing or unavailable</li>
                      <li><strong>Misleading</strong> - Descriptions may not accurately reflect property condition</li>
                      <li><strong>Unavailable</strong> - Properties shown may no longer be for sale or offer owner financing</li>
                      <li><strong>Stale</strong> - Data in our database may not reflect current market conditions or property status</li>
                    </ul>
                    <p className="text-red-700 text-sm mt-2 font-bold">
                      OwnerFi accepts no responsibility for incorrect, incomplete, outdated, or misleading property information stored in our database.
                    </p>
                  </div>

                  <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4">
                    <p className="font-bold text-yellow-800 mb-2">⚠️ PAYMENT & FINANCIAL CALCULATIONS</p>
                    <p className="text-yellow-700 text-sm">
                      All payment calculations, interest rates, monthly payments, down payment amounts, and financing terms shown are <strong>APPROXIMATE ESTIMATES ONLY</strong> based on information provided by third parties and stored in our database. These calculations:
                    </p>
                    <ul className="list-disc ml-6 space-y-1 text-yellow-700 text-sm mt-2">
                      <li>May be based on incorrect property prices or loan terms</li>
                      <li>Do not include taxes, insurance, HOA fees, or other costs</li>
                      <li>Are not offers to finance or commitments from any lender</li>
                      <li>May not reflect actual financing terms available to you</li>
                      <li>Should not be relied upon for financial planning or decision-making</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">10. USER RESPONSIBILITY & VERIFICATION REQUIREMENTS</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
                <h3 className="font-bold text-red-800 text-xl mb-4">🔍 YOUR MANDATORY VERIFICATION DUTIES</h3>

                <p className="text-red-700 mb-4">
                  <strong>BY SIGNING UP FOR OWNERFI, YOU EXPRESSLY AGREE AND ACKNOWLEDGE THAT:</strong>
                </p>

                <div className="space-y-3">
                  <div className="bg-red-100 border border-red-300 rounded p-3">
                    <p className="font-bold text-red-800">1. You Accept All Responsibility for Verification</p>
                    <p className="text-red-700 text-sm mt-1">
                      You are solely responsible for independently verifying ALL property information before making any decisions. This includes but is not limited to: property address, price, square footage, bedrooms, bathrooms, lot size, condition, ownership status, liens, title issues, zoning, permitted use, and all other material facts. The fact that a property is stored in our database does not mean the information is accurate or current.
                    </p>
                  </div>

                  <div className="bg-red-100 border border-red-300 rounded p-3">
                    <p className="font-bold text-red-800">2. You Acknowledge Information May Be Wrong</p>
                    <p className="text-red-700 text-sm mt-1">
                      You understand and accept that OwnerFi's database may contain incorrect, incomplete, outdated, or misleading information. <strong>You will NOT assume anything is verified or correct.</strong> You will not rely solely on OwnerFi's database information for any real estate, financial, or investment decision.
                    </p>
                  </div>

                  <div className="bg-red-100 border border-red-300 rounded p-3">
                    <p className="font-bold text-red-800">3. You Will Conduct Your Own Due Diligence</p>
                    <p className="text-red-700 text-sm mt-1">
                      Before entering into any agreement or making any payment, you will: conduct property inspections, obtain title searches, verify ownership, review all contracts with an attorney, verify financing terms with the lender or seller, confirm property is still available, and consult with licensed professionals including a mortgage broker or RMLO.
                    </p>
                  </div>

                  <div className="bg-red-100 border border-red-300 rounded p-3">
                    <p className="font-bold text-red-800">4. You Will Not Hold OwnerFi Liable</p>
                    <p className="text-red-700 text-sm mt-1">
                      You agree that OwnerFi is not responsible or liable for any losses, damages, or issues arising from inaccurate property information in our database, failed transactions, changed or withdrawn seller finance offers, or your reliance on information provided on the platform.
                    </p>
                  </div>

                  <div className="bg-red-100 border border-red-300 rounded p-3">
                    <p className="font-bold text-red-800">5. You Will Work With Licensed Professionals</p>
                    <p className="text-red-700 text-sm mt-1">
                      You agree to work with licensed real estate agents, attorneys, title companies, inspectors, mortgage brokers or RMLOs, and other qualified professionals before making any real estate purchase or investment decision. You acknowledge that failure to hire professionals is entirely your risk.
                    </p>
                  </div>
                </div>

                <div className="bg-red-200 border-2 border-red-400 rounded p-4 mt-4">
                  <p className="text-red-900 font-bold text-center">
                    ⚠️ BY USING OWNERFI, YOU ACCEPT FULL RESPONSIBILITY FOR VERIFYING ALL PROPERTY INFORMATION, ACKNOWLEDGE THAT NOTHING IS VERIFIED OR GUARANTEED, UNDERSTAND THAT SELLERS CAN WITHDRAW OFFERS AT ANY TIME, AND AGREE THAT OWNERFI IS NOT LIABLE FOR ANY INACCURACIES, ERRORS, OMISSIONS, OR OUTDATED INFORMATION IN OUR DATABASE.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">11. Lead Sales and Marketing Consent</h2>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-yellow-800 text-xl">📞 MARKETING & COMMUNICATION CONSENT</p>
                <p className="text-yellow-700 mt-2"><strong>BY REGISTERING, YOU EXPRESSLY CONSENT TO:</strong></p>
                <ul className="list-disc ml-6 mt-2 space-y-1 text-yellow-700">
                  <li>Having your contact information SOLD to licensed real estate professionals</li>
                  <li>Receiving calls, texts, and emails from multiple real estate agents</li>
                  <li>Being contacted using automated dialing systems</li>
                  <li>Marketing communications from our real estate partners</li>
                </ul>
                <p className="text-yellow-700 mt-2"><strong>Message and data rates may apply. This consent is required to use our service.</strong></p>
              </div>
              <p>When you register as a buyer, your information including but not limited to name, email, phone number, and property preferences <strong>WILL BE SOLD</strong> to real estate professionals who serve your area. You <strong>WILL BE CONTACTED</strong> by multiple agents regarding properties and services.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">12. Payments and Refunds</h2>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-orange-800 text-xl">💰 NO REFUNDS POLICY</p>
                <p className="text-orange-700 mt-2"><strong>ALL PAYMENTS FOR LEADS OR SERVICES ARE FINAL AND NON-REFUNDABLE.</strong></p>
                <p className="text-orange-700 mt-2"><strong>Payments are made exclusively by licensed real estate professionals for access to leads.</strong></p>
                <p className="text-orange-700 mt-2">OwnerFi does not guarantee:</p>
                <ul className="list-disc ml-6 mt-2 space-y-1 text-orange-700">
                  <li>Lead conversion or transaction success</li>
                  <li>Buyer qualification, creditworthiness, or ability to purchase</li>
                  <li>Buyer approval for seller financing (sellers may require credit checks)</li>
                  <li>Property availability or accuracy</li>
                  <li>That buyers will respond to contact attempts</li>
                  <li>That buyers will pass seller credit or income verification requirements</li>
                  <li>Any specific return on investment</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">13. No Warranties or Guarantees</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-800 mb-2">DISCLAIMER OF WARRANTIES</h3>
                <p className="text-red-700">THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE SPECIFICALLY DISCLAIM ALL WARRANTIES INCLUDING BUT NOT LIMITED TO:</p>
                <ul className="list-disc ml-6 mt-2 space-y-1 text-red-700">
                  <li>Accuracy of property information, prices, terms, or availability stored in our database</li>
                  <li>Completeness or timeliness of any data or listings</li>
                  <li>Accuracy of financial calculations, payment amounts, or interest rates</li>
                  <li>Quality or condition of any properties listed</li>
                  <li>Legal status or ownership of properties</li>
                  <li>Currency of data in our database (information may be outdated)</li>
                  <li>Reliability of third-party information from realtors or MLS sources</li>
                  <li>That properties shown are currently available or offer owner financing</li>
                  <li>That seller finance offers will remain available or unchanged</li>
                  <li>That information from realtors or data sources is accurate or current</li>
                  <li>That any information has been verified or confirmed</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">14. Limitation of Liability</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-800 mb-2">LIABILITY DISCLAIMER</h3>
                <p className="text-red-700 mb-2">TO THE MAXIMUM EXTENT PERMITTED BY LAW, OWNERFI AND ITS OWNERS, EMPLOYEES, AND AFFILIATES SHALL NOT BE LIABLE FOR:</p>
                <ul className="list-disc ml-6 space-y-1 text-red-700">
                  <li>ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES</li>
                  <li>LOSS OF PROFITS, REVENUE, DATA, OR BUSINESS OPPORTUNITIES</li>
                  <li>PROPERTY PURCHASE DECISIONS OR FINANCIAL LOSSES</li>
                  <li>INACCURATE, INCOMPLETE, OUTDATED, OR MISLEADING PROPERTY INFORMATION FROM ANY SOURCE</li>
                  <li>FAILED PROPERTY TRANSACTIONS OR FINANCING ARRANGEMENTS</li>
                  <li>SELLER WITHDRAWAL OR MODIFICATION OF FINANCING OFFERS</li>
                  <li>RELIANCE ON UNVERIFIED INFORMATION</li>
                  <li>FAILURE TO HIRE LICENSED PROFESSIONALS</li>
                  <li>RELIANCE ON INFORMATION PROVIDED BY REALTORS, MLS, OR OTHER DATA SOURCES</li>
                  <li>RELIANCE ON INFORMATION STORED IN OUR DATABASE</li>
                  <li>THIRD-PARTY CONDUCT, MISREPRESENTATIONS, OR COMMUNICATIONS</li>
                  <li>ANY DAMAGES EXCEEDING $100 IN THE AGGREGATE</li>
                </ul>
                <p className="text-red-700 mt-3 font-bold">
                  OWNERFI'S TOTAL LIABILITY TO YOU SHALL NOT EXCEED $100 (ONE HUNDRED DOLLARS) REGARDLESS OF THE NATURE OF YOUR CLAIM.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">15. Indemnification</h2>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-purple-700">
                  You agree to <strong>indemnify, defend, and hold harmless</strong> OwnerFi, Prosway, and their affiliates, officers, directors, employees, contractors, and agents from and against any and all claims, damages, losses, liabilities, costs, or expenses (including reasonable attorney's fees) arising from:
                </p>
                <ul className="list-disc ml-6 mt-2 space-y-1 text-purple-700">
                  <li>Your use of the OwnerFi platform or database</li>
                  <li>Your reliance on property information displayed on OwnerFi or stored in our database</li>
                  <li>Your reliance on unverified information</li>
                  <li>Your assumption that information is correct without verification</li>
                  <li>Your participation in any real estate transaction or investment opportunity</li>
                  <li>Your failure to verify property information independently</li>
                  <li>Your failure to hire licensed professionals</li>
                  <li>Seller withdrawal or modification of financing offers</li>
                  <li>Your violation of these Terms of Service</li>
                  <li>Your violation of any law, regulation, or third-party rights</li>
                  <li>Any claim that you were provided inaccurate, outdated, or misleading information</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">16. User Responsibilities</h2>
              <p>You agree to:</p>
              <ul className="list-disc ml-6 mt-2 space-y-2">
                <li>Provide accurate information when registering</li>
                <li>Conduct your own independent due diligence on any properties</li>
                <li>Verify all property information through appropriate licensed professionals</li>
                <li>NOT assume anything on OwnerFi is verified or correct</li>
                <li>Hire a mortgage broker or RMLO to protect your interests</li>
                <li>Not rely solely on OwnerFi's database information for any real estate decisions</li>
                <li>Confirm property availability and details directly with realtors or sellers</li>
                <li>Understand that seller finance offers can be withdrawn or changed at any time</li>
                <li>Comply with all applicable laws and regulations</li>
                <li>Not use the service for any illegal or unauthorized purpose</li>
                <li>Accept full responsibility for your real estate and investment decisions</li>
                <li>Indemnify OwnerFi against any claims arising from your use of the service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">17. Modifications to Service and Terms</h2>
              <p>We reserve the right to modify, suspend, or discontinue the service at any time without notice. We may also update these Terms at any time, and continued use constitutes acceptance of any changes. Property information in our database may be updated, modified, or removed at any time without notice. Sellers may change or withdraw financing offers at any time without notice.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">17A. CREATIVE FINANCE STRUCTURES (Subject-To, Wraps, Lease Options)</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
                <h3 className="font-bold text-red-800 text-xl mb-4">🚨 CRITICAL CREATIVE FINANCE DISCLAIMER</h3>

                <div className="space-y-4 text-red-700">
                  <div className="bg-red-100 border border-red-300 rounded-lg p-4">
                    <p className="font-bold text-red-800 mb-2">⚠️ OWNERFI DOES NOT ADVISE ON OR STRUCTURE CREATIVE FINANCE</p>
                    <p className="text-red-700 text-sm mb-2">
                      <strong>OwnerFi does NOT:</strong>
                    </p>
                    <ul className="list-disc ml-6 space-y-1 text-red-700 text-sm">
                      <li>Advise on creative finance structures (sub2, wraps, lease options, contract-for-deed)</li>
                      <li>Structure or facilitate creative finance deals</li>
                      <li>Draft creative finance documents or agreements</li>
                      <li>Verify the status of existing mortgages on properties</li>
                      <li>Confirm the existence or legality of wraparound terms</li>
                      <li>Determine whether a deal triggers due-on-sale clauses</li>
                      <li>Provide Dodd-Frank or SAFE Act compliance guidance</li>
                      <li>Verify compliance with RESPA or state lending laws</li>
                    </ul>
                  </div>

                  <div className="bg-orange-100 border border-orange-300 rounded-lg p-4">
                    <p className="font-bold text-orange-800 mb-2">📋 INFORMATION FROM LISTING AGENTS ONLY</p>
                    <p className="text-orange-700 text-sm">
                      <strong>Any reference to seller financing, subject-to, wraparound mortgages, or creative structures originates solely from the listing agent or seller.</strong> OwnerFi simply displays this information as provided. We do not verify, validate, or endorse any creative finance structure.
                    </p>
                  </div>

                  <div className="bg-red-200 border-2 border-red-400 rounded-lg p-4">
                    <p className="font-bold text-red-900 mb-2 text-lg">🚨 BUYER MUST VERIFY ALL CREATIVE FINANCE RISKS</p>
                    <p className="text-red-900 text-sm mb-2">
                      <strong>Before entering any creative finance transaction, you MUST independently verify:</strong>
                    </p>
                    <ul className="list-disc ml-6 space-y-1 text-red-900 text-sm">
                      <li><strong>Mortgage status:</strong> Whether existing mortgages exist, payment status, and balances</li>
                      <li><strong>Due-on-sale exposure:</strong> Whether the transaction triggers acceleration of existing loans</li>
                      <li><strong>Title and lien position:</strong> Priority of liens and encumbrances</li>
                      <li><strong>Legal compliance:</strong> State-specific lending laws, usury limits, and licensing requirements</li>
                      <li><strong>Dodd-Frank/SAFE Act:</strong> Whether seller needs RMLO license or falls under exemptions</li>
                      <li><strong>Balloon payment risks:</strong> Your ability to refinance or pay balloon when due</li>
                      <li><strong>Wraparound legality:</strong> Whether wraparound mortgages are legal in your state</li>
                      <li><strong>Loan servicer requirements:</strong> Who services the loan and how payments are handled</li>
                      <li><strong>Default consequences:</strong> What happens if you or seller defaults</li>
                      <li><strong>Insurance requirements:</strong> Whether seller's lender requires notification</li>
                    </ul>
                  </div>

                  <div className="bg-purple-100 border border-purple-300 rounded-lg p-4">
                    <p className="font-bold text-purple-800 mb-2">👔 MANDATORY PROFESSIONAL CONSULTATION</p>
                    <p className="text-purple-700 text-sm">
                      <strong>ALL creative finance structures must be reviewed by:</strong>
                    </p>
                    <ul className="list-disc ml-6 mt-2 space-y-1 text-purple-700 text-sm">
                      <li><strong>Licensed real estate attorney</strong> in the property's state</li>
                      <li><strong>Licensed Residential Mortgage Loan Originator (RMLO)</strong> or mortgage broker</li>
                      <li><strong>Title company</strong> to verify liens and ownership</li>
                      <li><strong>CPA or tax professional</strong> for tax implications</li>
                    </ul>
                    <p className="text-purple-700 text-sm mt-2 font-bold">
                      Do NOT proceed with any creative finance structure without professional legal and financial advice.
                    </p>
                  </div>

                  <div className="bg-red-200 border-2 border-red-400 rounded-lg p-4 mt-4">
                    <p className="text-red-900 font-bold text-center text-lg mb-2">
                      ⛔ OWNERFI BEARS ZERO LIABILITY FOR CREATIVE FINANCE STRUCTURES
                    </p>
                    <p className="text-red-800 text-sm text-center">
                      <strong>You assume ALL risk associated with creative financing. OwnerFi is not responsible for due-on-sale triggers, balloon payment issues, title problems, lender acceleration, Dodd-Frank violations, or any consequences of creative finance transactions.</strong>
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">18. Governing Law and Dispute Resolution</h2>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-slate-800">⚖️ BINDING ARBITRATION & CLASS ACTION WAIVER</p>
                <p className="text-slate-700 mt-2"><strong>BY USING THIS SERVICE, YOU AGREE TO:</strong></p>
                <ul className="list-disc ml-6 mt-2 space-y-1 text-slate-700">
                  <li><strong>WAIVE YOUR RIGHT TO A JURY TRIAL</strong></li>
                  <li><strong>WAIVE YOUR RIGHT TO PARTICIPATE IN CLASS ACTION LAWSUITS</strong></li>
                  <li><strong>RESOLVE ALL DISPUTES THROUGH BINDING ARBITRATION IN SHELBY COUNTY, TENNESSEE</strong></li>
                </ul>
              </div>
              <p className="mb-4">These Terms shall be governed by the laws of the <strong>State of Tennessee</strong>.</p>
              <p><strong>Any and all disputes</strong> arising from or relating to these Terms, your use of the OwnerFi platform, property information, creative finance structures, lead purchases, or any other matter shall be resolved <strong>exclusively through binding arbitration in Shelby County, Tennessee</strong> in accordance with the rules of the American Arbitration Association.</p>
              <p className="mt-4"><strong>You expressly waive:</strong></p>
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>Your right to a jury trial</li>
                <li>Your right to participate in class action lawsuits</li>
                <li>Your right to litigate disputes in any court</li>
              </ul>
              <p className="mt-4 font-bold">This arbitration clause is binding and enforceable. All users agree to resolve disputes through arbitration only.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">19. Severability</h2>
              <p>If any provision of these Terms is found to be unenforceable, the remaining provisions will continue to be valid and enforceable.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">20. Contact Information</h2>
              <p>If you have questions about these Terms, please contact us at:</p>
              <div className="mt-2 p-4 bg-slate-50 rounded-lg">
                <p><strong>OwnerFi</strong></p>
                <p>Email: support@ownerfi.ai</p>
                <p>Address: #1076, 1028 Cresthaven Road, Suite 200<br />Memphis, TN 38119<br />United States</p>
              </div>
            </section>

            <div className="border-t pt-8 mt-8">
              <p className="text-sm text-slate-500">
                By using OwnerFi, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. You specifically acknowledge that: (1) property information stored in our database may be inaccurate, incomplete, or outdated; (2) you will NOT assume anything is verified or correct; (3) sellers can change or withdraw financing offers at any time; (4) you should hire a mortgage broker or RMLO to protect yourself; and (5) you accept full responsibility for verifying all information independently.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
