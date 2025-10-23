'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from './Button';
import Image from 'next/image';

import { PropertyListing } from '@/lib/property-schema';

interface PropertyListingSwiperProps {
  properties: PropertyListing[];
  onLike: (property: PropertyListing) => void;
  onPass: (property: PropertyListing) => void;
  favorites: string[];
  passedIds?: string[];
  isLoading?: boolean;
}

export function PropertyListingSwiper({ properties, onLike, onPass, favorites, passedIds = [], isLoading = false }: PropertyListingSwiperProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showToast, setShowToast] = useState<{ type: 'saved' | 'deleted'; show: boolean }>({ type: 'saved', show: false });
  const [buttonPressed, setButtonPressed] = useState<'like' | 'pass' | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Filter out passed properties
  const visibleProperties = properties.filter(property => !passedIds.includes(property.id));

  // Auto-adjust index if current property was filtered out
  const safeIndex = currentIndex >= visibleProperties.length ?
    Math.max(0, visibleProperties.length - 1) : currentIndex;
  const currentPropertyListing = visibleProperties[safeIndex];

  // Update index if it was adjusted
  useEffect(() => {
    if (currentIndex !== safeIndex) {
      setCurrentIndex(safeIndex);
    }
  }, [safeIndex, currentIndex]);

  // Reset image index when property changes
  useEffect(() => {
    setImageIndex(0);
    setImageLoading(true);
    setImageError(false);
  }, [currentIndex]);

  // Get current image URL
  const getCurrentImage = (): string => {
    const images = currentPropertyListing?.imageUrls || [];
    if (images.length === 0 || imageError) {
      return '/placeholder-house.jpg';
    }
    return images[imageIndex] || images[0] || '/placeholder-house.jpg';
  };

  // Navigate through images
  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    const images = currentPropertyListing?.imageUrls || [];
    if (images.length > 1) {
      setImageIndex((prev) => (prev + 1) % images.length);
      setImageLoading(true);
    }
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    const images = currentPropertyListing?.imageUrls || [];
    if (images.length > 1) {
      setImageIndex((prev) => (prev - 1 + images.length) % images.length);
      setImageLoading(true);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-primary-text mb-2">
            Finding Your Perfect Properties
          </h2>
          <p className="text-secondary-text">
            Searching through thousands of owner-financed homes...
          </p>
        </div>
      </div>
    );
  }

  // No properties message
  if (!currentPropertyListing || visibleProperties.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            We&apos;re On It!
          </h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            We don&apos;t have properties matching your criteria at the moment, but we&apos;re constantly adding new owner-financed properties to our platform.
          </p>
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <p className="text-blue-800 font-medium">
              💡 We&apos;ll notify you as soon as properties become available in your area!
            </p>
          </div>
          <Button variant="primary" href="/dashboard/settings">
            Adjust Search Criteria
          </Button>
        </div>
      </div>
    );
  }

  // Simple next property function
  const handleNextPropertyListing = () => {
    if (currentIndex < visibleProperties.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0); // Loop back to first
    }
  };

  const isFavorited = favorites.includes(currentPropertyListing.id);

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 overflow-hidden fixed inset-0">
      {/* Main Property Card */}
      <div className="w-full max-w-md h-full max-h-[calc(100vh-2rem)] flex flex-col">
        <div
          ref={cardRef}
          className="relative w-full flex-1 bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Property Image Section - Large and Clear */}
          <div className="relative h-[55%] flex-shrink-0 bg-slate-200">
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
              </div>
            )}

            <Image
              src={getCurrentImage()}
              alt={`${currentPropertyListing.address}`}
              fill
              className="object-cover"
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageError(true);
                setImageLoading(false);
              }}
              unoptimized
              priority
            />

            {/* Image Navigation Arrows */}
            {currentPropertyListing?.imageUrls && currentPropertyListing.imageUrls.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-all backdrop-blur-sm z-10"
                  aria-label="Previous image"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-all backdrop-blur-sm z-10"
                  aria-label="Next image"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Image Dots Indicator */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                  {currentPropertyListing.imageUrls.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setImageIndex(idx);
                        setImageLoading(true);
                      }}
                      className={`w-2 h-2 rounded-full transition-all ${
                        idx === imageIndex
                          ? 'bg-white w-6'
                          : 'bg-white/50 hover:bg-white/75'
                      }`}
                      aria-label={`Go to image ${idx + 1}`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Property Counter Badge */}
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
              {currentIndex + 1} of {visibleProperties.length}
            </div>

            {/* Owner Financing Badge */}
            <div className="absolute top-4 right-4 bg-emerald-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
              Owner Finance
            </div>
          </div>

          {/* Property Details Content - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-4">
              {/* Address Section */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 leading-tight">
                  {currentPropertyListing.address}
                </h2>
                <p className="text-slate-600 text-lg mt-1">
                  {currentPropertyListing.city}, {currentPropertyListing.state} {currentPropertyListing.zipCode}
                </p>
              </div>

              {/* Property Stats */}
              <div className="flex gap-3">
                <div className="flex-1 bg-slate-100 rounded-xl p-3 text-center border border-slate-200">
                  <div className="text-2xl font-bold text-slate-900">{currentPropertyListing.bedrooms}</div>
                  <div className="text-sm text-slate-600 font-medium">Beds</div>
                </div>
                <div className="flex-1 bg-slate-100 rounded-xl p-3 text-center border border-slate-200">
                  <div className="text-2xl font-bold text-slate-900">{currentPropertyListing.bathrooms}</div>
                  <div className="text-sm text-slate-600 font-medium">Baths</div>
                </div>
                <div className="flex-1 bg-slate-100 rounded-xl p-3 text-center border border-slate-200">
                  <div className="text-2xl font-bold text-slate-900">{currentPropertyListing.squareFeet?.toLocaleString() || 'N/A'}</div>
                  <div className="text-sm text-slate-600 font-medium">Sq Ft</div>
                </div>
              </div>

              {/* Pricing Section */}
              <div className="space-y-3">
                {/* List Price */}
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-4 border-2 border-slate-200">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">List Price</div>
                  <div className="text-3xl font-black text-slate-900">
                    ${currentPropertyListing.listPrice?.toLocaleString()}
                  </div>
                </div>

                {/* Monthly & Down Payment */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border-2 border-emerald-200">
                    <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Monthly</div>
                    <div className="text-xl font-bold text-emerald-900">
                      ${currentPropertyListing.monthlyPayment?.toLocaleString()}/mo
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-200">
                    <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Down</div>
                    <div className="text-xl font-bold text-blue-900">
                      ${currentPropertyListing.downPaymentAmount?.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Additional Terms */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-600 font-medium">Interest Rate</span>
                    <span className="text-slate-900 font-bold">{currentPropertyListing.interestRate}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 font-medium">Term Length</span>
                    <span className="text-slate-900 font-bold">{currentPropertyListing.termYears} years</span>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <p className="text-xs text-yellow-800 font-medium text-center">
                  ⚠️ Estimates exclude taxes, insurance & HOA fees. Not guaranteed - verify with seller.
                </p>
              </div>

              {/* More Details Link */}
              <div className="text-center">
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(`${currentPropertyListing.address} ${currentPropertyListing.city}, ${currentPropertyListing.state} ${currentPropertyListing.zipCode}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-semibold transition-colors text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>View More Details</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Action Buttons - Fixed at Bottom */}
          <div className="p-4 border-t border-slate-200 bg-white">
            <div className="flex gap-3 mb-3">
              <button
                onClick={() => {
                  setButtonPressed('pass');
                  onPass(currentPropertyListing);
                  setShowToast({ type: 'deleted', show: true });
                  setTimeout(() => {
                    setShowToast({ type: 'deleted', show: false });
                    setButtonPressed(null);
                  }, 1500);
                  handleNextPropertyListing();
                }}
                className={`flex-1 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg ${
                  buttonPressed === 'pass'
                    ? 'bg-red-500 text-white scale-95'
                    : 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 active:scale-95'
                }`}
              >
                <span className="text-2xl">👎</span> Pass
              </button>
              <button
                onClick={() => {
                  setButtonPressed('like');
                  onLike(currentPropertyListing);
                  setShowToast({ type: 'saved', show: true });
                  setTimeout(() => {
                    setShowToast({ type: 'saved', show: false });
                    setButtonPressed(null);
                  }, 1500);
                }}
                className={`flex-1 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg ${
                  buttonPressed === 'like'
                    ? 'bg-green-500 text-white scale-95'
                    : isFavorited
                    ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700 active:scale-95'
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 active:scale-95'
                }`}
              >
                <span className="text-2xl">{isFavorited ? '❤️' : '💚'}</span> {isFavorited ? 'Saved' : 'Like'}
              </button>
            </div>

            {/* Property Navigation */}
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentIndex(prev => prev > 0 ? prev - 1 : visibleProperties.length - 1)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all disabled:opacity-30"
                disabled={visibleProperties.length <= 1}
              >
                ← Previous
              </button>
              <button
                onClick={() => setCurrentIndex(prev => prev < visibleProperties.length - 1 ? prev + 1 : 0)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all disabled:opacity-30"
                disabled={visibleProperties.length <= 1}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {showToast.show && (
        <div className={`fixed top-8 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full text-white font-bold shadow-2xl z-[100] transition-all animate-bounce ${
          showToast.type === 'saved'
            ? 'bg-gradient-to-r from-green-500 to-emerald-600'
            : 'bg-gradient-to-r from-red-500 to-red-600'
        }`}>
          {showToast.type === 'saved' ? '✅ Property Saved!' : '❌ Property Passed'}
        </div>
      )}
    </div>
  );
}