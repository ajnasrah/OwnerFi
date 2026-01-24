'use client';

import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import Link from 'next/link';
import { useState } from 'react';

export default function TermsOfService() {
  const [activeSection, setActiveSection] = useState<'buyer' | 'realtor'>('buyer');

  return (
    <div className="min-h-screen bg-primary-bg">
      <Header />

      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="bg-white rounded-xl shadow-light p-8 md:p-12">
          <h1 className="text-4xl font-bold text-primary-text mb-8">Terms of Service</h1>
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

          {/* BUYER/CONSUMER TERMS */}
          {activeSection === 'buyer' && (
            <>
              {/* Plain English Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
                <h2 className="text-2xl font-semibold text-blue-800 mb-4">📋 What You Need to Know (Plain English)</h2>
                <ul className="space-y-2 text-blue-700">
                  <li>• <strong>OwnerFi is a property search and lead-generation platform</strong> — we show properties that may offer owner financing</li>
                  <li>• <strong>We share your contact info with licensed real estate agents</strong> who will call/text/email you to offer help</li>
                  <li>• <strong>Agents pay OwnerFi a referral fee (30% of their commission)</strong> when they help you close on a home</li>
                  <li>• <strong>Agents will offer to show properties, write offers, and represent you</strong> (optional)</li>
                  <li>• <strong>You can decline representation anytime</strong> by telling the agent "I do not want representation"</li>
                  <li>• <strong>OwnerFi is NOT your agent or broker</strong> — we don't represent buyers or sellers</li>
                  <li>• <strong>We do NOT verify property information</strong> — listings may be inaccurate, outdated, or unavailable</li>
                  <li>• <strong>Payment estimates are illustrations only</strong> — not quotes or commitments</li>
                  <li>• <strong>You must verify everything yourself</strong> with licensed professionals</li>
                  <li>• <strong>We are not responsible for agent behavior</strong> after you decline representation</li>
                </ul>
              </div>

              <div className="space-y-8 text-lg leading-relaxed text-slate-700">

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">1. What OwnerFi Does</h2>
              <p className="mb-4">
                OwnerFi is a <strong>property search and lead-generation platform</strong> for owner-finance–friendly real estate.
              </p>
              <p className="mb-2">We:</p>
              <ul className="list-disc ml-6 space-y-1 mb-4">
                <li>Collect publicly available listing data</li>
                <li>Display properties that appear to offer owner financing</li>
                <li>Allow users to sign up and express interest in properties</li>
                <li>Share user contact information with licensed real estate agents ("Partner Agents") in the user's local market</li>
                <li>Allow Partner Agents to contact the user to offer:
                  <ul className="list-circle ml-6 mt-1 space-y-1">
                    <li>Showing appointments</li>
                    <li>Writing offers</li>
                    <li>Buyer representation</li>
                    <li>Owner-finance guidance</li>
                    <li>Transaction assistance</li>
                  </ul>
                </li>
              </ul>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700 font-bold">
                  OwnerFi does NOT verify listing details or confirm availability.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">2. OwnerFi Is NOT Your Agent</h2>
              <p className="mb-3">OwnerFi:</p>
              <ul className="list-disc ml-6 space-y-1 mb-4">
                <li><strong>Is not</strong> a real estate brokerage</li>
                <li><strong>Does not</strong> represent buyers or sellers</li>
                <li><strong>Does not</strong> provide legal, financial, or loan advice</li>
                <li><strong>Does not</strong> negotiate offers</li>
                <li><strong>Does not</strong> participate in transactions</li>
                <li><strong>Does not</strong> receive a commission on real estate transactions</li>
              </ul>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-yellow-700">
                  All representation services come from <strong>licensed real estate agents</strong>, not from OwnerFi.
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="font-bold text-blue-800 mb-2">Fee Clarification</p>
                <p className="text-blue-700">
                  We do not receive a commission on real estate transactions. Any fees paid to us are fees for <strong>advertising and lead-generation services</strong>, not real estate brokerage commissions.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">3. User Contact Information Is Shared With Real Estate Agents</h2>
              <p className="mb-4">
                By submitting your information on OwnerFi, you <strong>authorize us to share your profile</strong> (name, phone, email, property interest, budget, and relevant details) with licensed real estate agents in your general area.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-blue-800 mb-2">📞 How Agents Will Contact You</p>
                <p className="text-blue-700 mb-2">These agents may contact you via:</p>
                <ul className="list-disc ml-6 space-y-1 text-blue-700">
                  <li>call</li>
                  <li>text</li>
                  <li>email</li>
                </ul>
              </div>
              <p className="mb-2">Their goal is to help you:</p>
              <ul className="list-disc ml-6 space-y-1">
                <li>schedule showings</li>
                <li>make offers</li>
                <li>understand owner-finance options</li>
                <li>navigate the purchase process</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">4. Users May Decline Representation</h2>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-green-800 mb-2">✅ You Have a Choice</p>
                <p className="text-green-700 mb-2">If you prefer not to be represented:</p>
                <ul className="list-disc ml-6 space-y-1 text-green-700">
                  <li>You may tell any agent who contacts you: <strong>"I do not wish to be represented."</strong></li>
                  <li>It is the <strong>agent's responsibility</strong> to stop contacting you once notified.</li>
                  <li>OwnerFi is <strong>not responsible</strong> for ongoing communication from agents after you decline representation.</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">5. Agent Behavior</h2>
              <p className="mb-3">Partner Agents must follow:</p>
              <ul className="list-disc ml-6 space-y-1 mb-4">
                <li>federal and state real estate laws</li>
                <li>consumer protection requirements</li>
                <li>Do-Not-Call rules (once you ask them to stop)</li>
              </ul>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="font-bold text-red-800 mb-2">⚠️ OwnerFi Is Not Responsible For:</p>
                <ul className="list-disc ml-6 space-y-1 text-red-700">
                  <li>agent conduct</li>
                  <li>agent communication frequency</li>
                  <li>advice provided by agents</li>
                  <li>negotiation outcomes</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">6. Property Information Disclaimer</h2>
              <p className="mb-4">
                OwnerFi relies on <strong>public data sources, MLS feeds, and automated systems</strong>.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="font-bold text-red-800 mb-2">🚨 Critical Disclaimer</p>
                <p className="text-red-700 mb-2">Therefore:</p>
                <ul className="list-disc ml-6 space-y-1 text-red-700">
                  <li>We do <strong>not</strong> verify any property details</li>
                  <li>Information may be inaccurate, outdated, or incomplete</li>
                  <li>Owner-finance terms may change without notice</li>
                  <li>Listings may be sold, withdrawn, or unavailable</li>
                </ul>
                <p className="text-red-700 mt-3 font-bold">
                  You MUST independently verify all property information with licensed professionals.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">7. No Guarantees or Approvals</h2>
              <p className="mb-3">OwnerFi does <strong>not</strong>:</p>
              <ul className="list-disc ml-6 space-y-1 mb-4">
                <li>approve buyers</li>
                <li>prequalify buyers</li>
                <li>guarantee financing</li>
                <li>guarantee owner-finance availability</li>
                <li>promise any property is still available</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">8. User Responsibilities</h2>
              <p className="mb-3">You agree to:</p>
              <ul className="list-disc ml-6 space-y-1 mb-4">
                <li>verify all property details independently</li>
                <li>communicate directly with agents for showings and offers</li>
                <li>notify agents if you do not want representation</li>
                <li>verify owner-finance terms directly with sellers or their agents</li>
              </ul>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="font-bold text-orange-800 mb-2">Independent Verification Required</p>
                <p className="text-orange-700">
                  You agree not to make any purchase or financing decision based solely on information from our platform
                  without <strong>independent verification from licensed professionals</strong> (real estate agents, attorneys,
                  financial advisors, home inspectors, etc.).
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">9. Payment Estimates Disclaimer</h2>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-amber-700 mb-3">
                  Any payment calculations shown on OwnerFi are <strong>illustrative estimates only</strong> and may differ substantially from actual seller terms.
                </p>
                <p className="text-amber-800 font-bold">
                  They are NOT commitments or quotes.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">10. Limitation of Liability</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="font-bold text-red-800 mb-2">⚠️ Liability Limitation</p>
                <p className="text-red-700 mb-2">OwnerFi is not liable for:</p>
                <ul className="list-disc ml-6 space-y-1 text-red-700">
                  <li>inaccurate data</li>
                  <li>communication from agents</li>
                  <li>decisions made based on OwnerFi's displays</li>
                  <li>losses, disputes, failed offers, or denied approvals</li>
                </ul>
                <p className="text-red-700 mt-3 font-bold">
                  Your sole remedy is to stop using the Service.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">11. Refund Policy</h2>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-orange-700 font-bold mb-2">
                  All payments made to OwnerFi (if any) are <strong>non-refundable</strong>, except where prohibited by law or where we fail to provide the agreed-upon service.
                </p>
                <p className="text-orange-600 text-sm">
                  If you believe you are entitled to a refund due to service failure or applicable law, contact <a href="mailto:support@ownerfi.ai" className="underline">support@ownerfi.ai</a>.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">12. Dispute Resolution &amp; Arbitration</h2>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                <p className="text-slate-700 mb-3">
                  Any disputes arising from these Terms or your use of our Service are resolved by <strong>binding arbitration</strong>, not in court, except as provided below.
                </p>
                <p className="text-slate-700 mb-3">
                  <strong>Governing Law:</strong> These Terms are governed by the laws of the State of <strong>Tennessee</strong>, without regard to conflict of law principles.
                </p>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-red-800 mb-2">Class Action Waiver</p>
                <p className="text-red-700 text-sm">
                  You waive any right to participate in a class action, class arbitration, or other representative action.
                  All disputes must be brought in your individual capacity, not as a plaintiff or class member in any purported class or representative proceeding.
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-green-800 mb-2">Opt-Out Right</p>
                <p className="text-green-700 text-sm">
                  You may opt out of this arbitration agreement by sending written notice to <a href="mailto:support@ownerfi.ai" className="underline">support@ownerfi.ai</a> within <strong>30 days</strong> of first accepting these Terms.
                  Your notice must include your name, address, email, and a clear statement that you wish to opt out of arbitration.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="font-bold text-blue-800 mb-2">Small Claims Exception</p>
                <p className="text-blue-700 text-sm">
                  Either party may bring qualifying claims in small claims court in the county of your residence or in Nashville, Tennessee, if the claims fall within that court&apos;s jurisdiction.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">13. Changes to Terms</h2>
              <p>
                We may modify these Terms at any time. Continued use constitutes acceptance.
              </p>
            </section>

            <div className="border-t pt-8 mt-8">
              <div className="bg-blue-100 border-2 border-blue-300 rounded-lg p-6">
                <p className="text-blue-900 font-bold text-center text-lg mb-3">
                  ✅ By Using OwnerFi, You Agree
                </p>
                <p className="text-blue-800 text-sm text-center">
                  By using OwnerFi, you acknowledge that you have read and agree to these Terms of Service. You understand that: (1) your contact information will be shared with licensed real estate agents who may contact you; (2) agents pay OwnerFi a referral fee when you close; (3) you can decline representation at any time; (4) OwnerFi does not verify property information; (5) all data may be inaccurate or outdated; and (6) you must independently verify all information with licensed professionals.
                </p>
              </div>
            </div>
              </div>
            </>
          )}

          {/* REALTOR/AGENT TERMS */}
          {activeSection === 'realtor' && (
            <>
              {/* Plain English Summary for Realtors */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
                <h2 className="text-2xl font-semibold text-blue-800 mb-4">📋 What Agents Need to Know (Plain English)</h2>
                <ul className="space-y-2 text-blue-700">
                  <li>• <strong>OwnerFi provides buyer leads</strong> — pre-screened buyers interested in owner-financed properties (not lender-style pre-qualified)</li>
                  <li>• <strong>You pay a 30% referral fee</strong> of your commission at closing (only when you close)</li>
                  <li>• <strong>You must sign a referral agreement</strong> to receive buyer contact information</li>
                  <li>• <strong>Agreements are valid for 180 days</strong> and extend through closing</li>
                  <li>• <strong>You can re-refer leads</strong> to other agents if you cannot service them</li>
                  <li>• <strong>Lead quality is not guaranteed</strong> — buyers may become unresponsive</li>
                  <li>• <strong>You must maintain an active real estate license</strong> in good standing</li>
                  <li>• <strong>OwnerFi is not responsible</strong> for buyer behavior or transaction outcomes</li>
                  <li>• <strong>Digital signatures are binding</strong> — you agree to pay the referral fee at closing</li>
                </ul>
              </div>

              <div className="space-y-8 text-lg leading-relaxed text-slate-700">

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">1. Platform Overview for Real Estate Agents</h2>
                  <p className="mb-4">
                    OwnerFi operates a <strong>real estate lead generation and referral platform</strong> that connects licensed real estate agents with pre-screened buyer leads interested in owner-financed properties.
                  </p>
                  <p className="mb-2">The platform provides:</p>
                  <ul className="list-disc ml-6 space-y-1 mb-4">
                    <li>Access to buyer leads in your service area</li>
                    <li>Digital referral agreement signing</li>
                    <li>Lead management dashboard</li>
                    <li>Re-referral system for leads you cannot service</li>
                    <li>Transaction tracking</li>
                  </ul>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="font-bold text-blue-800 mb-2">Important Platform Clarification</p>
                    <p className="text-blue-700 text-sm mb-2">
                      OwnerFi is a <strong>marketing and lead-generation platform</strong>. We are not a real estate brokerage and do not receive a commission split on your transactions.
                    </p>
                    <p className="text-blue-700 text-sm">
                      <strong>&quot;Pre-screened&quot; means:</strong> Buyers have provided contact information, location preferences, and budget range through our platform. We do not run credit checks or provide lender-style pre-qualification.
                    </p>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">2. Eligibility Requirements</h2>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <p className="font-bold text-yellow-800 mb-2">License Requirements</p>
                    <p className="text-yellow-700 mb-2">To use OwnerFi as a real estate agent, you must:</p>
                    <ul className="list-disc ml-6 space-y-1 text-yellow-700">
                      <li>Hold an <strong>active real estate license</strong> in the state(s) where you operate</li>
                      <li>Be affiliated with a <strong>licensed real estate brokerage</strong></li>
                      <li>Maintain your license in <strong>good standing</strong> with no disciplinary actions</li>
                      <li>Comply with all <strong>state and federal real estate laws</strong></li>
                      <li>Have authority from your broker to enter into referral agreements</li>
                    </ul>
                  </div>
                  <p className="text-red-600 font-medium">
                    By registering, you represent and warrant that you meet all eligibility requirements. OwnerFi reserves the right to verify your license status and terminate accounts for ineligible users.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">3. Referral Fee Agreement</h2>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
                    <p className="font-bold text-emerald-800 mb-2">💰 Fee Structure</p>
                    <ul className="list-disc ml-6 space-y-2 text-emerald-700">
                      <li><strong>Standard Referral Fee:</strong> 30% of the gross commission you receive at closing</li>
                      <li><strong>Payment Timing:</strong> Due within 7 calendar days of closing and receipt of commission</li>
                      <li><strong>No Upfront Costs:</strong> You pay nothing until a transaction closes</li>
                      <li><strong>Settlement Statement:</strong> You must provide a copy of the fully executed settlement statement</li>
                    </ul>
                  </div>
                  <p className="mb-4">
                    By signing a referral agreement through the OwnerFi platform, you enter into a <strong>legally binding contract</strong> to pay the specified referral fee upon closing any transaction with the referred buyer.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">4. Referral Agreement Terms</h2>
                  <p className="mb-3">Each referral agreement includes:</p>
                  <ul className="list-disc ml-6 space-y-1 mb-4">
                    <li><strong>180-Day Term:</strong> Agreement valid for 180 days from signature date</li>
                    <li><strong>Auto-Extension:</strong> Automatically extends through closing if buyer is under contract or negotiations have begun</li>
                    <li><strong>Buyer-Side Only:</strong> Fee applies to buyer representation commission only</li>
                    <li><strong>Digital Signature:</strong> Electronic signature via typed name and checkbox is legally binding</li>
                  </ul>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <p className="text-slate-700 text-sm">
                      Referral agreements are based on standard real estate industry referral practices. By signing, you acknowledge that your brokerage approves of referral arrangements and that you have authority to bind your brokerage to the referral fee obligation.
                    </p>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">5. Lead Quality & Disclaimers</h2>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="font-bold text-red-800 mb-2">⚠️ Important Disclaimers</p>
                    <p className="text-red-700 mb-2">OwnerFi does NOT guarantee:</p>
                    <ul className="list-disc ml-6 space-y-1 text-red-700">
                      <li>That any lead will result in a closed transaction</li>
                      <li>Lead responsiveness or availability</li>
                      <li>Accuracy of buyer-provided information</li>
                      <li>Buyer's financial qualification or ability to purchase</li>
                      <li>Buyer's intent to complete a transaction</li>
                      <li>That leads are exclusive to you</li>
                    </ul>
                  </div>
                  <p className="mb-4">
                    Leads are provided "as-is" based on information buyers submit through our platform. You are responsible for qualifying leads and determining their suitability.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">6. Lead Disputes</h2>
                  <p className="mb-3">You may dispute a lead within 14 days of acceptance for the following reasons:</p>
                  <ul className="list-disc ml-6 space-y-1 mb-4">
                    <li><strong>No Response:</strong> Buyer does not respond after multiple contact attempts</li>
                    <li><strong>Invalid Information:</strong> Contact information is incorrect or fake</li>
                    <li><strong>Duplicate Lead:</strong> You already have an existing relationship with this buyer</li>
                    <li><strong>Outside Service Area:</strong> Buyer's actual location is outside your service area</li>
                    <li><strong>Not Interested:</strong> Buyer explicitly states they are not interested in purchasing</li>
                  </ul>
                  <p className="text-slate-600 text-sm">
                    Dispute decisions are made at OwnerFi's sole discretion. Approved disputes may result in lead credit or removal of referral fee obligation.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">7. Re-Referral System</h2>
                  <p className="mb-4">
                    If you cannot service a lead, you may re-refer them to another licensed agent through our platform.
                  </p>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                    <p className="font-bold text-purple-800 mb-2">Re-Referral Terms</p>
                    <ul className="list-disc ml-6 space-y-1 text-purple-700">
                      <li>You set the referral fee percentage (typically 25% of the new agent's commission)</li>
                      <li>The receiving agent becomes responsible for OwnerFi's original referral fee</li>
                      <li>Re-referrals create a new agreement between you and the receiving agent</li>
                      <li>Leads can only be re-referred once</li>
                      <li>You earn your portion only if the re-referred agent closes the transaction</li>
                    </ul>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">8. Account Obligations</h2>
                  <p className="mb-3">As a registered agent, you agree to:</p>
                  <ul className="list-disc ml-6 space-y-1 mb-4">
                    <li>Provide accurate and current license information</li>
                    <li>Update your account if your license status changes</li>
                    <li>Respond to leads in a timely and professional manner</li>
                    <li>Comply with all applicable real estate laws and regulations</li>
                    <li>Honor all signed referral agreements</li>
                    <li>Report closed transactions and pay referral fees promptly</li>
                    <li>Not circumvent the platform to avoid referral fees</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">9. Prohibited Conduct</h2>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="font-bold text-red-800 mb-2">You may NOT:</p>
                    <ul className="list-disc ml-6 space-y-1 text-red-700">
                      <li>Share lead information with unlicensed individuals</li>
                      <li>Use lead information for purposes other than real estate representation</li>
                      <li>Contact leads to discourage them from working with OwnerFi agents</li>
                      <li>Attempt to circumvent referral fee obligations</li>
                      <li>Misrepresent your license status or qualifications</li>
                      <li>Engage in dual agency without proper disclosure</li>
                      <li>Violate fair housing laws or discriminate against leads</li>
                      <li>Harass or repeatedly contact leads who have declined representation</li>
                    </ul>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">10. Account Termination</h2>
                  <p className="mb-3">OwnerFi may suspend or terminate your account for:</p>
                  <ul className="list-disc ml-6 space-y-1 mb-4">
                    <li>Violation of these Terms of Service</li>
                    <li>Failure to pay referral fees</li>
                    <li>License suspension, revocation, or expiration</li>
                    <li>Fraudulent activity or misrepresentation</li>
                    <li>Complaints from buyers or other agents</li>
                    <li>Any other reason at OwnerFi's sole discretion</li>
                  </ul>
                  <p className="text-slate-600 text-sm">
                    Upon termination, you remain obligated to pay referral fees for any pending or closed transactions from leads received through the platform.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">11. Limitation of Liability</h2>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="font-bold text-red-800 mb-2">⚠️ Liability Limitation</p>
                    <p className="text-red-700 mb-2">OwnerFi is not liable for:</p>
                    <ul className="list-disc ml-6 space-y-1 text-red-700">
                      <li>Lead quality or conversion rates</li>
                      <li>Buyer behavior or transaction outcomes</li>
                      <li>Lost commissions or business opportunities</li>
                      <li>Platform downtime or technical issues</li>
                      <li>Disputes with buyers or other agents</li>
                      <li>Any indirect, incidental, or consequential damages</li>
                    </ul>
                    <p className="text-red-700 mt-3 font-bold">
                      Maximum liability is limited to the referral fees paid by you in the 12 months preceding any claim.
                    </p>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">12. Indemnification</h2>
                  <p className="mb-4">
                    You agree to indemnify and hold harmless OwnerFi, its officers, employees, and affiliates from any claims, damages, or expenses arising from:
                  </p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Your use of the platform</li>
                    <li>Your real estate activities with referred leads</li>
                    <li>Violation of these Terms</li>
                    <li>Violation of any law or third-party rights</li>
                    <li>Disputes with buyers or other agents</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">13. Dispute Resolution</h2>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                    <p className="text-slate-700 mb-3">
                      Any disputes arising from these Terms or your use of the platform shall be resolved through:
                    </p>
                    <ol className="list-decimal ml-6 space-y-2 text-slate-700">
                      <li><strong>Informal Resolution:</strong> Contact support@ownerfi.ai to attempt resolution</li>
                      <li><strong>Mediation:</strong> If unresolved, parties agree to non-binding mediation</li>
                      <li><strong>Binding Arbitration:</strong> Final disputes resolved through binding arbitration in Tennessee</li>
                    </ol>
                    <p className="text-slate-600 text-sm mt-3">
                      For disputes between REALTORS®, the National Association of Realtors® Code of Ethics and Arbitration Manual may apply.
                    </p>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="font-bold text-red-800 mb-2">Class Action Waiver</p>
                    <p className="text-red-700 text-sm">
                      You waive any right to participate in a class action, class arbitration, or other representative action.
                      All disputes must be brought in your individual capacity, not as a plaintiff or class member in any purported class or representative proceeding.
                    </p>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="font-bold text-green-800 mb-2">Opt-Out Right</p>
                    <p className="text-green-700 text-sm">
                      You may opt out of this arbitration agreement by sending written notice to <a href="mailto:support@ownerfi.ai" className="underline">support@ownerfi.ai</a> within <strong>30 days</strong> of first accepting these Terms.
                    </p>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">14. Governing Law</h2>
                  <p>
                    These Terms are governed by the laws of the State of Tennessee without regard to conflict of law principles. You consent to jurisdiction in Tennessee state and federal courts.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-primary-text mb-4">15. Changes to Terms</h2>
                  <p>
                    We may modify these Terms at any time. Material changes will be communicated via email or platform notification. Continued use after changes constitutes acceptance.
                  </p>
                </section>

                <div className="border-t pt-8 mt-8">
                  <div className="bg-blue-100 border-2 border-blue-300 rounded-lg p-6">
                    <p className="text-blue-900 font-bold text-center text-lg mb-3">
                      ✅ By Registering as an Agent, You Agree
                    </p>
                    <p className="text-blue-800 text-sm text-center">
                      By registering and using the OwnerFi platform as a real estate agent, you acknowledge that you have read and agree to these Terms of Service. You confirm that: (1) you hold an active real estate license in good standing; (2) you have authority to enter into referral agreements; (3) you will pay the 30% referral fee at closing for all referred leads; (4) digital signatures on referral agreements are legally binding; (5) lead quality is not guaranteed; and (6) you will comply with all applicable laws and regulations.
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
