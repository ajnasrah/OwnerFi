'use client';

import { useState } from 'react';
import { OwnedBuyer, Agreement } from '../types';

interface OwnedLeadsTabProps {
  ownedBuyers: OwnedBuyer[];
  agreements: Agreement[];
  onOpenDispute: (buyer: OwnedBuyer) => void;
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

export function OwnedLeadsTab({ ownedBuyers, agreements, onOpenDispute }: OwnedLeadsTabProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  if (ownedBuyers.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">&#128101;</div>
        <h3 className="text-xl font-bold text-white mb-2">No leads yet</h3>
        <p className="text-slate-400">Leads you accept will appear here for ongoing communication.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {ownedBuyers.map((buyer) => (
        <div key={buyer.id} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="text-white font-bold text-lg">
                {buyer.firstName} {buyer.lastName}
              </h4>
              <p className="text-slate-400 text-sm">{buyer.city}, {buyer.state}</p>
              <p className="text-[#00BC7D] text-sm font-medium">{buyer.phone}</p>
              <p className="text-[#00BC7D] text-sm font-medium">{buyer.email}</p>
            </div>
            <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs font-medium">
              Owned
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const searchQuery = `${buyer.firstName} ${buyer.lastName} ${buyer.city} ${buyer.state} real estate owner financing`;
                  window.open(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, '_blank');
                }}
                className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
              >
                View More Details
              </button>
              <a
                href={`sms:${buyer.phone}?body=${encodeURIComponent("Hi, I see you're interested in owner finance properties through Ownerfi, how is everything going so far?")}`}
                className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 py-2 px-3 rounded-lg text-sm font-medium transition-colors text-center"
              >
                Text
              </a>
            </div>
            {(() => {
              const agreement = agreements.find(a => a.buyerId === buyer.id && a.status === 'signed');
              if (!agreement) return null;
              const expiresDate = new Date(agreement.expirationDate);
              const daysLeft = Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              const isExpiring = daysLeft <= 30 && daysLeft > 0;
              const isExpired = daysLeft <= 0;
              return (
                <>
                  <div className={`text-xs px-3 py-1.5 rounded-lg ${
                    isExpired ? 'bg-red-500/10 text-red-400' :
                    isExpiring ? 'bg-yellow-500/10 text-yellow-400' :
                    'bg-slate-700/50 text-slate-400'
                  }`}>
                    {isExpired
                      ? `Agreement expired ${expiresDate.toLocaleDateString()}`
                      : `Agreement expires ${expiresDate.toLocaleDateString()} (${daysLeft} days left)`}
                  </div>
                  <button
                    onClick={async () => {
                      setLoadingId(agreement.id);
                      await openAgreementInNewTab(agreement.id);
                      setLoadingId(null);
                    }}
                    disabled={loadingId === agreement.id}
                    className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 px-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {loadingId === agreement.id ? 'Loading...' : 'View Agreement'}
                  </button>
                </>
              );
            })()}
            <button
              onClick={() => onOpenDispute(buyer)}
              className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
            >
              Dispute
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
