'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

import { PropertyListing } from '@/lib/property-schema';

type Property = PropertyListing;

export default function FavoritesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [favoriteProperties, setFavoriteProperties] = useState<Property[]>([]);
  const [passedProperties, setPassedProperties] = useState<Property[]>([]);
  const [showPassed, setShowPassed] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      // Load actual property details from database
      fetchFavoriteProperties();
    }
  }, [status, router]);

  const fetchFavoriteProperties = async () => {
    try {
      // Get buyer profile first
      const profileResponse = await fetch('/api/buyer/profile');
      const profileData = await profileResponse.json();
      
      if (!profileData.profile) {
        setLoading(false);
        return;
      }

      const buyerId = profileData.profile.id;
      
      // Get liked properties using new unified API
      const likedResponse = await fetch(`/api/buyer/properties?buyerId=${buyerId}&status=liked`);
      const likedData = await likedResponse.json();
      
      if (!likedData.error) {
        setFavoriteProperties(likedData.properties || []);
      } else {
        setFavoriteProperties([]);
      }

      // Get passed properties using new unified API
      const passedResponse = await fetch(`/api/buyer/properties?buyerId=${buyerId}&status=disliked`);
      const passedData = await passedResponse.json();
      
      if (!passedData.error) {
        setPassedProperties(passedData.properties || []);
      } else {
        setPassedProperties([]);
      }
      
    } catch {
      setFavoriteProperties([]);
      setPassedProperties([]);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-bg">
      <header className="bg-white px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-800 transition-colors p-1"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Saved Properties</h1>
          </div>
        </div>
      </header>

      <div className="p-6">
        {favoriteProperties.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">💝</div>
            <h2 className="text-xl font-semibold text-primary-text mb-3">No Saved Properties Yet</h2>
            <p className="text-secondary-text mb-6">Start swiping to save properties you love!</p>
            <Button variant="primary" href="/dashboard">
              Browse Properties
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {favoriteProperties.map((property: Property) => (
              <div key={property.id} className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                {/* Header */}
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold text-gray-900">{property.address}</h3>
                  <p className="text-gray-600">{property.city}, {property.state} {property.zipCode}</p>
                  
                  {/* More Details Link */}
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(`${property.address} ${property.city}, ${property.state} ${property.zipCode}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors mt-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span>More Details</span>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>

                {/* Key Financial Info */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="text-center bg-blue-50 rounded-lg p-4">
                    <div className="text-sm text-blue-600 font-medium">Monthly Payment (est)</div>
                    <div className="text-2xl font-bold text-blue-700">
                      {formatCurrency(property.monthlyPayment)}
                    </div>
                  </div>
                  <div className="text-center bg-orange-50 rounded-lg p-4">
                    <div className="text-sm text-orange-600 font-medium">Down Payment (est)</div>
                    <div className="text-2xl font-bold text-orange-700">
                      {formatCurrency(property.downPaymentAmount)}
                    </div>
                  </div>
                </div>

                {/* Property Details */}
                <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-800">{property.bedrooms}</div>
                    <div className="text-xs text-gray-600">Bedrooms</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-800">{property.bathrooms}</div>
                    <div className="text-xs text-gray-600">Bathrooms</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-800">{property.squareFeet?.toLocaleString() || 'N/A'}</div>
                    <div className="text-xs text-gray-600">Sq Ft</div>
                  </div>
                </div>

                {/* Financing Terms */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div>
                      <div className="font-semibold text-gray-800">{formatCurrency(property.listPrice)}</div>
                      <div className="text-gray-600">List Price (est)</div>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">{property.interestRate}%</div>
                      <div className="text-gray-600">APR (est)</div>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">{property.termYears} years</div>
                      <div className="text-gray-600">Term (est)</div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {property.description && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-800 mb-2">Property Description</h4>
                    <p className="text-gray-700 leading-relaxed">{property.description}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Collapsible rejected properties section */}
        {passedProperties.length > 0 && (
          <div className="mt-8">
            <button
              onClick={() => setShowPassed(!showPassed)}
              className="w-full text-left bg-gray-100 hover:bg-gray-200 rounded-lg p-4 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-700">
                  Properties I Don't Like ({passedProperties.length})
                </span>
                <svg 
                  className={`w-5 h-5 text-gray-500 transition-transform ${showPassed ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            
            {showPassed && (
              <div className="mt-4 space-y-4">
                {passedProperties.map((property: Property) => (
                  <div key={property.id} className="bg-red-50 rounded-xl p-4 border border-red-100">
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800">{property.address}</h3>
                        <p className="text-gray-600 text-sm">{property.city}, {property.state}</p>
                        <p className="text-gray-600 text-sm">
                          {property.bedrooms} bed • {property.bathrooms} bath • {property.squareFeet?.toLocaleString() || 'N/A'} sqft
                        </p>
                        
                        {/* More Details Link */}
                        <a
                          href={`https://www.google.com/search?q=${encodeURIComponent(`${property.address} ${property.city}, ${property.state} ${property.zipCode}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors mt-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <span>More Details</span>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-600">
                          {formatCurrency(property.monthlyPayment)}<span className="text-xs text-gray-500">/mo</span>
                        </div>
                        <div className="text-sm text-orange-600">
                          {formatCurrency(property.downPaymentAmount)} down
                        </div>
                        <div className="mt-2 space-y-1">
                          <button 
                            onClick={() => setSelectedProperty(property)}
                            className="w-full bg-white text-gray-700 border border-gray-300 px-3 py-1 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                          >
                            View Details
                          </button>
                          <button 
                            onClick={async () => {
                              try {
                                // Get buyer profile first to get buyerId
                                const profileResponse = await fetch('/api/buyer/profile');
                                const profileData = await profileResponse.json();
                                
                                if (profileData.profile) {
                                  const response = await fetch('/api/property-actions', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ 
                                      buyerId: profileData.profile.id,
                                      propertyId: property.id, 
                                      action: 'undo_pass' 
                                    })
                                  });
                                  
                                  if (response.ok) {
                                    setPassedProperties(prev => prev.filter(p => p.id !== property.id));
                                  }
                                }
                              } catch {
                              }
                            }}
                            className="w-full bg-green-100 text-green-700 border border-green-300 px-3 py-1 rounded-lg text-sm hover:bg-green-200 transition-colors"
                          >
                            ↩️ Restore to Matches
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Property Details Modal */}
      {selectedProperty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-900">{selectedProperty.address}</h2>
                <button 
                  onClick={() => setSelectedProperty(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <p className="text-gray-600">{selectedProperty.city}, {selectedProperty.state} {selectedProperty.zipCode}</p>
                
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-800">{selectedProperty.bedrooms}</div>
                    <div className="text-xs text-gray-600">Bedrooms</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-800">{selectedProperty.bathrooms}</div>
                    <div className="text-xs text-gray-600">Bathrooms</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-800">{selectedProperty.squareFeet?.toLocaleString() || 'N/A'}</div>
                    <div className="text-xs text-gray-600">Sq Ft</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center bg-blue-50 rounded-lg p-4">
                    <div className="text-sm text-blue-600 font-medium">Monthly (est)</div>
                    <div className="text-2xl font-bold text-blue-700">
                      {formatCurrency(selectedProperty.monthlyPayment)}
                    </div>
                  </div>
                  <div className="text-center bg-orange-50 rounded-lg p-4">
                    <div className="text-sm text-orange-600 font-medium">Down Payment (est)</div>
                    <div className="text-2xl font-bold text-orange-700">
                      {formatCurrency(selectedProperty.downPaymentAmount)}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div>
                      <div className="font-semibold text-gray-800">{formatCurrency(selectedProperty.listPrice)}</div>
                      <div className="text-gray-600">List Price (est)</div>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">{selectedProperty.interestRate}%</div>
                      <div className="text-gray-600">APR (est)</div>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">{selectedProperty.termYears} years</div>
                      <div className="text-gray-600">Term (est)</div>
                    </div>
                  </div>
                </div>

                {selectedProperty.description && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-800 mb-2">Description</h4>
                    <p className="text-gray-700 leading-relaxed">{selectedProperty.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}