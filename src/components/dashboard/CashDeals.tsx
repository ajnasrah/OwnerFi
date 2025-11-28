'use client';

import { useState, useEffect } from 'react';

interface CashDeal {
  id: string;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  price: number;
  arv: number;
  percentOfArv: number;
  discount: number;
  beds: number;
  baths: number;
  sqft: number;
  imgSrc: string;
  url: string;
}

interface CashDealsProps {
  city: string;
  state: string;
}

export function CashDeals({ city, state }: CashDealsProps) {
  const [deals, setDeals] = useState<CashDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDeals();
  }, [city, state]);

  const fetchDeals = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (city) params.set('city', city);
      if (state) params.set('state', state);

      const res = await fetch(`/api/buyer/cash-deals?${params}`);
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setDeals([]);
      } else {
        setDeals(data.deals || []);
      }
    } catch (err: any) {
      setError(err.message);
      setDeals([]);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-700 border-t-emerald-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Finding cash deals near {city}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchDeals}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (deals.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-4xl mb-4">🏠</div>
          <h3 className="text-xl font-bold text-white mb-2">No Cash Deals Found</h3>
          <p className="text-slate-400">
            No properties under 80% ARV in <span className="text-emerald-400">{city}, {state}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <div className="mb-4">
        <p className="text-slate-400 text-sm">
          {deals.length} cash deal{deals.length !== 1 ? 's' : ''} under 80% ARV near {city}
        </p>
      </div>

      {/* Deals Grid */}
      <div className="grid grid-cols-1 gap-4">
        {deals.map((deal) => (
          <a
            key={deal.id}
            href={deal.url || `https://www.zillow.com/homes/${deal.address.replace(/\s+/g, '-')}_rb/`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-emerald-500/50 transition-all"
          >
            {/* Image */}
            <div className="relative h-40">
              {deal.imgSrc ? (
                <img
                  src={deal.imgSrc}
                  alt={deal.address}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                  <span className="text-4xl">🏠</span>
                </div>
              )}
              {/* Discount Badge */}
              <div className="absolute top-2 left-2 bg-emerald-600 text-white px-2 py-1 rounded-lg text-sm font-bold">
                {deal.percentOfArv}% of ARV
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              {/* Price Row */}
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-2xl font-bold text-white">
                  ${deal.price.toLocaleString()}
                </div>
                <div className="text-emerald-400 font-semibold">
                  ${deal.discount.toLocaleString()} below ARV
                </div>
              </div>

              {/* Address */}
              <div className="text-white font-medium mb-1 truncate">
                {deal.address}
              </div>
              <div className="text-slate-400 text-sm mb-3">
                {deal.city}, {deal.state} {deal.zipcode}
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">🛏️</span>
                  <span className="text-white font-medium">{deal.beds}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">🛁</span>
                  <span className="text-white font-medium">{deal.baths}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">📐</span>
                  <span className="text-white font-medium">{deal.sqft?.toLocaleString() || '—'} sqft</span>
                </div>
              </div>

              {/* ARV Info */}
              <div className="mt-3 pt-3 border-t border-slate-700 flex justify-between text-sm">
                <div>
                  <span className="text-slate-400">ARV: </span>
                  <span className="text-white font-medium">${deal.arv.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400">Equity: </span>
                  <span className="text-emerald-400 font-bold">{100 - deal.percentOfArv}%</span>
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
