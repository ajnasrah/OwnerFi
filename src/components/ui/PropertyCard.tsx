'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { PropertyListing } from '@/lib/property-schema';

interface PropertyCardProps {
  property: PropertyListing;
  onLike: () => void;
  onPass: () => void;
  isFavorited: boolean;
  style?: React.CSSProperties;
}

export const PropertyCard = React.memo(function PropertyCard({ property, onLike, onPass, isFavorited, style }: PropertyCardProps) {
  const [imageIndex, setImageIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Memoize expensive calculations
  const images = useMemo(() => property.imageUrls || [], [property.imageUrls]);
  const currentImage = useMemo(() =>
    images.length > 0 && !imageError ? images[imageIndex] : '/placeholder-house.jpg',
    [images, imageIndex, imageError]
  );

  const { monthlyPayment, estimatedTaxes, estimatedInsurance, totalMonthly } = useMemo(() => {
    const monthly = property.monthlyPayment || 0;
    const taxes = Math.round(monthly * 0.15);
    const insurance = Math.round(monthly * 0.1);
    return {
      monthlyPayment: monthly,
      estimatedTaxes: taxes,
      estimatedInsurance: insurance,
      totalMonthly: monthly + taxes + insurance
    };
  }, [property.monthlyPayment]);

  // Memoized event handlers
  const nextImage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (images.length > 1) {
      setImageIndex((prev) => (prev + 1) % images.length);
      setImageLoading(true);
    }
  }, [images.length]);

  const prevImage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (images.length > 1) {
      setImageIndex((prev) => (prev - 1 + images.length) % images.length);
      setImageLoading(true);
    }
  }, [images.length]);

  const toggleDetails = useCallback(() => {
    setShowDetails(prev => !prev);
  }, []);

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
              top: '10%',
              height: '40%'
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
              quality={75}
              priority={imageIndex === 0}
              loading={imageIndex === 0 ? "eager" : "lazy"}
            />
          </div>

          {/* Gradient Overlay for Text Readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/90" />
        </div>

        {/* Top Info Bar */}
        <div className="absolute top-0 left-0 right-0 p-3 flex items-start justify-between z-10">
          {/* Left Side Badges - Horizontal */}
          <div className="flex gap-2">
            {/* Owner Finance Badge */}
            <div className="bg-emerald-500 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5">
              <span className="text-sm">🏠</span>
              <span>Owner Finance</span>
            </div>

            {/* Negotiable Badge */}
            <div className="bg-blue-500 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5">
              <span className="text-sm">💬</span>
              <span>Negotiable</span>
            </div>
          </div>

          {/* Favorite Badge */}
          {isFavorited && (
            <div className="bg-pink-500 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
              ❤️ Saved
            </div>
          )}
        </div>

        {/* Image Navigation - Tap Zones */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-0 top-1/4 bottom-1/4 w-1/4 z-10 group"
              aria-label="Previous image"
            >
              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/40 group-hover:bg-black/60 backdrop-blur-sm text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                </svg>
              </div>
            </button>
            <button
              onClick={nextImage}
              className="absolute right-0 top-1/4 bottom-1/4 w-1/4 z-10 group"
              aria-label="Next image"
            >
              <div className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/40 group-hover:bg-black/60 backdrop-blur-sm text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {/* Image Dots */}
            <div className="absolute top-20 left-0 right-0 flex justify-center gap-1.5 z-10">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageIndex(idx);
                    setImageLoading(true);
                  }}
                  className={`h-1 rounded-full transition-all ${
                    idx === imageIndex
                      ? 'bg-white w-8'
                      : 'bg-white/40 w-1'
                  }`}
                  aria-label={`View image ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Swipe Instructions - Above drawer, always visible */}
        {!showDetails && (
          <div className="absolute left-0 right-0 z-20 flex justify-center items-center pointer-events-none" style={{ top: '52%' }}>
            <div className="inline-flex items-center gap-1.5 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-slate-200">
              <span className="text-slate-700 font-bold text-xs">👆 Swipe to browse • Tap buttons to save</span>
            </div>
          </div>
        )}

        {/* Bottom Info Panel - Can expand over card */}
        <div className="absolute bottom-0 left-0 right-0 z-10 h-[50vh] pointer-events-none">
          {/* Expandable Details Panel */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-white/98 backdrop-blur-sm rounded-t-3xl pointer-events-auto shadow-2xl transition-transform duration-300 ease-out"
            style={{
              transform: showDetails ? 'translateY(0)' : 'translateY(calc(100% - 240px))',
              height: '100%',
            }}
            onTouchStart={(e) => { if (showDetails) e.stopPropagation(); }}
            onTouchMove={(e) => { if (showDetails) e.stopPropagation(); }}
            onTouchEnd={(e) => { if (showDetails) e.stopPropagation(); }}
            onMouseDown={(e) => { if (showDetails) e.stopPropagation(); }}
            onMouseMove={(e) => { if (showDetails) e.stopPropagation(); }}
            onMouseUp={(e) => { if (showDetails) e.stopPropagation(); }}
          >
            {/* Handle Bar - Click to expand/collapse */}
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
              style={{
                height: 'calc(100% - 5rem)',
              }}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
            >
              {/* Price - Compact */}
              <div className="mb-2">
                <div className="text-2xl font-black text-slate-900 mb-0">
                  ${property.listPrice?.toLocaleString()}
                </div>
                <div className="text-emerald-600 font-bold text-xs">
                  est. ${monthlyPayment.toLocaleString()}/month
                </div>
              </div>

              {/* Address */}
              <div className="mb-2">
                <h2 className="text-sm font-bold text-slate-900 leading-tight">
                  {property.address}
                </h2>
                <p className="text-slate-600 text-xs">
                  {property.city}, {property.state} {property.zipCode}
                </p>
              </div>

              {/* Quick Stats */}
              <div className="flex gap-2 mb-2">
                <div className="flex items-center gap-1">
                  <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center">
                    <span className="text-xs">🛏️</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{property.bedrooms}</div>
                    <div className="text-[9px] text-slate-600">beds</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center">
                    <span className="text-xs">🚿</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{property.bathrooms}</div>
                    <div className="text-[9px] text-slate-600">baths</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center">
                    <span className="text-xs">📏</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {property.squareFeet?.toLocaleString() || 'N/A'}
                    </div>
                    <div className="text-[9px] text-slate-600">sq ft</div>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {showDetails && (
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  {/* Property Description */}
                  {property.description && (
                    <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-4">
                      <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-base">
                        <span className="text-lg">📝</span>
                        <span>Property Description</span>
                      </h3>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {property.description}
                      </p>
                    </div>
                  )}

                  {/* Monthly Payment Breakdown */}
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-sm">
                      <span>💰</span>
                      <span>Est. Monthly Payment Breakdown</span>
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Principal & Interest</span>
                        <span className="font-bold text-slate-900">est. ${monthlyPayment.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Property Tax</span>
                        <span className="font-bold text-slate-900">est. ${estimatedTaxes.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Insurance</span>
                        <span className="font-bold text-slate-900">est. ${estimatedInsurance.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-300">
                        <span className="font-bold text-slate-900">Total Monthly</span>
                        <span className="font-black text-emerald-600 text-sm">est. ${totalMonthly.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Down Payment */}
                  <div className="bg-blue-50 rounded-2xl p-4">
                    <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2 text-sm">
                      <span>💵</span>
                      <span>Est. Down Payment Required</span>
                    </h3>
                    <div className="text-xl font-black text-blue-900">
                      est. ${property.downPaymentAmount?.toLocaleString()}
                    </div>
                    <p className="text-xs text-blue-700 mt-1">
                      {property.downPaymentAmount && property.listPrice
                        ? `Approximately ${Math.round((property.downPaymentAmount / property.listPrice) * 100)}% of purchase price`
                        : ''}
                    </p>
                  </div>

                  {/* Financing Terms */}
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <span>📋</span>
                      <span>Financing Terms</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-slate-600 text-xs mb-1">Interest Rate</div>
                        <div className="font-bold text-slate-900 text-lg">est. {property.interestRate}%</div>
                      </div>
                      <div>
                        <div className="text-slate-600 text-xs mb-1">Loan Term</div>
                        <div className="font-bold text-slate-900 text-lg">est. {property.termYears} years</div>
                      </div>
                    </div>
                  </div>

                  {/* Refinance Timeline */}
                  {property.balloonYears && property.balloonYears > 0 && (
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
                      <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                        <span>📅</span>
                        <span>Refinance Timeline</span>
                      </h3>
                      <p className="text-sm text-blue-800 mb-2">
                        Plan to refinance after <strong>{property.balloonYears} {property.balloonYears === 1 ? 'year' : 'years'}</strong>
                      </p>
                      <p className="text-xs text-blue-700 bg-blue-100 rounded-lg p-2">
                        💡 <strong>Note:</strong> You'll need to refinance with a traditional mortgage or negotiate new terms with the seller after {property.balloonYears} {property.balloonYears === 1 ? 'year' : 'years'}. This gives you time to improve your credit and build equity.
                      </p>
                    </div>
                  )}

                  {/* Disclaimer */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                    <p className="text-xs text-yellow-800">
                      💡 Estimates shown are not guaranteed. Monthly payments may or may not include property taxes and insurance. Taxes, insurance, and HOA fees vary by property. Please verify all payment details and what's included with the seller.
                    </p>
                  </div>

                  {/* Action Buttons - Compact */}
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
                        const phone = property.agentPhone || property.phone || '+1234567890';
                        window.open(`sms:${phone}&body=${encodeURIComponent(message)}`, '_self');
                      }}
                      className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white py-2.5 px-4 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>Contact Agent</span>
                      </div>
                    </button>
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
