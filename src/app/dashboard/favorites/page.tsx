'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

import { PropertyListing } from '@/lib/property-schema';

type Property = PropertyListing;

export default function FavoritesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [favoriteProperties, setFavoriteProperties] = useState<Property[]>([]);
  const [passedProperties, setPassedProperties] = useState<Property[]>([]);
  const [showPassed, setShowPassed] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  const formatCurrency = (amount: number | undefined) => {
    if (!amount || amount === 0) {
      return 'N/A';
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
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

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth');
    } else if (status === 'authenticated') {
      fetchFavoriteProperties();
    }
  }, [status, router]);

  const fetchFavoriteProperties = async () => {
    try {
      const profileResponse = await fetch('/api/buyer/profile');
      const profileData = await profileResponse.json();

      if (!profileData.profile) {
        setLoading(false);
        return;
      }

      const buyerId = profileData.profile.id;

      const likedResponse = await fetch(`/api/buyer/properties?buyerId=${buyerId}&status=liked`);
      const likedData = await likedResponse.json();

      if (!likedData.error) {
        setFavoriteProperties(likedData.properties || []);
      } else {
        setFavoriteProperties([]);
      }

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
      <div className="h-screen overflow-hidden bg-primary-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto bg-primary-bg">
      <header className="bg-white px-6 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.back()}
              className="text-slate-600 hover:text-slate-800 transition-colors p-1"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-slate-900">Saved Properties</h1>
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
              <div key={property.id} className="bg-white rounded-xl p-6 shadow-lg border border-slate-100">
                {/* Header */}
                <div className="text-center mb-4">
                  {/* Badges */}
                  <div className="flex justify-center gap-2 mb-2">
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-xs font-bold">
                      {formatPropertyType(property.propertyType)}
                    </span>
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-xs font-bold">
                      Owner Finance
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900">{property.address}</h3>
                  <p className="text-slate-600">{property.city}, {property.state} {property.zipCode}</p>

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

                {/* Price */}
                <div className="text-center mb-4">
                  <div className="text-3xl font-black text-slate-900">
                    {formatCurrency(property.listPrice)}
                  </div>
                  {property.pricePerSqFt && (
                    <div className="text-slate-500 text-sm">
                      ${property.pricePerSqFt.toLocaleString()}/sq ft
                    </div>
                  )}
                </div>

                {/* Property Details */}
                <div className="grid grid-cols-4 gap-4 mb-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-slate-800">{property.bedrooms}</div>
                    <div className="text-xs text-slate-600">Beds</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-800">{property.bathrooms}</div>
                    <div className="text-xs text-slate-600">Baths</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-800">{property.squareFeet?.toLocaleString() || 'N/A'}</div>
                    <div className="text-xs text-slate-600">Sq Ft</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-800">{property.yearBuilt || 'N/A'}</div>
                    <div className="text-xs text-slate-600">Built</div>
                  </div>
                </div>

                {/* Additional Property Info */}
                <div className="bg-slate-50 rounded-lg p-4 mb-4 border border-slate-200">
                  <h4 className="text-xs font-semibold text-slate-700 mb-2">Property Details</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {formatLotSize(property.lotSize) && (
                      <div>
                        <span className="text-slate-500">Lot Size:</span>
                        <span className="font-semibold text-slate-800 ml-1">{formatLotSize(property.lotSize)}</span>
                      </div>
                    )}
                    {property.stories && (
                      <div>
                        <span className="text-slate-500">Stories:</span>
                        <span className="font-semibold text-slate-800 ml-1">{property.stories}</span>
                      </div>
                    )}
                    {property.garage && property.garage > 0 && (
                      <div>
                        <span className="text-slate-500">Garage:</span>
                        <span className="font-semibold text-slate-800 ml-1">{property.garage} car</span>
                      </div>
                    )}
                    {property.heating && (
                      <div>
                        <span className="text-slate-500">Heating:</span>
                        <span className="font-semibold text-slate-800 ml-1">{property.heating}</span>
                      </div>
                    )}
                    {property.cooling && (
                      <div>
                        <span className="text-slate-500">Cooling:</span>
                        <span className="font-semibold text-slate-800 ml-1">{property.cooling}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Third-Party Estimates */}
                {(property.estimatedValue || property.rentZestimate) && (
                  <div className="bg-purple-50 rounded-lg p-4 mb-4 border border-purple-200">
                    <h4 className="text-xs font-semibold text-purple-700 mb-1">Market Estimates</h4>
                    <p className="text-[9px] text-purple-600 mb-2">Third-party source • No guarantee • Verify independently</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {property.estimatedValue && property.estimatedValue > 0 && (
                        <div>
                          <div className="text-purple-600 text-xs">Est. Home Value</div>
                          <div className="font-bold text-purple-800">{formatCurrency(property.estimatedValue)}</div>
                        </div>
                      )}
                      {property.rentZestimate && property.rentZestimate > 0 && (
                        <div>
                          <div className="text-purple-600 text-xs">Est. Monthly Rent</div>
                          <div className="font-bold text-purple-800">${property.rentZestimate.toLocaleString()}/mo</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* HOA & Taxes */}
                {(property.hoa?.hasHOA || property.taxes?.annualAmount) && (
                  <div className="bg-amber-50 rounded-lg p-4 mb-4 border border-amber-200">
                    <h4 className="text-xs font-semibold text-amber-700 mb-1">Additional Costs</h4>
                    <p className="text-[9px] text-amber-600 mb-2">Third-party source • No estimate guarantee</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {property.hoa?.hasHOA && (
                        <div>
                          <div className="text-amber-600 text-xs">HOA Fee</div>
                          <div className="font-bold text-amber-800">
                            {property.hoa.monthlyFee ? `$${property.hoa.monthlyFee}/mo` : 'Yes'}
                          </div>
                        </div>
                      )}
                      {property.taxes?.annualAmount && (
                        <div>
                          <div className="text-amber-600 text-xs">Annual Taxes</div>
                          <div className="font-bold text-amber-800">${property.taxes.annualAmount.toLocaleString()}/yr</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Disclaimer */}
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-2 mb-4">
                  <p className="text-[9px] text-amber-900 font-semibold text-center">
                    Property info from listing agent • OwnerFi does not verify • Conduct your own due diligence
                  </p>
                </div>

                {/* Description */}
                {property.description && (
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h4 className="font-semibold text-slate-800 mb-1 text-sm">Description</h4>
                    <p className="text-[9px] text-slate-500 mb-2 italic">
                      Description from listing agent. OwnerFi does not verify accuracy.
                    </p>
                    <p className="text-slate-700 leading-relaxed text-sm">{property.description}</p>
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
              className="w-full text-left bg-slate-100 hover:bg-slate-200 rounded-lg p-4 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-slate-700">
                  Properties I Don't Like ({passedProperties.length})
                </span>
                <svg
                  className={`w-5 h-5 text-slate-500 transition-transform ${showPassed ? 'rotate-180' : ''}`}
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
                        <div className="flex gap-2 mb-1">
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">
                            {formatPropertyType(property.propertyType)}
                          </span>
                        </div>
                        <h3 className="font-semibold text-slate-800">{property.address}</h3>
                        <p className="text-slate-600 text-sm">{property.city}, {property.state}</p>
                        <p className="text-slate-600 text-sm">
                          {property.bedrooms} bed • {property.bathrooms} bath • {property.squareFeet?.toLocaleString() || 'N/A'} sqft
                          {property.yearBuilt && ` • Built ${property.yearBuilt}`}
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
                        <div className="text-lg font-bold text-slate-800">
                          {formatCurrency(property.listPrice)}
                        </div>
                        <div className="mt-2 space-y-1">
                          <button
                            onClick={() => setSelectedProperty(property)}
                            className="w-full bg-white text-slate-700 border border-slate-300 px-3 py-1 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                          >
                            View Details
                          </button>
                          <button
                            onClick={async () => {
                              try {
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
                            Restore to Matches
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
                <div>
                  <div className="flex gap-2 mb-2">
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-xs font-bold">
                      {formatPropertyType(selectedProperty.propertyType)}
                    </span>
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-xs font-bold">
                      Owner Finance
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedProperty.address}</h2>
                </div>
                <button
                  onClick={() => setSelectedProperty(null)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-slate-600">{selectedProperty.city}, {selectedProperty.state} {selectedProperty.zipCode}</p>

                {/* Price */}
                <div className="text-center">
                  <div className="text-3xl font-black text-slate-900">
                    {formatCurrency(selectedProperty.listPrice)}
                  </div>
                  {selectedProperty.pricePerSqFt && (
                    <div className="text-slate-500 text-sm">
                      ${selectedProperty.pricePerSqFt.toLocaleString()}/sq ft
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-slate-800">{selectedProperty.bedrooms}</div>
                    <div className="text-xs text-slate-600">Beds</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-800">{selectedProperty.bathrooms}</div>
                    <div className="text-xs text-slate-600">Baths</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-800">{selectedProperty.squareFeet?.toLocaleString() || 'N/A'}</div>
                    <div className="text-xs text-slate-600">Sq Ft</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-800">{selectedProperty.yearBuilt || 'N/A'}</div>
                    <div className="text-xs text-slate-600">Built</div>
                  </div>
                </div>

                {/* Additional Property Info */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <h4 className="text-xs font-semibold text-slate-700 mb-2">Property Details</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {formatLotSize(selectedProperty.lotSize) && (
                      <div>
                        <span className="text-slate-500">Lot Size:</span>
                        <span className="font-semibold text-slate-800 ml-1">{formatLotSize(selectedProperty.lotSize)}</span>
                      </div>
                    )}
                    {selectedProperty.stories && (
                      <div>
                        <span className="text-slate-500">Stories:</span>
                        <span className="font-semibold text-slate-800 ml-1">{selectedProperty.stories}</span>
                      </div>
                    )}
                    {selectedProperty.garage && selectedProperty.garage > 0 && (
                      <div>
                        <span className="text-slate-500">Garage:</span>
                        <span className="font-semibold text-slate-800 ml-1">{selectedProperty.garage} car</span>
                      </div>
                    )}
                    {selectedProperty.heating && (
                      <div>
                        <span className="text-slate-500">Heating:</span>
                        <span className="font-semibold text-slate-800 ml-1">{selectedProperty.heating}</span>
                      </div>
                    )}
                    {selectedProperty.cooling && (
                      <div>
                        <span className="text-slate-500">Cooling:</span>
                        <span className="font-semibold text-slate-800 ml-1">{selectedProperty.cooling}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Third-Party Estimates */}
                {(selectedProperty.estimatedValue || selectedProperty.rentZestimate) && (
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <h4 className="text-xs font-semibold text-purple-700 mb-1">Market Estimates</h4>
                    <p className="text-[9px] text-purple-600 mb-2">Third-party source • No guarantee • Verify independently</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {selectedProperty.estimatedValue && selectedProperty.estimatedValue > 0 && (
                        <div>
                          <div className="text-purple-600 text-xs">Est. Home Value</div>
                          <div className="font-bold text-purple-800">{formatCurrency(selectedProperty.estimatedValue)}</div>
                        </div>
                      )}
                      {selectedProperty.rentZestimate && selectedProperty.rentZestimate > 0 && (
                        <div>
                          <div className="text-purple-600 text-xs">Est. Monthly Rent</div>
                          <div className="font-bold text-purple-800">${selectedProperty.rentZestimate.toLocaleString()}/mo</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* HOA & Taxes */}
                {(selectedProperty.hoa?.hasHOA || selectedProperty.taxes?.annualAmount) && (
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                    <h4 className="text-xs font-semibold text-amber-700 mb-1">Additional Costs</h4>
                    <p className="text-[9px] text-amber-600 mb-2">Third-party source • No estimate guarantee</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {selectedProperty.hoa?.hasHOA && (
                        <div>
                          <div className="text-amber-600 text-xs">HOA Fee</div>
                          <div className="font-bold text-amber-800">
                            {selectedProperty.hoa.monthlyFee ? `$${selectedProperty.hoa.monthlyFee}/mo` : 'Yes'}
                          </div>
                        </div>
                      )}
                      {selectedProperty.taxes?.annualAmount && (
                        <div>
                          <div className="text-amber-600 text-xs">Annual Taxes</div>
                          <div className="font-bold text-amber-800">${selectedProperty.taxes.annualAmount.toLocaleString()}/yr</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-amber-50 border border-amber-300 rounded-lg p-2">
                  <p className="text-[9px] text-amber-900 font-semibold text-center">
                    Property info from listing agent • OwnerFi does not verify • Conduct your own due diligence
                  </p>
                </div>

                {selectedProperty.description && (
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h4 className="font-semibold text-slate-800 mb-1 text-sm">Description</h4>
                    <p className="text-[9px] text-slate-500 mb-2 italic">
                      Description from listing agent. OwnerFi does not verify accuracy.
                    </p>
                    <p className="text-slate-700 leading-relaxed text-sm">{selectedProperty.description}</p>
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
