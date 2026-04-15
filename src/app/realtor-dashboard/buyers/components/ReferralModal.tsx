'use client';

import { ReferralModalState } from '../types';

interface ReferralModalProps {
  modal: ReferralModalState;
  onUpdateField: (updates: Partial<ReferralModalState>) => void;
  onCreateInvite: () => void;
  onCopyLink: () => void;
  onSendEmail: () => void;
  onSendText: () => void;
  onClose: () => void;
}

export function ReferralModal({
  modal,
  onUpdateField,
  onCreateInvite,
  onCopyLink,
  onSendEmail,
  onSendText,
  onClose,
}: ReferralModalProps) {
  if (!modal.isOpen || !modal.agreement) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-modal p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Refer Lead to Another Agent</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl"
          >
            x
          </button>
        </div>

        {modal.loading ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Loading invite...</p>
          </div>
        ) : !modal.success ? (
          <>
            {/* Lead Info */}
            <div className="mb-6 p-4 bg-slate-700/50 rounded-lg">
              <div className="text-white font-medium mb-1">
                {modal.agreement.buyerFirstName} {modal.agreement.buyerLastName}
              </div>
              <div className="text-slate-400 text-sm">
                {modal.agreement.buyerCity}, {modal.agreement.buyerState}
              </div>
            </div>

            {/* Error */}
            {modal.error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {modal.error}
              </div>
            )}

            {/* Fee Input */}
            <div className="mb-6">
              <label className="block text-white text-sm font-medium mb-2">
                Referral Fee Percentage
              </label>
              <p className="text-slate-400 text-xs mb-3">
                This is the percentage of the receiving agent&apos;s commission you&apos;ll receive at closing.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={modal.feePercent}
                  onChange={(e) => onUpdateField({
                    feePercent: Math.max(1, Math.min(50, parseInt(e.target.value) || 25))
                  })}
                  className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white text-center text-xl font-bold"
                />
                <span className="text-white text-xl font-bold">%</span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Common rates: 25% (standard), 30% (premium), 35% (high-value)
              </div>
            </div>

            {/* Fee Breakdown */}
            <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <h4 className="text-purple-400 font-medium mb-2">Fee Breakdown</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Agent B pays (of their commission):</span>
                  <span className="text-purple-400 font-medium">{modal.feePercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">You receive (70% of referral):</span>
                  <span className="text-white font-medium">{(modal.feePercent * 0.7).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Platform share (30% of referral):</span>
                  <span className="text-slate-500">{(modal.feePercent * 0.3).toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onCreateInvite}
                disabled={modal.loading}
                className="flex-1 bg-purple-500 hover:bg-purple-600 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {modal.loading ? 'Creating...' : 'Create Invite Link'}
              </button>
            </div>
          </>
        ) : (
          /* Success State - Share Drawer */
          <div>
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl text-purple-400">&#10003;</span>
              </div>
              <h4 className="text-lg font-bold text-white">Share Referral Link</h4>
              <p className="text-slate-400 text-sm">
                How would you like to share this with the other agent?
              </p>
            </div>

            {/* Share Method Selection */}
            {modal.shareMethod === 'select' && (
              <div className="space-y-3">
                <button
                  onClick={() => onUpdateField({ shareMethod: 'email' })}
                  className="w-full flex items-center gap-4 p-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl transition-colors"
                >
                  <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <span className="text-xl">&#9993;</span>
                  </div>
                  <div className="text-left">
                    <div className="text-white font-medium">Send via Email</div>
                    <div className="text-slate-400 text-sm">Enter their email address</div>
                  </div>
                </button>

                <button
                  onClick={() => onUpdateField({ shareMethod: 'text' })}
                  className="w-full flex items-center gap-4 p-4 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-xl transition-colors"
                >
                  <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                    <span className="text-xl">&#128172;</span>
                  </div>
                  <div className="text-left">
                    <div className="text-white font-medium">Send via Text</div>
                    <div className="text-slate-400 text-sm">Enter their phone number</div>
                  </div>
                </button>

                <button
                  onClick={() => onUpdateField({ shareMethod: 'copy' })}
                  className="w-full flex items-center gap-4 p-4 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-xl transition-colors"
                >
                  <div className="w-12 h-12 bg-slate-600 rounded-full flex items-center justify-center">
                    <span className="text-xl">&#128279;</span>
                  </div>
                  <div className="text-left">
                    <div className="text-white font-medium">Copy Link</div>
                    <div className="text-slate-400 text-sm">Share it yourself</div>
                  </div>
                </button>
              </div>
            )}

            {/* Email Input */}
            {modal.shareMethod === 'email' && (
              <div className="space-y-4">
                <button
                  onClick={() => onUpdateField({ shareMethod: 'select' })}
                  className="text-slate-400 hover:text-white text-sm flex items-center gap-1"
                >
                  &#8592; Back
                </button>
                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Agent&apos;s Email Address
                  </label>
                  <input
                    type="email"
                    value={modal.shareEmail}
                    onChange={(e) => onUpdateField({ shareEmail: e.target.value })}
                    placeholder="agent@example.com"
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    autoFocus
                  />
                </div>
                <button
                  onClick={onSendEmail}
                  disabled={!modal.shareEmail || !modal.shareEmail.includes('@')}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Open Email App
                </button>
              </div>
            )}

            {/* Phone Input */}
            {modal.shareMethod === 'text' && (
              <div className="space-y-4">
                <button
                  onClick={() => onUpdateField({ shareMethod: 'select' })}
                  className="text-slate-400 hover:text-white text-sm flex items-center gap-1"
                >
                  &#8592; Back
                </button>
                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Agent&apos;s Phone Number
                  </label>
                  <input
                    type="tel"
                    value={modal.sharePhone}
                    onChange={(e) => onUpdateField({ sharePhone: e.target.value })}
                    placeholder="(555) 123-4567"
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 focus:border-green-500 focus:outline-none"
                    autoFocus
                  />
                </div>
                <button
                  onClick={onSendText}
                  disabled={!modal.sharePhone || modal.sharePhone.replace(/\D/g, '').length < 10}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Open Messages App
                </button>
              </div>
            )}

            {/* Copy Link */}
            {modal.shareMethod === 'copy' && (
              <div className="space-y-4">
                <button
                  onClick={() => onUpdateField({ shareMethod: 'select' })}
                  className="text-slate-400 hover:text-white text-sm flex items-center gap-1"
                >
                  &#8592; Back
                </button>
                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Referral Link
                  </label>
                  <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 break-all text-sm text-[#00BC7D] font-mono">
                    {modal.inviteUrl}
                  </div>
                </div>
                <button
                  onClick={onCopyLink}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                    modal.copied
                      ? 'bg-[#00BC7D] text-white'
                      : 'bg-[#00BC7D]/50 hover:bg-[#00BC7D] text-white'
                  }`}
                >
                  {modal.copied ? 'Copied!' : 'Copy to Clipboard'}
                </button>
              </div>
            )}

            {/* Done Button */}
            <button
              onClick={onClose}
              className="w-full mt-6 bg-slate-700 hover:bg-slate-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
