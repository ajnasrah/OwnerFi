'use client';

import { DisputeModalState } from '../types';

interface DisputeModalProps {
  modal: DisputeModalState;
  onUpdateField: (updates: Partial<DisputeModalState>) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function DisputeModal({ modal, onUpdateField, onSubmit, onClose }: DisputeModalProps) {
  if (!modal.buyer) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Dispute Lead</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl"
          >
            x
          </button>
        </div>

        {modal.success ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-[#00BC7D]/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl text-[#00BC7D]">&#10003;</span>
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Dispute Submitted</h4>
            <p className="text-slate-400 text-sm mb-4">
              We&apos;ll review your dispute for {modal.buyer.firstName} {modal.buyer.lastName} and follow up via email.
            </p>
            <button
              onClick={onClose}
              className="w-full bg-[#00BC7D]/50 hover:bg-[#00BC7D] text-white py-2 px-4 rounded-lg font-medium transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <div className="text-white font-medium mb-1">
                {modal.buyer.firstName} {modal.buyer.lastName}
              </div>
              <div className="text-slate-400 text-sm">
                {modal.buyer.city}, {modal.buyer.state}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-white text-sm font-medium mb-2">Reason</label>
                <select
                  value={modal.reason}
                  onChange={(e) => onUpdateField({ reason: e.target.value })}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white"
                >
                  <option value="" disabled>Select reason</option>
                  <option value="no_response">No response</option>
                  <option value="invalid_contact">Invalid contact info</option>
                  <option value="not_qualified">Not qualified</option>
                  <option value="already_working">Already working with another agent</option>
                  <option value="false_information">False information</option>
                  <option value="duplicate">Duplicate lead</option>
                  <option value="not_interested">Not interested</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-white text-sm font-medium mb-2">Description</label>
                <textarea
                  value={modal.description}
                  onChange={(e) => onUpdateField({ description: e.target.value })}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white h-24 resize-none"
                  placeholder="Please provide details about the issue..."
                />
              </div>

              {modal.error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-3 py-2">
                  {modal.error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onSubmit}
                  disabled={!modal.reason || !modal.description || modal.submitting}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {modal.submitting ? 'Submitting...' : 'Submit Dispute'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
