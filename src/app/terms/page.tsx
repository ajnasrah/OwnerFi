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
          <p className="text-slate-600 mb-4">Last Updated: January 2025</p>
          <p className="text-slate-600 mb-8">Contact: <a href="mailto:support@ownerfi.com" className="text-primary hover:underline">support@ownerfi.com</a></p>

          {/* Plain English Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
            <h2 className="text-2xl font-semibold text-blue-800 mb-4">📋 What You Need to Know (Plain English)</h2>
            <ul className="space-y-2 text-blue-700">
              <li>• <strong>OwnerFi is a property search and lead-generation platform</strong> — we show properties that may offer owner financing</li>
              <li>• <strong>We share your contact info with licensed real estate agents</strong> who will call/text/email you to offer help</li>
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
              </ul>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-700">
                  All representation services come from <strong>licensed real estate agents</strong>, not from OwnerFi.
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
              <ul className="list-disc ml-6 space-y-1">
                <li>verify all property details independently</li>
                <li>communicate directly with agents for showings and offers</li>
                <li>notify agents if you do not want representation</li>
                <li>verify owner-finance terms directly with sellers or their agents</li>
              </ul>
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
              <h2 className="text-2xl font-semibold text-primary-text mb-4">11. No Refunds</h2>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-orange-700 font-bold">
                  All payments made to OwnerFi (if any) are <strong>non-refundable</strong>.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">12. Arbitration</h2>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="text-slate-700">
                  Any disputes are resolved by <strong>binding arbitration</strong>, not in court.
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
                  By using OwnerFi, you acknowledge that you have read and agree to these Terms of Service. You understand that: (1) your contact information will be shared with licensed real estate agents who may contact you; (2) you can decline representation at any time; (3) OwnerFi does not verify property information; (4) all data may be inaccurate or outdated; and (5) you must independently verify all information with licensed professionals.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
