'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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

function CheckRow({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <div onClick={onToggle} className="flex items-center gap-3 py-2.5 px-2 rounded-lg active:bg-slate-700/50 cursor-pointer select-none">
      <div className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-[#00BC7D] border-[#00BC7D]' : 'border-slate-500 bg-slate-700'}`}>
        {checked && <span className="text-white text-sm font-bold">✓</span>}
      </div>
      <span className="text-slate-300 text-xs">{label}</span>
    </div>
  );
}

function SignatureSection({ modal, onUpdateField }: { modal: AgreementModalState; onUpdateField: (u: Partial<AgreementModalState>) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showArrow, setShowArrow] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowArrow(el.scrollTop + el.clientHeight < el.scrollHeight - 10);
  }, []);

  useEffect(() => {
    checkScroll();
  }, [checkScroll]);

  const scrollDown = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  };

  return (
    <div className="flex-shrink-0 border-t border-slate-700 relative">
      <div ref={scrollRef} onScroll={checkScroll} className="overflow-y-auto max-h-[40vh] p-3 md:p-6 space-y-2">
        <h4 className="text-white font-semibold text-sm">Sign Agreement</h4>

        <input
          type="text"
          value={modal.typedName}
          onChange={(e) => onUpdateField({ typedName: e.target.value })}
          placeholder="Type your full legal name to sign"
          className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-2.5 text-sm text-white placeholder-slate-500 focus:border-[#00BC7D] focus:outline-none"
        />

        <CheckRow checked={modal.agreeToTerms} onToggle={() => onUpdateField({ agreeToTerms: !modal.agreeToTerms })} label="I agree to the Referral Agreement terms" />
        <CheckRow checked={modal.agreeTCPA} onToggle={() => onUpdateField({ agreeTCPA: !modal.agreeTCPA })} label="I agree to TCPA Compliance" />
        <CheckRow checked={modal.agreeCreativeFinance} onToggle={() => onUpdateField({ agreeCreativeFinance: !modal.agreeCreativeFinance })} label="I acknowledge Creative Finance Disclaimer" />
        <CheckRow checked={modal.agreeDataAsIs} onToggle={() => onUpdateField({ agreeDataAsIs: !modal.agreeDataAsIs })} label="I accept lead data is provided as-is" />
      </div>

      {/* Scroll arrow indicator */}
      {showArrow && (
        <button
          onClick={scrollDown}
          className="absolute right-3 bottom-2 w-8 h-8 bg-[#00BC7D] rounded-full flex items-center justify-center shadow-lg animate-bounce"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
    </div>
  );
}

interface AgreementModalProps {
  modal: AgreementModalState;
  onUpdateField: (updates: Partial<AgreementModalState>) => void;
  onSign: () => void;
  onRetry: () => void;
  onClose: () => void;
}

export function AgreementModal({ modal, onUpdateField, onSign, onRetry, onClose }: AgreementModalProps) {
  // Hide the bottom tab bar when modal is open (Safari backdrop-blur breaks z-index)
  useEffect(() => {
    if (modal.isOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [modal.isOpen]);

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

          {/* Signature Section — scrollable with arrow indicator */}
          {modal.step === 'review' && modal.agreementHTML && (
            <SignatureSection modal={modal} onUpdateField={onUpdateField} />
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
                    href={`sms:${modal.buyerDetails.phone}?body=${encodeURIComponent("Hi, I see you're interested in owner-financed properties. I'd love to help you with your home search and represent you!")}`}
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
