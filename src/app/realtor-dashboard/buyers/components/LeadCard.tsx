'use client';

import Link from 'next/link';
import { BuyerLead, Agreement } from '../types';

const FREE_LIMIT = 3;

interface LeadCardProps {
  lead: BuyerLead;
  pendingAgreements: Agreement[];
  signedAgreements: Agreement[];
  hasCredits: boolean;
  pendingCount: number;
  onAcceptLead: (leadId: string, buyerName: string) => void;
  onViewAgreements: () => void;
}

export function LeadCard({
  lead,
  pendingAgreements,
  signedAgreements,
  hasCredits,
  pendingCount,
  onAcceptLead,
  onViewAgreements,
}: LeadCardProps) {
  const atLimit = pendingCount >= FREE_LIMIT && !hasCredits;

  const hasPendingAgreement = pendingAgreements.some(
    a => a.buyerId ? a.buyerId === lead.id : (a.buyerFirstName === lead.firstName && a.buyerLastName === lead.lastName && a.buyerCity === lead.city && a.buyerState === lead.state)
  );
  const hasSignedAgreement = signedAgreements.some(
    a => a.buyerId ? a.buyerId === lead.id : (a.buyerFirstName === lead.firstName && a.buyerLastName === lead.lastName && a.buyerCity === lead.city && a.buyerState === lead.state)
  );

  let statusLabel = 'Available';
  let statusColor = 'bg-[#00BC7D]/20 text-[#00BC7D]';
  if (hasSignedAgreement) {
    statusLabel = 'Accepted';
    statusColor = 'bg-blue-500/20 text-blue-400';
  } else if (hasPendingAgreement) {
    statusLabel = 'Pending';
    statusColor = 'bg-yellow-500/20 text-yellow-400';
  }

  return (
    <div className={`bg-slate-800/50 border rounded-lg p-4 ${
      hasSignedAgreement ? 'border-blue-500/30' :
      hasPendingAgreement ? 'border-yellow-500/30' :
      'border-slate-700/50'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-white font-bold text-lg">
            {lead.firstName} {lead.lastName}
          </h4>
          <p className="text-slate-400 text-sm">{lead.city}, {lead.state}</p>
          {lead.matchScore != null && lead.matchScore > 0 && (
            <p className="text-[#00BC7D] text-xs mt-1">
              {lead.matchScore}% match
              {lead.likedPropertiesCount ? ` • ${lead.likedPropertiesCount} liked` : ''}
            </p>
          )}
        </div>
        <span className={`${statusColor} px-2 py-1 rounded text-xs font-medium`}>
          {statusLabel}
        </span>
      </div>

      {hasSignedAgreement ? (
        <button
          onClick={onViewAgreements}
          className="w-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 py-2 px-4 rounded-lg font-medium transition-colors"
        >
          View Agreement
        </button>
      ) : hasPendingAgreement ? (
        <button
          onClick={onViewAgreements}
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-black py-2 px-4 rounded-lg font-medium transition-colors"
        >
          Complete Signature
        </button>
      ) : atLimit ? (
        <Link
          href="/buy-credits"
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-black py-2 px-4 rounded-lg font-medium transition-colors block text-center"
        >
          Buy Credits to Accept
        </Link>
      ) : (
        <button
          onClick={() => onAcceptLead(lead.id, `${lead.firstName} ${lead.lastName}`)}
          className="w-full bg-[#00BC7D]/50 hover:bg-[#00BC7D] text-white py-2 px-4 rounded-lg font-medium transition-colors"
        >
          Accept Lead
        </button>
      )}
    </div>
  );
}
