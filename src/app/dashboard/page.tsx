'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ExtendedSession, isExtendedSession } from '@/types/session';
import Tutorial from '@/components/dashboard/Tutorial';

interface BuyerProfile {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  state?: string;
  maxMonthlyPayment: number;
  maxDownPayment: number;
}

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode?: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number;
  listPrice?: number;
  monthlyPayment?: number;
  downPaymentAmount?: number;
  balloonPayment?: number;
  balloonYears?: number;
  interestRate?: number;
  termYears?: number;
  imageUrls?: string[];
  zillowImageUrl?: string;
  imageUrl?: string;
  displayTag?: string;
  matchReason?: string;
  resultType?: 'direct' | 'nearby' | 'liked';
  isLiked?: boolean;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [profile, setProfile] = useState<BuyerProfile | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedProperties, setLikedProperties] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  
  // Swipe state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const lastMoveTime = useRef(0);

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    } else if (status === 'authenticated' && isExtendedSession(session as unknown as ExtendedSession) && (session as unknown as ExtendedSession)?.user?.role !== 'buyer') {
      router.push('/');
    }
  }, [status, session, router]);

  // Cleanup body styles when component unmounts
  useEffect(() => {
    return () => {
      // Reset body styles when leaving dashboard
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, []);

  // Load data
  useEffect(() => {
    if (status === 'authenticated' && isExtendedSession(session as unknown as ExtendedSession) && (session as unknown as ExtendedSession)?.user?.role === 'buyer') {
      loadData();
    }
  }, [status, session]);

  const loadData = async () => {
    try {
      setLoading(true);

      const profileRes = await fetch('/api/buyer/profile');
      const profileData = await profileRes.json();

      if (!profileData.profile) {
        router.push('/dashboard/setup');
        return;
      }

      setProfile(profileData.profile);
      setLikedProperties(profileData.profile.likedProperties || []);

      const propertiesRes = await fetch(
        `/api/buyer/properties?city=${encodeURIComponent(profileData.profile.city)}&state=${encodeURIComponent(profileData.profile.state || 'TX')}&maxMonthlyPayment=${profileData.profile.maxMonthlyPayment}&maxDownPayment=${profileData.profile.maxDownPayment}`
      );
      const propertiesData = await propertiesRes.json();

      setProperties(propertiesData.properties || []);

      // Check if tutorial should be shown
      const tutorialCompleted = localStorage.getItem('buyerTutorialCompleted');
      const isNewAccount = localStorage.getItem('isNewBuyerAccount');

      // Show tutorial for new accounts or if never completed
      if ((isNewAccount === 'true' || !tutorialCompleted) && propertiesData.properties?.length > 0) {
        setShowTutorial(true);
        // Clear the new account flag once tutorial is shown
        localStorage.removeItem('isNewBuyerAccount');
      }
    } catch {
      // Error loading properties
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async (propertyId: string) => {
    try {
      const isLiked = likedProperties.includes(propertyId);
      const action = isLiked ? 'unlike' : 'like';

      const response = await fetch('/api/buyer/like-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, action })
      });

      if (response.ok) {
        if (isLiked) {
          setLikedProperties(prev => prev.filter(id => id !== propertyId));
        } else {
          setLikedProperties(prev => [...prev, propertyId]);
        }
      }
    } catch {
      // Error updating like status
    }
  };

  const nextProperty = () => {
    if (properties.length > 1) {
      setCurrentIndex(prev => (prev + 1) % properties.length);
    }
  };

  const previousProperty = () => {
    if (properties.length > 1) {
      setCurrentIndex(prev => (prev - 1 + properties.length) % properties.length);
    }
  };

  // Touch event handlers for Tinder-style swiping
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startPos.current = { x: touch.clientX, y: touch.clientY };
    lastMoveTime.current = Date.now();
    setIsDragging(true);
    setSwipeDirection(null);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - startPos.current.x;
    const deltaY = touch.clientY - startPos.current.y;
    const now = Date.now();
    
    // Calculate velocity
    if (now - lastMoveTime.current > 0) {
      velocity.current.x = deltaX / (now - lastMoveTime.current);
    }
    
    setDragOffset({ x: deltaX, y: deltaY });
    
    // Determine swipe direction for visual feedback
    if (Math.abs(deltaX) > 20) {
      setSwipeDirection(deltaX > 0 ? 'right' : 'left');
    }
    
    lastMoveTime.current = now;
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;

    const { x } = dragOffset;
    const swipeThreshold = 100;
    const velocityThreshold = 0.5;

    // Determine if swipe was successful
    const shouldSwipe = Math.abs(x) > swipeThreshold || Math.abs(velocity.current.x) > velocityThreshold;

    if (shouldSwipe) {
      // Animate card flying off screen
      const direction = x > 0 ? 1 : -1;
      const targetX = direction * window.innerWidth;
      const targetRotation = direction * 30;

      if (cardRef.current) {
        cardRef.current.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        cardRef.current.style.transform = `translate3d(${targetX}px, -100px, 0) rotate(${targetRotation}deg) scale(0.8)`;
        cardRef.current.style.opacity = '0';
      }

      // Wait for animation, then navigate
      setTimeout(() => {
        if (x > 0) {
          // Swipe right - go to next property
          nextProperty();
        } else {
          // Swipe left - go back to previous property
          previousProperty();
        }

        // Reset card position for next property
        if (cardRef.current) {
          cardRef.current.style.transition = 'none';
          cardRef.current.style.transform = 'translate3d(0, 0, 0)';
          cardRef.current.style.opacity = '1';
        }
      }, 300);
    }

    // Reset state
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    setSwipeDirection(null);
  }, [isDragging, dragOffset, currentIndex, properties, nextProperty, previousProperty, toggleLike]);

  if (loading) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center p-4 overflow-hidden fixed inset-0">
          <div className="text-center max-w-sm w-full">
            {/* Animated Logo/Icon */}
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto mb-3 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-2xl animate-pulse"></div>
                <div className="absolute inset-2 bg-slate-900 rounded-xl flex items-center justify-center">
                  <span className="text-xl font-black text-emerald-400">🏠</span>
                </div>
              </div>

              {/* Animated Spinner */}
              <div className="flex justify-center mb-3">
                <div className="w-12 h-12 border-4 border-slate-700 border-t-emerald-400 rounded-full animate-spin"></div>
              </div>
            </div>

            {/* Main Status */}
            <h1 className="text-2xl font-black text-white mb-2 animate-pulse">
              SCANNING PROPERTIES
            </h1>
            <p className="text-slate-400 text-lg mb-4">
              Finding owner-financed homes in your area...
            </p>

            {/* Live Statistics */}
            <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-3 border border-slate-700/50 mb-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Properties Analyzed */}
                <div className="text-center">
                  <div className="text-xl font-black text-emerald-400 mb-1 animate-pulse">
                    1,247
                  </div>
                  <div className="text-sm text-slate-400 font-semibold">LISTINGS SCANNED</div>
                </div>

                {/* Owner Financed Found */}
                <div className="text-center">
                  <div className="text-xl font-black text-blue-400 mb-1 animate-pulse">
                    89
                  </div>
                  <div className="text-sm text-slate-400 font-semibold">OWNER FINANCED FOUND</div>
                </div>

                {/* Budget Matches */}
                <div className="text-center">
                  <div className="text-xl font-black text-purple-400 mb-1 animate-pulse">
                    23
                  </div>
                  <div className="text-sm text-slate-400 font-semibold">IN YOUR BUDGET</div>
                </div>

                {/* Perfect Matches */}
                <div className="text-center">
                  <div className="text-xl font-black text-yellow-400 mb-1 animate-pulse">
                    7
                  </div>
                  <div className="text-sm text-slate-400 font-semibold">PERFECT FOR YOU</div>
                </div>
              </div>
            </div>

            {/* Loading Progress Bar */}
            <div className="bg-slate-700/50 rounded-full h-2 mb-3 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-blue-500 animate-pulse w-4/5"></div>
            </div>

            {/* Status Messages */}
            <div className="text-slate-400 text-sm animate-pulse space-y-1">
              <div>✓ Analyzing property listings</div>
              <div>✓ Checking owner financing terms</div>
              <div>✓ Matching with your budget</div>
              <div className="text-emerald-400">⧗ Preparing your personalized matches...</div>
            </div>
          </div>
        </div>
    );
  }

  if (!properties.length) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="text-4xl mb-4">🏠</div>
          <h2 className="text-xl font-bold text-white mb-4">NO HOMES FOUND</h2>
          <p className="text-slate-300 mb-6 text-base">
            No properties in <span className="text-emerald-400">{profile?.city}</span> match your criteria.
          </p>
          <Link 
            href="/dashboard/settings" 
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold"
          >
            ADJUST SEARCH
          </Link>
        </div>
      </div>
    );
  }

  const currentProperty = properties[currentIndex];

  return (
    <div className="h-screen bg-black text-white overflow-hidden relative fixed inset-0 supports-[height:100dvh]:h-[100dvh]">
      {/* Tutorial Overlay */}
      <Tutorial
        isVisible={showTutorial}
        onComplete={() => setShowTutorial(false)}
      />

      {/* Top Navigation - Minimal */}
      <div className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between">
        <button 
          onClick={() => router.push('/')}
          className="w-10 h-10 bg-black/20 backdrop-blur-sm rounded-full flex items-center justify-center"
        >
          <span className="text-white text-xl">✕</span>
        </button>
        
        <div className="text-center">
          <h1 className="text-xl font-bold text-white">{profile?.city}</h1>
        </div>

        <div className="flex gap-2">
          <Link href="/dashboard/liked" className="w-10 h-10 bg-black/20 backdrop-blur-sm rounded-full flex items-center justify-center relative">
            <span className="text-white">❤️</span>
            {likedProperties.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {likedProperties.length}
              </span>
            )}
          </Link>
          <Link href="/dashboard/settings" className="w-10 h-10 bg-black/20 backdrop-blur-sm rounded-full flex items-center justify-center">
            <span className="text-white">⚙️</span>
          </Link>
          <button
            onClick={() => setShowTutorial(true)}
            className="w-10 h-10 bg-black/20 backdrop-blur-sm rounded-full flex items-center justify-center"
            title="Show Tutorial"
          >
            <span className="text-white">❓</span>
          </button>
        </div>
      </div>

      {/* Full Screen Property Card */}
      <div className="absolute inset-0">
        {/* Card Stack Effect - Behind Main Card */}
        {currentIndex < properties.length - 1 && (
          <div className="absolute top-16 bottom-20 left-2 right-2 bg-slate-800 rounded-3xl transform rotate-2 scale-95 z-10"></div>
        )}
        {currentIndex < properties.length - 2 && (
          <div className="absolute top-16 bottom-20 left-3 right-3 bg-slate-700 rounded-3xl transform -rotate-1 scale-90 z-5"></div>
        )}
        
        {/* Main Property Card */}
        <div
          ref={cardRef}
          className="absolute top-16 bottom-24 left-1 right-1 bg-white rounded-3xl overflow-hidden shadow-2xl z-20 transform-gpu select-none"
          style={{
            transform: isDragging 
              ? `translate3d(${dragOffset.x}px, ${dragOffset.y * 0.1}px, 0) rotate(${dragOffset.x * 0.1}deg)` 
              : 'translate3d(0, 0, 0)',
            transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            opacity: isDragging ? Math.max(0.3, 1 - Math.abs(dragOffset.x) / 300) : 1
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Swipe Overlay */}
          {isDragging && swipeDirection && (
            <div className={`absolute inset-0 flex items-center justify-center z-30 ${
              swipeDirection === 'right' ? 'bg-green-500/20' : 'bg-blue-500/20'
            }`}>
              <div className={`text-9xl ${
                swipeDirection === 'right' ? 'text-green-400' : 'text-blue-400'
              }`}>
                {swipeDirection === 'right' ? '→' : '←'}
              </div>
            </div>
          )}
          
          {/* Full Screen Property Image */}
          <div className="relative h-full">
            <img
              src={
                currentProperty.imageUrl ||
                currentProperty.imageUrls?.[0] ||
                currentProperty.zillowImageUrl ||
                '/placeholder-house.jpg'
              }
              alt={currentProperty.address}
              className="w-full h-full object-cover"
              draggable={false}
            />

            {/* Strong Dark Gradient Overlay for Better Text Readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>

            {/* Property Tags */}
            {currentProperty.displayTag && (
              <div className="absolute top-20 right-4 bg-emerald-500 text-white px-4 py-2 rounded-full text-base font-bold shadow-2xl border-2 border-white/20">
                {currentProperty.displayTag}
              </div>
            )}

            {/* Property Info Card - Frosted Glass Effect */}
            <div className="absolute bottom-24 left-4 right-4">
              {/* Frosted Glass Background Card */}
              <div className="bg-black/70 backdrop-blur-xl rounded-3xl p-5 shadow-2xl border border-white/10">
                {/* Address */}
                <h2 className="text-2xl font-black text-white mb-1 leading-tight drop-shadow-lg">
                  {currentProperty.address}
                </h2>
                <p className="text-white/90 text-lg font-semibold mb-4 drop-shadow">
                  {currentProperty.city}, {currentProperty.state} {currentProperty.zipCode || ''}
                </p>

                {/* Property Stats Row */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-white/10 backdrop-blur px-3 py-2 rounded-xl border border-white/20">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-base">🛏️</span>
                      <span className="text-white text-base font-bold">{currentProperty.bedrooms}bd</span>
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur px-3 py-2 rounded-xl border border-white/20">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-base">🛁</span>
                      <span className="text-white text-base font-bold">{currentProperty.bathrooms}ba</span>
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur px-3 py-2 rounded-xl border border-white/20">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-base">📏</span>
                      <span className="text-white text-base font-bold">{currentProperty.squareFeet?.toLocaleString() || '1,140'} sqft</span>
                    </div>
                  </div>
                </div>

                {/* Price Info - Enhanced Visibility */}
                <div className="space-y-3">
                  {/* List Price - Most Prominent */}
                  <div className="bg-gradient-to-r from-white/20 to-white/10 backdrop-blur rounded-2xl p-3 border border-white/30">
                    <div className="flex items-center justify-between">
                      <span className="text-white/80 text-sm font-semibold uppercase tracking-wide">List Price</span>
                      <span className="text-white text-2xl font-black drop-shadow-lg">
                        ${currentProperty.listPrice?.toLocaleString() || '260,000'}
                      </span>
                    </div>
                  </div>

                  {/* Monthly & Down Payment */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-500/30 backdrop-blur rounded-xl p-3 border border-emerald-400/30">
                      <div className="text-emerald-200 text-xs font-semibold uppercase mb-1">Monthly</div>
                      <div className="text-emerald-100 text-lg font-black">
                        ${currentProperty.monthlyPayment ? Math.ceil(currentProperty.monthlyPayment).toLocaleString() : '1,403'}
                      </div>
                    </div>
                    <div className="bg-blue-500/30 backdrop-blur rounded-xl p-3 border border-blue-400/30">
                      <div className="text-blue-200 text-xs font-semibold uppercase mb-1">Down</div>
                      <div className="text-blue-100 text-lg font-black">
                        ${currentProperty.downPaymentAmount?.toLocaleString() || '26,000'}
                      </div>
                    </div>
                  </div>

                  {/* Balloon Payment if exists */}
                  {currentProperty.balloonYears && (
                    <div className="bg-yellow-500/20 backdrop-blur rounded-xl px-3 py-2 border border-yellow-400/30">
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-300 text-base">🎈</span>
                        <span className="text-yellow-100 text-sm font-bold">
                          {currentProperty.balloonYears} year balloon payment
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Payment Disclaimer */}
                  <div className="text-center pt-2">
                    <p className="text-white/50 text-xs font-medium">
                      * Estimate excludes taxes, insurance & HOA fees
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Buttons - Simplified with Safe Area */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pb-safe">
        <div className="flex justify-center items-center gap-8 pb-8">
          {/* Previous Button */}
          <button
            onClick={previousProperty}
            className="w-16 h-16 bg-blue-500 text-white rounded-full flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 shadow-lg shadow-blue-500/30"
          >
            <span className="text-2xl">←</span>
          </button>

          {/* Like Button */}
          <button
            onClick={() => toggleLike(currentProperty.id)}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all transform shadow-lg ${
              likedProperties.includes(currentProperty.id)
                ? 'bg-pink-500 text-white scale-110 shadow-pink-500/30'
                : 'bg-green-500 text-white hover:scale-110 active:scale-95 shadow-green-500/30'
            }`}
          >
            <span className="text-2xl">
              {likedProperties.includes(currentProperty.id) ? '❤️' : '♡'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}