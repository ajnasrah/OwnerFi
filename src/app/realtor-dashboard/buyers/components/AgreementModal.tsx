'use client';

import { AgreementModalState } from '../types';

// Safely format a date value that could be a string, Date, Firestore Timestamp, or ISO string
function safeFormatDate(value: unknown): string {
  if (!value) return 'N/A';
  try {
    // Firestore Timestamp object
    if (typeof value === 'object' && value !== null && 'toDate' in value) {
      return (value as { toDate: () => Date }).toDate().toLocaleDateString();
    }
    // Already a Date
    if (value instanceof Date) return value.toLocaleDateString();
    // String — try parsing
    if (typeof value === 'string') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? value : d.toLocaleDateString();
    }
    // Number (epoch)
    if (typeof value === 'number') return new Date(value).toLocaleDateString();
    return String(value);
  } catch {
    return String(value);
  }
}

interface AgreementModalProps {
  modal: AgreementModalState;
  onUpdateField: (updates: Partial<AgreementModalState>) => void;
  onSign: () => void;
  onRetry: () => void;
  onClose: () => void;
}

export function AgreementModal({ modal, onUpdateField, onSign, onRetry, onClose }: AgreementModalProps) {
  if (!modal.isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-0 md:p-4 overflow-y-auto" style={{ zIndex: 9999 }}>
      <div className="bg-slate-800 border-0 md:border md:border-slate-700 rounded-none md:rounded-xl max-w-3xl w-full h-full md:h-auto md:max-h-[90vh] overflow-hidden flex flex-col">

        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <h3 className="text-xl font-bold text-white">Referral Agreement</h3>
            {modal.agreementNumber && (
              <p className="text-slate-400 text-sm">#{modal.agreementNumber}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            x
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-3 md:p-6">

          {/* Loading State */}
          {modal.step === 'loading' && (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-[#00BC7D] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-400">Generating agreement...</p>
            </div>
          )}

          {/* Error State */}
          {modal.error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4">
              <p className="text-red-400 mb-3">{modal.error}</p>
              {!modal.agreementHTML && (
                <button
                  onClick={onRetry}
                  className="bg-red-500/30 hover:bg-red-500/40 text-red-300 py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                >
                  Try Again
                </button>
              )}
            </div>
          )}

          {/* Review State */}
          {modal.step === 'review' && (
            <div>
              {/* Agreement Preview */}
              {modal.agreementHTML && (
                <div className="bg-white rounded-lg mb-4 md:mb-6 max-h-64 md:max-h-96 overflow-y-auto overflow-x-hidden">
                  <div className="md:p-4 origin-top-left md:scale-100" style={{ transform: 'scale(0.55)', transformOrigin: 'top left', width: '182%' }}>
                    <div
                      dangerouslySetInnerHTML={{ __html: modal.agreementHTML }}
                      className="md:hidden"
                    />
                  </div>
                  <div className="hidden md:block p-4">
                    <div
                      dangerouslySetInnerHTML={{ __html: modal.agreementHTML }}
                      className="text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Terms Summary — compact */}
              {modal.terms && (
                <div className="bg-slate-700/50 rounded-lg p-3 mb-3 md:p-4 md:mb-6">
                  <div className="text-slate-300 text-xs md:text-sm space-y-0.5">
                    <div>Referral Fee: <span className="text-[#00BC7D] font-medium">{modal.terms.referralFeePercent}%</span> · Valid: <span className="text-white font-medium">{modal.terms.agreementTermDays} days</span> · Expires: <span className="text-white font-medium">{safeFormatDate(modal.terms.expirationDate)}</span></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Signature Section — OUTSIDE the scroll area so it stays stable on mobile */}
          {modal.step === 'review' && modal.agreementHTML && (
            <div className="flex-shrink-0 border-t border-slate-700 p-3 md:p-6 space-y-3">
              <h4 className="text-white font-semibold text-sm">Sign Agreement</h4>

              <input
                type="text"
                value={modal.typedName}
                onChange={(e) => onUpdateField({ typedName: e.target.value })}
                placeholder="Type your full legal name to sign"
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-2.5 text-sm text-white placeholder-slate-500 focus:border-[#00BC7D] focus:outline-none"
              />

              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={modal.agreeToTerms} onChange={(e) => onUpdateField({ agreeToTerms: e.target.checked })} className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-700 text-[#00BC7D] focus:ring-[#00BC7D] flex-shrink-0" />
                  <span className="text-slate-300 text-xs">I agree to the Referral Agreement terms and am electronically signing.</span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={modal.agreeTCPA} onChange={(e) => onUpdateField({ agreeTCPA: e.target.checked })} className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-700 text-[#00BC7D] focus:ring-[#00BC7D] flex-shrink-0" />
                  <span className="text-slate-300 text-xs">I agree to the <a href="/tcpa-compliance" target="_blank" className="text-[#00BC7D] underline">TCPA Compliance Agreement</a>.</span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={modal.agreeCreativeFinance} onChange={(e) => onUpdateField({ agreeCreativeFinance: e.target.checked })} className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-700 text-[#00BC7D] focus:ring-[#00BC7D] flex-shrink-0" />
                  <span className="text-slate-300 text-xs">I acknowledge the <a href="/creative-finance-disclaimer" target="_blank" className="text-[#00BC7D] underline">Creative Finance Disclaimer</a>.</span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={modal.agreeDataAsIs} onChange={(e) => onUpdateField({ agreeDataAsIs: e.target.checked })} className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-700 text-[#00BC7D] focus:ring-[#00BC7D] flex-shrink-0" />
                  <span className="text-slate-300 text-xs">I accept that lead data is provided &quot;as-is&quot; without verification.</span>
                </label>
              </div>
            </div>
          )}

          {/* Signing State */}
          {modal.step === 'signing' && (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-[#00BC7D] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-400">Processing signature...</p>
            </div>
          )}

          {/* Success State */}
          {modal.step === 'success' && modal.buyerDetails && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-[#00BC7D]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl text-[#00BC7D]">&#10003;</span>
              </div>
              <h4 className="text-xl font-bold text-white mb-2">Agreement Signed!</h4>
              <p className="text-slate-400 mb-6">Here is your lead&apos;s contact information:</p>

              <div className="bg-slate-700/50 rounded-lg p-6 text-left max-w-md mx-auto">
                <div className="space-y-3">
                  <div>
                    <span className="text-slate-400 text-sm">Name</span>
                    <p className="text-white font-medium">
                      {modal.buyerDetails.firstName} {modal.buyerDetails.lastName}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-sm">Phone</span>
                    <p className="text-[#00BC7D] font-medium">{modal.buyerDetails.phone}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-sm">Email</span>
                    <p className="text-[#00BC7D] font-medium">{modal.buyerDetails.email}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-sm">Location</span>
                    <p className="text-white">
                      {modal.buyerDetails.city}, {modal.buyerDetails.state}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <a
                    href={`sms:${modal.buyerDetails.phone}?body=${encodeURIComponent("Hi, I see you're interested in owner finance properties through Ownerfi. I'd love to help you with your home search and represent you!")}`}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-medium transition-colors text-center"
                  >
                    Text Now
                  </a>
                  <a
                    href={`tel:${modal.buyerDetails.phone}`}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-medium transition-colors text-center"
                  >
                    Call Now
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {modal.step === 'review' && (
          <div className="p-4 border-t border-slate-700 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            {modal.agreementHTML && (
              <button
                onClick={onSign}
                disabled={!modal.typedName || !modal.agreeToTerms || !modal.agreeTCPA || !modal.agreeCreativeFinance || !modal.agreeDataAsIs}
                className="flex-1 bg-[#00BC7D]/50 hover:bg-[#00BC7D] text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sign & Accept Lead
              </button>
            )}
          </div>
        )}

        {modal.step === 'success' && (
          <div className="p-4 border-t border-slate-700">
            <button
              onClick={onClose}
              className="w-full bg-[#00BC7D]/50 hover:bg-[#00BC7D] text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
