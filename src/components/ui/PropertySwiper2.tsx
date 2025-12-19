'use client';

import React, { useState, useRef, useEffect, memo, useMemo } from 'react';
import Link from 'next/link';
import { PropertyListing } from '@/lib/property-schema';
import { PropertyCard } from './PropertyCard';

interface PropertySwiper2Props {
  properties: PropertyListing[];
  onLike: (property: PropertyListing) => void;
  onPass: (property: PropertyListing) => void;
  favorites: string[];
  passedIds?: string[];
  isLoading?: boolean;
}

// Wrapped in React.memo to prevent unnecessary re-renders when parent state changes
export const PropertySwiper2 = memo(function PropertySwiper2({
  properties,
  onLike,
  onPass,
  favorites,
  passedIds = [],
  isLoading = false
}: PropertySwiper2Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [showAction, setShowAction] = useState<'like' | 'pass' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // PERF: Convert passedIds to Set for O(1) lookup instead of O(n) includes()
  const passedIdsSet = useMemo(() => new Set(passedIds), [passedIds]);

  // PERF: Memoize filtered properties - was O(n*m), now O(n)
  const visibleProperties = useMemo(
    () => properties.filter(p => !passedIdsSet.has(p.id)),
    [properties, passedIdsSet]
  );
  const currentProperty = visibleProperties[currentIndex];

  // Reset state when index changes
  useEffect(() => {
    setDragOffset({ x: 0, y: 0 });
    setAnimating(false);
  }, [currentIndex]);

  // Handle touch/mouse start
  const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (animating) return;

    const point = 'touches' in e ? e.touches[0] : e;
    setDragStart({ x: point.clientX, y: point.clientY });
    setIsDragging(true);
  };

  // Handle touch/mouse move
  const handleMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!dragStart || !isDragging || animating) return;

    const point = 'touches' in e ? e.touches[0] : e;
    const deltaX = point.clientX - dragStart.x;
    const deltaY = point.clientY - dragStart.y;

    setDragOffset({ x: deltaX, y: deltaY });

    // Show action indicator based on drag direction
    if (Math.abs(deltaX) > 50) {
      setShowAction(deltaX > 0 ? 'like' : 'pass');
    } else {
      setShowAction(null);
    }
  };

  // Handle touch/mouse end - Navigation only, no auto-like/pass
  const handleEnd = () => {
    if (!isDragging || animating) return;

    setIsDragging(false);

    const threshold = 100; // Swipe threshold for navigation
    const absX = Math.abs(dragOffset.x);

    if (absX > threshold && currentProperty) {
      // Swipe detected - just navigate, don't like/pass
      setAnimating(true);

      if (dragOffset.x > 0) {
        // Swiped right - Go to next property
        goToNext();
      } else {
        // Swiped left - Go to previous property
        goToPrevious();
      }

      setTimeout(() => {
        setAnimating(false);
        setDragOffset({ x: 0, y: 0 });
        setShowAction(null);
      }, 200);
    } else {
      // Not enough swipe - reset
      setDragOffset({ x: 0, y: 0 });
      setShowAction(null);
    }

    setDragStart(null);
  };

  // Navigation helpers
  const goToNext = () => {
    if (currentIndex < visibleProperties.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0); // Loop to first
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else {
      setCurrentIndex(visibleProperties.length - 1); // Loop to last
    }
  };

  // Animate card off screen - Faster animation
  const animateCard = (action: 'like' | 'pass') => {
    const direction = action === 'like' ? 1 : -1;
    const finalX = direction * window.innerWidth * 1.2;

    setDragOffset({ x: finalX, y: -50 }); // Add slight upward movement
    setShowAction(action);

    setTimeout(() => {
      // Move to next card
      goToNext();

      setAnimating(false);
      setDragOffset({ x: 0, y: 0 });
      setShowAction(null);
    }, 200); // Faster animation
  };

  // Button handlers - Like/Pass and advance
  const handleLikeButton = () => {
    if (animating || !currentProperty) return;
    setAnimating(true);

    // Call the like callback
    onLike(currentProperty);

    // Animate and advance
    animateCard('like');
  };

  const handlePassButton = () => {
    if (animating || !currentProperty) return;
    setAnimating(true);

    // Call the pass callback
    onPass(currentProperty);

    // Animate and advance
    animateCard('pass');
  };

  // Calculate card transform - Optimized for 60fps
  const getCardStyle = (isCurrentCard: boolean): React.CSSProperties => {
    if (!isCurrentCard) {
      return {
        transform: 'scale(0.95) translateY(20px) translateZ(0)',
        opacity: 0.8,
        zIndex: 1,
        pointerEvents: 'none' as const,
      };
    }

    const rotation = dragOffset.x / 20;
    const scale = isDragging ? 0.98 : 1;

    return {
      transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${rotation}deg) scale(${scale})`,
      transition: isDragging || animating ? 'none' : 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      opacity: 1,
      zIndex: 10,
      willChange: isDragging || animating ? 'transform' : 'auto',
      backfaceVisibility: 'hidden' as const,
      WebkitBackfaceVisibility: 'hidden' as const,
      WebkitTransform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${rotation}deg) scale(${scale})`,
    };
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="fixed top-14 left-0 right-0 bottom-0 bg-slate-900 flex items-center justify-center p-6 z-50">
        <div className="text-center max-w-sm">
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto mb-4 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-2xl animate-pulse"></div>
              <div className="absolute inset-2 bg-slate-900 rounded-xl flex items-center justify-center">
                <span className="text-3xl">🏠</span>
              </div>
            </div>
            <div className="flex justify-center">
              <div className="w-16 h-16 border-4 border-slate-700 border-t-emerald-400 rounded-full animate-spin"></div>
            </div>
          </div>
          <h2 className="text-2xl font-black text-white mb-3 animate-pulse">
            FINDING YOUR DREAM HOME
          </h2>
          <p className="text-slate-400 text-lg">
            Scanning thousands of owner-financed properties...
          </p>
        </div>
      </div>
    );
  }

  // No properties state
  if (!currentProperty || visibleProperties.length === 0) {
    return (
      <div className="fixed top-14 left-0 right-0 bottom-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6 z-50">
        <div className="text-center max-w-md">
          <div className="text-7xl mb-6 animate-bounce">🔍</div>
          <h2 className="text-3xl font-black text-white mb-4">
            ALL CAUGHT UP!
          </h2>
          <p className="text-slate-300 text-lg mb-8 leading-relaxed">
            You&apos;ve viewed all available properties. Check back soon for new listings, or adjust your search criteria.
          </p>
          <Link
            href="/dashboard/settings"
            className="inline-block bg-gradient-to-r from-emerald-500 to-blue-500 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all"
          >
            Adjust Search Settings
          </Link>
        </div>
      </div>
    );
  }

  const isFavorited = favorites.includes(currentProperty.id);

  return (
    <div
      ref={containerRef}
      className="fixed top-14 left-0 right-0 bottom-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-emerald-950 overflow-hidden z-40"
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      style={{ width: '100vw', maxWidth: '100vw', overflowX: 'hidden' }}
    >
      {/* Cards Stack */}
      <div className="absolute top-1 left-1 right-1 bottom-24 sm:top-2 sm:left-2 sm:right-2 flex items-center justify-center" style={{ maxWidth: '100%' }}>
        {/* Next Card (Behind) - hidden to avoid overlap */}

        {/* Current Card - priority load image */}
        <div className="absolute w-[calc(100%-1rem)] sm:w-full max-w-[min(28rem,calc(100vw-2rem))] h-full">
          <PropertyCard
            property={currentProperty}
            onLike={handleLikeButton}
            onPass={handlePassButton}
            isFavorited={isFavorited}
            style={getCardStyle(true)}
            isPriority={true}
          />
        </div>

      </div>

      {/* Bottom Action Buttons - Compact Layout */}
      <div className="absolute bottom-4 left-0 right-0 z-overlay px-3">
        <div className="max-w-md mx-auto flex items-center justify-center gap-4">
          {/* Pass Button */}
          <button
            onClick={handlePassButton}
            disabled={animating}
            className="w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-slate-600 disabled:to-slate-700 text-white rounded-full shadow-xl flex items-center justify-center transform hover:scale-110 active:scale-95 transition-all disabled:opacity-50"
            aria-label="Pass"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Property Counter */}
          <div className="px-4 py-2 bg-white/90 backdrop-blur-lg rounded-full shadow-lg">
            <span className="text-slate-600 font-bold text-xs">
              {currentIndex + 1} / {visibleProperties.length}
            </span>
          </div>

          {/* Like Button */}
          <button
            onClick={handleLikeButton}
            disabled={animating}
            className={`w-14 h-14 ${
              isFavorited
                ? 'bg-gradient-to-br from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700'
                : 'bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700'
            } disabled:from-slate-600 disabled:to-slate-700 text-white rounded-full shadow-xl flex items-center justify-center transform hover:scale-110 active:scale-95 transition-all disabled:opacity-50`}
            aria-label="Like"
          >
            <svg className="w-6 h-6" fill={isFavorited ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isFavorited ? 0 : 2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        </div>
      </div>

    </div>
  );
});

// Display name for React DevTools debugging
PropertySwiper2.displayName = 'PropertySwiper2';
