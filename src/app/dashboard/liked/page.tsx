'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { PropertyListing } from '@/lib/property-schema';

type Property = PropertyListing & {
  isLiked: boolean;
  zillowImageUrl?: string;
  imageUrl?: string;
};


export default function LikedProperties() {
  const { status } = useSession();
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isInvestor, setIsInvestor] = useState(false);

  // Auth check - allow all authenticated users (buyer, admin, realtor)
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth');
    }
  }, [status, router]);

  // Load liked properties - works for all authenticated users
  useEffect(() => {
    if (status === 'authenticated') {
      loadLikedProperties();
    }
  }, [status]);

  const loadLikedProperties = async () => {
    try {
      setLoading(true);

      // Check if user is an investor (for back-link routing)
      fetch('/api/buyer/profile').then(r => r.ok ? r.json() : null).then(data => {
        if (data?.profile?.isInvestor === true) setIsInvestor(true);
      }).catch(() => {});

      const response = await fetch('/api/buyer/liked-properties');
      const result = await response.json();

      if (result.error) {
        setError(result.error);
      } else if (result.success && result.data) {
        // API returns { success: true, data: { likedProperties: [...] } }
        setProperties(result.data.likedProperties || []);
      } else {
        // Fallback for legacy format
        setProperties(result.likedProperties || []);
      }

    } catch {
      setError('Failed to load your liked properties');
    } finally {
      setLoading(false);
    }
  };

  const removeLike = async (propertyId: string) => {
    try {
      const response = await fetch('/api/buyer/like-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, action: 'unlike' })
      });

      if (response.ok) {
        setProperties(prev => prev.filter(p => p.id !== propertyId));
      }
    } catch {
    }
  };

  // Format property type for display
  const formatPropertyType = (type: string) => {
    const types: Record<string, string> = {
      'single-family': 'Single Family',
      'condo': 'Condo',
      'townhouse': 'Townhouse',
      'mobile-home': 'Mobile Home',
      'multi-family': 'Multi-Family',
      'land': 'Land'
    };
    return types[type] || type;
  };

  // Format lot size
  const formatLotSize = (lotSize?: number) => {
    if (!lotSize) return null;
    if (lotSize >= 43560) {
      return `${(lotSize / 43560).toFixed(2)} acres`;
    }
    return `${lotSize.toLocaleString()} sq ft`;
  };

  // Build a working Zillow URL. property.id is prefixed (e.g. "zpid_2067830274")
  // so naively appending "_zpid" doubles the prefix and breaks the link.
  const buildZillowUrl = (property: Property & { url?: string; zpid?: string | number }) => {
    if (property.url) {
      return property.url.startsWith('http') ? property.url : `https://www.zillow.com${property.url.startsWith('/') ? '' : '/'}${property.url}`;
    }
    const zpid = property.zpid ?? (typeof property.id === 'string' ? property.id.replace(/^zpid_/, '') : property.id);
    return `https://www.zillow.com/homedetails/${zpid}_zpid/`;
  };

  if (loading) {
    return (
      <div className="h-screen overflow-hidden bg-[#111625] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#00BC7D] border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <div className="text-2xl font-bold text-white mb-2">LOADING SAVED HOMES</div>
          <p className="text-slate-400 font-medium">Finding your liked properties...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto bg-[#111625]">
      {/* Page Title */}
      <div className="px-6 py-4">
        <h1 className="text-xl font-black text-white">SAVED HOMES</h1>
        <p className="text-sm text-slate-400 mt-1 font-semibold">
          {properties.length} SAVED {properties.length === 1 ? 'PROPERTY' : 'PROPERTIES'}
        </p>
      </div>

      <main className="px-4 pb-20 md:pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Error State */}
          {error && (
            <div className="bg-red-600/20 backdrop-blur-lg border border-red-500/30 rounded-xl p-4 mb-6">
              <p className="text-red-300 font-semibold">{error}</p>
            </div>
          )}

          {/* Liked Properties Grid */}
          {properties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => (
                <div key={property.id} className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
                  {/* Property Image */}
                  <div className="w-full h-48 bg-slate-700 overflow-hidden relative">
                    <img
                      src={
                        property.imageUrl ||
                        property.imageUrls?.[0] ||
                        property.zillowImageUrl ||
                        '/placeholder-house.jpg'
                      }
                      alt={property.address}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/placeholder-house.jpg';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>

                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex gap-2">
                      <div className="bg-blue-600 text-white px-2 py-1 rounded-lg text-xs font-bold">
                        {formatPropertyType(property.propertyType)}
                      </div>
                      {(property as any).source === 'cash_deal' ? (
                        <div className="bg-amber-600 text-white px-2 py-1 rounded-lg text-xs font-bold">
                          Cash Deal
                        </div>
                      ) : (
                        <div className="bg-[#00BC7D] text-white px-2 py-1 rounded-lg text-xs font-bold">
                          Owner Finance
                        </div>
                      )}
                    </div>
                    <div className="absolute top-3 right-3 bg-gradient-to-r from-red-500 to-red-600 text-white px-3 py-2 rounded-xl text-sm font-bold shadow-xl border border-red-400/30">
                      ❤️ SAVED
                    </div>
                  </div>

                  <div className="p-6">
                    {/* Price */}
                    <div className="mb-2">
                      <div className="text-2xl font-black text-white">
                        ${property.listPrice?.toLocaleString()}
                      </div>
                      {property.pricePerSqFt && (
                        <div className="text-slate-400 text-xs">
                          ${property.pricePerSqFt.toLocaleString()}/sq ft
                        </div>
                      )}
                    </div>

                    {/* Address */}
                    <h3 className="text-lg font-bold text-white mb-1">
                      {property.address.toUpperCase()}
                    </h3>
                    <p className="text-slate-300 mb-4 font-semibold">
                      {property.city}, {property.state} {property.zipCode}
                    </p>

                    {/* Quick Stats */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <div className="flex items-center gap-1 bg-slate-700/50 rounded-lg px-2 py-1">
                        <span className="text-xs">🛏️</span>
                        <span className="text-sm font-bold text-white">{property.bedrooms}</span>
                        <span className="text-[10px] text-slate-400">beds</span>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-700/50 rounded-lg px-2 py-1">
                        <span className="text-xs">🚿</span>
                        <span className="text-sm font-bold text-white">{property.bathrooms}</span>
                        <span className="text-[10px] text-slate-400">baths</span>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-700/50 rounded-lg px-2 py-1">
                        <span className="text-xs">📏</span>
                        <span className="text-sm font-bold text-white">{property.squareFeet?.toLocaleString() || 'N/A'}</span>
                        <span className="text-[10px] text-slate-400">sq ft</span>
                      </div>
                      {property.yearBuilt && (
                        <div className="flex items-center gap-1 bg-slate-700/50 rounded-lg px-2 py-1">
                          <span className="text-xs">📅</span>
                          <span className="text-sm font-bold text-white">{property.yearBuilt}</span>
                          <span className="text-[10px] text-slate-400">built</span>
                        </div>
                      )}
                    </div>

                    {/* Property Details */}
                    <div className="space-y-2 mb-4">
                      {formatLotSize(property.lotSize) && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-400">Lot Size:</span>
                          <span className="font-semibold text-white">{formatLotSize(property.lotSize)}</span>
                        </div>
                      )}
                      {property.garage && property.garage > 0 && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-400">Garage:</span>
                          <span className="font-semibold text-white">{property.garage} car</span>
                        </div>
                      )}
                      {property.stories && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-400">Stories:</span>
                          <span className="font-semibold text-white">{property.stories}</span>
                        </div>
                      )}
                    </div>

                    {/* Third-Party Estimates */}
                    {(property.estimatedValue || property.rentZestimate) && (
                      <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-3 mb-4">
                        <div className="text-[9px] text-purple-300 mb-2">
                          Third-party estimates • No guarantee • Verify independently
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {property.estimatedValue && property.estimatedValue > 0 && (
                            <div>
                              <div className="text-[10px] text-purple-300">Est. Home Value</div>
                              <div className="text-sm font-bold text-purple-200">
                                ${property.estimatedValue.toLocaleString()}
                              </div>
                            </div>
                          )}
                          {property.rentZestimate && property.rentZestimate > 0 && (
                            <div>
                              <div className="text-[10px] text-purple-300">Est. Monthly Rent</div>
                              <div className="text-sm font-bold text-purple-200">
                                ${property.rentZestimate.toLocaleString()}/mo
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* HOA & Taxes */}
                    {(property.hoa?.hasHOA || property.taxes?.annualAmount) && (
                      <div className="bg-amber-900/30 border border-amber-500/30 rounded-lg p-3 mb-4">
                        <div className="text-[9px] text-amber-300 mb-2">
                          Third-party source • No estimate guarantee
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {property.hoa?.hasHOA && (
                            <div>
                              <div className="text-[10px] text-amber-300">HOA Fee</div>
                              <div className="text-sm font-bold text-amber-200">
                                {property.hoa.monthlyFee ? `$${property.hoa.monthlyFee}/mo` : 'Yes'}
                              </div>
                            </div>
                          )}
                          {property.taxes?.annualAmount && (
                            <div>
                              <div className="text-[10px] text-amber-300">Annual Taxes</div>
                              <div className="text-sm font-bold text-amber-200">
                                ${property.taxes.annualAmount.toLocaleString()}/yr
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Disclaimer */}
                    <div className="text-center bg-slate-700/30 rounded p-2 mb-4">
                      <p className="text-slate-400 text-[10px]">
                        Property info from listing agent • Ownerfi does not verify • Conduct your own due diligence
                      </p>
                    </div>

                    {/* Chat CTA */}
                    <button
                      onClick={() => {
                        // Dispatch event to open chatbot with property context
                        window.dispatchEvent(new CustomEvent('openChatbot', {
                          detail: { message: `I'm interested in the property at ${property.address}, ${property.city}, ${property.state} (listed at $${property.listPrice?.toLocaleString()}). Can you tell me more about it?` }
                        }));
                      }}
                      className="w-full mb-3 bg-gradient-to-r from-[#00BC7D]/50 to-[#00BC7D] hover:from-[#00BC7D] hover:to-[#00BC7D]/50 active:from-[#009B66] active:to-[#007A52] text-white py-3 px-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#00BC7D]/20"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      ASK ABOUT THIS PROPERTY
                    </button>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => removeLike(property.id)}
                        className="bg-red-600/20 hover:bg-red-600/30 text-red-400 py-2 px-3 rounded-lg transition-all hover:scale-105 font-bold border border-red-500/30 text-sm"
                      >
                        REMOVE
                      </button>

                      <a
                        href={buildZillowUrl(property)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-gradient-to-r from-[#00BC7D]/50 to-[#00BC7D] hover:from-[#00BC7D] hover:to-[#00BC7D]/50 text-white py-2 px-3 rounded-lg transition-all hover:scale-105 font-bold text-sm text-center"
                      >
                        ZILLOW
                      </a>

                      <button
                        onClick={() => {
                          const searchQuery = `${property.address}, ${property.city}, ${property.state}`;
                          window.open(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, '_blank');
                        }}
                        className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 py-2 px-3 rounded-lg transition-all hover:scale-105 font-bold text-sm border border-blue-500/30"
                      >
                        MORE INFO
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-slate-700/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">💔</span>
              </div>
              <h3 className="text-2xl font-black text-white mb-4">NO SAVED PROPERTIES</h3>
              <p className="text-slate-300 mb-8 font-medium text-lg">
                Start browsing and save properties you like to see them here.
              </p>
              <Link
                href={isInvestor ? '/dashboard/investor' : '/dashboard'}
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-[#00BC7D]/50 to-[#00BC7D] hover:from-[#00BC7D] hover:to-[#00BC7D]/50 rounded-xl font-bold text-lg transition-all duration-300 hover:scale-105 shadow-2xl shadow-[#00BC7D]/25"
              >
                BROWSE PROPERTIES
                <svg className="ml-2 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      </main>

    </div>
  );
}
