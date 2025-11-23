'use client';

import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-primary-bg">
      <Header />

      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="bg-white rounded-xl shadow-light p-8 md:p-12">
          <h1 className="text-4xl font-bold text-primary-text mb-8">Privacy Policy</h1>
          <p className="text-slate-600 mb-4">Last Updated: January 2025</p>
          <p className="text-slate-600 mb-8">Contact: <a href="mailto:support@ownerfi.com" className="text-primary hover:underline">support@ownerfi.com</a></p>

          {/* Plain English Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
            <h2 className="text-2xl font-semibold text-blue-800 mb-4">📋 Privacy Summary (Key Points)</h2>
            <ul className="space-y-2 text-blue-700">
              <li>• <strong>We collect your name, phone, email, budget, and preferences</strong></li>
              <li>• <strong>We share this information with licensed real estate agents</strong> who will contact you</li>
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
                <li>cookies</li>
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
              <p className="mb-3">We retain user data for as long as needed to:</p>
              <ul className="list-disc ml-6 space-y-1 mb-4">
                <li>operate the platform</li>
                <li>provide services</li>
                <li>meet legal requirements</li>
                <li>maintain security</li>
              </ul>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-700">
                  You may request deletion at any time by contacting <a href="mailto:support@ownerfi.com" className="underline hover:text-blue-800">support@ownerfi.com</a>.
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
                  To submit a request, contact: <a href="mailto:support@ownerfi.com" className="underline hover:text-blue-800 font-bold">support@ownerfi.com</a>
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
                  <li><strong>Right to Opt-Out:</strong> Opt out of the sharing of personal information</li>
                  <li><strong>Right to Non-Discrimination:</strong> Equal service regardless of privacy choices</li>
                </ul>
                <p className="text-purple-700 mt-3">
                  To exercise your rights, email <strong>support@ownerfi.com</strong> with "CCPA REQUEST" in the subject line.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">9. Children</h2>
              <p>
                OwnerFi is not intended for users under 18.
              </p>
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
                  Email: <a href="mailto:support@ownerfi.com" className="text-primary hover:underline">support@ownerfi.com</a>
                </p>
              </div>
            </section>

            <div className="border-t pt-8 mt-8">
              <div className="bg-blue-100 border-2 border-blue-300 rounded-lg p-6">
                <p className="text-blue-900 font-bold text-center text-lg mb-3">
                  ✅ By Using OwnerFi, You Agree
                </p>
                <p className="text-blue-800 text-sm text-center">
                  By using OwnerFi, you acknowledge that you have read and agree to this Privacy Policy. You consent to the collection and sharing of your information with licensed real estate agents as described above. You understand that agents may contact you and that you can decline representation at any time.
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
