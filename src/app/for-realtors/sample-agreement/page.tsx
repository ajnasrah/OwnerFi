'use client'

import Link from 'next/link'
import { generateAgreementHTML, REFERRING_COMPANY_DEFAULTS, calculateExpirationDate, formatCurrentDate } from '@/lib/referral-agreement-template'

// Note: Metadata moved to separate file or handled differently for client components

const pageTitle = 'Sample RF-701 Referral Agreement | OwnerFi For Realtors'
const pageDescription = 'View a sample RF-701 Referral Agreement used by OwnerFi. Tennessee Association of REALTORS standard form with 30% referral fee and 180-day term.'

// Metadata cannot be exported from client components, so we set document title in useEffect
// For now, the parent layout handles base metadata

export default function SampleAgreementPage() {
  // Sample data for the agreement preview
  const sampleAgreementData = {
    agreementNumber: 'SAMPLE-2024-0001',
    effectiveDate: formatCurrentDate(),
    expirationDate: calculateExpirationDate(180),
    timeZone: REFERRING_COMPANY_DEFAULTS.TIME_ZONE,

    // Section 1: Referring Company (OwnerFi/eXp)
    referringCompanyName: REFERRING_COMPANY_DEFAULTS.COMPANY_NAME,
    referringCompanyAddress: REFERRING_COMPANY_DEFAULTS.COMPANY_ADDRESS,
    referringCompanyPhone: REFERRING_COMPANY_DEFAULTS.COMPANY_PHONE,
    referringCompanyLicense: REFERRING_COMPANY_DEFAULTS.COMPANY_LICENSE,
    referringCompanyFederalId: REFERRING_COMPANY_DEFAULTS.COMPANY_FEDERAL_ID || 'N/A',
    referringLicenseeName: REFERRING_COMPANY_DEFAULTS.LICENSEE_NAME,
    referringLicenseePhone: REFERRING_COMPANY_DEFAULTS.LICENSEE_PHONE,
    referringLicenseeEmail: REFERRING_COMPANY_DEFAULTS.LICENSEE_EMAIL,
    referringRelocationDirector: REFERRING_COMPANY_DEFAULTS.RELOCATION_DIRECTOR,
    referringRelocationEmail: REFERRING_COMPANY_DEFAULTS.RELOCATION_EMAIL,

    // Section 2: Receiving Company (Sample Realtor)
    receivingCompanyName: '[Your Brokerage Name]',
    receivingCompanyAddress: '[Your Office Address]',
    receivingCompanyPhone: '[Your Phone]',
    receivingCompanyLicense: '[Your Firm License #]',
    receivingLicenseeName: '[Your Name]',
    receivingLicenseePhone: '[Your Phone]',
    receivingLicenseeEmail: '[your.email@example.com]',
    receivingRelocationDirector: 'N/A',
    receivingRelocationEmail: 'N/A',

    // Section 3: Prospect (Sample Buyer)
    prospectName: 'John D. (Sample Buyer)',
    referralType: 'buyer' as const,
    prospectAgreedToReferral: true,

    // Section 4: Referral Fee
    referralFeeFixed: '',
    referralFeePercent: REFERRING_COMPANY_DEFAULTS.REFERRAL_FEE_PERCENT,

    // Contact Info (redacted for sample)
    prospectCurrentAddress: '[Released after signing]',
    prospectHomePhone: '[Released after signing]',
    prospectWorkPhone: '[Released after signing]',
    prospectCellPhone: '[Released after signing]',
    prospectEmail: '[Released after signing]',
    prospectBestTimeToCall: '[Released after signing]',
    otherTerms: 'Buyer is interested in owner-financed properties in the Houston, TX area.',
  }

  const agreementHTML = generateAgreementHTML(sampleAgreementData)

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">O</span>
            </div>
            <span className="text-lg font-bold text-white">OwnerFi</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/for-realtors" className="text-slate-300 hover:text-white text-sm">
              ← Back to For Realtors
            </Link>
            <Link
              href="/auth?role=realtor"
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
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
              Sample RF-701 Referral Agreement
            </h1>
            <p className="text-slate-400 max-w-2xl mx-auto">
              This is the Tennessee Association of REALTORS® standard referral agreement you&apos;ll sign when accepting a lead through OwnerFi.
            </p>
          </div>

          {/* Key Terms Summary */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">Quick Summary</h2>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-3">
                <span className="text-emerald-400">💰</span>
                <div>
                  <div className="text-white font-medium">30% Referral Fee</div>
                  <div className="text-slate-400">Paid at closing only</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-blue-400">📅</span>
                <div>
                  <div className="text-white font-medium">180-Day Term</div>
                  <div className="text-slate-400">Extends through closing</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-purple-400">🏠</span>
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
              📋 SAMPLE DOCUMENT - This is for preview purposes only. Actual agreements are signed digitally when accepting leads.
            </span>
          </div>

          {/* Agreement Document */}
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
            <div
              className="p-4 md:p-8"
              dangerouslySetInnerHTML={{ __html: agreementHTML }}
            />
          </div>

          {/* Print Button */}
          <div className="flex justify-center gap-4 mt-8">
            <button
              onClick={() => window.print()}
              className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2"
            >
              🖨️ Print Agreement
            </button>
            <Link
              href="/auth?role=realtor"
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium transition-all"
            >
              Join OwnerFi Free →
            </Link>
          </div>

          {/* Additional Info */}
          <div className="mt-12 bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
            <h2 className="text-lg font-semibold text-white mb-4">About This Agreement</h2>
            <div className="space-y-4 text-slate-300 text-sm">
              <p>
                <strong className="text-white">Form RF-701</strong> is the standard referral agreement form created by the Tennessee Association of REALTORS®.
                It&apos;s widely recognized and accepted across the real estate industry.
              </p>
              <p>
                <strong className="text-white">Digital Signing:</strong> When you accept a lead through OwnerFi, you&apos;ll sign this agreement digitally by typing your legal name and checking a confirmation box. The process takes less than 30 seconds.
              </p>
              <p>
                <strong className="text-white">Contact Info Release:</strong> The buyer&apos;s full contact information (phone, email, address) is released to you immediately after you sign the agreement.
              </p>
              <p>
                <strong className="text-white">No Risk:</strong> If the lead doesn&apos;t close on a home purchase, you owe nothing. The 30% referral fee is only due at closing when you get paid.
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
