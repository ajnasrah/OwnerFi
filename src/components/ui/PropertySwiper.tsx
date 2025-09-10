'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from './Button';

import { PropertyListing } from '@/lib/property-schema';

interface PropertyListingSwiperProps {
  properties: PropertyListing[];
  onLike: (property: PropertyListing) => void;
  onPass: (property: PropertyListing) => void;
  onFavorite: (property: PropertyListing) => void;
  favorites: string[];
  passedIds?: string[];
  isLoading?: boolean;
}

export function PropertyListingSwiper({ properties, onLike, onPass, onFavorite, favorites, passedIds = [], isLoading = false }: PropertyListingSwiperProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [buttonPressed, setButtonPressed] = useState<'like' | 'pass' | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showToast, setShowToast] = useState<{ type: 'saved' | 'deleted'; show: boolean }>({ type: 'saved', show: false });
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

  // ONLY use database imageUrl (no API calls)
  const getHousePhoto = (property: PropertyListing) => {
    // All properties should have imageUrl saved in database
    return property.imageUrl || '/placeholder-house.jpg'; // Simple fallback
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
            We're On It!
          </h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            We don't have properties matching your criteria at the moment, but we're constantly adding new owner-financed properties to our platform.
          </p>
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <p className="text-blue-800 font-medium">
              💡 We'll notify you as soon as properties become available in your area!
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

  // Disable swipe functionality - just use arrow buttons
  const handleMouseDown = () => {};
  const handleMouseMove = () => {};
  const handleMouseUp = () => {};

  const isFavorited = favorites.includes(currentPropertyListing.id);

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      {/* Mobile-First PropertyListing Card */}
      <div className="flex-1 p-4">
        <div 
          ref={cardRef}
          className="relative w-full h-full bg-white rounded-3xl shadow-lg overflow-hidden"
        >
          {/* PropertyListing Image - Large and Prominent */}
          <div className="relative h-80">
            <img
              src={getHousePhoto(currentPropertyListing)}
              alt={`${currentPropertyListing.address}`}
              className="w-full h-full object-cover"
            />

            {/* PropertyListing Counter */}
            <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-medium">
              {currentIndex + 1} of {visibleProperties.length}
            </div>

            {/* Owner Financing Badge */}
            <div className="absolute bottom-4 left-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
              Owner Finance
            </div>
          </div>

          {/* PropertyListing Navigation Row - Clean and Simple */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setCurrentIndex(prev => prev > 0 ? prev - 1 : visibleProperties.length - 1)}
                className="p-4 bg-blue-100 hover:bg-blue-200 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                disabled={visibleProperties.length <= 1}
              >
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-1">Browsing Properties</div>
                <div className="text-lg font-bold text-gray-800">
                  {currentIndex + 1} of {visibleProperties.length}
                </div>
              </div>
              
              <button 
                onClick={() => setCurrentIndex(prev => prev < visibleProperties.length - 1 ? prev + 1 : 0)}
                className="p-4 bg-blue-100 hover:bg-blue-200 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                disabled={visibleProperties.length <= 1}
              >
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* PropertyListing Details */}
          <div className="p-6 space-y-6">
            {/* Price & Address Section */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="text-sm text-slate-600 mb-1">Asking Price</div>
                  <div className="text-2xl font-bold text-slate-900">
                    ${currentPropertyListing.listPrice?.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-slate-700">{currentPropertyListing.address}</div>
                  <div className="text-base text-slate-600">{currentPropertyListing.city}, {currentPropertyListing.state} {currentPropertyListing.zipCode}</div>
                </div>
              </div>
            </div>

            {/* PropertyListing Features Section */}
            <div className="bg-slate-100 rounded-xl p-4 border border-slate-300">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-slate-800">{currentPropertyListing.bedrooms}</div>
                  <div className="text-base text-slate-600">Bedrooms</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">{currentPropertyListing.bathrooms}</div>
                  <div className="text-base text-slate-600">Bathrooms</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">{currentPropertyListing.squareFeet?.toLocaleString()}</div>
                  <div className="text-base text-slate-600">Sq Ft</div>
                </div>
              </div>
            </div>

            {/* Owner Financing Terms Section */}
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <h3 className="text-xl font-bold text-center text-blue-700 mb-3">💳 Owner Financing Terms</h3>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center border-b border-blue-200 pb-1">
                  <span className="text-base text-blue-700 font-medium">Monthly Payment:</span>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-800">${currentPropertyListing.monthlyPayment?.toLocaleString()}/mo</div>
                    <div className="text-sm text-blue-600">est</div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center border-b border-blue-200 pb-1">
                  <span className="text-base text-blue-700 font-medium">Down Payment:</span>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-800">${currentPropertyListing.downPaymentAmount?.toLocaleString()}</div>
                    <div className="text-sm text-blue-600">est</div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center border-b border-blue-200 pb-1">
                  <span className="text-base text-blue-700 font-medium">Interest Rate:</span>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-800">{currentPropertyListing.interestRate}%</div>
                    <div className="text-sm text-blue-600">est</div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-1">
                  <span className="text-base text-blue-700 font-medium">Term Length:</span>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-800">{currentPropertyListing.termYears} years</div>
                    <div className="text-sm text-blue-600">est</div>
                  </div>
                </div>
              </div>
            </div>

            {/* More Details Link */}
            <div className="text-center mb-4">
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(`${currentPropertyListing.address} ${currentPropertyListing.city}, ${currentPropertyListing.state} ${currentPropertyListing.zipCode}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>More Details</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4">
              <button
                onClick={() => {
                  onPass(currentPropertyListing);
                  setShowToast({ type: 'deleted', show: true });
                  setTimeout(() => setShowToast({ type: 'deleted', show: false }), 2000);
                  handleNextPropertyListing();
                }}
                className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all ${
                  buttonPressed === 'pass' 
                    ? 'bg-red-500 text-white scale-105' 
                    : 'bg-red-100 text-red-700 hover:bg-red-200 active:scale-95'
                }`}
              >
                👎 Pass
              </button>
              <button
                onClick={() => {
                  onLike(currentPropertyListing);
                  setShowToast({ type: 'saved', show: true });
                  setTimeout(() => setShowToast({ type: 'saved', show: false }), 2000);
                  // Don't auto-advance for likes
                }}
                className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all ${
                  buttonPressed === 'like' 
                    ? 'bg-green-500 text-white scale-105' 
                    : 'bg-green-100 text-green-700 hover:bg-green-200 active:scale-95'
                }`}
              >
                👍 Interested
              </button>
            </div>

            {/* Toast Notification */}
            {showToast.show && (
              <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full text-white font-semibold shadow-lg z-50 transition-all ${
                showToast.type === 'saved' 
                  ? 'bg-green-500' 
                  : 'bg-red-500'
              }`}>
                {showToast.type === 'saved' ? '✅ PropertyListing Saved!' : '🗑️ PropertyListing Deleted!'}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}