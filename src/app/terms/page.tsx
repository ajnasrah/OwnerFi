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
          <p className="text-slate-600 mb-8">Last updated: September 3, 2025</p>
          
          {/* Plain English Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
            <h2 className="text-2xl font-semibold text-blue-800 mb-4">📋 What You Need to Know (Plain English)</h2>
            <ul className="space-y-2 text-blue-700">
              <li>• <strong>We connect buyers with real estate agents</strong> - that&apos;s our business model</li>
              <li>• <strong>Your contact info will be sold to licensed realtors</strong> who may call/text/email you</li>
              <li>• <strong>We don&apos;t specify what type of deal each property is</strong> - could be seller finance, subject-to, contract for deed, lease-to-own, or other arrangements</li>
              <li>• <strong>You must verify the deal type yourself</strong> - we don&apos;t guarantee what financing structure is actually offered</li>
              <li>• <strong>We don&apos;t guarantee property accuracy or availability</strong> - always verify everything yourself</li>
              <li>• <strong>We&apos;re not your agent, broker, or advisor</strong> - we&apos;re just a lead generation platform</li>
              <li>• <strong>Do your own homework</strong> before making any real estate decisions</li>
              <li>• <strong>All sales are final</strong> - no refunds on lead purchases</li>
            </ul>
          </div>

          <div className="space-y-8 text-lg leading-relaxed text-slate-700">
            
            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">1. Acceptance of Terms</h2>
              <p>By accessing or using OwnerFi ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service. You must be at least 18 years old and legally capable of entering into contracts to use this service.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">2. Description of Service</h2>
              <p>OwnerFi is a platform that:</p>
              <ul className="list-disc ml-6 mt-2 space-y-2">
                <li>Lists owner-financed real estate properties</li>
                <li>Collects buyer information and preferences</li>
                <li>Matches buyers with properties based on their criteria</li>
                <li>Sells buyer lead information to licensed real estate agents and brokers</li>
                <li>Provides lead management tools for real estate professionals</li>
              </ul>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <p className="text-blue-700"><strong>Important:</strong> <strong className="text-blue-800">Buyers do not pay for use of OwnerFi.</strong> Our service is free for buyers. Payments are made by licensed real estate professionals for access to leads. Your use of the service is also governed by our <Link href="/privacy" className="underline hover:text-blue-800">Privacy Policy</Link>, which describes how we collect, use, and share your information.</p>
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
                  <li>Facilitate or conduct real estate transactions</li>
                </ul>
                <p className="text-red-700 mt-2"><strong>WE ARE SOLELY A LEAD GENERATION AND MARKETING PLATFORM CONNECTING CONSUMERS WITH LICENSED REAL ESTATE PROFESSIONALS.</strong></p>
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
              <h2 className="text-2xl font-semibold text-primary-text mb-4">4. Lead Sales and Marketing Consent</h2>
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
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                <p className="font-bold text-green-800">📞 OWNERFI COMMUNICATION RIGHTS</p>
                <p className="text-green-700 mt-2">
                  <strong>By registering, you expressly consent to OwnerFi contacting you via phone, text, and email for:</strong>
                </p>
                <ul className="list-disc ml-6 mt-2 space-y-1 text-green-700">
                  <li><strong>Marketing communications</strong> - Property updates, platform promotions, service offerings</li>
                  <li><strong>Account and service notifications</strong> - Password resets, account updates, security alerts</li>
                  <li><strong>Platform updates</strong> - New features, policy changes, important announcements</li>
                  <li><strong>Customer support</strong> - Responding to your inquiries and technical support</li>
                  <li><strong>Legal and compliance</strong> - Required notices, dispute resolution, regulatory compliance</li>
                </ul>
                <p className="text-green-700 mt-2 text-sm">
                  <strong>This includes automated calls and texts. Message and data rates may apply.</strong> 
                  You consent to these communications as part of using our platform, even if your number is on a Do Not Call registry.
                </p>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                <p className="font-bold text-red-800">🚨 AGENT COMPLIANCE & LIABILITY LIMITATION</p>
                <div className="text-red-700 mt-2 space-y-2">
                  <p><strong>OwnerFi is not responsible for agent compliance with TCPA, state telemarketing laws, or communication regulations.</strong></p>
                  <p><strong>Each agent is an independent contractor responsible for:</strong></p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Compliance with federal and state TCPA regulations</li>
                    <li>Honoring opt-out requests (STOP, unsubscribe)</li>
                    <li>Maintaining their own Do Not Call compliance</li>
                    <li>Following state-specific telemarketing laws</li>
                    <li>Proper use of automated dialing systems</li>
                  </ul>
                  <p><strong>You acknowledge that OwnerFi cannot control agent communication practices after lead sale and agree to direct any compliance issues to the individual agent, not OwnerFi.</strong></p>
                </div>
              </div>
              
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mt-4">
                <p className="font-bold text-purple-800">🏛️ STATE-SPECIFIC TCPA COMPLIANCE</p>
                <p className="text-purple-700 mt-2">
                  <strong>Additional state laws may apply beyond federal TCPA requirements:</strong>
                </p>
                <ul className="list-disc ml-6 mt-2 space-y-1 text-purple-700 text-sm">
                  <li><strong>Florida:</strong> Florida Telephone Solicitation Act (additional restrictions)</li>
                  <li><strong>Oklahoma:</strong> Oklahoma Telephone Solicitation Act (stricter than federal)</li>
                  <li><strong>Washington:</strong> Washington Commercial Electronic Mail Act</li>
                  <li><strong>All States:</strong> State Do Not Call registries may apply</li>
                </ul>
                <p className="text-purple-700 mt-2 text-sm">
                  <strong>You consent to contact under both federal and applicable state laws. Agents purchasing leads are responsible for compliance with all applicable laws in their jurisdiction and yours.</strong>
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">4.5. AGENT COMPLIANCE REQUIREMENTS</h2>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-orange-800">📋 REAL ESTATE AGENT OBLIGATIONS</p>
                <p className="text-orange-700 mt-2"><strong>Licensed real estate professionals who purchase leads through OwnerFi agree to:</strong></p>
                <ul className="list-disc ml-6 mt-2 space-y-1 text-orange-700">
                  <li><strong>Use leads only for purchased purpose</strong> - Contact only regarding properties and services</li>
                  <li><strong>Honor opt-out requests within 24 hours</strong> - Process STOP, unsubscribe, do-not-call requests immediately</li>
                  <li><strong>Maintain TCPA compliance</strong> - Follow federal and state telemarketing regulations</li>
                  <li><strong>Respect Do Not Call registries</strong> - Check and comply with federal and state DNC lists</li>
                  <li><strong>Use proper identification</strong> - Identify themselves and their brokerage in all communications</li>
                  <li><strong>Indemnify OwnerFi</strong> - Hold OwnerFi harmless for their communication practices</li>
                </ul>
                
                <div className="bg-red-100 border border-red-200 rounded p-3 mt-3">
                  <p className="text-red-800 font-semibold text-sm">
                    🚨 AGENT LIABILITY: Agents are independent contractors. OwnerFi is not responsible for agent compliance failures, spam, or regulatory violations. Direct all communication complaints to the individual agent and their brokerage.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">5. Payments and Refunds</h2>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-orange-800 text-xl">💰 NO REFUNDS POLICY</p>
                <p className="text-orange-700 mt-2"><strong>ALL PAYMENTS FOR LEADS OR SERVICES ARE FINAL AND NON-REFUNDABLE.</strong></p>
                <p className="text-orange-700 mt-2"><strong>Payments are made exclusively by licensed real estate professionals for access to leads.</strong></p>
                <p className="text-orange-700 mt-2">OwnerFi does not guarantee:</p>
                <ul className="list-disc ml-6 mt-2 space-y-1 text-orange-700">
                  <li>Lead conversion or transaction success</li>
                  <li>Buyer qualification or ability to purchase</li>
                  <li>Property availability or accuracy</li>
                  <li>That buyers will respond to contact attempts</li>
                  <li>Any specific return on investment</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">6. No Warranties or Guarantees</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-800 mb-2">DISCLAIMER OF WARRANTIES</h3>
                <p className="text-red-700">THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE SPECIFICALLY DISCLAIM ALL WARRANTIES INCLUDING BUT NOT LIMITED TO:</p>
                <ul className="list-disc ml-6 mt-2 space-y-1 text-red-700">
                  <li>Accuracy of property information, prices, terms, or availability</li>
                  <li>Completeness or timeliness of any data or listings</li>
                  <li>Accuracy of financial calculations, payment amounts, or interest rates</li>
                  <li>Quality or condition of any properties listed</li>
                  <li>Legal status or ownership of properties</li>
                  <li>Reliability of third-party information</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">7. Limitation of Liability</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-800 mb-2">LIABILITY DISCLAIMER</h3>
                <p className="text-red-700 mb-2">TO THE MAXIMUM EXTENT PERMITTED BY LAW, OWNERFI AND ITS OWNERS, EMPLOYEES, AND AFFILIATES SHALL NOT BE LIABLE FOR:</p>
                <ul className="list-disc ml-6 space-y-1 text-red-700">
                  <li>ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES</li>
                  <li>LOSS OF PROFITS, REVENUE, DATA, OR BUSINESS OPPORTUNITIES</li>
                  <li>PROPERTY PURCHASE DECISIONS OR FINANCIAL LOSSES</li>
                  <li>INACCURATE PROPERTY INFORMATION OR PRICING</li>
                  <li>FAILED PROPERTY TRANSACTIONS OR FINANCING ARRANGEMENTS</li>
                  <li>THIRD-PARTY CONDUCT OR COMMUNICATIONS</li>
                  <li>ANY DAMAGES EXCEEDING $100 IN THE AGGREGATE</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">8. Property Information Disclaimer</h2>
              <p>All property information is provided by third parties and may be inaccurate, incomplete, or outdated. You acknowledge that:</p>
              <ul className="list-disc ml-6 mt-2 space-y-2">
                <li>Property prices, terms, and availability may change without notice</li>
                <li>Financial calculations are estimates only and may not reflect actual costs</li>
                <li>Property conditions, sizes, and features may differ from descriptions</li>
                <li>You must independently verify all information before making any decisions</li>
                <li>We are not responsible for errors in property data from any source</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">8.5. DEAL TYPE VERIFICATION & BUYER RESPONSIBILITY</h2>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-4">
                <h3 className="font-bold text-yellow-800 text-xl mb-4">🔍 CRITICAL BUYER VERIFICATION RESPONSIBILITY</h3>

                <div className="space-y-4 text-yellow-700">
                  <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4">
                    <h4 className="font-bold text-yellow-800 mb-2">⚠️ DEAL TYPE NOT SPECIFIED OR GUARANTEED</h4>
                    <p className="text-yellow-700 mb-2"><strong>OwnerFi does NOT specify or guarantee the type of financing arrangement for any property listing.</strong></p>
                    <p className="text-yellow-700 text-sm">Properties may involve various financing structures including but not limited to: seller financing, subject-to arrangements, contract for deed, lease-to-own, or traditional financing. <strong>It is the buyer's sole responsibility to verify and understand the exact financing structure being offered.</strong></p>
                  </div>

                  <div className="bg-red-100 border border-red-300 rounded-lg p-4">
                    <h4 className="font-bold text-red-800 mb-2">🚨 BUYER'S MANDATORY VERIFICATION DUTIES</h4>
                    <p className="text-red-700 mb-2"><strong>Before entering any agreement, you must independently verify:</strong></p>
                    <ul className="list-disc ml-6 space-y-1 text-red-700 text-sm">
                      <li><strong>Exact financing type:</strong> Seller finance, subject-to, contract for deed, lease-to-own, or other arrangement</li>
                      <li><strong>Property ownership status:</strong> Whether seller owns property free and clear or has existing mortgages</li>
                      <li><strong>Legal structure:</strong> Whether you receive deed immediately or at end of payment term</li>
                      <li><strong>Risk factors:</strong> Due-on-sale clauses, balloon payments, foreclosure risks, equity protection</li>
                      <li><strong>Seller qualifications:</strong> Verify seller's legal right to offer the proposed financing arrangement</li>
                      <li><strong>Current availability:</strong> Whether property is still available and seller still willing to finance</li>
                      <li><strong>All terms and conditions:</strong> Interest rates, payment schedules, penalties, default provisions</li>
                    </ul>
                  </div>

                  <div className="bg-blue-100 border border-blue-300 rounded-lg p-4">
                    <h4 className="font-bold text-blue-800 mb-2">🏠 PROPERTY STATUS VERIFICATION</h4>
                    <div className="text-blue-700 space-y-2 text-sm">
                      <p><strong>OwnerFi makes no representations regarding:</strong></p>
                      <ul className="list-disc ml-6 space-y-1">
                        <li>Current property availability or seller willingness to finance</li>
                        <li>Whether properties are still on the market</li>
                        <li>Accuracy of listing information, prices, or terms</li>
                        <li>Seller's current financial or legal status</li>
                        <li>Whether displayed properties actually exist or are accurately described</li>
                      </ul>
                      <p className="font-semibold mt-2">You must verify all property details independently through appropriate professionals.</p>
                    </div>
                  </div>

                  <div className="bg-purple-100 border border-purple-300 rounded-lg p-4">
                    <h4 className="font-bold text-purple-800 mb-2">📋 REQUIRED PROFESSIONAL CONSULTATION</h4>
                    <p className="text-purple-700 mb-2"><strong>OwnerFi strongly recommends consulting these professionals BEFORE signing any agreement:</strong></p>
                    <ul className="list-disc ml-6 space-y-1 text-purple-700 text-sm">
                      <li><strong>Licensed Real Estate Attorney:</strong> To review contracts and explain legal implications</li>
                      <li><strong>Licensed Real Estate Agent:</strong> To represent your interests and guide the transaction</li>
                      <li><strong>Title Company/Title Attorney:</strong> To verify ownership and handle closing</li>
                      <li><strong>Financial Advisor:</strong> To assess investment risks and financing options</li>
                      <li><strong>Tax Professional:</strong> To understand tax implications of the financing structure</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-red-100 border border-red-300 rounded-lg p-4 mt-4">
                  <p className="text-red-800 font-bold text-sm text-center">
                    🚨 OWNERFI DISCLAIMS ALL LIABILITY FOR BUYER'S FAILURE TO VERIFY DEAL TYPES, PROPERTY STATUS, OR FINANCING ARRANGEMENTS. ALL VERIFICATION IS BUYER'S SOLE RESPONSIBILITY.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">9. No Professional Advice</h2>
              <p>OwnerFi does not provide legal, financial, tax, or real estate advice. Information on this platform is for informational purposes only. You should consult qualified professionals before making any real estate or financial decisions.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">10. User Responsibilities</h2>
              <p>You agree to:</p>
              <ul className="list-disc ml-6 mt-2 space-y-2">
                <li>Provide accurate information when registering</li>
                <li>Conduct your own due diligence on any properties</li>
                <li>Comply with all applicable laws and regulations</li>
                <li>Not use the service for any illegal or unauthorized purpose</li>
                <li>Indemnify OwnerFi against any claims arising from your use of the service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">11. Third-Party Services</h2>
              <p>Our service may contain links to or integrate with third-party websites, services, or applications. We are not responsible for the content, privacy practices, or terms of service of any third parties.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">12. Modifications to Service and Terms</h2>
              <p>We reserve the right to modify, suspend, or discontinue the service at any time without notice. We may also update these Terms at any time, and continued use constitutes acceptance of any changes.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">13. Account Suspension and Abuse</h2>
              <p>We reserve the right to immediately suspend or terminate your account and access to the service if you:</p>
              <ul className="list-disc ml-6 mt-2 space-y-2">
                <li>Violate these Terms of Service</li>
                <li>Engage in spam, fraud, or abusive behavior</li>
                <li>Provide false or misleading information</li>
                <li>Attempt to circumvent our systems or security measures</li>
                <li>Use the service for illegal or unauthorized purposes</li>
                <li>Harass other users or our staff</li>
              </ul>
              <p className="mt-4">Upon termination, you forfeit any unused credits or payments and remain liable for all obligations incurred.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">14. Intellectual Property</h2>
              <p>All content on OwnerFi, including but not limited to trademarks, logos, text, graphics, software, and design elements, are the exclusive property of OwnerFi or our licensors. You may not copy, modify, distribute, or create derivative works without our express written permission.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">14.5. LEGAL RISK & LIMITATION OF LIABILITY</h2>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                <h3 className="font-bold text-red-800 text-xl mb-4">🏢 PLATFORM ROLE</h3>
                <p className="text-red-700 mb-4">
                  <strong>OwnerFi (operated by Prosway) is a marketing and lead-generation platform only.</strong> We are <strong>NOT</strong> a licensed real estate broker, agent, lender, title company, attorney, or financial advisor. We do not negotiate, structure, or close any transactions. All property, financing, and investment decisions are the sole responsibility of the users of the platform.
                </p>
                
                <h3 className="font-bold text-red-800 text-lg mb-3">🚫 NO GUARANTEE OF ACCURACY</h3>
                <p className="text-red-700 mb-4">
                  All property information, financial figures, payment estimates, and other data displayed on OwnerFi are provided by third parties (sellers, agents, or automated sources). OwnerFi makes no representation or warranty as to the <strong>accuracy, completeness, or reliability</strong> of this information. Users must independently verify all property details, financing terms, tax obligations, insurance requirements, and homeowner association (HOA) fees before making any purchase or investment decision.
                </p>
                
                <h3 className="font-bold text-red-800 text-lg mb-3">⚖️ NO PROFESSIONAL ADVICE</h3>
                <p className="text-red-700 mb-4">
                  Nothing provided on OwnerFi should be considered <strong>legal, financial, tax, or real estate advice.</strong> Users are encouraged to consult with licensed professionals, including but not limited to real estate brokers, attorneys, title companies, financial advisors, and tax specialists, before entering into any agreement.
                </p>
                
                <h3 className="font-bold text-red-800 text-lg mb-3">📋 USER RESPONSIBILITIES</h3>
                <p className="text-red-700 mb-2"><strong>By using OwnerFi, you acknowledge and agree that:</strong></p>
                <ul className="list-disc ml-6 space-y-1 text-red-700 text-sm">
                  <li>You are solely responsible for verifying the legal status of the property, including liens, mortgages, judgments, or title defects.</li>
                  <li>You are solely responsible for understanding and paying property taxes, homeowner's insurance, and HOA dues (if applicable), as these are not escrowed by OwnerFi or the seller.</li>
                  <li>You are solely responsible for understanding balloon payments, refinancing obligations, and foreclosure risks associated with owner-finance transactions.</li>
                  <li>You are solely responsible for ensuring compliance with all applicable laws, including federal Fair Housing laws and state-specific licensing regulations.</li>
                </ul>
                
                <h3 className="font-bold text-red-800 text-lg mb-3 mt-4">🛡️ LIMITATION OF LIABILITY</h3>
                <p className="text-red-700 mb-2">
                  To the maximum extent permitted by law, OwnerFi and its parent company Prosway, including all officers, directors, employees, contractors, and affiliates, shall not be liable for any <strong>losses, damages, claims, or expenses</strong> (including but not limited to direct, indirect, incidental, consequential, punitive, or special damages) arising out of or related to:
                </p>
                <ul className="list-disc ml-6 space-y-1 text-red-700 text-sm">
                  <li>Inaccurate or incomplete property information</li>
                  <li>Failed, delayed, or canceled transactions</li>
                  <li>Acts or omissions of sellers, buyers, agents, or third parties</li>
                  <li>User reliance on financial projections, estimates, or examples</li>
                  <li>Any real estate, financing, or investment decision made by the user</li>
                </ul>
                
                <h3 className="font-bold text-red-800 text-lg mb-3 mt-4">🔒 INDEMNIFICATION</h3>
                <p className="text-red-700">
                  You agree to <strong>indemnify, defend, and hold harmless</strong> OwnerFi, Prosway, and their affiliates from and against any and all claims, damages, losses, liabilities, costs, or expenses (including attorney's fees) arising from: (a) Your use of the platform; (b) Your participation in any transaction or investment opportunity; (c) Your violation of any law, regulation, or third-party rights.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">14.6. ADDITIONAL LIABILITY LIMITATIONS</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-red-800">🚨 MAXIMUM LIABILITY PROTECTION</p>
                <div className="text-red-700 mt-2 space-y-2">
                  <p><strong>OWNERFI'S TOTAL LIABILITY TO YOU SHALL NOT EXCEED $100 (ONE HUNDRED DOLLARS) REGARDLESS OF THE NATURE OF YOUR CLAIM.</strong></p>
                  <p><strong>WE ARE NOT LIABLE FOR:</strong></p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Inaccurate property information or financial projections</li>
                    <li>Failed real estate transactions or financing arrangements</li>
                    <li>Actions or omissions of real estate agents, brokers, or property owners</li>
                    <li>Investment losses, property damage, or financial harm</li>
                    <li>Consequential, incidental, punitive, or special damages</li>
                    <li>Lost profits, lost opportunities, or business interruption</li>
                    <li>Third-party actions, fraud, or misrepresentation</li>
                    <li>AI-generated content or automated responses</li>
                  </ul>
                  <p><strong>YOU USE OUR PLATFORM ENTIRELY AT YOUR OWN RISK.</strong></p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">14.6. PROPERTY LISTING DISCLAIMERS & PROTECTIONS</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-blue-800">🏠 PROPERTY INFORMATION DISCLAIMERS</p>
                <p className="text-blue-700 mt-2"><strong>ALL PROPERTY LISTINGS AND DESCRIPTIONS ARE SUBJECT TO THE FOLLOWING DISCLAIMERS:</strong></p>
                <div className="mt-3 space-y-2 text-blue-700">
                  <div className="border-l-4 border-blue-400 pl-3">
                    <p className="font-semibold">1. Payment Estimates Only</p>
                    <p className="text-sm">All payment amounts shown are approximate examples only and not guaranteed. Actual payments may vary significantly based on multiple factors.</p>
                  </div>
                  
                  <div className="border-l-4 border-blue-400 pl-3">
                    <p className="font-semibold">2. Additional Costs Not Included & Escrow Responsibility</p>
                    <p className="text-sm">Monthly payment estimates do not include property taxes, insurance, HOA fees, maintenance, utilities, or other ownership costs. Unlike traditional bank loans, there is typically no escrow account established to collect and pay these expenses. Buyers are solely responsible for determining amounts owed, payment due dates, and ensuring timely direct payments to taxing authorities, insurance providers, and HOA organizations. Failure to pay these obligations may result in penalties, liens, loss of coverage, or foreclosure.</p>
                  </div>
                  
                  <div className="border-l-4 border-blue-400 pl-3">
                    <p className="font-semibold">3. Financing Terms Are Examples Only</p>
                    <p className="text-sm">Interest rates, loan terms, down payment requirements, and buyer qualifications shown are examples only and not offers to finance.</p>
                  </div>
                  
                  <div className="border-l-4 border-blue-400 pl-3">
                    <p className="font-semibold">4. Not a Loan Offer or Commitment</p>
                    <p className="text-sm">OwnerFi does not make loans, provide financing, or commit to any lending arrangements. All financing is between buyer and property owner only.</p>
                  </div>
                  
                  <div className="border-l-4 border-blue-400 pl-3">
                    <p className="font-semibold">5. Credit Approval Required</p>
                    <p className="text-sm">All financing arrangements require approved credit and buyer qualifications as determined solely by the property owner or their designated lender. Sellers have the right to perform credit checks and may require credit reports, income verification, and background checks.</p>
                  </div>
                  
                  <div className="border-l-4 border-blue-400 pl-3">
                    <p className="font-semibold">6. No Guarantee of Approval or Availability</p>
                    <p className="text-sm">OwnerFi does not guarantee financing approval, property availability, or successful transaction completion for any buyer. Properties shown may no longer be available, sellers may have changed their financing terms, or sellers may no longer be interested in owner financing. We are simply letting you know what possible owner finance deals are out there - not guaranteeing availability or seller commitment.</p>
                  </div>
                  
                  <div className="border-l-4 border-blue-400 pl-3">
                    <p className="font-semibold">7. Balloon Payment Disclosure</p>
                    <p className="text-sm">Owner financing arrangements may include balloon payments where remaining loan balance becomes due at specified intervals (typically 3-5 years) requiring refinancing or full payment.</p>
                  </div>
                  
                  <div className="border-l-4 border-blue-400 pl-3">
                    <p className="font-semibold">8. Seller Discretion Reserved</p>
                    <p className="text-sm">Property owners reserve the absolute right to accept, reject, or negotiate any offer at their sole discretion without obligation or explanation.</p>
                  </div>
                </div>
                <p className="text-blue-700 mt-3 font-semibold">These disclaimers apply to all property information displayed on our platform regardless of source or format.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">14.7. REAL ESTATE INVESTMENT RISKS</h2>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-orange-800">💰 INVESTMENT RISK DISCLOSURE</p>
                <div className="text-orange-700 mt-2 space-y-2">
                  <p><strong>REAL ESTATE INVESTMENTS INVOLVE SUBSTANTIAL RISK OF LOSS.</strong></p>
                  <p>You acknowledge and understand that:</p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Property values may decrease, resulting in financial loss</li>
                    <li>Owner financing arrangements may fail or be foreclosed</li>
                    <li>All financial projections are estimates only and not guaranteed</li>
                    <li>Past performance does not predict future results</li>
                    <li>You may lose your entire investment including down payment</li>
                    <li>OwnerFi provides no investment advice or recommendations</li>
                  </ul>
                  <p><strong>CONSULT LICENSED FINANCIAL ADVISORS BEFORE MAKING ANY INVESTMENT DECISIONS.</strong></p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">15. Governing Law and Binding Arbitration</h2>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-slate-800">⚖️ BINDING ARBITRATION & CLASS ACTION WAIVER</p>
                <p className="text-slate-700 mt-2"><strong>BY USING THIS SERVICE, YOU AGREE TO:</strong></p>
                <ul className="list-disc ml-6 mt-2 space-y-1 text-slate-700">
                  <li><strong>WAIVE YOUR RIGHT TO A JURY TRIAL</strong></li>
                  <li><strong>WAIVE YOUR RIGHT TO PARTICIPATE IN CLASS ACTION LAWSUITS</strong></li>
                  <li><strong>RESOLVE ALL DISPUTES THROUGH BINDING ARBITRATION</strong></li>
                </ul>
              </div>
              <p>These Terms shall be governed by the laws of the State of Texas. Any disputes arising from these Terms or your use of the service shall be resolved exclusively through binding arbitration in accordance with the rules of the American Arbitration Association. You agree that any arbitration will be conducted on an individual basis and not as part of a class action or class-wide arbitration.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">16. Severability</h2>
              <p>If any provision of these Terms is found to be unenforceable, the remaining provisions will continue to be valid and enforceable.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">17. Contact Information</h2>
              <p>If you have questions about these Terms, please contact us at:</p>
              <div className="mt-2 p-4 bg-slate-50 rounded-lg">
                <p><strong>OwnerFi (operated by Prosway)</strong></p>
                <p>Email: admin@prosway.com</p>
                <p>Address: 6699 Fletcher Creek Cove, Memphis, TN 38133</p>
              </div>
            </section>

            <div className="border-t pt-8 mt-8">
              <p className="text-sm text-slate-500">
                By using OwnerFi, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}