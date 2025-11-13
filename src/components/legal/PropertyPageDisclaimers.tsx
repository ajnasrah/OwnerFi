'use client';

import Link from 'next/link';

interface PropertyPageDisclaimersProps {
  showCreativeFinance?: boolean;
  showWireFraud?: boolean;
  showPaymentEstimate?: boolean;
  compact?: boolean;
}

export function PropertyPageDisclaimers({
  showCreativeFinance = false,
  showWireFraud = true,
  showPaymentEstimate = true,
  compact = false
}: PropertyPageDisclaimersProps) {
  if (compact) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
        <p className="text-red-800 text-sm font-semibold">
          ⚠️ All information is approximate and unverified. Payment estimates exclude taxes, insurance, and fees.
          Seller-finance terms are hypothetical and subject to change. <Link href="/terms" className="underline hover:text-red-600">See Terms</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-6">
      {/* Core Disclaimer - Always Show */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
        <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
          <span>📋</span>
          <span>Property Information Disclaimer</span>
        </h3>
        <div className="text-blue-800 text-sm space-y-2">
          <p>
            <strong>All property information is approximate and unverified.</strong> OwnerFi displays data provided by listing agents and MLS sources. We do not verify property details, ownership, condition, or availability.
          </p>
          <p>
            <strong>You must independently verify all information</strong> including property address, square footage, bedrooms, bathrooms, lot size, ownership status, title, liens, and property condition before making any decisions.
          </p>
        </div>
      </div>

      {/* Payment Estimate Disclaimer */}
      {showPaymentEstimate && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
          <h3 className="font-bold text-yellow-900 mb-2 flex items-center gap-2">
            <span>💰</span>
            <span>Payment Estimate Disclaimer</span>
          </h3>
          <div className="text-yellow-800 text-sm space-y-2">
            <p>
              <strong>Payment estimates are NON-BINDING and for illustration only.</strong> Actual payments will be higher once you include:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-yellow-700">
              <li>Property taxes (varies by location)</li>
              <li>Homeowner's insurance (required by most sellers)</li>
              <li>HOA dues (if applicable)</li>
              <li>Mortgage insurance (if required)</li>
              <li>Flood insurance (if in flood zone)</li>
              <li>Escrow reserves and closing costs</li>
            </ul>
            <p className="font-semibold">
              Seller-finance terms shown are hypothetical and subject to change or withdrawal by the seller at any time.
            </p>
          </div>
        </div>
      )}

      {/* Creative Finance Warning */}
      {showCreativeFinance && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-5">
          <h3 className="font-bold text-orange-900 mb-2 flex items-center gap-2">
            <span>🚨</span>
            <span>Creative Finance Warning</span>
          </h3>
          <div className="text-orange-800 text-sm space-y-2">
            <p>
              <strong>This property may involve creative finance structures</strong> (subject-to, wraparound mortgage, lease option, etc.) which carry significant legal and financial risks.
            </p>
            <p className="font-semibold">
              You MUST consult with a licensed real estate attorney and RMLO before proceeding with any creative finance transaction.
            </p>
            <p>
              <Link
                href="/creative-finance-disclaimer"
                target="_blank"
                className="text-orange-900 underline hover:text-orange-700 font-semibold"
              >
                Read Full Creative Finance Disclaimer →
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Wire Fraud Warning */}
      {showWireFraud && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-5">
          <h3 className="font-bold text-red-900 mb-2 flex items-center gap-2">
            <span>💰</span>
            <span>WIRE FRAUD PROTECTION</span>
          </h3>
          <div className="text-red-800 text-sm space-y-2">
            <div className="font-semibold space-y-1">
              <p>⛔ OWNERFI NEVER PROVIDES WIRE INSTRUCTIONS</p>
              <p>⛔ OWNERFI NEVER REQUESTS PAYMENTS OR DEPOSITS</p>
              <p>⛔ OWNERFI NEVER SENDS WIRING INFORMATION BY EMAIL</p>
            </div>
            <p className="font-bold">
              ✅ ALWAYS verify wiring instructions BY PHONE with your escrow/title company using a phone number YOU independently look up (not from an email).
            </p>
          </div>
        </div>
      )}

      {/* Professional Consultation Recommendation */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-5">
        <h3 className="font-bold text-purple-900 mb-2 flex items-center gap-2">
          <span>👔</span>
          <span>Professional Consultation Required</span>
        </h3>
        <div className="text-purple-800 text-sm space-y-2">
          <p>
            <strong>Before making any offer or financial commitment, consult with:</strong>
          </p>
          <ul className="list-disc ml-6 space-y-1 text-purple-700">
            <li><strong>Licensed RMLO or mortgage broker</strong> to review financing terms</li>
            <li><strong>Licensed real estate attorney</strong> to review contracts</li>
            <li><strong>Licensed buyer's agent</strong> to represent your interests</li>
            <li><strong>Title company</strong> to verify ownership and liens</li>
            <li><strong>Licensed home inspector</strong> to assess property condition</li>
          </ul>
        </div>
      </div>

      {/* Legal Links */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="flex flex-wrap justify-center gap-4 text-sm">
          <Link href="/terms" target="_blank" className="text-blue-600 hover:text-blue-800 underline font-medium">
            Terms of Service
          </Link>
          <Link href="/privacy" target="_blank" className="text-blue-600 hover:text-blue-800 underline font-medium">
            Privacy Policy
          </Link>
          {showCreativeFinance && (
            <Link href="/creative-finance-disclaimer" target="_blank" className="text-blue-600 hover:text-blue-800 underline font-medium">
              Creative Finance Disclaimer
            </Link>
          )}
        </div>
        <p className="text-xs text-slate-600 text-center mt-2">
          OwnerFi is not a licensed broker or lender. We are a lead generation platform only.
        </p>
      </div>
    </div>
  );
}

// Compact version for use in cards or small spaces
export function CompactDisclaimer() {
  return <PropertyPageDisclaimers compact />;
}

// Baseline terms disclaimer for property cards
export function BaselineTermsDisclaimer() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
      <p className="text-amber-900 text-xs">
        <strong>⚠️ Baseline terms shown:</strong> Interest rate, down payment, and payment amounts are hypothetical conversation starters only.
        Not binding. Seller may change or reject any terms. Excludes taxes, insurance, HOA fees.
      </p>
    </div>
  );
}
