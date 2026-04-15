'use client'

import Link from 'next/link'
import {
  generateExpReferralAgreementHTML,
  PLATFORM_ORIGINATING_AGENT,
  PLATFORM_REFERRAL_DEFAULTS,
  formatCurrentDate,
  calculateExpirationDate,
  type ExpAgreementParties,
} from '@/lib/referral-agreement-template'

export default function SampleAgreementPage() {
  // Sample data — exact eXp Tennessee Referral Agreement preview with
  // placeholder receiving-broker fields the agent fills in at signing.
  const sampleParties: ExpAgreementParties = {
    originating: PLATFORM_ORIGINATING_AGENT,
    receiving: {
      brokerageName: '[Your Brokerage Name]',
      brokerageEmail: '',
      brokeragePhone: '',
      agentName: '[Your Name]',
      officeAddress: '[Your Office Address]',
      agentPhone: '[Your Phone]',
      agentEmail: '[your.email@example.com]',
      managingBrokerName: '',
    },
    client: {
      type: 'buying',
      names: 'John D. (Sample Buyer)',
      address: '[Released after signing]',
      phone: '[Released after signing]',
      email: '[Released after signing]',
    },
    fee: {
      percent: PLATFORM_REFERRAL_DEFAULTS.REFERRAL_FEE_PERCENT,
      scope: PLATFORM_REFERRAL_DEFAULTS.FEE_SCOPE,
      paymentDays: PLATFORM_REFERRAL_DEFAULTS.PAYMENT_DAYS,
      additionalTerms: '',
    },
    period: {
      validTransactions: PLATFORM_REFERRAL_DEFAULTS.VALID_TRANSACTIONS,
      beginDate: formatCurrentDate(),
      expireDate: calculateExpirationDate(PLATFORM_REFERRAL_DEFAULTS.AGREEMENT_TERM_DAYS),
    },
  }

  const agreementHTML = generateExpReferralAgreementHTML(sampleParties)

  return (
    <div className="min-h-screen bg-[#111625] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#111625]/90 backdrop-blur-xl border-b border-white/[0.06] px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-14 sm:h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">OwnerFi <span className="text-slate-400 text-sm font-normal">for Realtors</span></span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/for-realtors" className="hidden sm:inline-flex text-sm text-slate-400 hover:text-white px-3 py-2 rounded-lg transition-colors">
              Back to For Realtors
            </Link>
            <Link
              href="/auth?role=realtor"
              className="bg-[#00BC7D] hover:bg-[#00d68f] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
            >
              Join Free
            </Link>
          </nav>
        </div>
      </header>

      <main className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Sample Referral Agreement
            </h1>
            <p className="text-slate-400 max-w-2xl mx-auto">
              This is the eXp Realty Tennessee Referral Agreement (SkySlope&reg; Forms, revised 5/6/2025) you&apos;ll sign when accepting a buyer lead. The Originating Brokerage is eXp Realty, LLC; the Receiving Brokerage is yours.
            </p>
          </div>

          {/* Key Terms Summary */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">Quick Summary</h2>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-3">
                <span className="text-[#00BC7D]">%</span>
                <div>
                  <div className="text-white font-medium">{PLATFORM_REFERRAL_DEFAULTS.REFERRAL_FEE_PERCENT}% Referral Fee</div>
                  <div className="text-slate-400">Paid at closing only</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-blue-400">d</span>
                <div>
                  <div className="text-white font-medium">{PLATFORM_REFERRAL_DEFAULTS.AGREEMENT_TERM_DAYS}-Day Term</div>
                  <div className="text-slate-400">Per agreement period</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-purple-400">B</span>
                <div>
                  <div className="text-white font-medium">Buyer-Side Only</div>
                  <div className="text-slate-400">Buyer representation</div>
                </div>
              </div>
            </div>
          </div>

          {/* Sample Banner */}
          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6 text-center">
            <span className="text-yellow-400 font-medium">
              SAMPLE DOCUMENT — Preview only. Actual agreements are signed digitally when accepting leads.
            </span>
          </div>

          {/* Agreement Document — overflow-x-auto so the 780px-wide form
              scrolls on narrow viewports instead of being clipped. */}
          <div className="bg-white rounded-xl shadow-2xl overflow-x-auto">
            <div
              className="p-4 md:p-8"
              dangerouslySetInnerHTML={{ __html: agreementHTML }}
            />
          </div>

          {/* Print Button */}
          <div className="flex justify-center gap-4 mt-8">
            <button
              onClick={() => window.print()}
              className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-xl font-medium transition-all"
            >
              Print Agreement
            </button>
            <Link
              href="/auth?role=realtor"
              className="bg-[#00BC7D]/50 hover:bg-[#00BC7D] text-white px-6 py-3 rounded-xl font-medium transition-all"
            >
              Join Free
            </Link>
          </div>

          {/* Additional Info */}
          <div className="mt-12 bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
            <h2 className="text-lg font-semibold text-white mb-4">About This Agreement</h2>
            <div className="space-y-4 text-slate-300 text-sm">
              <p>
                <strong className="text-white">eXp Realty Tennessee Referral Agreement</strong> is the standard SkySlope&reg; Forms 2-page broker-to-broker referral document used by eXp Realty&apos;s Tennessee office.
              </p>
              <p>
                <strong className="text-white">Originating vs Receiving Brokerage:</strong> The platform routes leads under eXp Realty as the Originating Brokerage. The Receiving Brokerage is your firm. Both managing brokers sign on page 2.
              </p>
              <p>
                <strong className="text-white">Digital Signing:</strong> When you accept a lead, you&apos;ll sign this agreement by typing your legal name and confirming the terms.
              </p>
              <p>
                <strong className="text-white">Contact Info Release:</strong> The buyer&apos;s full contact information is released to you immediately after signing.
              </p>
              <p>
                <strong className="text-white">No Risk:</strong> If the lead doesn&apos;t close, you owe nothing. The {PLATFORM_REFERRAL_DEFAULTS.REFERRAL_FEE_PERCENT}% referral fee is only due at closing when you get paid.
              </p>
              <p>
                <strong className="text-white">Platform Terms:</strong> Separately from this brokerage agreement, all users agree to the platform&apos;s{' '}
                <Link href="/tcpa-compliance" className="text-[#00BC7D] hover:underline">TCPA Compliance Agreement</Link>,{' '}
                <Link href="/creative-finance-disclaimer" className="text-[#00BC7D] hover:underline">Creative Finance Disclaimer</Link>, and{' '}
                <Link href="/terms" className="text-[#00BC7D] hover:underline">Terms of Service</Link>.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Print Styles - Inline to avoid styled-jsx issues */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            header, nav, button, .no-print {
              display: none !important;
            }
            body {
              background: white !important;
            }
            .bg-white {
              box-shadow: none !important;
            }
          }
        `
      }} />
    </div>
  )
}
