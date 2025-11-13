'use client';

import Link from 'next/link';

export default function TCPACompliance() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">O</span>
            </div>
            <span className="text-lg font-bold text-white">OwnerFi</span>
          </Link>
          <button
            onClick={() => window.close()}
            className="text-slate-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            ← Close
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-4">
            TCPA Compliance & Liability Agreement
          </h1>
          <p className="text-xl text-slate-300">
            For Licensed Real Estate Professionals
          </p>
        </div>

        <div className="bg-slate-800/30 rounded-2xl p-8 space-y-8">
          
          {/* Section 1 */}
          <section>
            <h2 className="text-2xl font-bold text-red-400 mb-4">1. Independent Responsibility</h2>
            <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-4">
              <p className="text-slate-200 leading-relaxed">
                Agent acknowledges and agrees that all communications (calls, texts, emails, voicemails, or otherwise) 
                made to leads purchased from OwnerFi are the <strong>sole responsibility of the Agent and Agent's brokerage.</strong>
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-2xl font-bold text-orange-400 mb-4">2. Compliance Obligations</h2>
            <div className="bg-orange-500/10 border border-orange-400/30 rounded-lg p-4">
              <p className="text-slate-200 mb-4"><strong>Agent expressly agrees to:</strong></p>
              <ul className="space-y-2 text-slate-200">
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">•</span>
                  <span>Comply with the federal Telephone Consumer Protection Act (TCPA), the Telemarketing Sales Rule (TSR), and all applicable state "mini-TCPA" laws (including but not limited to Florida, Oklahoma, Washington, and any state Do Not Call registry laws).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">•</span>
                  <span>Honor all opt-out requests (STOP, unsubscribe, or equivalent) within <strong>24 hours</strong> of receipt.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">•</span>
                  <span>Maintain and update an internal Do Not Call list and suppress all contacts who have opted out.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">•</span>
                  <span>Properly identify themselves and their brokerage in all communications.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">•</span>
                  <span>Use automated dialing or texting systems only in compliance with applicable laws.</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-2xl font-bold text-purple-400 mb-4">3. Indemnification</h2>
            <div className="bg-purple-500/10 border border-purple-400/30 rounded-lg p-4">
              <p className="text-slate-200 leading-relaxed">
                Agent agrees to <strong>indemnify, defend, and hold harmless</strong> OwnerFi and its affiliates,
                officers, directors, employees, and contractors from and against any and all claims, damages, fines, penalties,
                settlements, costs, or expenses (including reasonable attorneys' fees) arising from or related to Agent's
                communications with leads, including but not limited to TCPA or state telemarketing violations.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-2xl font-bold text-blue-400 mb-4">4. Independent Contractor Status</h2>
            <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-4">
              <p className="text-slate-200 leading-relaxed">
                Agent acknowledges they are an <strong>independent contractor</strong>, not an employee or representative of OwnerFi. 
                All communications made to leads are made on behalf of the Agent and/or Agent's brokerage only.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-2xl font-bold text-green-400 mb-4">5. Termination for Non-Compliance</h2>
            <div className="bg-green-500/10 border border-green-400/30 rounded-lg p-4">
              <p className="text-slate-200 leading-relaxed">
                OwnerFi reserves the right to <strong>immediately suspend or terminate</strong> Agent's access to leads 
                in the event of suspected or confirmed TCPA/telemarketing non-compliance, without refund, and to provide 
                proof of such violations to regulators if required.
              </p>
            </div>
          </section>

          {/* Legal Notice */}
          <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-6 mt-8">
            <h3 className="text-yellow-800 font-bold text-lg mb-3">⚖️ Legal Notice</h3>
            <p className="text-yellow-800 text-sm leading-relaxed">
              This agreement is binding and enforceable. By purchasing leads from OwnerFi, you agree to these terms. 
              Violation of these terms may result in immediate termination of services, forfeiture of fees paid, 
              and potential legal action for indemnification of any resulting claims or damages.
            </p>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="text-center mt-8">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => window.close()}
              className="bg-slate-700 hover:bg-slate-600 text-white py-3 px-8 rounded-xl font-semibold transition-all duration-300"
            >
              I Have Read This Agreement
            </button>
            <Link
              href="/terms"
              target="_blank"
              className="bg-blue-600 hover:bg-blue-500 text-white py-3 px-8 rounded-xl font-semibold transition-all duration-300 text-center"
            >
              View Full Terms of Service
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-800/30 border-t border-slate-700/50 py-6 mt-12">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs text-slate-500">
            © 2025 OwnerFi - #1076, 1028 Cresthaven Road, Suite 200, Memphis, TN 38119, United States
          </p>
        </div>
      </footer>
    </div>
  );
}