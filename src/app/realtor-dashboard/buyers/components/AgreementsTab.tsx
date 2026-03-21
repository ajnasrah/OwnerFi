'use client';

import { useState } from 'react';
import { Agreement } from '../types';

interface AgreementsTabProps {
  agreements: Agreement[];
  pendingAgreements: Agreement[];
  signedAgreements: Agreement[];
  onCompletePendingSignature: (agreement: Agreement) => void;
  onOpenReferralModal: (agreement: Agreement) => void;
}

async function openAgreementInNewTab(agreementId: string) {
  const res = await fetch(`/api/realtor/agreements?id=${agreementId}`);
  const data = await res.json();
  if (!data.success || !data.agreementHTML) {
    alert('Failed to load agreement. Please try again.');
    return;
  }
  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow pop-ups to view the agreement.');
    return;
  }
  win.document.write(`<!DOCTYPE html><html><head><title>Referral Agreement</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px}@media print{button{display:none!important}}</style></head><body>${data.agreementHTML}<div style="text-align:center;margin-top:24px"><button onclick="window.print()" style="padding:10px 24px;font-size:16px;cursor:pointer;background:#00BC7D;color:white;border:none;border-radius:8px">Print / Save as PDF</button></div></body></html>`);
  win.document.close();
}

export function AgreementsTab({
  agreements,
  pendingAgreements,
  signedAgreements,
  onCompletePendingSignature,
  onOpenReferralModal,
}: AgreementsTabProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  if (agreements.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">&#128196;</div>
        <h3 className="text-xl font-bold text-white mb-2">No agreements yet</h3>
        <p className="text-slate-400">When you accept a lead, your referral agreement will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pending Agreements */}
      {pendingAgreements.length > 0 && (
        <div className="mb-6">
          <h3 className="text-yellow-400 font-semibold mb-3">Pending Signature</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {pendingAgreements.map((agreement) => (
              <div key={agreement.id} className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-white font-bold">
                      {agreement.buyerFirstName} {agreement.buyerLastName}
                    </h4>
                    <p className="text-slate-400 text-sm">{agreement.buyerCity}, {agreement.buyerState}</p>
                  </div>
                  <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs font-medium">
                    Pending
                  </span>
                </div>
                <p className="text-slate-500 text-xs mb-3">#{agreement.agreementNumber}</p>
                <button
                  onClick={() => onCompletePendingSignature(agreement)}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-black py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Complete Signature
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signed Agreements */}
      {signedAgreements.length > 0 && (
        <div>
          <h3 className="text-[#00BC7D] font-semibold mb-3">Active Agreements</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {signedAgreements.map((agreement) => (
              <div key={agreement.id} className="bg-slate-800/50 border border-[#00BC7D]/30 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-white font-bold">
                      {agreement.buyerFirstName} {agreement.buyerLastName}
                    </h4>
                    <p className="text-slate-400 text-sm">{agreement.buyerCity}, {agreement.buyerState}</p>
                    {agreement.buyerPhone && (
                      <p className="text-[#00BC7D] text-sm font-medium">{agreement.buyerPhone}</p>
                    )}
                    {agreement.buyerEmail && (
                      <p className="text-[#00BC7D] text-sm">{agreement.buyerEmail}</p>
                    )}
                  </div>
                  <span className="bg-[#00BC7D]/20 text-[#00BC7D] px-2 py-1 rounded text-xs font-medium">
                    Active
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-3 border-t border-slate-700">
                  <span>#{agreement.agreementNumber}</span>
                  <span>{agreement.referralFeePercent}% referral fee</span>
                </div>
                {(agreement.buyerPhone || agreement.buyerEmail) && (
                  <div className="flex gap-2 mt-3">
                    {agreement.buyerPhone && (
                      <a
                        href={`sms:${agreement.buyerPhone}?body=${encodeURIComponent("Hi, I see you're interested in owner finance properties through Ownerfi, how is everything going so far?")}`}
                        className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 py-2 px-3 rounded-lg text-sm font-medium transition-colors text-center"
                      >
                        Text
                      </a>
                    )}
                    {agreement.buyerEmail && (
                      <a
                        href={`mailto:${agreement.buyerEmail}`}
                        className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 py-2 px-3 rounded-lg text-sm font-medium transition-colors text-center"
                      >
                        Email
                      </a>
                    )}
                  </div>
                )}
                {/* View Agreement button */}
                <button
                  onClick={async () => {
                    setLoadingId(agreement.id);
                    await openAgreementInNewTab(agreement.id);
                    setLoadingId(null);
                  }}
                  disabled={loadingId === agreement.id}
                  className="w-full mt-2 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 px-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loadingId === agreement.id ? 'Loading...' : 'View Agreement'}
                </button>
                {/* Refer button */}
                {!agreement.isReReferral && agreement.canBeReReferred !== false && (
                  <button
                    onClick={() => onOpenReferralModal(agreement)}
                    className={`w-full mt-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      agreement.hasActiveInvite
                        ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                        : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400'
                    }`}
                  >
                    {agreement.hasActiveInvite
                      ? `View Invite Link (${agreement.referralInviteFeePercent}% fee)`
                      : 'Refer to Another Agent'}
                  </button>
                )}
                {agreement.isReReferral && (
                  <div className="mt-2 text-xs text-slate-500 text-center">
                    This is a referred lead (cannot be re-referred)
                  </div>
                )}
                {!agreement.isReReferral && agreement.canBeReReferred === false && (
                  <div className="mt-2 text-xs text-[#00BC7D] text-center">
                    Already referred to another agent
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
