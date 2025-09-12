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
          <p className="text-slate-600 mb-8">Last updated: September 3, 2025</p>
          
          {/* Summary at Top */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
            <h2 className="text-2xl font-semibold text-blue-800 mb-4">📋 Privacy Summary (Key Points)</h2>
            <ul className="space-y-2 text-blue-700">
              <li>• <strong>We collect your personal information and property preferences</strong></li>
              <li>• <strong>We sell buyer leads to real estate agents and brokers</strong></li>
              <li>• <strong>You may be contacted by multiple real estate professionals</strong></li>
              <li>• <strong>We use cookies and tracking technologies</strong></li>
              <li>• <strong>We implement security measures but cannot guarantee absolute security</strong></li>
              <li>• <strong>You have certain rights regarding your information</strong></li>
              <li>• <strong>Once sold to agents, we cannot control how they use your data</strong></li>
            </ul>
          </div>

          <div className="space-y-8 text-lg leading-relaxed text-slate-700">
            
            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">1. Who We Are</h2>
              <p><strong>OwnerFi is operated by Prosway</strong>, headquartered at 5095 Covington Way, Memphis, TN 38134.</p>
              <p className="mt-4">This Privacy Policy describes how we collect, use, share, and protect your personal information when you use our website and services.</p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <p className="font-medium text-blue-800">Key Point:</p>
                <p className="text-blue-700 mt-2">Our business model includes selling buyer lead information to real estate professionals. By using our service, you consent to this practice as described below.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">2. Information We Collect</h2>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-red-800">⚠️ DO NOT SUBMIT SENSITIVE DATA</p>
                <p className="text-red-700 mt-2">Do not submit sensitive personal information such as Social Security numbers, financial account numbers, or health information. We do not request or process such data and disclaim responsibility for any submitted.</p>
              </div>
              
              <h3 className="text-xl font-medium text-primary-text mb-3">Personal Information</h3>
              <p>We collect personal information you voluntarily provide, including:</p>
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>Name, email address, and phone number</li>
                <li>Property preferences and search criteria</li>
                <li>Budget information and financing preferences</li>
                <li>Location and geographic preferences</li>
                <li>Real estate license information (for agents)</li>
                <li>Payment and billing information</li>
              </ul>

              <h3 className="text-xl font-medium text-primary-text mb-3 mt-6">Automatically Collected Information</h3>
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>IP address, browser type, and device information</li>
                <li>Website usage patterns and analytics data</li>
                <li>Cookies and similar tracking technologies</li>
                <li>Geolocation data (if permitted)</li>
              </ul>

              <h3 className="text-xl font-medium text-primary-text mb-3 mt-6">International Data Transfers</h3>
              <p>If you access our services from outside the United States, your information will be processed and stored in the U.S.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">3. How We Use Your Information</h2>
              
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <h3 className="font-semibold text-orange-800 mb-2">PRIMARY BUSINESS USE - LEAD SALES</h3>
                <p className="text-orange-700">We sell buyer contact information and preferences to licensed real estate agents and brokers. This is our primary revenue source and a core part of our business model.</p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-yellow-800">📞 TCPA CONSENT & TERMS CROSS-REFERENCE</p>
                <p className="text-yellow-700 mt-2">By providing your phone number, you consent to receive calls and texts (including via automated systems) as described in our <Link href="/terms" className="underline hover:text-yellow-800">Terms of Service</Link>.</p>
              </div>
              
              <p>We use your information to:</p>
              <ul className="list-disc ml-6 mt-2 space-y-2">
                <li><strong>Sell leads to real estate professionals:</strong> Your contact information and property preferences may be sold to licensed agents and brokers in your area</li>
                <li><strong>Match you with properties:</strong> Connect you with suitable owner-financed properties</li>
                <li><strong>Provide our services:</strong> Operate and maintain our platform</li>
                <li><strong>Communicate with you:</strong> Send property updates, marketing communications, and service notifications</li>
                <li><strong>Process payments:</strong> Handle subscription fees and lead purchases</li>
                <li><strong>Improve our service:</strong> Analyze usage patterns and optimize our platform</li>
                <li><strong>Comply with legal obligations:</strong> Meet regulatory and legal requirements</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">4. Information Sharing and Disclosure</h2>
              
              <h3 className="text-xl font-medium text-primary-text mb-3">Lead Sales to Real Estate Professionals</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="font-medium text-red-800">IMPORTANT:</p>
                <p className="text-red-700 mt-2">When you register as a buyer, we may sell your information to multiple real estate agents and brokers. You may receive contact from several professionals regarding properties and services.</p>
              </div>
              
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                <p className="font-bold text-slate-800">🛡️ AGENT LIABILITY FIREWALL</p>
                <p className="text-slate-700 mt-2"><strong>Licensed real estate professionals who purchase leads from us are independent third parties.</strong> We are not responsible for their actions, privacy practices, or how they use your information once sold.</p>
              </div>
              
              <p>Information shared in lead sales includes:</p>
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>Your name, email, and phone number</li>
                <li>Property preferences (location, price range, size)</li>
                <li>Budget and financing information</li>
                <li>Timeline and urgency indicators</li>
              </ul>

              <h3 className="text-xl font-medium text-primary-text mb-3 mt-6">Other Sharing</h3>
              <p>We may also share your information with:</p>
              <ul className="list-disc ml-6 mt-2 space-y-2">
                <li><strong>Service providers:</strong> Third-party vendors who help operate our business</li>
                <li><strong>Payment processors:</strong> Companies that process financial transactions</li>
                <li><strong>Legal compliance:</strong> When required by law or to protect our rights</li>
                <li><strong>Business transfers:</strong> In case of merger, acquisition, or asset sale</li>
                <li><strong>Marketing partners:</strong> Trusted partners who may offer relevant services</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">5. Cookies and Tracking Technologies</h2>
              <p>We use cookies, web beacons, and similar technologies to:</p>
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>Remember your preferences and login information</li>
                <li>Analyze website traffic and user behavior</li>
                <li>Deliver targeted advertising and marketing</li>
                <li>Improve website functionality and user experience</li>
              </ul>
              <p className="mt-4">You can control cookies through your browser settings, but this may limit some website functionality.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">6. Data Security</h2>
              <p>We implement reasonable security measures to protect your personal information, including:</p>
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>Encryption of sensitive data during transmission</li>
                <li>Secure data storage practices</li>
                <li>Regular security audits and updates</li>
                <li>Access controls and authentication measures</li>
              </ul>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                <p className="text-yellow-800"><strong>Disclaimer:</strong> While we strive to protect your information, no method of transmission or storage is 100% secure. We cannot guarantee absolute security of your data.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">7. Your Rights and Choices</h2>
              
              <h3 className="text-xl font-medium text-primary-text mb-3">Communication Preferences</h3>
              <p>You may:</p>
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>Unsubscribe from marketing emails using the unsubscribe link</li>
                <li>Update your communication preferences in your account settings</li>
                <li>Contact us to modify or delete your account information</li>
              </ul>

              <h3 className="text-xl font-medium text-primary-text mb-3 mt-4">Important Limitation</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700"><strong>Please Note:</strong> If we have already sold your information to real estate professionals, we cannot control how they use or retain that data. You will need to contact them directly regarding their use of your information.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">8. Data Retention</h2>
              <p>We retain your personal information:</p>
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>For as long as your account is active</li>
                <li>As needed to provide our services</li>
                <li>To comply with legal obligations</li>
                <li>To resolve disputes and enforce agreements</li>
              </ul>
              <p className="mt-4">Even if you delete your account, information previously sold to real estate professionals will remain with those third parties.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">9. Children's Privacy</h2>
              <p>Our services are not intended for individuals under 18 years of age. We do not knowingly collect personal information from children under 18. If we become aware of such collection, we will take steps to delete the information promptly.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">10. Third-Party Websites</h2>
              <p>Our website may contain links to third-party websites. We are not responsible for the privacy practices of these external sites. We encourage you to review their privacy policies before providing any personal information.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">11. State-Specific Rights</h2>
              
              <h3 className="text-xl font-medium text-primary-text mb-3">State Privacy Rights</h3>
              <p><strong>If you are a resident of California, Colorado, Virginia, Connecticut, or Utah</strong>, you may have additional rights under applicable privacy laws, including:</p>
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li><strong>California (CCPA):</strong> Right to know, delete, and opt-out of sale of personal information</li>
                <li><strong>Other States:</strong> Similar rights may apply under state privacy laws</li>
              </ul>
              <p className="mt-4"><strong>Important:</strong> Opting out of sales may limit your ability to use our matching services. Contact us for more information about your specific rights.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">12. Changes to This Privacy Policy</h2>
              <p>We may update this Privacy Policy periodically. We will notify you of material changes by posting the updated policy on our website and updating the "Last updated" date. Your continued use of our services after any changes constitutes acceptance of the updated policy.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">13. Contact Information</h2>
              <p>If you have questions about this Privacy Policy or our privacy practices, please contact us:</p>
              <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                <p><strong>Email:</strong> admin@prosway.com</p>
                <p><strong>Address:</strong> 5095 Covington Way<br />Memphis, TN 38134</p>
              </div>
            </section>

            <div className="border-t pt-8 mt-8">
              <p className="text-sm text-slate-500">
                By using OwnerFi, you acknowledge that you have read, understood, and agree to this Privacy Policy and our <Link href="/terms" className="underline hover:text-slate-700">Terms of Service</Link>.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}