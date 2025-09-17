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

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated' && isExtendedSession(session as unknown as ExtendedSession) && (session as unknown as ExtendedSession)?.user?.role !== 'buyer') {
      router.push('/auth/signin');
    }
  }, [status, session, router]);

  // Load liked properties
  useEffect(() => {
    if (status === 'authenticated' && isExtendedSession(session as unknown as ExtendedSession) && (session as unknown as ExtendedSession)?.user?.role === 'buyer') {
      loadLikedProperties();
    }
  }, [status, session]);

  const loadLikedProperties = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/buyer/liked-properties');
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setProperties(data.likedProperties || []);
        // setProfile(data.profile); // TODO: Define setProfile function
        
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <div className="text-2xl font-bold text-white mb-2">LOADING SAVED HOMES</div>
          <p className="text-slate-400 font-medium">Finding your liked properties...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header with Navigation */}
      <header className="relative z-20 bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-white">SAVED HOMES</h1>
            <p className="text-sm text-slate-400 mt-1 font-semibold">
              {properties.length} SAVED {properties.length === 1 ? 'PROPERTY' : 'PROPERTIES'}
            </p>
          </div>

          {/* Mobile Owner Finance Help Button */}
          <div className="md:hidden">
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
              onClick={() => signOut({ callbackUrl: '/' })}
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
                        property.imageUrls?.[0] ||
                        property.zillowImageUrl ||
                        property.imageUrl ||
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
                    <div className="absolute top-3 right-3 bg-gradient-to-r from-red-500 to-red-600 text-white px-3 py-2 rounded-xl text-sm font-bold shadow-xl border border-red-400/30">
                      ❤️ SAVED
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-white mb-2">
                      {property.address.toUpperCase()}
                    </h3>
                    <p className="text-slate-300 mb-4 font-semibold">
                      {property.city}, {property.state}
                    </p>
                    
                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-semibold">List Price:</span>
                        <span className="font-bold text-white text-lg">${property.listPrice?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-semibold">Monthly Payment:</span>
                        <span className="font-bold text-emerald-400 text-lg">${Math.ceil(property.monthlyPayment || 0).toLocaleString()} est</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-semibold">Down Payment:</span>
                        <span className="font-bold text-blue-400 text-lg">${property.downPaymentAmount?.toLocaleString()} est</span>
                      </div>
                      {property.interestRate !== undefined && property.interestRate !== null && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-semibold">Interest Rate:</span>
                          <span className="font-bold text-yellow-400 text-lg">{property.interestRate}%</span>
                        </div>
                      )}
                      {property.downPaymentPercent !== undefined && property.downPaymentPercent !== null && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-semibold">Down Payment %:</span>
                          <span className="font-bold text-purple-400 text-lg">{property.downPaymentPercent}%</span>
                        </div>
                      )}

                      {/* Payment Disclaimer */}
                      <div className="text-center bg-slate-700/30 rounded p-2">
                        <p className="text-slate-300 text-xs">
                          * Estimates only. Excludes taxes, insurance, HOA fees
                        </p>
                      </div>
                      
                      {/* Balloon Payment Info */}
                      {property.balloonYears && property.balloonPayment ? (
                        <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-lg p-3 mt-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-yellow-400 text-sm">🎈</span>
                            <span className="text-yellow-300 font-semibold text-sm">Balloon Payment</span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-yellow-200 text-xs">Amount Due:</span>
                            <span className="font-bold text-yellow-300">${property.balloonPayment.toLocaleString()} est</span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-yellow-200 text-xs">Due In:</span>
                            <span className="font-bold text-yellow-300">{property.balloonYears} year{property.balloonYears > 1 ? 's' : ''}</span>
                          </div>
                          <p className="text-yellow-200 text-xs leading-relaxed">
                            Estimated balloon payment. Plan to refinance or save. Excludes taxes/insurance/HOA.
                          </p>
                          <div className="mt-2">
                            <Link
                              href="/how-owner-finance-works#balloon-payments"
                              className="text-yellow-300 underline text-xs hover:text-yellow-200"
                            >
                              Learn about balloon payments →
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-3 mt-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-red-400 text-sm">⚠️</span>
                            <span className="text-red-300 font-semibold text-sm">Balloon Payment Unknown</span>
                          </div>
                          <p className="text-red-200 text-xs leading-relaxed">
                            <strong>Balloon payment terms not specified.</strong> This property may include a balloon payment. Ask the seller for details before proceeding.
                          </p>
                          <div className="mt-2">
                            <Link
                              href="/how-owner-finance-works#balloon-payments"
                              className="text-red-300 underline text-xs hover:text-red-200"
                            >
                              Learn about balloon payments →
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between text-sm text-slate-400 mb-4 font-semibold">
                      <span>{property.bedrooms} BED</span>
                      <span>{property.bathrooms} BATH</span>
                      <span>{property.squareFeet?.toLocaleString()} SQ FT</span>
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