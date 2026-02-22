'use client';

import { OwnedBuyer } from '../types';

interface OwnedLeadsTabProps {
  ownedBuyers: OwnedBuyer[];
  onOpenDispute: (buyer: OwnedBuyer) => void;
}

export function OwnedLeadsTab({ ownedBuyers, onOpenDispute }: OwnedLeadsTabProps) {
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
              <p className="text-emerald-400 text-sm font-medium">{buyer.phone}</p>
              <p className="text-emerald-400 text-sm font-medium">{buyer.email}</p>
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
                href={`sms:${buyer.phone}?body=${encodeURIComponent("Hi, I see you're interested in owner finance properties through OwnerFi, how is everything going so far?")}`}
                className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 py-2 px-3 rounded-lg text-sm font-medium transition-colors text-center"
              >
                Text
              </a>
            </div>
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
