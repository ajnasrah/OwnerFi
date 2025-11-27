'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { PropertyListing } from '@/lib/property-schema';
import { LEGAL_DISCLAIMERS, LEGAL_COLORS, AGENT_CONTACT_DISCLAIMER } from '@/lib/legal-disclaimers';

interface PropertyCardProps {
  property: PropertyListing;
  onLike: () => void;
  onPass: () => void;
  isFavorited: boolean;
  style?: React.CSSProperties;
  isPriority?: boolean; // Only true for the currently visible card
}

export const PropertyCard = React.memo(function PropertyCard({ property, onLike, onPass, isFavorited, style, isPriority = false }: PropertyCardProps) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // ONLY use first image - no gallery
  const currentImage = useMemo(() => {
    const propertyAny = property as any;
    const imageUrl =
      propertyAny.imageUrl ||
      propertyAny.firstPropertyImage ||
      property.imageUrls?.[0] ||
      propertyAny.propertyImages?.[0] ||
      propertyAny.zillowImageUrl ||
      propertyAny.images?.[0];

    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '' || imageError) {
      return '/placeholder-house.jpg';
    }
    return imageUrl;
  }, [property, imageError]);

  const toggleDetails = useCallback(() => {
    setShowDetails(prev => !prev);
  }, []);


  // Format lot size
  const lotSizeDisplay = useMemo(() => {
    if (!property.lotSize) return null;
    if (property.lotSize >= 43560) {
      return `${(property.lotSize / 43560).toFixed(2)} acres`;
    }
    return `${property.lotSize.toLocaleString()} sq ft`;
  }, [property.lotSize]);

  return (
    <div
      className="absolute inset-0 w-full h-full"
      style={style}
    >
      <div className="relative w-full h-full bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 rounded-3xl shadow-2xl overflow-hidden">
        {/* Property Image - Full Screen Background */}
        <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50">
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-200">
              <div className="w-16 h-16 border-4 border-emerald-300 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
          )}

          <div
            className="absolute inset-x-0 overflow-hidden"
            style={{
              top: '2%',
              height: '44%'
            }}
          >
            <Image
              src={currentImage}
              alt={property.address}
              fill
              className="object-cover"
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageError(true);
                setImageLoading(false);
              }}
              sizes="(max-width: 768px) 100vw, 50vw"
              quality={70}
              priority={isPriority}
              loading={isPriority ? "eager" : "lazy"}
            />
          </div>

          {/* Gradient Overlay for Text Readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/90" />
        </div>

        {/* Top Info Bar */}
        <div className="absolute top-0 left-0 right-0 p-3 flex items-start justify-between z-10">
          {/* Left Side Badges */}
          <div className="flex gap-2 flex-wrap">
            {/* Financing Type Badge - Dynamic based on detected keywords */}
            {(() => {
              const financingType = (property as any).financingType || (property as any).financingTypeLabel || 'Owner Finance';
              const badgeConfig: Record<string, { bg: string; icon: string }> = {
                'Owner Finance': { bg: 'bg-emerald-600', icon: '💰' },
                'Seller Finance': { bg: 'bg-blue-600', icon: '🤝' },
                'Rent to Own': { bg: 'bg-purple-600', icon: '🏠' },
                'Contract for Deed': { bg: 'bg-orange-600', icon: '📜' },
                'Assumable Loan': { bg: 'bg-teal-600', icon: '🔄' },
                'Creative Financing': { bg: 'bg-yellow-600', icon: '💡' },
              };
              const config = badgeConfig[financingType] || badgeConfig['Owner Finance'];
              return (
                <div className={`${config.bg} backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5`}>
                  <span className="text-sm">{config.icon}</span>
                  <span>{financingType}</span>
                </div>
              );
            })()}
          </div>

          {/* Favorite Badge */}
          {isFavorited && (
            <div className="bg-pink-500 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
              ❤️ Saved
            </div>
          )}
        </div>

        {/* Swipe Instructions - Above drawer */}
        {!showDetails && (
          <div className="absolute left-0 right-0 z-20 flex justify-center items-center pointer-events-none" style={{ top: '52%' }}>
            <div className="inline-flex items-center gap-1.5 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-slate-200">
              <span className="text-slate-700 font-bold text-xs">👆 Swipe to browse • Tap buttons to save</span>
            </div>
          </div>
        )}

        {/* Bottom Info Panel */}
        <div className="absolute bottom-0 left-0 right-0 z-10 h-[50vh] pointer-events-none">
          <div
            className="absolute bottom-0 left-0 right-0 bg-white/98 backdrop-blur-sm rounded-t-3xl pointer-events-auto shadow-2xl transition-transform duration-300 ease-out"
            style={{
              transform: showDetails ? 'translateY(0)' : 'translateY(calc(100% - 200px))',
              height: '100%',
            }}
            onTouchStart={(e) => { if (showDetails) e.stopPropagation(); }}
            onTouchMove={(e) => { if (showDetails) e.stopPropagation(); }}
            onTouchEnd={(e) => { if (showDetails) e.stopPropagation(); }}
            onMouseDown={(e) => { if (showDetails) e.stopPropagation(); }}
            onMouseMove={(e) => { if (showDetails) e.stopPropagation(); }}
            onMouseUp={(e) => { if (showDetails) e.stopPropagation(); }}
          >
            {/* Handle Bar */}
            <button
              onClick={toggleDetails}
              className="w-full py-4 flex flex-col items-center gap-3 cursor-pointer hover:bg-slate-50/50 transition-colors"
            >
              <div className="w-20 h-1.5 bg-slate-300 rounded-full">
                <div className="w-full h-full bg-gradient-to-r from-slate-400 to-slate-500 rounded-full" />
              </div>
              {!showDetails && (
                <div className="inline-flex items-center gap-1.5 bg-emerald-500 text-white px-4 py-2 rounded-full shadow-lg">
                  <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                  </svg>
                  <span className="font-bold text-sm">Tap for details</span>
                </div>
              )}
              {showDetails && (
                <div className="inline-flex items-center gap-1.5 text-slate-600 px-4 py-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                  </svg>
                  <span className="font-bold text-sm">Tap to collapse</span>
                </div>
              )}
            </button>

            <div
              className="px-6 pb-6 overflow-y-auto"
              style={{ height: 'calc(100% - 5rem)' }}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
            >
              {/* Price */}
              <div className="mb-2">
                <div className="text-3xl font-black text-slate-900">
                  ${property.listPrice?.toLocaleString()}
                </div>
                {property.pricePerSqFt && (
                  <div className="text-slate-500 text-xs">
                    ${property.pricePerSqFt.toLocaleString()}/sq ft
                  </div>
                )}
              </div>

              {/* Address */}
              <div className="mb-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <h2 className="text-sm font-bold text-slate-900 leading-tight">
                      {(property as any).streetAddress || property.address}
                    </h2>
                    <p className="text-slate-600 text-xs">
                      {property.city}, {property.state} {property.zipCode}
                    </p>
                  </div>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const fullAddress = `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`;
                      try {
                        await navigator.clipboard.writeText(fullAddress);
                        const btn = e.currentTarget;
                        const originalHTML = btn.innerHTML;
                        btn.innerHTML = '<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>';
                        setTimeout(() => { btn.innerHTML = originalHTML; }, 1500);
                      } catch (err) {
                        console.error('Failed to copy address:', err);
                      }
                    }}
                    className="flex-shrink-0 p-1.5 hover:bg-slate-100 rounded-md transition-colors"
                    title="Copy full address"
                  >
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Quick Stats Row */}
              <div className="flex gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-2 py-1">
                  <span className="text-xs">🛏️</span>
                  <span className="text-sm font-bold text-slate-900">{property.bedrooms}</span>
                  <span className="text-[10px] text-slate-600">beds</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-2 py-1">
                  <span className="text-xs">🚿</span>
                  <span className="text-sm font-bold text-slate-900">{property.bathrooms}</span>
                  <span className="text-[10px] text-slate-600">baths</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-2 py-1">
                  <span className="text-xs">📏</span>
                  <span className="text-sm font-bold text-slate-900">{property.squareFeet?.toLocaleString() || 'N/A'}</span>
                  <span className="text-[10px] text-slate-600">sq ft</span>
                </div>
              </div>

              {/* Expanded Details */}
              {showDetails && (
                <div className="space-y-4 pt-2 border-t border-slate-200">

                  {/* Third-Party Value Estimates */}
                  {(property.estimatedValue || property.rentZestimate) && (
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-4">
                      <h3 className="font-bold text-purple-900 mb-1 flex items-center gap-2 text-sm">
                        <span>📊</span>
                        <span>Market Estimates</span>
                      </h3>
                      <p className="text-[9px] text-purple-700 mb-3 leading-tight bg-purple-100 rounded-lg p-2">
                        ⚠️ These estimates are provided by third-party data sources (Zillow). OwnerFi does not calculate or verify these values. Use for reference only.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {property.estimatedValue && property.estimatedValue > 0 && (
                          <div className="bg-white/60 rounded-xl p-3">
                            <div className="text-xs text-purple-700 mb-1">Est. Home Value</div>
                            <div className="text-xl font-black text-purple-900">
                              ${property.estimatedValue.toLocaleString()}
                            </div>
                            <div className="text-[9px] text-purple-600">Third-party estimate</div>
                          </div>
                        )}
                        {property.rentZestimate && property.rentZestimate > 0 && (
                          <div className="bg-white/60 rounded-xl p-3">
                            <div className="text-xs text-purple-700 mb-1">Est. Monthly Rent</div>
                            <div className="text-xl font-black text-purple-900">
                              ${property.rentZestimate.toLocaleString()}/mo
                            </div>
                            <div className="text-[9px] text-purple-600">Third-party estimate</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Property Details Grid */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-sm">
                      <span>🏠</span>
                      <span>Property Details</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {/* Always show Property Type */}
                      <div>
                        <div className="text-slate-500 text-xs">Property Type</div>
                        <div className="font-bold text-slate-900">
                          {(() => {
                            const homeType = (property as any).homeType || property.propertyType || 'Single Family';
                            const types: Record<string, string> = {
                              'SINGLE_FAMILY': 'Single Family',
                              'single-family': 'Single Family',
                              'CONDO': 'Condo',
                              'condo': 'Condo',
                              'TOWNHOUSE': 'Townhouse',
                              'townhouse': 'Townhouse',
                              'MOBILE': 'Mobile Home',
                              'mobile-home': 'Mobile Home',
                              'MULTI_FAMILY': 'Multi-Family',
                              'multi-family': 'Multi-Family',
                              'LAND': 'Land',
                              'land': 'Land',
                            };
                            return types[homeType] || homeType;
                          })()}
                        </div>
                      </div>
                      {/* Always show Year Built if available */}
                      {property.yearBuilt && (
                        <div>
                          <div className="text-slate-500 text-xs">Year Built</div>
                          <div className="font-bold text-slate-900">{property.yearBuilt}</div>
                        </div>
                      )}
                      {lotSizeDisplay && (
                        <div>
                          <div className="text-slate-500 text-xs">Lot Size</div>
                          <div className="font-bold text-slate-900">{lotSizeDisplay}</div>
                        </div>
                      )}
                      {property.stories && (
                        <div>
                          <div className="text-slate-500 text-xs">Stories</div>
                          <div className="font-bold text-slate-900">{property.stories}</div>
                        </div>
                      )}
                      {property.garage !== undefined && property.garage > 0 && (
                        <div>
                          <div className="text-slate-500 text-xs">Garage</div>
                          <div className="font-bold text-slate-900">{property.garage} car</div>
                        </div>
                      )}
                      {property.parking && (
                        <div>
                          <div className="text-slate-500 text-xs">Parking</div>
                          <div className="font-bold text-slate-900">{property.parking}</div>
                        </div>
                      )}
                      {property.heating && (
                        <div>
                          <div className="text-slate-500 text-xs">Heating</div>
                          <div className="font-bold text-slate-900">{property.heating}</div>
                        </div>
                      )}
                      {property.cooling && (
                        <div>
                          <div className="text-slate-500 text-xs">Cooling</div>
                          <div className="font-bold text-slate-900">{property.cooling}</div>
                        </div>
                      )}
                      {property.daysOnMarket !== undefined && (
                        <div>
                          <div className="text-slate-500 text-xs">Days on Market</div>
                          <div className="font-bold text-slate-900">{property.daysOnMarket}</div>
                        </div>
                      )}
                      {property.neighborhood && (
                        <div className="col-span-2">
                          <div className="text-slate-500 text-xs">Neighborhood</div>
                          <div className="font-bold text-slate-900">{property.neighborhood}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* HOA & Taxes */}
                  {(property.hoa?.hasHOA || property.taxes?.annualAmount) && (
                    <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
                      <h3 className="font-bold text-amber-900 mb-1 flex items-center gap-2 text-sm">
                        <span>💵</span>
                        <span>Additional Costs</span>
                      </h3>
                      <p className="text-[9px] text-amber-700 mb-3 leading-tight">
                        Third-party source • No estimate guarantee • Verify independently
                      </p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {property.hoa?.hasHOA && (
                          <div>
                            <div className="text-amber-700 text-xs">HOA Fee</div>
                            <div className="font-bold text-amber-900">
                              {property.hoa.monthlyFee ? `$${property.hoa.monthlyFee}/mo` : 'Yes (amount TBD)'}
                            </div>
                          </div>
                        )}
                        {property.taxes?.annualAmount && (
                          <div>
                            <div className="text-amber-700 text-xs">Annual Taxes</div>
                            <div className="font-bold text-amber-900">
                              ${property.taxes.annualAmount.toLocaleString()}/yr
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Location Scores */}
                  {(property.walkScore || property.schoolRating) && (
                    <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
                      <h3 className="font-bold text-blue-900 mb-1 flex items-center gap-2 text-sm">
                        <span>📍</span>
                        <span>Location Scores</span>
                      </h3>
                      <p className="text-[9px] text-blue-700 mb-3 leading-tight">
                        Third-party source • No guarantee • Verify independently
                      </p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {property.walkScore && (
                          <div>
                            <div className="text-blue-700 text-xs">Walk Score</div>
                            <div className="font-bold text-blue-900">{property.walkScore}/100</div>
                          </div>
                        )}
                        {property.schoolRating && (
                          <div>
                            <div className="text-blue-700 text-xs">School Rating</div>
                            <div className="font-bold text-blue-900">{property.schoolRating}/10</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Features */}
                  {property.features && property.features.length > 0 && (
                    <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200">
                      <h3 className="font-bold text-emerald-900 mb-3 flex items-center gap-2 text-sm">
                        <span>✨</span>
                        <span>Features</span>
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {property.features.slice(0, 12).map((feature, idx) => (
                          <span key={idx} className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded-lg text-xs font-medium">
                            {feature}
                          </span>
                        ))}
                        {property.features.length > 12 && (
                          <span className="text-emerald-600 text-xs px-2 py-1">
                            +{property.features.length - 12} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Appliances */}
                  {property.appliances && property.appliances.length > 0 && (
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                      <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-sm">
                        <span>🔌</span>
                        <span>Included Appliances</span>
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {property.appliances.map((appliance, idx) => (
                          <span key={idx} className="bg-slate-100 text-slate-700 px-2 py-1 rounded-lg text-xs font-medium">
                            {appliance}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Property Description */}
                  {property.description && (
                    <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-4 border border-slate-200">
                      <h3 className="font-bold text-slate-900 mb-1 flex items-center gap-2 text-sm">
                        <span className="text-lg">📝</span>
                        <span>Description</span>
                      </h3>
                      <p className="text-[9px] text-slate-500 mb-2 italic leading-tight">
                        {LEGAL_DISCLAIMERS.PROPERTY_DESCRIPTION}
                      </p>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {property.description}
                      </p>
                    </div>
                  )}

                  {/* General Disclaimer */}
                  <div className={`${LEGAL_COLORS.WARNING_BG} border ${LEGAL_COLORS.WARNING_BORDER} rounded-xl p-3`}>
                    <p className={`text-xs ${LEGAL_COLORS.WARNING_TEXT} font-medium`}>
                      ⚠️ Property information provided by listing agent. OwnerFi does not verify accuracy. Always conduct your own due diligence before making any decisions.
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(`${property.address} ${property.city}, ${property.state} ${property.zipCode}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-2.5 px-4 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span>Search Online</span>
                      </div>
                    </a>

                    <button
                      onClick={() => {
                        const message = `I'm interested in the property at ${property.address}, ${property.city}, ${property.state}. Found through OwnerFi.`;
                        const phone = property.agentPhone || (property as any).phone || '+1234567890';
                        window.open(`sms:${phone}&body=${encodeURIComponent(message)}`, '_self');
                      }}
                      className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white py-2.5 px-4 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95 transition-all"
                      title={AGENT_CONTACT_DISCLAIMER}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>Contact Agent</span>
                      </div>
                    </button>
                  </div>

                  {/* Agent Relationship Disclaimer */}
                  <div className="mt-2">
                    <p className="text-[9px] text-slate-500 text-center italic">
                      {AGENT_CONTACT_DISCLAIMER}
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
