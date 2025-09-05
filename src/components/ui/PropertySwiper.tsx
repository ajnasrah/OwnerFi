'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from './Button';

import { Property } from '@/lib/mock-data';

interface PropertySwiperProps {
  properties: Property[];
  onLike: (property: Property) => void;
  onPass: (property: Property) => void;
  onFavorite: (property: Property) => void;
  favorites: string[];
}

export function PropertySwiper({ properties, onLike, onPass, onFavorite, favorites }: PropertySwiperProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [buttonPressed, setButtonPressed] = useState<'like' | 'pass' | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Filter out rejected properties
  const rejectedIds = JSON.parse(localStorage.getItem('rejectedProperties') || '[]');
  const visibleProperties = properties.filter(property => !rejectedIds.includes(property.id));

  // Realistic house photos for different property types
  const getHousePhoto = (property: Property) => {
    const photos = [
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=500&h=400&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1593696140826-c58b021acf8b?w=500&h=400&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=500&h=400&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=500&h=400&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=500&h=400&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1605146769289-440113cc3d00?w=500&h=400&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=500&h=400&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1571939228382-b2f2b585ce15?w=500&h=400&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=500&h=400&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500&h=400&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=500&h=400&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=500&h=400&fit=crop&crop=center',
    ];
    
    // Use property ID to consistently select the same photo for the same property
    const photoIndex = parseInt(property.id.slice(-2), 16) % photos.length;
    return photos[photoIndex];
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const currentProperty = visibleProperties[currentIndex];
  const hasNext = currentIndex < visibleProperties.length - 1;

  const handleSwipe = (direction: 'like' | 'pass' | 'next') => {
    if (!currentProperty || isTransitioning) return;

    setButtonPressed(direction);
    setIsTransitioning(true);

    if (direction === 'like') {
      onLike(currentProperty);
    } else if (direction === 'pass') {
      onPass(currentProperty);
    }

    // Always go to next property, loop back to start when reaching end
    setTimeout(() => {
      setCurrentIndex(hasNext ? currentIndex + 1 : 0);
      setButtonPressed(null);
      setIsTransitioning(false);
    }, 200);
  };

  const handleNextProperty = () => {
    handleSwipe('next');
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartPos({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    
    setDragOffset({
      x: currentX - startPos.x,
      y: currentY - startPos.y
    });
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    
    const threshold = 80;
    
    // Gallery-style swiping: left = next, right = previous
    if (Math.abs(dragOffset.x) > threshold) {
      if (dragOffset.x < 0) {
        // Swiped left - go to next property
        console.log('Swiped left - next property');
        setCurrentIndex(hasNext ? currentIndex + 1 : 0);
      } else {
        // Swiped right - go to previous property  
        console.log('Swiped right - previous property');
        setCurrentIndex(currentIndex > 0 ? currentIndex - 1 : visibleProperties.length - 1);
      }
    }
    
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
  };

  if (!currentProperty || visibleProperties.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">🏠</div>
          <h2 className="text-2xl font-semibold text-primary-text mb-2">
            No Properties Found
          </h2>
          <p className="text-secondary-text mb-6">
            No properties match your search criteria. Try adjusting your preferences.
          </p>
          <Button variant="primary" href="/dashboard/settings">
            Update Preferences
          </Button>
        </div>
      </div>
    );
  }

  const cardStyle = {
    transform: isDragging ? `translateX(${dragOffset.x}px)` : 'translateX(0)',
    transition: isDragging ? 'none' : 'transform 0.3s ease-out',
  };

  const overlayOpacity = Math.min(Math.abs(dragOffset.x) / 150, 0.8);

  return (
    <div className="flex-1 relative overflow-hidden">
      {/* Swipe indicators */}
      <div className="absolute top-4 left-4 right-4 z-20 flex justify-between pointer-events-none">
        <div 
          className="px-4 py-2 bg-red-500 text-white rounded-full font-medium text-sm transition-opacity duration-200"
          style={{ opacity: dragOffset.x < -50 ? overlayOpacity : 0 }}
        >
          PASS
        </div>
        <div 
          className="px-4 py-2 bg-green-500 text-white rounded-full font-medium text-sm transition-opacity duration-200"
          style={{ opacity: dragOffset.x > 50 ? overlayOpacity : 0 }}
        >
          LIKE
        </div>
      </div>

      {/* Property card */}
      <div className="h-full p-4">
        <div
          ref={cardRef}
          className="h-full bg-white rounded-3xl shadow-xl overflow-hidden relative border border-gray-100"
          style={cardStyle}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Property image - always show something */}
          <div className="h-1/2 relative overflow-hidden">
            <img 
              src={currentProperty.imageUrl || getHousePhoto(currentProperty)}
              alt=""
              className="w-full h-full object-cover"
              loading="eager"
            />
            
            {/* Photo overlay for readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"></div>
            
            {/* Clean financial overlay */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-20">
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-lg text-center">
                <div className="text-xs font-medium text-gray-600">Down Payment (est)</div>
                <div className="text-xl font-bold text-gray-900">
                  {formatCurrency(currentProperty.downPaymentAmount)}
                </div>
              </div>
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-lg text-center">
                <div className="text-xs font-medium text-gray-600">Monthly (est)</div>
                <div className="text-xl font-bold text-gray-900">
                  {formatCurrency(currentProperty.monthlyPayment)}
                </div>
              </div>
            </div>

            {/* Owner Finance Badge */}
            <div className="absolute bottom-4 left-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
              🏠 Owner Finance
            </div>
            
          </div>

          {/* Property details */}
          <div className="h-1/2 p-6 flex flex-col">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-primary-text mb-1 text-center">
                {currentProperty.address}
              </h2>
              <p className="text-secondary-text text-sm mb-4 text-center">
                {currentProperty.city}, {currentProperty.state} {currentProperty.zipCode}
              </p>

              {/* Property specs */}
              <div className="flex justify-between items-center mb-4 text-sm text-secondary-text bg-accent-light rounded-lg p-3">
                <span className="flex items-center">
                  <span className="text-lg mr-1">🛏️</span>
                  {currentProperty.bedrooms}
                </span>
                <span className="flex items-center">
                  <span className="text-lg mr-1">🛁</span>
                  {currentProperty.bathrooms}
                </span>
                <span className="flex items-center">
                  <span className="text-lg mr-1">📐</span>
                  {currentProperty.squareFeet.toLocaleString()} sqft
                </span>
              </div>

              {/* Financing Details */}
              <div className="bg-primary-bg rounded-lg p-4 mb-4">
                <div className="text-center mb-3">
                  <div className="text-lg font-semibold text-primary-text">
                    {formatCurrency(currentProperty.listPrice)} <span className="text-sm text-secondary-text">(est)</span>
                  </div>
                  <div className="text-sm text-secondary-text">
                    {currentProperty.interestRate}% APR (est) • {currentProperty.termYears} years (est)
                  </div>
                </div>
                
                {/* Big prominent numbers with navigation */}
                <div className="flex items-center justify-between space-x-4">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentIndex(currentIndex > 0 ? currentIndex - 1 : visibleProperties.length - 1);
                    }}
                    className="w-12 h-12 bg-gray-700 hover:bg-gray-800 rounded-full shadow-lg flex items-center justify-center text-white transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <div className="flex-1 space-y-3">
                    <div className="text-center bg-blue-50 rounded-lg p-3">
                      <div className="text-sm text-blue-600 font-medium">Monthly Payment (est)</div>
                      <div className="text-2xl font-bold text-blue-700">
                        {formatCurrency(currentProperty.monthlyPayment)}
                      </div>
                    </div>
                    <div className="text-center bg-orange-50 rounded-lg p-3">
                      <div className="text-sm text-orange-600 font-medium">Down Payment (est)</div>
                      <div className="text-2xl font-bold text-orange-700">
                        {formatCurrency(currentProperty.downPaymentAmount)}
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentIndex(hasNext ? currentIndex + 1 : 0);
                    }}
                    className="w-12 h-12 bg-gray-700 hover:bg-gray-800 rounded-full shadow-lg flex items-center justify-center text-white transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Description */}
              {currentProperty.description && (
                <p className="text-sm text-secondary-text leading-relaxed mb-4 text-center">
                  {currentProperty.description}
                </p>
              )}
            </div>

            {/* Navigation instruction - prominent */}
            <div className="text-center mb-4 bg-blue-50 rounded-lg p-3 border border-blue-100">
              <p className="text-sm font-semibold text-blue-700">👈 Swipe right and left to see your properties 👉</p>
            </div>
            
            {/* Action buttons side by side */}
            <div className="flex items-center justify-center space-x-12">
              <div className="text-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSwipe('pass');
                  }}
                  className="w-12 h-12 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center text-xl transition-colors mb-2"
                  disabled={isTransitioning}
                >
                  ❌
                </button>
                <p className="text-xs text-gray-500">Don't like</p>
              </div>
              
              <div className="text-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFavorite(currentProperty);
                  }}
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 mb-2 ${
                    favorites.includes(currentProperty.id)
                      ? 'bg-green-500 text-white shadow-lg scale-105'
                      : 'bg-green-100 hover:bg-green-200 text-green-600'
                  }`}
                  disabled={isTransitioning}
                >
                  {favorites.includes(currentProperty.id) ? (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-2xl">❤️</span>
                  )}
                </button>
                <p className="text-xs text-gray-500">
                  {favorites.includes(currentProperty.id) ? 'Saved!' : 'Like'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stack indicator */}
      <div className="absolute bottom-8 right-8 bg-surface-bg rounded-lg px-3 py-2 shadow-soft">
        <span className="text-sm text-secondary-text">
          {currentIndex + 1} of {properties.length}
        </span>
      </div>
    </div>
  );
}