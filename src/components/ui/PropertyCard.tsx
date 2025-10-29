'use client';

import React, { useState, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import { PropertyListing } from '@/lib/property-schema';

interface PropertyCardProps {
  property: PropertyListing;
  onLike: () => void;
  onPass: () => void;
  isFavorited: boolean;
  style?: React.CSSProperties;
}

export function PropertyCard({ property, onLike, onPass, isFavorited, style }: PropertyCardProps) {
  const [imageIndex, setImageIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [drawerDragStart, setDrawerDragStart] = useState<number | null>(null);
  const [drawerOffset, setDrawerOffset] = useState(0);
  const rafRef = useRef<number | null>(null);

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

  // Drawer swipe handlers - Buttery smooth for mobile
  const handleDrawerTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setDrawerDragStart(touch.clientY);
    setDrawerOffset(0);

    // Stop propagation to prevent parent swiper from interfering
    e.stopPropagation();
  }, []);

  const handleDrawerTouchMove = useCallback((e: React.TouchEvent) => {
    if (drawerDragStart === null) return;

    const touch = e.touches[0];
    const deltaY = drawerDragStart - touch.clientY;

    // Allow scrolling if drawer is expanded and user is scrolling content
    if (showDetails) {
      const target = e.target as HTMLElement;
      const scrollContainer = target.closest('[data-drawer-scroll]');

      if (scrollContainer) {
        const isScrolledToTop = scrollContainer.scrollTop <= 0;
        const isScrollingDown = deltaY < 0;

        // Only allow drawer to close if scrolled to top and swiping down
        if (!isScrolledToTop || !isScrollingDown) {
          return;
        }
      }
    }

    // Stop propagation to prevent parent swiper interference
    e.stopPropagation();

    // Use RAF for 60fps smooth updates
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      // Provide real-time visual feedback with rubber-band effect
      if (!showDetails && deltaY > 0) {
        // Dragging up to open - show preview with resistance
        const resistance = deltaY > 100 ? 0.5 : 1;
        setDrawerOffset(Math.min(deltaY * resistance, 150));
      } else if (showDetails && deltaY < 0) {
        // Dragging down to close - show preview with resistance
        const resistance = Math.abs(deltaY) > 100 ? 0.5 : 1;
        setDrawerOffset(Math.max(deltaY * resistance, -150));
      }
    });
  }, [drawerDragStart, showDetails]);

  const handleDrawerTouchEnd = useCallback((e: React.TouchEvent) => {
    if (drawerDragStart === null) return;

    const touchEnd = e.changedTouches[0].clientY;
    const deltaY = drawerDragStart - touchEnd;

    // Stop propagation
    e.stopPropagation();

    // Increased threshold for better control - 60px swipe required
    const threshold = 60;

    if (deltaY > threshold && !showDetails) {
      setShowDetails(true);
    } else if (deltaY < -threshold && showDetails) {
      setShowDetails(false);
    }

    setDrawerDragStart(null);
    setDrawerOffset(0);
  }, [drawerDragStart, showDetails]);

  return (
    <div
      className="absolute inset-0 w-full h-full"
      style={style}
    >
      <div className="relative w-full h-full bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Property Image - Full Screen Background */}
        <div className="absolute inset-0">
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-200">
              <div className="w-16 h-16 border-4 border-emerald-300 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
          )}

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
            quality={85}
            priority={imageIndex === 0}
          />

          {/* Gradient Overlay for Text Readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/90" />
        </div>

        {/* Top Info Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-start justify-between z-10">
          {/* Owner Finance Badge */}
          <div className="bg-emerald-500 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg flex items-center gap-2">
            <span className="text-base">🏠</span>
            <span>Owner Finance</span>
          </div>

          {/* Favorite Badge */}
          {isFavorited && (
            <div className="bg-pink-500 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
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

        {/* Bottom Info Panel - Fixed Height Container */}
        <div className="absolute bottom-0 left-0 right-0 z-10 h-[70vh] pointer-events-none">
          {/* Expandable Details Panel - GPU Accelerated Transform Animation */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-white/98 backdrop-blur-sm rounded-t-3xl h-[70vh] pointer-events-auto shadow-2xl"
            style={{
              transform: showDetails
                ? `translate3d(0, ${drawerOffset}px, 0)`
                : `translate3d(0, calc(70vh - 240px + ${drawerOffset}px), 0)`,
              transition: drawerDragStart === null ? 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
              willChange: 'transform',
              WebkitTransform: showDetails
                ? `translate3d(0, ${drawerOffset}px, 0)`
                : `translate3d(0, calc(70vh - 240px + ${drawerOffset}px), 0)`,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
            onTouchStart={handleDrawerTouchStart}
            onTouchMove={handleDrawerTouchMove}
            onTouchEnd={handleDrawerTouchEnd}
          >
            {/* Handle Bar - Swipeable Area */}
            <div className="w-full py-3 flex justify-center cursor-grab active:cursor-grabbing">
              <div className="w-16 h-1.5 bg-slate-300 rounded-full">
                <div className="w-full h-full bg-gradient-to-r from-slate-400 to-slate-500 rounded-full" />
              </div>
            </div>

            <div
              className="px-6 pb-6 overflow-y-auto h-[calc(70vh-3rem)]"
              style={{
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
                touchAction: 'pan-y',
              }}
              data-drawer-scroll
            >
              {/* Price - Hero Element */}
              <div className="mb-4">
                <div className="text-4xl font-black text-slate-900 mb-1">
                  ${property.listPrice?.toLocaleString()}
                </div>
                <div className="text-emerald-600 font-bold text-xl">
                  est. ${monthlyPayment.toLocaleString()}/month
                </div>
              </div>

              {/* Address */}
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-900 leading-tight">
                  {property.address}
                </h2>
                <p className="text-slate-600 text-base">
                  {property.city}, {property.state} {property.zipCode}
                </p>
              </div>

              {/* Quick Stats */}
              <div className="flex gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                    <span className="text-lg">🛏️</span>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-slate-900">{property.bedrooms}</div>
                    <div className="text-xs text-slate-600">beds</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                    <span className="text-lg">🚿</span>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-slate-900">{property.bathrooms}</div>
                    <div className="text-xs text-slate-600">baths</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                    <span className="text-lg">📏</span>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-slate-900">
                      {property.squareFeet?.toLocaleString() || 'N/A'}
                    </div>
                    <div className="text-xs text-slate-600">sq ft</div>
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
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line break-words overflow-wrap-anywhere">
                        {property.description}
                      </p>
                    </div>
                  )}

                  {/* Monthly Payment Breakdown */}
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <span>💰</span>
                      <span>Est. Monthly Payment Breakdown</span>
                    </h3>
                    <div className="space-y-2 text-sm">
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
                        <span className="font-black text-emerald-600 text-lg">est. ${totalMonthly.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Down Payment */}
                  <div className="bg-blue-50 rounded-2xl p-4">
                    <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                      <span>💵</span>
                      <span>Est. Down Payment Required</span>
                    </h3>
                    <div className="text-2xl font-black text-blue-900">
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
                        <div className="font-bold text-slate-900 text-lg">{property.interestRate}%</div>
                      </div>
                      <div>
                        <div className="text-slate-600 text-xs mb-1">Loan Term</div>
                        <div className="font-bold text-slate-900 text-lg">{property.termYears} years</div>
                      </div>
                    </div>
                  </div>

                  {/* Balloon Payment Warning */}
                  {property.balloonPayment && (
                    <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4">
                      <h3 className="font-bold text-orange-900 mb-2 flex items-center gap-2">
                        <span>⚠️</span>
                        <span>Est. Balloon Payment</span>
                      </h3>
                      <p className="text-sm text-orange-800 mb-2">
                        Approximately <strong>est. ${property.balloonPayment.toLocaleString()}</strong> due after {property.balloonYears} years
                      </p>
                      <p className="text-xs text-orange-700 bg-orange-100 rounded-lg p-2">
                        💡 <strong>Note:</strong> You can refinance this balloon payment with a traditional mortgage or negotiate new terms before it's due. This gives you flexibility to manage the remaining balance.
                      </p>
                    </div>
                  )}

                  {/* Disclaimer */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                    <p className="text-xs text-yellow-800">
                      💡 Estimates shown are not guaranteed. Monthly payments may or may not include property taxes and insurance. Taxes, insurance, and HOA fees vary by property. Please verify all payment details and what's included with the seller.
                    </p>
                  </div>

                  {/* More Info Button - Large and Prominent */}
                  <div className="text-center pt-2">
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(`${property.address} ${property.city}, ${property.state} ${property.zipCode}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full block bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-4 px-6 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      <div className="flex items-center justify-center gap-3">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span>Search Property Online</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </div>
                    </a>
                  </div>
                </div>
              )}

              {/* Swipe Instructions - Enhanced */}
              {!showDetails && (
                <div className="text-center mt-3">
                  <div className="inline-flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full">
                    <svg className="w-5 h-5 text-slate-600 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                    </svg>
                    <span className="text-slate-700 font-bold text-sm">Swipe up for full details</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
