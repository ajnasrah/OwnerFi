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

/**
 * Days remaining until `expirationDate`. Negative = already expired.
 * Returns null if the field isn't present/parseable on legacy docs.
 */
function daysUntilExpiry(value: unknown): number | null {
  if (!value) return null;
  try {
    const d = typeof value === 'string' ? new Date(value)
      : value instanceof Date ? value
      : typeof (value as { toDate?: unknown }).toDate === 'function' ? (value as { toDate: () => Date }).toDate()
      : null;
    if (!d || isNaN(d.getTime())) return null;
    return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function ExpiryBadge({ days }: { days: number | null }) {
  if (days === null) return null;
  if (days < 0) {
    return <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-[10px] font-medium">Expired</span>;
  }
  if (days <= 14) {
    return <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded text-[10px] font-medium">{days}d left</span>;
  }
  if (days <= 30) {
    return <span className="bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded text-[10px] font-medium">{days}d left</span>;
  }
  return <span className="text-slate-500 text-[10px]">{days}d left</span>;
}

async function openAgreementInNewTab(agreementId: string) {
  const res = await fetch(`/api/realtor/agreements?id=${agreementId}`);
  const data = await res.json();
  if (!data.success || !data.agreementHTML) {
    console.warn('Failed to load agreement:', data.error || 'No agreement HTML returned');
    return;
  }
  const win = window.open('', '_blank');
  if (!win) {
    console.warn('Pop-up blocked: unable to open agreement in a new tab.');
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
              <div key={agreement.id} className={`rounded-lg p-4 ${agreement.buyerRevokedAt ? 'bg-red-500/10 border border-red-500/50' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
                {agreement.buyerRevokedAt && (
                  <div className="mb-3 bg-red-500/15 border border-red-500/40 rounded p-3 text-xs">
                    <div className="font-bold text-red-400 mb-1">BUYER REVOKED CONSENT — DO NOT SIGN</div>
                    <div className="text-red-300">
                      This buyer opted out of communications on {new Date(agreement.buyerRevokedAt).toLocaleDateString()}
                      {agreement.buyerRevocationChannel ? ` (via ${agreement.buyerRevocationChannel})` : ''}.
                      Cancel this agreement instead of signing — they do not want to be contacted.
                    </div>
                  </div>
                )}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-white font-bold">
                      {agreement.buyerFirstName} {agreement.buyerLastName}
                    </h4>
                    <p className="text-slate-400 text-sm">{agreement.buyerCity}, {agreement.buyerState}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${agreement.buyerRevokedAt ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {agreement.buyerRevokedAt ? 'Revoked' : 'Pending'}
                  </span>
                </div>
                <p className="text-slate-500 text-xs mb-3">#{agreement.agreementNumber}</p>
                {!agreement.buyerRevokedAt && (
                  <button
                    onClick={() => onCompletePendingSignature(agreement)}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black py-2 px-4 rounded-lg font-medium transition-colors"
                  >
                    Complete Signature
                  </button>
                )}
                <button
                  onClick={async () => {
                    if (!window.confirm('Cancel this pending agreement? The lead will be released for other realtors.')) return;
                    const res = await fetch('/api/realtor/agreements/void', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ agreementId: agreement.id, reason: 'canceled by realtor before signing' }),
                    });
                    if (res.ok) window.location.reload();
                    else {
                      const data = await res.json().catch(() => ({ error: 'Failed' }));
                      window.alert(data.error || 'Failed to cancel');
                    }
                  }}
                  className="w-full mt-2 text-xs text-red-400 hover:text-red-300 py-1 transition-colors"
                >
                  Cancel &amp; release lead
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
              <div key={agreement.id} className={`bg-slate-800/50 border rounded-lg p-4 ${agreement.buyerRevokedAt ? 'border-red-500/60' : 'border-[#00BC7D]/30'}`}>
                {agreement.buyerRevokedAt && (
                  <div className="mb-3 bg-red-500/15 border border-red-500/40 rounded p-3 text-xs">
                    <div className="font-bold text-red-400 mb-1">BUYER REVOKED CONSENT — DO NOT CONTACT</div>
                    <div className="text-red-300">
                      This buyer opted out of communications on {new Date(agreement.buyerRevokedAt).toLocaleDateString()}
                      {agreement.buyerRevocationChannel ? ` (via ${agreement.buyerRevocationChannel})` : ''}.
                      Do not call, text, or email them. Continuing contact is a TCPA violation.
                    </div>
                  </div>
                )}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-white font-bold">
                      {agreement.buyerFirstName} {agreement.buyerLastName}
                    </h4>
                    <p className="text-slate-400 text-sm">{agreement.buyerCity}, {agreement.buyerState}</p>
                    {agreement.buyerPhone && !agreement.buyerRevokedAt && (
                      <p className="text-[#00BC7D] text-sm font-medium">{agreement.buyerPhone}</p>
                    )}
                    {agreement.buyerEmail && !agreement.buyerRevokedAt && (
                      <p className="text-[#00BC7D] text-sm">{agreement.buyerEmail}</p>
                    )}
                  </div>
                  <span className="bg-[#00BC7D]/20 text-[#00BC7D] px-2 py-1 rounded text-xs font-medium">
                    Active
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-3 border-t border-slate-700">
                  <span>#{agreement.agreementNumber}</span>
                  <div className="flex items-center gap-2">
                    <span>{agreement.referralFeePercent}% referral fee</span>
                    <ExpiryBadge days={daysUntilExpiry(agreement.expirationDate)} />
                  </div>
                </div>
                {/* Text/Email CTAs — suppressed entirely when the buyer has
                    revoked consent so the href can't be used to bypass the
                    "DO NOT CONTACT" banner above. */}
                {!agreement.buyerRevokedAt && (agreement.buyerPhone || agreement.buyerEmail) && (
                  <div className="flex gap-2 mt-3">
                    {agreement.buyerPhone && (
                      <a
                        href={`sms:${agreement.buyerPhone}?body=${encodeURIComponent("Hi, I see you're interested in owner-financed properties. How is everything going so far?")}`}
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
                <button
                  onClick={async () => {
                    const reason = window.prompt('Optional: why are you voiding this agreement?');
                    if (reason === null) return; // user cancelled prompt (fix: previous code used `|| ''` which broke this guard)
                    if (!window.confirm('Void this agreement? The buyer will be released back to the available pool. This cannot be undone.')) return;
                    const res = await fetch('/api/realtor/agreements/void', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ agreementId: agreement.id, reason }),
                    });
                    if (res.ok) {
                      window.location.reload();
                    } else {
                      const data = await res.json().catch(() => ({ error: 'Failed to void' }));
                      window.alert(data.error || 'Failed to void the agreement');
                    }
                  }}
                  className="w-full mt-2 text-xs text-red-400 hover:text-red-300 py-1 transition-colors"
                >
                  Void agreement
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
