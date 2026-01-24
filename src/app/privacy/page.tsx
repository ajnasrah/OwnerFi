'use client';

import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import Link from 'next/link';
import { useState } from 'react';

export default function PrivacyPolicy() {
  const [activeSection, setActiveSection] = useState<'buyer' | 'realtor'>('buyer');

  return (
    <div className="min-h-screen bg-primary-bg">
      <Header />

      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="bg-white rounded-xl shadow-light p-8 md:p-12">
          <h1 className="text-4xl font-bold text-primary-text mb-8">Privacy Policy</h1>
          <p className="text-slate-600 mb-4">Last Updated: January 2025</p>
          <p className="text-slate-600 mb-8">Contact: <a href="mailto:support@ownerfi.ai" className="text-primary hover:underline">support@ownerfi.ai</a></p>

          {/* Section Toggle */}
          <div className="flex gap-2 mb-8">
            <button
              onClick={() => setActiveSection('buyer')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeSection === 'buyer'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              For Buyers / Consumers
            </button>
            <button
              onClick={() => setActiveSection('realtor')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeSection === 'realtor'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              For Real Estate Agents
            </button>
          </div>

          {/* BUYER/CONSUMER PRIVACY */}
          {activeSection === 'buyer' && (
            <>
              {/* Plain English Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
                <h2 className="text-2xl font-semibold text-blue-800 mb-4">📋 Privacy Summary (Key Points)</h2>
                <ul className="space-y-2 text-blue-700">
                  <li>• <strong>We collect your name, phone, email, budget, and preferences</strong></li>
                  <li>• <strong>We share this information with licensed real estate agents</strong> who will contact you</li>
                  <li>• <strong>Agents pay OwnerFi a 30% referral fee</strong> when they help you close on a home</li>
                  <li>• <strong>Agents may call, text, or email you</strong> to offer help with properties</li>
                  <li>• <strong>You can decline representation</strong> by telling the agent directly</li>
                  <li>• <strong>We use cookies and tracking technologies</strong> to improve our platform</li>
                  <li>• <strong>We implement security measures</strong> but cannot guarantee absolute security</li>
                  <li>• <strong>You have rights to access, correct, or delete your data</strong> (with limitations)</li>
                  <li>• <strong>Once shared with agents, we cannot control their use of your data</strong></li>
                </ul>
              </div>

              <div className="space-y-8 text-lg leading-relaxed text-slate-700">

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">1. Information We Collect</h2>

              {/* Data Categories Table */}
              <div className="overflow-x-auto mb-6">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 p-3 text-left font-semibold">Category</th>
                      <th className="border border-slate-300 p-3 text-left font-semibold">Examples</th>
                      <th className="border border-slate-300 p-3 text-left font-semibold">Purpose</th>
                      <th className="border border-slate-300 p-3 text-left font-semibold">Recipients</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-slate-300 p-3 font-medium">Identifiers</td>
                      <td className="border border-slate-300 p-3">Name, email, phone, IP address</td>
                      <td className="border border-slate-300 p-3">Account creation, lead matching</td>
                      <td className="border border-slate-300 p-3">Real estate agents, service providers</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="border border-slate-300 p-3 font-medium">Commercial Info</td>
                      <td className="border border-slate-300 p-3">Property preferences, budget, saved properties</td>
                      <td className="border border-slate-300 p-3">Property matching, recommendations</td>
                      <td className="border border-slate-300 p-3">Real estate agents</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 p-3 font-medium">Internet Activity</td>
                      <td className="border border-slate-300 p-3">Browsing history, searches, clicks</td>
                      <td className="border border-slate-300 p-3">Platform improvement, personalization</td>
                      <td className="border border-slate-300 p-3">Analytics providers</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="border border-slate-300 p-3 font-medium">Geolocation</td>
                      <td className="border border-slate-300 p-3">City, state, general area</td>
                      <td className="border border-slate-300 p-3">Local property search, agent matching</td>
                      <td className="border border-slate-300 p-3">Real estate agents</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-xl font-medium text-primary-text mb-3">A. Information You Provide</h3>
              <ul className="list-disc ml-6 space-y-1 mb-4">
                <li>Name</li>
                <li>Phone number</li>
                <li>Email address</li>
                <li>City/area of interest</li>
                <li>Budget or preferences</li>
                <li>Property selections or interactions</li>
              </ul>

              <h3 className="text-xl font-medium text-primary-text mb-3">B. Automatically Collected Information</h3>
              <ul className="list-disc ml-6 space-y-1 mb-4">
                <li>IP address</li>
                <li>Device information</li>
                <li>Browser type</li>
                <li>Analytics and behavioral data</li>
                <li>Search history</li>
                <li>Favorite properties</li>
                <li>Pages visited</li>
              </ul>

              <h3 className="text-xl font-medium text-primary-text mb-3">C. Cookies & Tracking</h3>
              <p>We use:</p>
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>cookies (max 13 months retention)</li>
                <li>analytics tools</li>
                <li>session logs</li>
                <li>tracking pixels</li>
              </ul>
              <p className="mt-3">to improve platform performance and personalize your experience.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">2. How We Use Your Information</h2>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-blue-800 mb-2">🎯 Primary Purpose: Connecting You With Agents</p>
                <p className="text-blue-700">
                  We use your information primarily to <strong>connect you with licensed real estate agents</strong> who can help you view properties, make offers, and navigate the purchase process.
                </p>
              </div>

              <p className="mb-3">We use your information to:</p>
              <ul className="list-disc ml-6 space-y-1">
                <li>connect you with licensed real estate agents</li>
                <li>allow agents to contact you</li>
                <li>send property matches</li>
                <li>provide account services</li>
                <li>improve the Service</li>
                <li>maintain security and fraud detection</li>
                <li>comply with legal requirements</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">3. How We Share Your Information</h2>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-orange-800 mb-2">📞 A. Licensed Real Estate Agents</p>
                <p className="text-orange-700 mb-3">
                  <strong>This is the primary purpose of collecting your information.</strong>
                </p>
                <p className="text-orange-700 mb-2">We share:</p>
                <ul className="list-disc ml-6 space-y-1 text-orange-700">
                  <li>your name</li>
                  <li>phone number</li>
                  <li>email</li>
                  <li>the property you are interested in</li>
                  <li>your general market area</li>
                  <li>your buying preferences</li>
                </ul>
                <p className="text-orange-700 mt-3 font-bold">
                  Agents use this information to contact you and offer representation, assistance, or appointments.
                </p>
              </div>

              <h3 className="text-xl font-medium text-primary-text mb-3">B. Service Providers</h3>
              <p className="mb-2">We may share data with:</p>
              <ul className="list-disc ml-6 space-y-1 mb-4">
                <li>hosting providers</li>
                <li>analytics platforms</li>
                <li>marketing tools</li>
                <li>customer support tools</li>
              </ul>

              <h3 className="text-xl font-medium text-primary-text mb-3">C. Legal Requirements</h3>
              <p>We may share information to comply with legal obligations.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">4. User Choice: Declining Representation</h2>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="font-bold text-green-800 mb-2">✅ You Have Control</p>
                <p className="text-green-700 mb-2">If you do not wish to be represented:</p>
                <ul className="list-disc ml-6 space-y-1 text-green-700">
                  <li>Inform any contacting agent: <strong>"I do not want representation."</strong></li>
                  <li>Agents are legally obligated to stop contacting you.</li>
                  <li>OwnerFi is <strong>not responsible</strong> for their failure to do so.</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">5. Data Retention</h2>
              <p className="mb-3">We retain user data according to these specific periods:</p>

              <div className="overflow-x-auto mb-4">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 p-3 text-left font-semibold">Data Type</th>
                      <th className="border border-slate-300 p-3 text-left font-semibold">Retention Period</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-slate-300 p-3">Account Information</td>
                      <td className="border border-slate-300 p-3">Active account + 3 years after closure</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="border border-slate-300 p-3">Lead/Referral Data</td>
                      <td className="border border-slate-300 p-3">7 years (legal/compliance)</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 p-3">Transaction Records</td>
                      <td className="border border-slate-300 p-3">7 years (tax/financial compliance)</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="border border-slate-300 p-3">Marketing Preferences</td>
                      <td className="border border-slate-300 p-3">Until opt-out or 3 years inactive</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 p-3">Analytics Data</td>
                      <td className="border border-slate-300 p-3">26 months, then anonymized</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="border border-slate-300 p-3">Cookies</td>
                      <td className="border border-slate-300 p-3">13 months maximum</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-700">
                  You may request deletion at any time by contacting <a href="mailto:support@ownerfi.ai" className="underline hover:text-blue-800">support@ownerfi.ai</a>.
                  Note: Some data may be retained for legal compliance even after deletion requests.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">6. Data Security</h2>
              <p className="mb-3">
                We use industry-standard security to protect your data, including:
              </p>
              <ul className="list-disc ml-6 space-y-1 mb-4">
                <li>Encryption of sensitive data during transmission</li>
                <li>Secure data storage practices</li>
                <li>Access controls and authentication measures</li>
              </ul>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-700">
                  <strong>Disclaimer:</strong> We cannot guarantee absolute security.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">7. Your Rights</h2>
              <p className="mb-3">Depending on your state, you may have rights to:</p>
              <ul className="list-disc ml-6 space-y-1 mb-4">
                <li>access your data</li>
                <li>correct your data</li>
                <li>delete your data</li>
                <li>opt out of sharing</li>
                <li>request a copy of your data</li>
              </ul>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-700">
                  To submit a request, contact: <a href="mailto:support@ownerfi.ai" className="underline hover:text-blue-800 font-bold">support@ownerfi.ai</a>
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">8. California Privacy Rights (CCPA)</h2>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-purple-800 mb-2">🏛️ California Residents</p>
                <p className="text-purple-700 mb-2">Under the California Consumer Privacy Act (CCPA), you have:</p>
                <ul className="list-disc ml-6 space-y-1 text-purple-700">
                  <li><strong>Right to Know:</strong> Request disclosure of personal information we collect, use, or share</li>
                  <li><strong>Right to Delete:</strong> Request deletion of personal information (with exceptions)</li>
                  <li><strong>Right to Opt-Out:</strong> Opt out of the sale/sharing of personal information</li>
                  <li><strong>Right to Non-Discrimination:</strong> Equal service regardless of privacy choices</li>
                </ul>
                <p className="text-purple-700 mt-3">
                  To exercise your rights, email <strong>support@ownerfi.ai</strong> with &quot;CCPA REQUEST&quot; in the subject line.
                </p>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-orange-800 mb-2">CCPA &quot;Sale&quot; and &quot;Sharing&quot; Disclosure</p>
                <p className="text-orange-700 mb-3">
                  <strong>Important:</strong> Under the CCPA, sharing your contact information with real estate agents in exchange for referral fees may constitute a &quot;sale&quot; or &quot;sharing&quot; of personal information.
                </p>
                <p className="text-orange-700 mb-2"><strong>Categories of data sold/shared:</strong></p>
                <ul className="list-disc ml-6 space-y-1 text-orange-700 mb-3">
                  <li>Identifiers (name, email, phone)</li>
                  <li>Commercial information (property preferences, budget)</li>
                  <li>Geolocation (city, state)</li>
                </ul>
                <p className="text-orange-700 mb-2">
                  <strong>To Opt-Out:</strong> Email <a href="mailto:support@ownerfi.ai" className="underline">support@ownerfi.ai</a> with
                  <strong> &quot;DO NOT SELL/SHARE MY INFO&quot;</strong> in the subject line. Include your name and email address associated with your account.
                </p>
                <p className="text-orange-600 text-sm">
                  We also honor the Global Privacy Control (GPC) signal. If your browser sends a GPC signal, we will treat it as a valid opt-out request.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">9. Children&apos;s Privacy</h2>
              <p className="mb-3">
                OwnerFi is not intended for users under 18. We do not knowingly collect personal information from anyone under the age of 18.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700">
                  <strong>Inadvertent Collection:</strong> If we discover that we have inadvertently collected personal information from a user under 18, we will delete that information within <strong>30 days</strong>. If you believe we have collected information from a minor, please contact <a href="mailto:support@ownerfi.ai" className="underline">support@ownerfi.ai</a> immediately.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">10. Updates to This Policy</h2>
              <p>
                We may update this Privacy Policy. Continued use constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">11. Contact</h2>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="font-bold">OwnerFi</p>
                <p className="text-slate-700 mt-1">
                  Email: <a href="mailto:support@ownerfi.ai" className="text-primary hover:underline">support@ownerfi.ai</a>
                </p>
              </div>
            </section>

            <div className="border-t pt-8 mt-8">
              <div className="bg-blue-100 border-2 border-blue-300 rounded-lg p-6">
                <p className="text-blue-900 font-bold text-center text-lg mb-3">
                  ✅ By Using OwnerFi, You Agree
                </p>
                <p className="text-blue-800 text-sm text-center">
                  By using OwnerFi, you acknowledge that you have read and agree to this Privacy Policy. You consent to the collection and sharing of your information with licensed real estate agents as described above. You understand that agents pay OwnerFi a referral fee, that agents may contact you, and that you can decline representation at any time.
                </p>
              </div>
            </div>
              </div>
            </>
          )}

          {/* REALTOR/AGENT PRIVACY */}
          {activeSection === 'realtor' && (
            <>
              {/* Plain English Summary for Realtors */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
                <h2 className="text-2xl font-semibold text-blue-800 mb-4">📋 Privacy Summary for Agents (Key Points)</h2>
                <ul className="space-y-2 text-blue-700">
                  <li>• <strong>We collect your name, email, phone, license info, and brokerage details</strong></li>
                  <li>• <strong>We provide you with buyer lead information</strong> after you sign a referral agreement</li>
                  <li>• <strong>You must protect buyer data</strong> and use it only for real estate services</li>
                  <li>• <strong>We track your transactions</strong> to verify referral fee compliance</li>
                  <li>• <strong>We may share your info with buyers</strong> who you accept as leads</li>
                  <li>• <strong>We use analytics</strong> to improve the platform and match leads</li>
                  <li>• <strong>Your account data is retained</strong> as long as your account is active</li>
                  <li>• <strong>You can request data deletion</strong> but transaction records may be retained</li>
                </ul>
              </div>

              <div className="space-y-8 text-lg leading-relaxed text-slate-700">

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">1. Information We Collect From Agents</h2>

                  <h3 className="text-xl font-medium text-primary-text mb-3">A. Registration Information</h3>
                  <ul className="list-disc ml-6 space-y-1 mb-4">
                    <li>Full legal name</li>
                    <li>Email address</li>
                    <li>Phone number</li>
                    <li>Real estate license number</li>
                    <li>License state</li>
                    <li>Brokerage/company name</li>
                    <li>Brokerage address</li>
                    <li>Service area/cities</li>
                  </ul>

                  <h3 className="text-xl font-medium text-primary-text mb-3">B. Activity Information</h3>
                  <ul className="list-disc ml-6 space-y-1 mb-4">
                    <li>Leads viewed and accepted</li>
                    <li>Agreements signed</li>
                    <li>Transaction history</li>
                    <li>Referral fee payments</li>
                    <li>Re-referral activity</li>
                    <li>Login timestamps and IP addresses</li>
                    <li>Platform usage patterns</li>
                  </ul>

                  <h3 className="text-xl font-medium text-primary-text mb-3">C. Signature Data</h3>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Digital signatures (typed names)</li>
                    <li>Signature timestamps</li>
                    <li>IP address at time of signature</li>
                    <li>User agent/browser information</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">2. How We Use Agent Information</h2>
                  <p className="mb-3">We use your information to:</p>
                  <ul className="list-disc ml-6 space-y-1 mb-4">
                    <li>Verify your real estate license eligibility</li>
                    <li>Match you with buyer leads in your service area</li>
                    <li>Facilitate referral agreement execution</li>
                    <li>Process and track referral fee obligations</li>
                    <li>Provide lead contact information upon agreement signing</li>
                    <li>Enable re-referral functionality</li>
                    <li>Communicate platform updates and opportunities</li>
                    <li>Enforce our Terms of Service</li>
                    <li>Comply with legal obligations</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">3. Information We Share</h2>

                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                    <p className="font-bold text-orange-800 mb-2">📋 A. With Buyers</p>
                    <p className="text-orange-700 mb-2">When you accept a lead, we may share with the buyer:</p>
                    <ul className="list-disc ml-6 space-y-1 text-orange-700">
                      <li>Your name</li>
                      <li>Your brokerage name</li>
                      <li>Your contact information</li>
                      <li>That you have accepted them as a lead</li>
                    </ul>
                  </div>

                  <h3 className="text-xl font-medium text-primary-text mb-3">B. With Other Agents (Re-Referrals)</h3>
                  <p className="mb-4">
                    When you re-refer a lead, the receiving agent will see that you are the referring agent and may receive your contact information for coordination purposes.
                  </p>

                  <h3 className="text-xl font-medium text-primary-text mb-3">C. Service Providers</h3>
                  <ul className="list-disc ml-6 space-y-1 mb-4">
                    <li>Payment processors (for referral fee collection)</li>
                    <li>Cloud hosting providers</li>
                    <li>Analytics services</li>
                    <li>Email/communication services</li>
                  </ul>

                  <h3 className="text-xl font-medium text-primary-text mb-3">D. Legal Requirements</h3>
                  <p>We may disclose information to comply with legal obligations, court orders, or regulatory requirements.</p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">4. Your Obligations Regarding Buyer Data</h2>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="font-bold text-red-800 mb-2">⚠️ Agent Data Protection Responsibilities</p>
                    <p className="text-red-700 mb-2">When you receive buyer lead information, you agree to:</p>
                    <ul className="list-disc ml-6 space-y-1 text-red-700">
                      <li>Use buyer data <strong>only for real estate services</strong></li>
                      <li><strong>Not sell or share</strong> buyer data with third parties</li>
                      <li><strong>Not use</strong> buyer data for marketing unrelated products</li>
                      <li>Comply with <strong>all applicable privacy laws</strong> (CCPA, TCPA, etc.)</li>
                      <li><strong>Securely store</strong> any buyer information you retain</li>
                      <li><strong>Delete buyer data</strong> upon request or when no longer needed</li>
                      <li>Honor <strong>Do-Not-Call</strong> requests from buyers</li>
                    </ul>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">5. Data Retention</h2>
                  <p className="mb-3">We retain agent data as follows:</p>
                  <ul className="list-disc ml-6 space-y-1 mb-4">
                    <li><strong>Account Information:</strong> As long as your account is active, plus 3 years after closure</li>
                    <li><strong>Transaction Records:</strong> 7 years for financial/tax compliance</li>
                    <li><strong>Signed Agreements:</strong> 7 years or as required by law</li>
                    <li><strong>Digital Signatures:</strong> Permanently retained as legal records</li>
                    <li><strong>Activity Logs:</strong> 2 years for operational purposes</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">6. Data Security</h2>
                  <p className="mb-3">We implement security measures including:</p>
                  <ul className="list-disc ml-6 space-y-1 mb-4">
                    <li>Encryption of data in transit (HTTPS/TLS)</li>
                    <li>Secure password hashing</li>
                    <li>Access controls and authentication</li>
                    <li>Regular security assessments</li>
                    <li>Secure cloud infrastructure</li>
                  </ul>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-yellow-700">
                      <strong>Disclaimer:</strong> While we implement industry-standard security measures, no system is completely secure. We cannot guarantee absolute security of your data.
                    </p>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">7. Your Rights</h2>
                  <p className="mb-3">You have the right to:</p>
                  <ul className="list-disc ml-6 space-y-1 mb-4">
                    <li><strong>Access:</strong> Request a copy of your personal data</li>
                    <li><strong>Correction:</strong> Update inaccurate information</li>
                    <li><strong>Deletion:</strong> Request deletion of your account (subject to retention requirements)</li>
                    <li><strong>Portability:</strong> Receive your data in a portable format</li>
                    <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
                  </ul>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-700">
                      To exercise your rights, contact: <a href="mailto:support@ownerfi.ai" className="underline hover:text-blue-800 font-bold">support@ownerfi.ai</a>
                    </p>
                  </div>
                  <p className="text-slate-600 text-sm mt-3">
                    Note: Deletion requests may be subject to retention requirements for legal, financial, or compliance purposes. Transaction records and signed agreements may be retained even after account deletion.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">8. California Privacy Rights (CCPA)</h2>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <p className="font-bold text-purple-800 mb-2">🏛️ California Resident Agents</p>
                    <p className="text-purple-700 mb-2">Under CCPA, you have:</p>
                    <ul className="list-disc ml-6 space-y-1 text-purple-700">
                      <li><strong>Right to Know:</strong> What personal information we collect and how we use it</li>
                      <li><strong>Right to Delete:</strong> Request deletion (with exceptions for business records)</li>
                      <li><strong>Right to Opt-Out:</strong> Opt out of sale of personal information (we do not sell agent data)</li>
                      <li><strong>Right to Non-Discrimination:</strong> Equal service regardless of privacy choices</li>
                    </ul>
                    <p className="text-purple-700 mt-3">
                      Email <strong>support@ownerfi.ai</strong> with "CCPA REQUEST" in the subject line.
                    </p>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">9. Cookies & Analytics</h2>
                  <p className="mb-3">We use cookies and similar technologies to:</p>
                  <ul className="list-disc ml-6 space-y-1 mb-4">
                    <li>Maintain your login session</li>
                    <li>Remember your preferences</li>
                    <li>Analyze platform usage and performance</li>
                    <li>Improve lead matching algorithms</li>
                  </ul>
                  <p>You can control cookies through your browser settings, though some features may not work properly if cookies are disabled.</p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">10. Updates to This Policy</h2>
                  <p>
                    We may update this Privacy Policy at any time. Material changes will be communicated via email or platform notification. Continued use after changes constitutes acceptance.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">11. Contact</h2>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <p className="font-bold">OwnerFi Privacy Team</p>
                    <p className="text-slate-700 mt-1">
                      Email: <a href="mailto:support@ownerfi.ai" className="text-primary hover:underline">support@ownerfi.ai</a>
                    </p>
                    <p className="text-slate-600 text-sm mt-2">
                      For privacy-related inquiries, include "PRIVACY" in your subject line.
                    </p>
                  </div>
                </section>

                <div className="border-t pt-8 mt-8">
                  <div className="bg-blue-100 border-2 border-blue-300 rounded-lg p-6">
                    <p className="text-blue-900 font-bold text-center text-lg mb-3">
                      ✅ By Registering as an Agent, You Agree
                    </p>
                    <p className="text-blue-800 text-sm text-center">
                      By registering and using the OwnerFi platform as a real estate agent, you acknowledge that you have read and agree to this Privacy Policy. You consent to the collection and use of your information as described. You agree to protect buyer data you receive and use it only for legitimate real estate services. You understand that transaction records and signed agreements may be retained for legal compliance purposes.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
