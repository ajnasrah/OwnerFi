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
          <p className="text-gray-600 mb-8">Last updated: September 3, 2025</p>
          
          {/* Plain English Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
            <h2 className="text-2xl font-semibold text-blue-800 mb-4">📋 What You Need to Know (Plain English)</h2>
            <ul className="space-y-2 text-blue-700">
              <li>• <strong>We connect buyers with real estate agents</strong> - that&apos;s our business model</li>
              <li>• <strong>Your contact info will be sold to licensed realtors</strong> who may call/text/email you</li>
              <li>• <strong>We don&apos;t guarantee property accuracy</strong> - always verify everything yourself</li>
              <li>• <strong>We&apos;re not your agent, broker, or advisor</strong> - we&apos;re just a lead generation platform</li>
              <li>• <strong>Do your own homework</strong> before making any real estate decisions</li>
              <li>• <strong>All sales are final</strong> - no refunds on lead purchases</li>
            </ul>
          </div>

          <div className="space-y-8 text-lg leading-relaxed text-gray-700">
            
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
                <p className="font-bold text-red-800 text-xl">⚠️ IMPORTANT DISCLAIMER</p>
                <p className="text-red-700 mt-2"><strong>OWNERFI IS NOT A LICENSED REAL ESTATE BROKER, AGENT, OR LENDER.</strong> We do not:</p>
                <ul className="list-disc ml-6 mt-2 space-y-1 text-red-700">
                  <li>Represent buyers or sellers in real estate transactions</li>
                  <li>Negotiate sales prices or financing terms</li>
                  <li>Provide real estate brokerage services</li>
                  <li>Act as a fiduciary or advocate for any party</li>
                  <li>Provide lending or mortgage services</li>
                </ul>
                <p className="text-red-700 mt-2"><strong>WE ARE SOLELY A LEAD GENERATION AND MARKETING PLATFORM.</strong></p>
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
                  <li>Marketing communications from OwnerFi and our partners</li>
                </ul>
                <p className="text-yellow-700 mt-2"><strong>Message and data rates may apply. This consent is required to use our service.</strong></p>
              </div>
              <p>When you register as a buyer, your information including but not limited to name, email, phone number, and property preferences <strong>WILL BE SOLD</strong> to real estate professionals who serve your area. You <strong>WILL BE CONTACTED</strong> by multiple agents regarding properties and services.</p>
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
              <h2 className="text-2xl font-semibold text-primary-text mb-4">15. Governing Law and Binding Arbitration</h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-gray-800">⚖️ BINDING ARBITRATION & CLASS ACTION WAIVER</p>
                <p className="text-gray-700 mt-2"><strong>BY USING THIS SERVICE, YOU AGREE TO:</strong></p>
                <ul className="list-disc ml-6 mt-2 space-y-1 text-gray-700">
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
              <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                <p><strong>OwnerFi (operated by Prosway)</strong></p>
                <p>Email: admin@prosway.com</p>
                <p>Address: 5095 Covington Way, Memphis, TN 38134</p>
              </div>
            </section>

            <div className="border-t pt-8 mt-8">
              <p className="text-sm text-gray-500">
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