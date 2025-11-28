'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ExtendedSession, isExtendedSession } from '@/types/session';

import { PropertyListing } from '@/lib/property-schema';

type Property = PropertyListing & {
  isLiked: boolean;
  zillowImageUrl?: string;
  imageUrl?: string;
};


export default function LikedProperties() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Auth check - allow all authenticated users (buyer, admin, realtor)
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth');
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

  if (loading) {
    return (
      <div className="h-screen overflow-hidden bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <div className="text-2xl font-bold text-white mb-2">LOADING SAVED HOMES</div>
          <p className="text-slate-400 font-medium">Finding your liked properties...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto bg-slate-900">
      {/* Header with Navigation */}
      <header className="relative z-20 bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-white">SAVED HOMES</h1>
            <p className="text-sm text-slate-400 mt-1 font-semibold">
              {properties.length} SAVED {properties.length === 1 ? 'PROPERTY' : 'PROPERTIES'}
            </p>
          </div>

          {/* Mobile Navigation Buttons */}
          <div className="md:hidden flex gap-2">
            <Link
              href="/dashboard"
              className="bg-slate-600 hover:bg-slate-500 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
            >
              <span>←</span>
              <span>Back</span>
            </Link>
            <Link
              href="/how-owner-finance-works"
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
            >
              <span>📚</span>
              <span>Learn</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-6">
            <div className="flex space-x-4">
              <Link href="/dashboard" className="flex flex-col items-center group">
                <div className="w-12 h-12 bg-slate-700/50 hover:bg-slate-600/50 rounded-xl flex items-center justify-center transition-colors group-hover:scale-110">
                  <span className="text-slate-300 text-xl">🏠</span>
                </div>
                <span className="text-xs font-bold text-slate-400 mt-1">BROWSE</span>
              </Link>

              <Link href="/dashboard/liked" className="flex flex-col items-center group">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <span className="text-white text-xl">♥</span>
                </div>
                <span className="text-xs font-bold text-emerald-400 mt-1">SAVED</span>
              </Link>

              <Link href="/dashboard/settings" className="flex flex-col items-center group">
                <div className="w-12 h-12 bg-slate-700/50 hover:bg-slate-600/50 rounded-xl flex items-center justify-center transition-colors group-hover:scale-110">
                  <span className="text-slate-300 text-xl">⚙</span>
                </div>
                <span className="text-xs font-bold text-slate-400 mt-1">SETTINGS</span>
              </Link>
            </div>

            <button
              onClick={() => signOut({ callbackUrl: '/auth/signout' })}
              className="flex flex-col items-center group"
            >
              <div className="w-12 h-12 bg-slate-700/50 hover:bg-red-600/30 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 duration-300">
                <span className="text-slate-300 group-hover:text-red-400 text-xl transition-colors">⏻</span>
              </div>
              <span className="text-xs font-bold text-slate-400 group-hover:text-red-400 mt-1 transition-colors">LOGOUT</span>
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 pb-8 pt-6">
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
                      <div className="bg-emerald-600 text-white px-2 py-1 rounded-lg text-xs font-bold">
                        Owner Finance
                      </div>
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
                        Property info from listing agent • OwnerFi does not verify • Conduct your own due diligence
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => removeLike(property.id)}
                        className="bg-red-600/20 hover:bg-red-600/30 text-red-400 py-2 px-3 rounded-lg transition-all hover:scale-105 font-bold border border-red-500/30 text-sm"
                      >
                        REMOVE
                      </button>

                      <button
                        onClick={() => {
                          const message = `I'm interested in the property at ${property.address}, ${property.city}, ${property.state}. Found through OwnerFi.`;
                          window.open(`sms:+1234567890&body=${encodeURIComponent(message)}`, '_self');
                        }}
                        className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-2 px-3 rounded-lg transition-all hover:scale-105 font-bold text-sm"
                      >
                        CONTACT
                      </button>

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
                href="/dashboard"
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 rounded-xl font-bold text-lg transition-all duration-300 hover:scale-105 shadow-2xl shadow-emerald-500/25"
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
