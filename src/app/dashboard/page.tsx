'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ExtendedSession, isExtendedSession } from '@/types/session';
import Tutorial from '@/components/dashboard/Tutorial';
import { PropertyListingSwiper } from '@/components/ui/PropertySwiper';

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
  const [showTutorial, setShowTutorial] = useState(false);

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

  // Handler for liking a property (converted to PropertyListing format)
  const handleLikeProperty = async (property: Property) => {
    await toggleLike(property.id);
  };

  // Handler for passing a property (no action needed for buyer dashboard)
  const handlePassProperty = (property: Property) => {
    // Just move to next property - no server call needed
  };

  return (
    <div className="h-screen overflow-hidden relative fixed inset-0">
      {/* Tutorial Overlay */}
      <Tutorial
        isVisible={showTutorial}
        onComplete={() => setShowTutorial(false)}
      />

      {/* Top Navigation - Fixed Above PropertySwiper */}
      <div className="fixed top-0 left-0 right-0 z-50 p-4 flex items-center justify-between bg-gradient-to-b from-slate-900/80 to-transparent backdrop-blur-sm">
        <button
          onClick={() => router.push('/')}
          className="w-10 h-10 bg-slate-800/80 backdrop-blur-md hover:bg-slate-700 rounded-full flex items-center justify-center transition-all shadow-lg"
        >
          <span className="text-white text-xl">✕</span>
        </button>

        <div className="text-center">
          <h1 className="text-xl font-bold text-white drop-shadow-lg">{profile?.city}</h1>
        </div>

        <div className="flex gap-2">
          <Link href="/dashboard/liked" className="w-10 h-10 bg-slate-800/80 backdrop-blur-md hover:bg-slate-700 rounded-full flex items-center justify-center relative transition-all shadow-lg">
            <span className="text-white">❤️</span>
            {likedProperties.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {likedProperties.length}
              </span>
            )}
          </Link>
          <Link href="/dashboard/settings" className="w-10 h-10 bg-slate-800/80 backdrop-blur-md hover:bg-slate-700 rounded-full flex items-center justify-center transition-all shadow-lg">
            <span className="text-white">⚙️</span>
          </Link>
          <button
            onClick={() => setShowTutorial(true)}
            className="w-10 h-10 bg-slate-800/80 backdrop-blur-md hover:bg-slate-700 rounded-full flex items-center justify-center transition-all shadow-lg"
            title="Show Tutorial"
          >
            <span className="text-white">❓</span>
          </button>
        </div>
      </div>

      {/* PropertyListingSwiper Component */}
      <PropertyListingSwiper
        properties={properties}
        onLike={handleLikeProperty}
        onPass={handlePassProperty}
        favorites={likedProperties}
        passedIds={[]}
        isLoading={loading}
      />
    </div>
  );
}